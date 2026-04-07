import { type NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getInvoice, emitInvoice } from '@/lib/invoices/service'
import { generateFacturePdf, type ArtisanProfile } from '@/lib/pdf/facture-pdf'
import { generateFacturxXml, type FacturxTvaTotal } from '@/lib/facturx/template'
import { embedFacturxInPdf } from '@/lib/facturx/embed'
import { validateFacturx } from '@/lib/facturx/validate'

type Params = { params: Promise<{ id: string }> }

/** Convert ISO date "YYYY-MM-DD" to CII format "YYYYMMDD" */
function toYYYYMMDD(iso: string): string {
  return iso.replace(/-/g, '').substring(0, 8)
}

export async function POST(_request: NextRequest, { params }: Params) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { id } = await params

  try {
    const invoice = await getInvoice(id)
    if (!invoice) return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 })
    if (invoice.status !== 'brouillon') {
      return NextResponse.json({ error: 'Facture déjà émise' }, { status: 409 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile } = await (supabase as any)
      .from('profiles')
      .select('full_name,company_name,siret,address,city,postal_code,phone,email,tva_number,is_auto_entrepreneur,insurance_decennale_number,insurance_decennale_company,rge_number')
      .eq('id', user.id)
      .single()

    if (!profile) return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 })

    // Validation bloquante avant émission
    const validation = validateFacturx(invoice, profile)
    if (!validation.valid) {
      return NextResponse.json({ error: 'Validation Factur-X échouée', details: validation.errors }, { status: 422 })
    }

    const isAutoEntrepreneur = invoice.is_auto_entrepreneur_invoice

    // Construire les lignes pour le XML
    const allLignes = invoice.lots.flatMap((lot, lotIdx) =>
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

    const issueDate = toYYYYMMDD(new Date().toISOString().split('T').at(0) ?? '')
    const dueDate = invoice.due_date ? toYYYYMMDD(invoice.due_date) : undefined

    const xmlContent = generateFacturxXml({
      invoice_number: invoice.invoice_number,
      invoice_type_code: invoice.type === 'credit_note' ? '381' : '380',
      issue_date: issueDate,
      ...(dueDate !== undefined ? { due_date: dueDate } : {}),
      currency_code: 'EUR',
      seller: {
        name: profile.company_name ?? profile.full_name ?? '',
        ...(profile.siret ? { siret: profile.siret } : {}),
        ...(profile.tva_number ? { tva_number: profile.tva_number } : {}),
        ...(profile.address ? { address: profile.address } : {}),
        ...(profile.city ? { city: profile.city } : {}),
        ...(profile.postal_code ? { postal_code: profile.postal_code } : {}),
        country_code: 'FR',
      },
      buyer: {
        name: invoice.client?.company_name ?? invoice.client?.name ?? '',
        ...(invoice.client?.siret ? { siret: invoice.client.siret } : {}),
        ...(invoice.client?.billing_address ? { address: invoice.client.billing_address } : {}),
        ...(invoice.client?.billing_city ? { city: invoice.client.billing_city } : {}),
        ...(invoice.client?.billing_postal_code ? { postal_code: invoice.client.billing_postal_code } : {}),
        country_code: 'FR',
      },
      lines: allLignes,
      tva_totals: tvaTotals,
      total_ht: invoice.total_ht,
      total_tva: invoice.total_tva,
      total_ttc: invoice.total_ttc,
      ...(isAutoEntrepreneur ? { note: 'TVA non applicable, art. 293 B du CGI' } : {}),
    })

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

    const pdfBytes = await generateFacturePdf(invoice, artisanProfile)
    const pdfWithXml = await embedFacturxInPdf(pdfBytes, xmlContent)

    await emitInvoice(id, pdfWithXml, xmlContent)

    return NextResponse.json({ success: true, invoice_number: invoice.invoice_number })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur serveur' }, { status: 500 })
  }
}
