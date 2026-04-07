import { createClient as createSupabaseClient } from '@/lib/supabase/server'
import type {
  Facture,
  FactureWithDetails,
  FactureListResult,
  FactureDashboard,
  SituationAvancement,
} from '@/types/factures'
import type {
  FactureCreateInput,
  FactureUpdateInput,
  FactureListQuery,
  SituationInput,
  PayInput,
  LotInput,
} from './schemas'
import { calculerTotaux } from './calculations'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function nextReference(supabase: any, userId: string, type: 'facture' | 'situation' | 'avoir'): Promise<string> {
  const prefix = type === 'facture' ? 'FAC' : type === 'situation' ? 'SIT' : 'AVO'
  const { data, error } = await supabase.rpc('next_reference', {
    p_user_id: userId,
    p_counter_type: type,
    p_prefix: prefix,
  })
  if (error) throw new Error(`Erreur numérotation référence: ${error.message}`)
  return data as string
}

export async function listFactures(query: FactureListQuery): Promise<FactureListResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = await createSupabaseClient() as any
  const { q, status, type, client_id, page, limit, periode } = query
  const offset = (page - 1) * limit

  let dbQuery = supabase
    .from('factures')
    .select('*', { count: 'exact' })
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status) dbQuery = dbQuery.eq('status', status)
  if (type) dbQuery = dbQuery.eq('type', type)
  if (client_id) dbQuery = dbQuery.eq('client_id', client_id)
  if (q && q.trim().length > 0) {
    dbQuery = dbQuery.or(`reference.ilike.%${q}%,title.ilike.%${q}%,object.ilike.%${q}%`)
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

  return { data: (data ?? []) as Facture[], total: count ?? 0, page, limit }
}

export async function getFacture(id: string): Promise<FactureWithDetails | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = await createSupabaseClient() as any

  const { data: facture, error } = await supabase
    .from('factures')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw new Error(`Erreur récupération facture: ${error.message}`)
  }

  const [lotsResult, clientResult] = await Promise.all([
    supabase
      .from('facture_lots')
      .select('*, lignes:facture_lignes(*)')
      .eq('facture_id', id)
      .order('sort_order', { ascending: true }),
    facture.client_id
      ? supabase
          .from('clients')
          .select('id,name,email,phone,company_name,siret,client_type,billing_address,billing_city,billing_postal_code')
          .eq('id', facture.client_id)
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

  return { ...(facture as Facture), lots, client: clientResult.data ?? null }
}

export async function createFacture(input: FactureCreateInput): Promise<FactureWithDetails> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = await createSupabaseClient() as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non authentifié')

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_auto_entrepreneur')
    .eq('id', user.id)
    .single()
  const isAutoEntrepreneur = profile?.is_auto_entrepreneur ?? false

  const totaux = calculerTotaux(input.lots, input.discount_percent ?? 0, 0, isAutoEntrepreneur)
  const reference = await nextReference(supabase, user.id, 'facture')

  const dueDate = new Date()
  dueDate.setDate(dueDate.getDate() + (input.payment_terms_days ?? 30))

  const { data: facture, error } = await supabase
    .from('factures')
    .insert({
      user_id: user.id,
      client_id: input.client_id,
      reference,
      title: input.title ?? 'Facture travaux',
      object: input.object ?? null,
      type: 'facture',
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

  await insertLots(supabase, facture.id, input.lots, isAutoEntrepreneur)

  const result = await getFacture(facture.id)
  if (!result) throw new Error('Facture introuvable après création')
  return result
}

export async function updateFacture(id: string, input: FactureUpdateInput): Promise<FactureWithDetails> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = await createSupabaseClient() as any

  const { data: existing, error: fetchError } = await supabase
    .from('factures')
    .select('status, user_id')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (fetchError || !existing) throw new Error('Facture introuvable')
  if (existing.status !== 'brouillon') throw new Error('Seule une facture en brouillon peut être modifiée')

  const { data: profile } = await supabase
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
    await supabase.from('facture_lots').delete().eq('facture_id', id)
    await insertLots(supabase, id, input.lots, isAutoEntrepreneur)
  }

  const { error: updateError } = await supabase.from('factures').update(updates).eq('id', id)
  if (updateError) throw new Error(`Erreur mise à jour: ${updateError.message}`)

  const result = await getFacture(id)
  if (!result) throw new Error('Facture introuvable après mise à jour')
  return result
}

