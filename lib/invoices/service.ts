import { supabase } from '@/lib/supabase'
import type {
  Invoice,
  InvoiceWithDetails,
  InvoiceListResult,
  InvoiceDashboard,
  SituationProgress,
} from '@/types/invoices'
import type {
  InvoiceCreateInput,
  InvoiceUpdateInput,
  InvoiceListQuery,
  SituationInput,
  PayInput,
  LotInput,
} from './schemas'
import { calculerTotaux } from './calculations'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function nextReference(sb: any, userId: string, type: 'invoice' | 'situation' | 'credit_note'): Promise<string> {
  const prefix = type === 'invoice' ? 'FAC' : type === 'situation' ? 'SIT' : 'AVO'
  const { data, error } = await sb.rpc('next_reference', {
    p_user_id: userId,
    p_counter_type: type,
    p_prefix: prefix,
  })
  if (error) throw new Error(`Erreur numérotation référence: ${error.message}`)
  return data as string
}

export async function listInvoices(query: InvoiceListQuery): Promise<InvoiceListResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any
  const { q, status, type, client_id, page, limit, periode } = query
  const offset = (page - 1) * limit

  let dbQuery = sb
    .from('invoices')
    .select('*', { count: 'exact' })
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status) dbQuery = dbQuery.eq('status', status)
  if (type) dbQuery = dbQuery.eq('type', type)
  if (client_id) dbQuery = dbQuery.eq('client_id', client_id)
  if (q && q.trim().length > 0) {
    dbQuery = dbQuery.or(`invoice_number.ilike.%${q}%,title.ilike.%${q}%,object.ilike.%${q}%`)
  }
  if (periode) {
    const now = new Date()
    let from: Date
    if (periode === 'mois') {
      from = new Date(now.getFullYear(), now.getMonth(), 1)
    } else if (periode === 'trimestre') {
      const qtr = Math.floor(now.getMonth() / 3)
      from = new Date(now.getFullYear(), qtr * 3, 1)
    } else {
      from = new Date(now.getFullYear(), 0, 1)
    }
    dbQuery = dbQuery.gte('created_at', from.toISOString())
  }

  const { data, count, error } = await dbQuery
  if (error) throw new Error(`Erreur liste factures: ${error.message}`)

  return { data: (data ?? []) as Invoice[], total: count ?? 0, page, limit }
}

export async function getInvoice(id: string): Promise<InvoiceWithDetails | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  const { data: invoice, error } = await sb
    .from('invoices')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw new Error(`Erreur récupération facture: ${error.message}`)
  }

  const [lotsResult, clientResult] = await Promise.all([
    sb
      .from('invoice_lots')
      .select('*, lignes:invoice_lines(*)')
      .eq('invoice_id', id)
      .order('sort_order', { ascending: true }),
    invoice.client_id
      ? sb
          .from('clients')
          .select('id,name,email,phone,company_name,siret,client_type,billing_address,billing_city,billing_postal_code')
          .eq('id', invoice.client_id)
          .single()
      : Promise.resolve({ data: null }),
  ])

  const lots = (lotsResult.data ?? []).map((lot: Record<string, unknown>) => ({
    ...lot,
    lignes: ((lot.lignes as unknown[]) ?? []).sort(
      (a: unknown, b: unknown) =>
        ((a as Record<string, number>).sort_order ?? 0) - ((b as Record<string, number>).sort_order ?? 0)
    ),
  }))

  return { ...(invoice as Invoice), lots, client: clientResult.data ?? null }
}

