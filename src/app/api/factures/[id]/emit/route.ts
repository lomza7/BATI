import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFacture, emitFacture } from '@/lib/factures/service'
import { validateFacturx } from '@/lib/facturx/validate'
import { generateFacturxXml } from '@/lib/facturx/template'
import { generateFacturePdf } from '@/lib/pdf/facture-pdf'
import { embedFacturxInPdf } from '@/lib/facturx/embed'
import type { ArtisanProfile } from '@/lib/pdf/facture-pdf'
import type { FacturxTvaTotal } from '@/lib/facturx/template'

interface Params { params: { id: string } }

/** Convert ISO date "YYYY-MM-DD" to CII format "YYYYMMDD" */
function toYYYYMMDD(iso: string): string {
  return iso.replace(/-/g, '').substring(0, 8)
}

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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any
    const { data: profile } = await supabaseAny
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (!profile) return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 })

    // Validation bloquante avant émission
    const validation = validateFacturx(facture, profile)
    if (!validation.valid) {
      return NextResponse.json({ error: 'Validation Factur-X échouée', details: validation.errors }, { status: 422 })
    }

    const isAutoEntrepreneur = facture.is_auto_entrepreneur_invoice

    // Construire les lignes pour le XML
    const allLignes = facture.lots.flatMap((lot, lotIdx) =>
      (lot.lignes ?? []).map((l, lineIdx) => {
        const effectiveRate = isAutoEntrepreneur ? 0 : l.tva_rate
        return {
          id: lotIdx * 1000 + lineIdx + 1,
          description: l.description,
          quantity: l.quantity,
          unit_price_ht: l.unit_price_ht,
          total_ht: l.total_ht,
          tva_rate: effectiveRate as 0 | 10 | 20,
        }
      })
    )

    // Calculer la ventilation TVA pour tva_totals
    const tvaMap = new Map<number, { base: number; montant: number }>()
    for (const ligne of allLignes) {
      const rate = ligne.tva_rate
      const existing = tvaMap.get(rate) ?? { base: 0, montant: 0 }
      const montant = parseFloat((ligne.total_ht * rate / 100).toFixed(2))
      tvaMap.set(rate, {
        base: parseFloat((existing.base + ligne.total_ht).toFixed(2)),
        montant: parseFloat((existing.montant + montant).toFixed(2)),
      })
    }

    const tvaTotals: FacturxTvaTotal[] = Array.from(tvaMap.entries()).map(([rate, { base, montant }]) => ({
      rate: rate as 0 | 10 | 20,
      base_ht: base,
      montant_tva: montant,
    }))

    const issueDate = toYYYYMMDD(new Date().toISOString().split('T')[0])
    const dueDate = facture.due_date ? toYYYYMMDD(facture.due_date) : undefined

    const xmlContent = generateFacturxXml({
      invoice_number: facture.reference,
      invoice_type_code: facture.type === 'avoir' ? '381' : '380',
      issue_date: issueDate,
      due_date: dueDate,
      currency_code: 'EUR',
      seller: {
        name: profile.company_name ?? profile.full_name ?? '',
        siret: profile.siret ?? undefined,
        tva_number: profile.tva_number ?? undefined,
        address: profile.address ?? undefined,
        city: profile.city ?? undefined,
        postal_code: profile.postal_code ?? undefined,
        country_code: 'FR',
      },
      buyer: {
        name: facture.client?.company_name ?? facture.client?.name ?? '',
        siret: facture.client?.siret ?? undefined,
        address: facture.client?.billing_address ?? undefined,
        city: facture.client?.billing_city ?? undefined,
        postal_code: facture.client?.billing_postal_code ?? undefined,
        country_code: 'FR',
      },
      lines: allLignes,
      tva_totals: tvaTotals,
      total_ht: facture.total_ht,
      total_tva: facture.total_tva,
      total_ttc: facture.total_ttc,
      note: isAutoEntrepreneur ? 'TVA non applicable, art. 293 B du CGI' : undefined,
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

    await emitFacture(params.id, pdfWithXml, xmlContent)

    return NextResponse.json({ success: true, reference: facture.reference })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