export async function deleteFacture(id: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = await createSupabaseClient() as any
  const { data: facture, error } = await supabase
    .from('factures')
    .select('status')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error || !facture) throw new Error('Facture introuvable')
  if (facture.status !== 'brouillon') throw new Error('Seule une facture en brouillon peut être supprimée')

  const { error: delError } = await supabase
    .from('factures')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)

  if (delError) throw new Error(`Erreur suppression: ${delError.message}`)
}

/**
 * createFactureFromDevis — conversion devis → facture en 1 clic
 * Copie tous les lots/lignes, déduit l'acompte si deposit_percent > 0
 */
export async function createFactureFromDevis(devisId: string): Promise<FactureWithDetails> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = await createSupabaseClient() as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non authentifié')

  // Récupérer le devis avec ses lots/lignes
  const { data: devis, error: devisError } = await supabase
    .from('devis')
    .select('*')
    .eq('id', devisId)
    .is('deleted_at', null)
    .single()

  if (devisError || !devis) throw new Error('Devis introuvable')
  if (!['accepté'].includes(devis.status)) {
    throw new Error('Seul un devis accepté peut être converti en facture')
  }

  const { data: lotsData } = await supabase
    .from('devis_lots')
    .select('*, lignes:devis_lignes(*)')
    .eq('devis_id', devisId)
    .order('sort_order', { ascending: true })

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_auto_entrepreneur')
    .eq('id', user.id)
    .single()
  const isAutoEntrepreneur = profile?.is_auto_entrepreneur ?? false

  const lotsInput = (lotsData ?? []).map((lot: Record<string, unknown>) => ({
    name: lot.name as string,
    montant_lot_ht: (lot.lignes as Array<Record<string, unknown>>)?.reduce(
      (sum: number, l: Record<string, unknown>) => sum + Number(l.total_ht ?? 0),
      0
    ) ?? 0,
    sort_order: lot.sort_order as number,
    postes: ((lot.lignes as Array<Record<string, unknown>>) ?? []).map((l) => ({
      description: l.description as string,
      quantity: Number(l.quantity),
      unit: l.unit as string,
      unit_price_ht: Number(l.unit_price_ht),
      tva_rate: Number(l.tva_rate),
      sort_order: Number(l.sort_order),
    })),
  }))

  const discountPercent = Number(devis.discount_percent ?? 0)
  const totaux = calculerTotaux(lotsInput, discountPercent, 0, isAutoEntrepreneur)

  // Calculer acompte déduit
  const depositPercent = Number(devis.deposit_percent ?? 0)
  const depositAmount = depositPercent > 0
    ? parseFloat((totaux.total_ttc * depositPercent / 100).toFixed(2))
    : 0

  const totalTtcNet = parseFloat((totaux.total_ttc - depositAmount).toFixed(2))

  const reference = await nextReference(supabase, user.id, 'facture')
  const dueDate = new Date()
  dueDate.setDate(dueDate.getDate() + 30)

  const { data: facture, error: factureError } = await supabase
    .from('factures')
    .insert({
      user_id: user.id,
      client_id: devis.client_id,
      devis_id: devisId,
      reference,
      title: devis.title,
      object: devis.object,
      type: 'facture',
      site_address: devis.site_address,
      site_city: devis.site_city,
      site_postal_code: devis.site_postal_code,
      discount_percent: discountPercent,
      deposit_amount_deducted: depositAmount,
      payment_conditions: devis.payment_conditions ?? 'Paiement à 30 jours',
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

  if (factureError) throw new Error(`Erreur création facture: ${factureError.message}`)

  await insertLots(supabase, facture.id, lotsInput, isAutoEntrepreneur)

  // Marquer le devis comme facturé
  await supabase.from('devis').update({ status: 'facturé' }).eq('id', devisId)

  const result = await getFacture(facture.id)
  if (!result) throw new Error('Facture introuvable après création')
  return result
}

/**
 * emitFacture — Lock + génère PDF/A-3 + Factur-X XML + change statut
 */
export async function emitFacture(
  id: string,
  pdfBytes: Uint8Array,
  xmlContent: string
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = await createSupabaseClient() as any

  const { data: facture, error } = await supabase
    .from('factures')
    .select('status')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error || !facture) throw new Error('Facture introuvable')
  if (facture.status !== 'brouillon') throw new Error('Facture déjà émise')

  // Upload PDF dans Supabase Storage
  const pdfPath = `factures/${id}/facture.pdf`
  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(pdfPath, pdfBytes, { contentType: 'application/pdf', upsert: true })

  let pdfUrl: string | null = null
  if (!uploadError) {
    const { data: urlData } = supabase.storage.from('documents').getPublicUrl(pdfPath)
    pdfUrl = urlData?.publicUrl ?? null
  }

  const { error: updateError } = await supabase
    .from('factures')
    .update({
      status: 'émise',
      emitted_at: new Date().toISOString(),
      pdf_url: pdfUrl,
      facturx_xml: xmlContent,
    })
    .eq('id', id)

  if (updateError) throw new Error(`Erreur émission: ${updateError.message}`)
}