export async function createInvoice(input: InvoiceCreateInput): Promise<InvoiceWithDetails> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any
  const { data: { user } } = await sb.auth.getUser()
  if (!user) throw new Error('Non authentifié')

  const { data: profile } = await sb
    .from('profiles')
    .select('is_auto_entrepreneur')
    .eq('id', user.id)
    .single()
  const isAutoEntrepreneur = profile?.is_auto_entrepreneur ?? false

  const totaux = calculerTotaux(input.lots, input.discount_percent ?? 0, 0, isAutoEntrepreneur)
  const invoiceNumber = await nextReference(sb, user.id, 'invoice')

  const dueDate = new Date()
  dueDate.setDate(dueDate.getDate() + (input.payment_terms_days ?? 30))

  const { data: invoice, error } = await sb
    .from('invoices')
    .insert({
      user_id: user.id,
      client_id: input.client_id,
      invoice_number: invoiceNumber,
      title: input.title ?? 'Facture travaux',
      object: input.object ?? null,
      type: 'invoice',
      site_address: input.site_address ?? null,
      site_city: input.site_city ?? null,
      site_postal_code: input.site_postal_code ?? null,
      discount_percent: input.discount_percent ?? 0,
      deposit_amount_deducted: 0,
      payment_conditions: input.payment_conditions ?? 'Paiement à 30 jours',
      payment_terms_days: input.payment_terms_days ?? 30,
      due_date: dueDate.toISOString().split('T')[0],
      total_ht: totaux.total_ht_apres_remise,
      total_tva: totaux.total_tva,
      total_ttc: totaux.total_ttc,
      status: 'brouillon',
      is_auto_entrepreneur_invoice: isAutoEntrepreneur,
    })
    .select()
    .single()

  if (error) throw new Error(`Erreur création facture: ${error.message}`)

  await insertLots(sb, invoice.id, input.lots, isAutoEntrepreneur)

  const result = await getInvoice(invoice.id)
  if (!result) throw new Error('Facture introuvable après création')
  return result
}

export async function updateInvoice(id: string, input: InvoiceUpdateInput): Promise<InvoiceWithDetails> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  const { data: existing, error: fetchError } = await sb
    .from('invoices')
    .select('status, user_id')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (fetchError || !existing) throw new Error('Facture introuvable')
  if (existing.status !== 'brouillon') throw new Error('Seule une facture en brouillon peut être modifiée')

  const { data: profile } = await sb
    .from('profiles')
    .select('is_auto_entrepreneur')
    .eq('id', existing.user_id)
    .single()
  const isAutoEntrepreneur = profile?.is_auto_entrepreneur ?? false

  const updates: Record<string, unknown> = {}
  if (input.client_id !== undefined) updates.client_id = input.client_id
  if (input.title !== undefined) updates.title = input.title
  if (input.object !== undefined) updates.object = input.object
  if (input.site_address !== undefined) updates.site_address = input.site_address
  if (input.site_city !== undefined) updates.site_city = input.site_city
  if (input.site_postal_code !== undefined) updates.site_postal_code = input.site_postal_code
  if (input.discount_percent !== undefined) updates.discount_percent = input.discount_percent
  if (input.payment_conditions !== undefined) updates.payment_conditions = input.payment_conditions
  if (input.payment_terms_days !== undefined) {
    updates.payment_terms_days = input.payment_terms_days
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + input.payment_terms_days)
    updates.due_date = dueDate.toISOString().split('T')[0]
  }

  if (input.lots) {
    const totaux = calculerTotaux(
      input.lots,
      (input.discount_percent as number | undefined) ?? 0,
      0,
      isAutoEntrepreneur
    )
    updates.total_ht = totaux.total_ht_apres_remise
    updates.total_tva = totaux.total_tva
    updates.total_ttc = totaux.total_ttc
    await sb.from('invoice_lots').delete().eq('invoice_id', id)
    await insertLots(sb, id, input.lots, isAutoEntrepreneur)
  }

  const { error: updateError } = await sb.from('invoices').update(updates).eq('id', id)
  if (updateError) throw new Error(`Erreur mise à jour: ${updateError.message}`)

  const result = await getInvoice(id)
  if (!result) throw new Error('Facture introuvable après mise à jour')
  return result
}

export async function deleteInvoice(id: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  const { data: invoice, error } = await sb
    .from('invoices')
    .select('status')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error || !invoice) throw new Error('Facture introuvable')
  if (invoice.status !== 'brouillon') throw new Error('Seule une facture en brouillon peut être supprimée')

  const { error: delError } = await sb
    .from('invoices')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)

  if (delError) throw new Error(`Erreur suppression: ${delError.message}`)
}

