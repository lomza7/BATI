import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFacture, emitFacture } from '@/lib/factures/service'
import { validateFacturx } from '@/lib/facturx/validate'
import { generateFacturxXml } from '@/lib/facturx/template'
import { generateFacturePdf } from '@/lib/pdf/facture-pdf'
import { embedFacturxInPdf } from '@/lib/facturx/embed'
import type { ArtisanProfile } from '@/lib/pdf/facture-pdf'
import type { FacturxInput } from '@/lib/facturx/template'

interface Params { params: { id: string } }

export async function POST(_req: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  try {
    const facture = await getFacture(params.id)
    if (!facture) return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 })
    if (facture.status !== 'brouillon') {
      return NextResponse.json({ error: 'Facture déjà émise' }, { status: 409 })
    }

    // Récupérer le profil artisan
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any
    const { data: profile } = await supabaseAny
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (!profile) return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 })

    // Validation Factur-X bloquante
    const validation = validateFacturx(facture, profile)
    if (!validation.valid) {
      return NextResponse.json({ error: 'Validation Factur-X échouée', details: validation.errors }, { status: 422 })
    }

    // Générer le XML CII EN16931
    const allLignes = facture.lots.flatMap((lot) =>
      (lot.lignes ?? []).map((l) => ({
        id: l.id,
        description: l.description,
        quantity: l.quantity,
        unit_code: l.unit,
        unit_price_ht: l.unit_price_ht,
        tva_rate: facture.is_auto_entrepreneur_invoice ? 0 : l.tva_rate,
        total_ht: l.total_ht,
      }))
    )

    const seller = {
      name: profile.company_name ?? profile.full_name ?? '',
      siret: profile.siret,
      tva_number: profile.tva_number ?? null,
      address: profile.address,
      city: profile.city,
      postal_code: profile.postal_code,
      country_code: 'FR',
    }

    const buyer = {
      name: facture.client?.company_name ?? facture.client?.name ?? '',
      siret: facture.client?.siret ?? null,
      tva_number: null,
      address: facture.client?.billing_address ?? null,
      city: facture.client?.billing_city ?? null,
      postal_code: facture.client?.billing_postal_code ?? null,
      country_code: 'FR',
    }

    const discountAmount = parseFloat((facture.total_ht * facture.discount_percent / 100).toFixed(2))
    const typeCode: FacturxInput['type_code'] = facture.type === 'avoir' ? '381' : '380'
    const issueDate = new Date().toISOString().split('T')[0]

    const xmlContent = generateFacturxXml({
      type_code: typeCode,
      reference: facture.reference,
      issue_date: issueDate,
      due_date: facture.due_date,
      currency_code: 'EUR',
      seller,
      buyer,
      lines: allLignes,
      total_ht: facture.total_ht,
      total_tva: facture.total_tva,
      total_ttc: facture.total_ttc,
      discount_amount: discountAmount,
      is_auto_entrepreneur: facture.is_auto_entrepreneur_invoice,
      payment_terms: facture.payment_conditions,
      buyer_order_ref: null,
    })

    // Générer le PDF
    const artisanProfile: ArtisanProfile = {
      full_name: profile.full_name,
      company_name: profile.company_name,
      siret: profile.siret,
      tva_number: profile.tva_number ?? null,
      address: profile.address,
      city: profile.city,
      postal_code: profile.postal_code,
      phone: profile.phone,
      email: profile.email,
      insurance_decennale_number: profile.insurance_decennale_number ?? null,
      insurance_decennale_company: profile.insurance_decennale_company ?? null,
      rge_number: profile.rge_number ?? null,
      is_auto_entrepreneur: profile.is_auto_entrepreneur ?? false,
    }

    const pdfBytes = await generateFacturePdf(facture, artisanProfile)
    const pdfWithXml = await embedFacturxInPdf(pdfBytes, xmlContent)

    // Émettre (enregistre en DB + upload Storage)
    await emitFacture(params.id, pdfWithXml, xmlContent)

    return NextResponse.json({ success: true, reference: facture.reference })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