export async function sendFacture(id: string, email: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = await createSupabaseClient() as any

  const { data: facture, error } = await supabase
    .from('factures')
    .select('status, reference')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error || !facture) throw new Error('Facture introuvable')
  if (!['émise', 'envoyée'].includes(facture.status)) {
    throw new Error('La facture doit être émise avant envoi')
  }

  const { error: updateError } = await supabase
    .from('factures')
    .update({ status: 'envoyée', sent_to_email: email })
    .eq('id', id)

  if (updateError) throw new Error(`Erreur envoi: ${updateError.message}`)
}

export async function payFacture(id: string, input: PayInput): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = await createSupabaseClient() as any

  const { data: facture, error } = await supabase
    .from('factures')
    .select('status')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error || !facture) throw new Error('Facture introuvable')
  if (!['émise', 'envoyée', 'en_retard'].includes(facture.status)) {
    throw new Error('Cette facture ne peut pas être marquée comme payée')
  }

  const { error: updateError } = await supabase
    .from('factures')
    .update({
      status: 'payée',
      paid_at: input.paid_at ?? new Date().toISOString(),
      payment_method: input.payment_method,
    })
    .eq('id', id)

  if (updateError) throw new Error(`Erreur paiement: ${updateError.message}`)
}

/**
 * createSituation — crée une facture de situation depuis une facture mère
 */