export async function createInvoiceFromQuote(quoteId: string): Promise<InvoiceWithDetails> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any
  const { data: { user } } = await sb.auth.getUser()
  if (!user) throw new Error('Non authentifié')

  const { data: quote, error: quoteError } = await sb
    .from('quotes')
    .select('*')
    .eq('id', quoteId)
    .is('deleted_at', null)
    .single()

  if (quoteError || !quote) throw new Error('Devis introuvable')
  if (quote.status !== 'accepté') throw new Error('Seul un devis accepté peut être converti en facture')

  const { data: lotsData } = await sb
    .from('quote_lots')
    .select('*, lignes:quote_lines(*)')
    .eq('quote_id', quoteId)
    .order('sort_order', { ascending: true })

  const { data: profile } = await sb
    .from('profiles')
    .select('is_auto_entrepreneur')
    .eq('id', user.id)
    .single()
  const isAutoEntrepreneur = profile?.is_auto_entrepreneur ?? false

  const lotsInput = (lotsData ?? []).map((lot: Record<string, unknown>) => ({
    name: lot.name as string,
    montant_lot_ht: ((lot.lignes as Array<Record<string, unknown>>) ?? []).reduce(
      (sum: number, l: Record<string, unknown>) => sum + Number(l.total_ht ?? l.unit_price_ht ?? 0),
      0
    ),
    sort_order: lot.sort_order as number,
    postes: ((lot.lignes as Array<Record<string, unknown>>) ?? []).map((l) => ({
      description: l.description as string,
      quantity: Number(l.quantity),
      unit: (l.unit as string) ?? 'u',
      unit_price_ht: Number(l.unit_price_ht ?? l.unit_price ?? 0),
      tva_rate: Number(l.tva_rate ?? 20),
      sort_order: Number(l.sort_order ?? l.position ?? 0),
    })),
  }))

  const discountPercent = Number(quote.discount_percent ?? 0)
  const totaux = calculerTotaux(lotsInput, discountPercent, 0, isAutoEntrepreneur)

  const depositPercent = Number(quote.deposit_percent ?? 0)
  const depositAmount = depositPercent > 0
    ? parseFloat((totaux.total_ttc * depositPercent / 100).toFixed(2))
    : 0
  const totalTtcNet = parseFloat((totaux.total_ttc - depositAmount).toFixed(2))

  const invoiceNumber = await nextReference(sb, user.id, 'invoice')
  const dueDate = new Date()
  dueDate.setDate(dueDate.getDate() + 30)

  const { data: invoice, error: invoiceError } = await sb
    .from('invoices')
    .insert({
      user_id: user.id,
      client_id: quote.client_id,
      quote_id: quoteId,
      invoice_number: invoiceNumber,
      title: quote.title,
      object: quote.object,
      type: 'invoice',
      site_address: quote.site_address,
      site_city: quote.site_city,
      site_postal_code: quote.site_postal_code,
      discount_percent: discountPercent,
      deposit_amount_deducted: depositAmount,
      payment_conditions: quote.payment_conditions ?? 'Paiement à 30 jours',
      payment_terms_days: 30,
      due_date: dueDate.toISOString().split('T')[0],
      total_ht: totaux.total_ht_apres_remise,
      total_tva: totaux.total_tva,
      total_ttc: totalTtcNet,
      status: 'brouillon',
      is_auto_entrepreneur_invoice: isAutoEntrepreneur,
    })
    .select()
    .single()

  if (invoiceError) throw new Error(`Erreur création facture: ${invoiceError.message}`)

  await insertLots(sb, invoice.id, lotsInput, isAutoEntrepreneur)

  // Mark quote as invoiced
  await sb.from('quotes').update({ status: 'facturé' }).eq('id', quoteId)

  const result = await getInvoice(invoice.id)
  if (!result) throw new Error('Facture introuvable après création')
  return result
}

export async function emitInvoice(
  id: string,
  pdfBytes: Uint8Array,
  xmlContent: string
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  const { data: invoice, error } = await sb
    .from('invoices')
    .select('status')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error || !invoice) throw new Error('Facture introuvable')
  if (invoice.status !== 'brouillon') throw new Error('Facture déjà émise')

  const pdfPath = `invoices/${id}/invoice.pdf`
  const { error: uploadError } = await sb.storage
    .from('documents')
    .upload(pdfPath, pdfBytes, { contentType: 'application/pdf', upsert: true })

  let pdfUrl: string | null = null
  if (!uploadError) {
    const { data: urlData } = sb.storage.from('documents').getPublicUrl(pdfPath)
    pdfUrl = urlData?.publicUrl ?? null
  }

  const { error: updateError } = await sb
    .from('invoices')
    .update({
      status: 'émise',
      emitted_at: new Date().toISOString(),
      pdf_url: pdfUrl,
      facturx_xml: xmlContent,
    })
    .eq('id', id)

  if (updateError) throw new Error(`Erreur émission: ${updateError.message}`)
}