export async function createSituation(
  factureId: string,
  input: SituationInput
): Promise<FactureWithDetails> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = await createSupabaseClient() as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non authentifié')

  const factureMere = await getFacture(factureId)
  if (!factureMere) throw new Error('Facture mère introuvable')
  if (!['émise', 'envoyée', 'payée'].includes(factureMere.status) && factureMere.status !== 'brouillon') {
    throw new Error('La facture mère doit exister pour créer une situation')
  }

  // Récupérer le cumul précédent par lot
  const { data: previousSituations } = await supabase
    .from('facture_situations')
    .select('lot_id, avancement_percent')
    .eq('facture_mere_id', factureId)

  const cumulMap = new Map<string, number>()
  for (const s of previousSituations ?? []) {
    const current = cumulMap.get(s.lot_id) ?? 0
    cumulMap.set(s.lot_id, current + s.avancement_percent)
  }

  // Calculer les montants de la situation
  const avancements: SituationAvancement[] = []
  let totalSituationHt = 0

  for (const av of input.avancements) {
    const lot = factureMere.lots.find((l) => l.id === av.lot_id)
    if (!lot) throw new Error(`Lot ${av.lot_id} introuvable dans la facture mère`)

    const cumulPrecedent = cumulMap.get(av.lot_id) ?? 0
    const cumulApres = cumulPrecedent + av.avancement_percent
    if (cumulApres > 100) {
      throw new Error(`Lot "${lot.name}" : cumul d'avancement dépasse 100% (${cumulApres}%)`)
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

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_auto_entrepreneur')
    .eq('id', user.id)
    .single()
  const isAutoEntrepreneur = profile?.is_auto_entrepreneur ?? false

  // Calculer TVA en respectant les taux réels de chaque lot de la facture mère.
  // Un lot peut contenir des lignes à des taux différents (ex : 10% MO + 20% fournitures).
  // On ventile le HT de chaque lot par taux de TVA proportionnellement à l'avancement.
  const lotTvaBuckets = new Map<string, Map<number, number>>()

  for (const av of avancements) {
    const parentLot = factureMere.lots.find((l) => l.id === av.lot_id)!
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
      // Pas de lignes dans le lot parent — montant sans TVA (cas exceptionnel)
      buckets.set(0, av.montant_situation_ht)
    }

    lotTvaBuckets.set(av.lot_id, buckets)
  }

  // Construire les LotInput pour calculerTotaux (ventilation TVA multi-taux correcte)
  const situationLotsForCalc = avancements.map((av) => {
    const buckets = lotTvaBuckets.get(av.lot_id)!
    const parentLot = factureMere.lots.find((l) => l.id === av.lot_id)!
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
  const totalTva = totaux.total_tva
  const totalTtc = totaux.total_ttc

  const reference = await nextReference(supabase, user.id, 'situation')
  const dueDate = new Date()
  dueDate.setDate(dueDate.getDate() + (input.payment_terms_days ?? 30))

  const { data: situation, error: situationError } = await supabase
    .from('factures')
    .insert({
      user_id: user.id,
      client_id: factureMere.client_id,
      devis_id: factureMere.devis_id,
      parent_facture_id: factureId,
      reference,
      title: `Situation de travaux — ${factureMere.title}`,
      type: 'situation',
      is_final: input.is_final,
      discount_percent: 0,
      deposit_amount_deducted: 0,
      payment_conditions: input.payment_conditions ?? factureMere.payment_conditions,
      payment_terms_days: input.payment_terms_days ?? 30,
      due_date: dueDate.toISOString().split('T')[0],
      total_ht: totalSituationHt,
      total_tva: totalTva,
      total_ttc: totalTtc,
      status: 'brouillon',
      is_auto_entrepreneur_invoice: isAutoEntrepreneur,
    })
    .select()
    .single()

  if (situationError) throw new Error(`Erreur création situation: ${situationError.message}`)

  // Créer les lots et lignes de la situation
  for (const av of avancements) {
    const { data: lot } = await supabase
      .from('facture_lots')
      .insert({
        facture_id: situation.id,
        name: av.lot_name,
        montant_lot_ht: av.montant_lot_ht,
        sort_order: 0,
      })
      .select()
      .single()

    if (lot && av.montant_situation_ht !== 0) {
      // Insérer une ligne par taux de TVA (ventilation multi-taux conforme Factur-X)
      const buckets = lotTvaBuckets.get(av.lot_id)!
      let sortOrder = 0
      for (const [tvaRate, htAmount] of buckets.entries()) {
        if (htAmount !== 0) {
          await supabase.from('facture_lignes').insert({
            facture_id: situation.id,
            lot_id: lot.id,
            description: `Avancement ${av.avancement_percent}% — ${av.lot_name}`,
            quantity: 1,
            unit: 'forfait',
            unit_price_ht: htAmount,
            tva_rate: tvaRate,
            sort_order: sortOrder++,
          })
        }
      }

      // Enregistrer l'avancement
      await supabase.from('facture_situations').insert({
        facture_mere_id: factureId,
        facture_situation_id: situation.id,
        lot_id: av.lot_id,
        avancement_percent: av.avancement_percent,
        cumul_precedent_percent: cumulMap.get(av.lot_id) ?? 0,
        montant_situation_ht: av.montant_situation_ht,
      })
    }
  }

  const result = await getFacture(situation.id)
  if (!result) throw new Error('Situation introuvable après création')
  return result
}

/**
 * createAvoir — crée une facture d'avoir depuis une facture émise/payée
 */
export async function createAvoir(factureId: string): Promise<FactureWithDetails> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = await createSupabaseClient() as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non authentifié')

  const factureOrigine = await getFacture(factureId)
  if (!factureOrigine) throw new Error('Facture origine introuvable')
  if (!['émise', 'envoyée', 'payée', 'en_retard'].includes(factureOrigine.status)) {
    throw new Error('Seule une facture émise ou payée peut faire l\'objet d\'un avoir')
  }

  const reference = await nextReference(supabase, user.id, 'avoir')

  const { data: avoir, error: avoirError } = await supabase
    .from('factures')
    .insert({
      user_id: user.id,
      client_id: factureOrigine.client_id,
      devis_id: factureOrigine.devis_id,
      parent_facture_id: factureId,
      reference,
      title: `Avoir — ${factureOrigine.reference}`,
      type: 'avoir',
      discount_percent: 0,
      deposit_amount_deducted: 0,
      payment_conditions: factureOrigine.payment_conditions,
      payment_terms_days: factureOrigine.payment_terms_days,
      // Montants inversés (négatifs pour l'avoir)
      total_ht: -factureOrigine.total_ht,
      total_tva: -factureOrigine.total_tva,
      total_ttc: -factureOrigine.total_ttc,
      status: 'brouillon',
      is_auto_entrepreneur_invoice: factureOrigine.is_auto_entrepreneur_invoice,
    })
    .select()
    .single()

  if (avoirError) throw new Error(`Erreur création avoir: ${avoirError.message}`)

  // Reproduire les lots/lignes avec quantités inversées
  for (const lot of factureOrigine.lots) {
    const { data: newLot } = await supabase
      .from('facture_lots')
      .insert({
        facture_id: avoir.id,
        name: lot.name,
        montant_lot_ht: -lot.montant_lot_ht,
        sort_order: lot.sort_order,
      })
      .select()
      .single()

    if (newLot && lot.lignes && lot.lignes.length > 0) {
      const lignes = lot.lignes.map((l) => ({
        facture_id: avoir.id,
        lot_id: newLot.id,
        description: l.description,
        quantity: -Math.abs(l.quantity), // Inversion
        unit: l.unit,
        unit_price_ht: l.unit_price_ht,
        tva_rate: l.tva_rate,
        sort_order: l.sort_order,
      }))
      await supabase.from('facture_lignes').insert(lignes)
    }
  }

  const result = await getFacture(avoir.id)
  if (!result) throw new Error('Avoir introuvable après création')
  return result
}

export async function getDashboard(): Promise<FactureDashboard> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = await createSupabaseClient() as any

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const todayIso = now.toISOString().split('T')[0]

  const [moisResult, retardResult, attenteResult] = await Promise.all([
    // CA du mois (factures payées ce mois)
    supabase
      .from('factures')
      .select('total_ttc')
      .eq('status', 'payée')
      .is('deleted_at', null)
      .gte('paid_at', startOfMonth),

    // Factures en retard (émises/envoyées avec due_date dépassée)
    supabase
      .from('factures')
      .select('total_ttc')
      .in('status', ['émise', 'envoyée'])
      .is('deleted_at', null)
      .lt('due_date', todayIso),

    // Encaissements attendus (émises/envoyées non en retard)
    supabase
      .from('factures')
      .select('total_ttc')
      .in('status', ['émise', 'envoyée'])
      .is('deleted_at', null)
      .gte('due_date', todayIso),
  ])

  const caDuMois = (moisResult.data ?? []).reduce(
    (sum: number, f: { total_ttc: number }) => sum + Number(f.total_ttc),
    0
  )
  const facturesRetard = retardResult.data ?? []
  const facturesEnRetardMontant = facturesRetard.reduce(
    (sum: number, f: { total_ttc: number }) => sum + Number(f.total_ttc),
    0
  )
  const encaissementsAttendus = (attenteResult.data ?? []).reduce(
    (sum: number, f: { total_ttc: number }) => sum + Number(f.total_ttc),
    0
  )

  // Mettre à jour le statut en_retard en DB
  if (facturesRetard.length > 0) {
    await supabase
      .from('factures')
      .update({ status: 'en_retard' })
      .in('status', ['émise', 'envoyée'])
      .is('deleted_at', null)
      .lt('due_date', todayIso)
  }

  return {
    ca_du_mois: parseFloat(caDuMois.toFixed(2)),
    factures_en_retard_count: facturesRetard.length,
    factures_en_retard_montant: parseFloat(facturesEnRetardMontant.toFixed(2)),
    encaissements_attendus: parseFloat(encaissementsAttendus.toFixed(2)),
  }
}

// ── helpers ────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function insertLots(supabase: any, factureId: string, lots: LotInput[], isAutoEntrepreneur: boolean): Promise<void> {
  for (const lotInput of lots) {
    const lotHt = lotInput.postes.reduce((sum, p) => sum + p.quantity * p.unit_price_ht, 0)
    const { data: lot, error: lotError } = await supabase
      .from('facture_lots')
      .insert({
        facture_id: factureId,
        name: lotInput.name,
        montant_lot_ht: lotInput.montant_lot_ht > 0 ? lotInput.montant_lot_ht : lotHt,
        sort_order: lotInput.sort_order,
      })
      .select()
      .single()

    if (lotError) throw new Error(`Erreur création lot: ${lotError.message}`)

    if (lot && lotInput.postes.length > 0) {
      const lignes = lotInput.postes.map((p) => ({
        facture_id: factureId,
        lot_id: lot.id,
        description: p.description,
        quantity: p.quantity,
        unit: p.unit,
        unit_price_ht: p.unit_price_ht,
        tva_rate: isAutoEntrepreneur ? 0 : p.tva_rate,
        sort_order: p.sort_order,
      }))
      const { error: lignesError } = await supabase.from('facture_lignes').insert(lignes)
      if (lignesError) throw new Error(`Erreur création lignes: ${lignesError.message}`)
    }
  }
}