export async function sendInvoice(id: string, email: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  const { data: invoice, error } = await sb
    .from('invoices')
    .select('status')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error || !invoice) throw new Error('Facture introuvable')
  if (!['émise', 'envoyée'].includes(invoice.status)) {
    throw new Error('La facture doit être émise avant envoi')
  }

  const { error: updateError } = await sb
    .from('invoices')
    .update({ status: 'envoyée', sent_to_email: email })
    .eq('id', id)

  if (updateError) throw new Error(`Erreur envoi: ${updateError.message}`)
}

export async function payInvoice(id: string, input: PayInput): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  const { data: invoice, error } = await sb
    .from('invoices')
    .select('status')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error || !invoice) throw new Error('Facture introuvable')
  if (!['émise', 'envoyée', 'en_retard'].includes(invoice.status)) {
    throw new Error('Cette facture ne peut pas être marquée comme payée')
  }

  const { error: updateError } = await sb
    .from('invoices')
    .update({
      status: 'payée',
      paid_at: input.paid_at ?? new Date().toISOString(),
      payment_method: input.payment_method,
    })
    .eq('id', id)

  if (updateError) throw new Error(`Erreur paiement: ${updateError.message}`)
}

export async function createSituation(
  invoiceId: string,
  input: SituationInput
): Promise<InvoiceWithDetails> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any
  const { data: { user } } = await sb.auth.getUser()
  if (!user) throw new Error('Non authentifié')

  const parentInvoice = await getInvoice(invoiceId)
  if (!parentInvoice) throw new Error('Facture mère introuvable')

  const { data: previousSituations } = await sb
    .from('invoice_situations')
    .select('lot_id, avancement_percent')
    .eq('parent_invoice_id', invoiceId)

  const cumulMap = new Map<string, number>()
  for (const s of previousSituations ?? []) {
    const current = cumulMap.get(s.lot_id) ?? 0
    cumulMap.set(s.lot_id, current + s.avancement_percent)
  }

  const avancements: SituationProgress[] = []
  let totalSituationHt = 0

  for (const av of input.avancements) {
    const lot = parentInvoice.lots.find((l) => l.id === av.lot_id)
    if (!lot) throw new Error(`Lot ${av.lot_id} introuvable dans la facture mère`)

    const cumulPrecedent = cumulMap.get(av.lot_id) ?? 0
    if (cumulPrecedent + av.avancement_percent > 100) {
      throw new Error(`Lot "${lot.name}" : cumul d'avancement dépasse 100% (${cumulPrecedent + av.avancement_percent}%)`)
    }

    const montantSituationHt = parseFloat(
      ((av.avancement_percent / 100) * lot.montant_lot_ht).toFixed(2)
    )
    totalSituationHt += montantSituationHt

    avancements.push({
      lot_id: av.lot_id,
      lot_name: lot.name,
      montant_lot_ht: lot.montant_lot_ht,
      avancement_percent: av.avancement_percent,
      cumul_precedent_ht: parseFloat(((cumulPrecedent / 100) * lot.montant_lot_ht).toFixed(2)),
      montant_situation_ht: montantSituationHt,
    })
  }

  const { data: profile } = await sb
    .from('profiles')
    .select('is_auto_entrepreneur')
    .eq('id', user.id)
    .single()
  const isAutoEntrepreneur = profile?.is_auto_entrepreneur ?? false

  const situationLotsForCalc = avancements.map((av) => {
    const parentLot = parentInvoice.lots.find((l) => l.id === av.lot_id)!
    const lignes = parentLot.lignes ?? []
    const ratio = av.avancement_percent / 100
    const buckets = new Map<number, number>()

    if (lignes.length > 0) {
      for (const ligne of lignes) {
        const rate = isAutoEntrepreneur ? 0 : ligne.tva_rate
        const ht = parseFloat((ligne.unit_price_ht * ligne.quantity * ratio).toFixed(2))
        buckets.set(rate, (buckets.get(rate) ?? 0) + ht)
      }
    } else {
      buckets.set(0, av.montant_situation_ht)
    }

    return {
      name: parentLot.name,
      montant_lot_ht: av.montant_situation_ht,
      sort_order: 0,
      postes: Array.from(buckets.entries()).map(([rate, ht], i) => ({
        description: `Avancement ${av.avancement_percent}% — ${parentLot.name}`,
        quantity: 1,
        unit: 'forfait',
        unit_price_ht: ht,
        tva_rate: rate,
        sort_order: i,
      })),
    }
  })

  const totaux = calculerTotaux(situationLotsForCalc, 0, 0, isAutoEntrepreneur)
  const invoiceNumber = await nextReference(sb, user.id, 'situation')
  const dueDate = new Date()
  dueDate.setDate(dueDate.getDate() + (input.payment_terms_days ?? 30))

  const { data: situation, error: situationError } = await sb
    .from('invoices')
    .insert({
      user_id: user.id,
      client_id: parentInvoice.client_id,
      quote_id: parentInvoice.quote_id,
      parent_invoice_id: invoiceId,
      invoice_number: invoiceNumber,
      title: `Situation de travaux — ${parentInvoice.title}`,
      type: 'situation',
      is_final: input.is_final,
      discount_percent: 0,
      deposit_amount_deducted: 0,
      payment_conditions: input.payment_conditions ?? parentInvoice.payment_conditions,
      payment_terms_days: input.payment_terms_days ?? 30,
      due_date: dueDate.toISOString().split('T')[0],
      total_ht: totalSituationHt,
      total_tva: totaux.total_tva,
      total_ttc: totaux.total_ttc,
      status: 'brouillon',
      is_auto_entrepreneur_invoice: isAutoEntrepreneur,
    })
    .select()
    .single()

  if (situationError) throw new Error(`Erreur création situation: ${situationError.message}`)

  for (const av of avancements) {
    const { data: lot } = await sb
      .from('invoice_lots')
      .insert({
        invoice_id: situation.id,
        name: av.lot_name,
        montant_lot_ht: av.montant_lot_ht,
        sort_order: 0,
      })
      .select()
      .single()

    if (lot && av.montant_situation_ht !== 0) {
      const parentLot = parentInvoice.lots.find((l) => l.id === av.lot_id)!
      const lignes = parentLot.lignes ?? []
      const ratio = av.avancement_percent / 100
      const buckets = new Map<number, number>()

      if (lignes.length > 0) {
        for (const ligne of lignes) {
          const rate = isAutoEntrepreneur ? 0 : ligne.tva_rate
          const ht = parseFloat((ligne.unit_price_ht * ligne.quantity * ratio).toFixed(2))
          buckets.set(rate, (buckets.get(rate) ?? 0) + ht)
        }
      } else {
        buckets.set(0, av.montant_situation_ht)
      }

      let sortOrder = 0
      for (const [tvaRate, htAmount] of buckets.entries()) {
        if (htAmount !== 0) {
          await sb.from('invoice_lines').insert({
            invoice_id: situation.id,
            lot_id: lot.id,
            description: `Avancement ${av.avancement_percent}% — ${av.lot_name}`,
            quantity: 1,
            unit: 'forfait',
            unit_price_ht: htAmount,
            unit_price: htAmount,
            tva_rate: tvaRate,
            sort_order: sortOrder++,
          })
        }
      }

      await sb.from('invoice_situations').insert({
        parent_invoice_id: invoiceId,
        situation_invoice_id: situation.id,
        lot_id: av.lot_id,
        avancement_percent: av.avancement_percent,
        cumul_precedent_percent: cumulMap.get(av.lot_id) ?? 0,
        montant_situation_ht: av.montant_situation_ht,
      })
    }
  }

  const result = await getInvoice(situation.id)
  if (!result) throw new Error('Situation introuvable après création')
  return result
}

export async function createCreditNote(invoiceId: string): Promise<InvoiceWithDetails> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any
  const { data: { user } } = await sb.auth.getUser()
  if (!user) throw new Error('Non authentifié')

  const original = await getInvoice(invoiceId)
  if (!original) throw new Error('Facture origine introuvable')
  if (!['émise', 'envoyée', 'payée', 'en_retard'].includes(original.status)) {
    throw new Error('Seule une facture émise ou payée peut faire l\'objet d\'un avoir')
  }

  const invoiceNumber = await nextReference(sb, user.id, 'credit_note')

  const { data: avoir, error: avoirError } = await sb
    .from('invoices')
    .insert({
      user_id: user.id,
      client_id: original.client_id,
      quote_id: original.quote_id,
      parent_invoice_id: invoiceId,
      invoice_number: invoiceNumber,
      title: `Avoir — ${original.invoice_number}`,
      type: 'credit_note',
      discount_percent: 0,
      deposit_amount_deducted: 0,
      payment_conditions: original.payment_conditions,
      payment_terms_days: original.payment_terms_days,
      total_ht: -original.total_ht,
      total_tva: -original.total_tva,
      total_ttc: -original.total_ttc,
      status: 'brouillon',
      is_auto_entrepreneur_invoice: original.is_auto_entrepreneur_invoice,
    })
    .select()
    .single()

  if (avoirError) throw new Error(`Erreur création avoir: ${avoirError.message}`)

  for (const lot of original.lots) {
    const { data: newLot } = await sb
      .from('invoice_lots')
      .insert({
        invoice_id: avoir.id,
        name: lot.name,
        montant_lot_ht: -lot.montant_lot_ht,
        sort_order: lot.sort_order,
      })
      .select()
      .single()

    if (newLot && lot.lignes && lot.lignes.length > 0) {
      const lignes = lot.lignes.map((l) => ({
        invoice_id: avoir.id,
        lot_id: newLot.id,
        description: l.description,
        quantity: -Math.abs(l.quantity),
        unit: l.unit,
        unit_price_ht: l.unit_price_ht,
        unit_price: l.unit_price_ht,
        tva_rate: l.tva_rate,
        sort_order: l.sort_order,
      }))
      await sb.from('invoice_lines').insert(lignes)
    }
  }

  const result = await getInvoice(avoir.id)
  if (!result) throw new Error('Avoir introuvable après création')
  return result
}

export async function getDashboard(): Promise<InvoiceDashboard> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const todayIso = now.toISOString().split('T')[0]

  const [moisResult, retardResult, attenteResult] = await Promise.all([
    sb.from('invoices').select('total_ttc').eq('status', 'payée').is('deleted_at', null).gte('paid_at', startOfMonth),
    sb.from('invoices').select('total_ttc').in('status', ['émise', 'envoyée']).is('deleted_at', null).lt('due_date', todayIso),
    sb.from('invoices').select('total_ttc').in('status', ['émise', 'envoyée']).is('deleted_at', null).gte('due_date', todayIso),
  ])

  const caDuMois = (moisResult.data ?? []).reduce(
    (sum: number, f: { total_ttc: number }) => sum + Number(f.total_ttc), 0
  )
  const facturesRetard = retardResult.data ?? []
  const facturesEnRetardMontant = facturesRetard.reduce(
    (sum: number, f: { total_ttc: number }) => sum + Number(f.total_ttc), 0
  )
  const encaissementsAttendus = (attenteResult.data ?? []).reduce(
    (sum: number, f: { total_ttc: number }) => sum + Number(f.total_ttc), 0
  )

  if (facturesRetard.length > 0) {
    await sb
      .from('invoices')
      .update({ status: 'en_retard' })
      .in('status', ['émise', 'envoyée'])
      .is('deleted_at', null)
      .lt('due_date', todayIso)
  }

  return {
    ca_du_mois: parseFloat(caDuMois.toFixed(2)),
    invoices_overdue_count: facturesRetard.length,
    invoices_overdue_amount: parseFloat(facturesEnRetardMontant.toFixed(2)),
    encaissements_attendus: parseFloat(encaissementsAttendus.toFixed(2)),
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function insertLots(sb: any, invoiceId: string, lots: LotInput[], isAutoEntrepreneur: boolean): Promise<void> {
  for (const lotInput of lots) {
    const lotHt = lotInput.postes.reduce((sum, p) => sum + p.quantity * p.unit_price_ht, 0)
    const { data: lot, error: lotError } = await sb
      .from('invoice_lots')
      .insert({
        invoice_id: invoiceId,
        name: lotInput.name,
        montant_lot_ht: lotInput.montant_lot_ht > 0 ? lotInput.montant_lot_ht : lotHt,
        sort_order: lotInput.sort_order,
      })
      .select()
      .single()

    if (lotError) throw new Error(`Erreur création lot: ${lotError.message}`)

    if (lot && lotInput.postes.length > 0) {
      const lignes = lotInput.postes.map((p) => ({
        invoice_id: invoiceId,
        lot_id: lot.id,
        description: p.description,
        quantity: p.quantity,
        unit: p.unit,
        unit_price_ht: p.unit_price_ht,
        unit_price: p.unit_price_ht, // backward-compat
        tva_rate: isAutoEntrepreneur ? 0 : p.tva_rate,
        sort_order: p.sort_order,
      }))
      const { error: lignesError } = await sb.from('invoice_lines').insert(lignes)
      if (lignesError) throw new Error(`Erreur création lignes: ${lignesError.message}`)
    }
  }
}
