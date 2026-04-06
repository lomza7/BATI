import { createClient as createSupabaseClient } from '@/lib/supabase/server'
import type { Devis, DevisWithDetails, DevisListResult } from '@/types/devis'
import type { DevisCreateInput, DevisUpdateInput, DevisListQuery } from './schemas'
import { calculerTotaux } from './calculations'

async function nextReference(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  type: 'devis'
): Promise<string> {
  const { data, error } = await supabase.rpc('next_reference', {
    p_user_id: userId,
    p_counter_type: type,
    p_prefix: 'DEV',
  })
  if (error) throw new Error(`Erreur numérotation référence: ${error.message}`)
  return data as string
}

export async function listDevis(query: DevisListQuery): Promise<DevisListResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = await createSupabaseClient() as any
  const { q, status, client_id, page, limit, periode } = query
  const offset = (page - 1) * limit

  let dbQuery = supabase
    .from('devis')
    .select('*', { count: 'exact' })
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status) {
    dbQuery = dbQuery.eq('status', status)
  }
  if (client_id) {
    dbQuery = dbQuery.eq('client_id', client_id)
  }
  if (q && q.trim().length > 0) {
    dbQuery = dbQuery.or(
      `reference.ilike.%${q}%,title.ilike.%${q}%,object.ilike.%${q}%`
    )
  }
  if (periode) {
    const now = new Date()
    let from: Date
    if (periode === 'mois') {
      from = new Date(now.getFullYear(), now.getMonth(), 1)
    } else if (periode === 'trimestre') {
      const q = Math.floor(now.getMonth() / 3)
      from = new Date(now.getFullYear(), q * 3, 1)
    } else {
      from = new Date(now.getFullYear(), 0, 1)
    }
    dbQuery = dbQuery.gte('created_at', from.toISOString())
  }

  const { data, count, error } = await dbQuery
  if (error) throw new Error(`Erreur liste devis: ${error.message}`)

  return { data: (data ?? []) as Devis[], total: count ?? 0, page, limit }
}

export async function getDevis(id: string): Promise<DevisWithDetails | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = await createSupabaseClient() as any

  const { data: devis, error } = await supabase
    .from('devis')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw new Error(`Erreur récupération devis: ${error.message}`)
  }

  const [lotsResult, clientResult] = await Promise.all([
    supabase
      .from('devis_lots')
      .select('*, lignes:devis_lignes(*)')
      .eq('devis_id', id)
      .order('sort_order', { ascending: true }),
    devis.client_id
      ? supabase
          .from('clients')
          .select('id,name,email,phone,company_name,client_type,billing_address,billing_city,billing_postal_code')
          .eq('id', devis.client_id)
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

  return {
    ...(devis as Devis),
    lots,
    client: clientResult.data ?? null,
  }
}

export async function createDevis(input: DevisCreateInput): Promise<DevisWithDetails> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = await createSupabaseClient() as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non authentifié')

  // Récupérer le profil pour savoir si auto-entrepreneur
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_auto_entrepreneur')
    .eq('id', user.id)
    .single()

  const isAutoEntrepreneur = profile?.is_auto_entrepreneur ?? false

  const totaux = calculerTotaux(
    input.lots,
    input.discount_percent ?? 0,
    input.deposit_percent ?? 0,
    isAutoEntrepreneur
  )

  const reference = await nextReference(supabase, user.id, 'devis')

  const validUntil = new Date()
  validUntil.setDate(validUntil.getDate() + (input.validity_days ?? 30))

  const { data: devis, error: devisError } = await supabase
    .from('devis')
    .insert({
      user_id: user.id,
      client_id: input.client_id,
      reference,
      title: input.title ?? 'Devis travaux',
      object: input.object ?? null,
      site_address: input.site_address ?? null,
      site_city: input.site_city ?? null,
      site_postal_code: input.site_postal_code ?? null,
      is_renovation_2yr: input.is_renovation_2yr ?? false,
      discount_percent: input.discount_percent ?? 0,
      deposit_percent: input.deposit_percent ?? 0,
      payment_conditions: input.payment_conditions ?? 'Paiement à 30 jours',
      validity_days: input.validity_days ?? 30,
      valid_until: validUntil.toISOString().split('T')[0],
      total_ht: totaux.total_ht,
      total_tva: totaux.total_tva,
      total_ttc: totaux.total_ttc,
      status: 'brouillon',
    })
    .select()
    .single()

  if (devisError) throw new Error(`Erreur création devis: ${devisError.message}`)

  // Créer les lots et postes en cascade
  for (const lotInput of input.lots) {
    const { data: lot, error: lotError } = await supabase
      .from('devis_lots')
      .insert({ devis_id: devis.id, name: lotInput.name, sort_order: lotInput.sort_order })
      .select()
      .single()

    if (lotError) throw new Error(`Erreur création lot: ${lotError.message}`)

    if (lotInput.postes.length > 0) {
      const lignes = lotInput.postes.map((p) => ({
        devis_id: devis.id,
        lot_id: lot.id,
        description: p.description,
        quantity: p.quantity,
        unit: p.unit,
        unit_price_ht: p.unit_price_ht,
        tva_rate: isAutoEntrepreneur ? 0 : p.tva_rate,
        sort_order: p.sort_order,
      }))

      const { error: lignesError } = await supabase.from('devis_lignes').insert(lignes)
      if (lignesError) throw new Error(`Erreur création lignes: ${lignesError.message}`)
    }
  }

  const result = await getDevis(devis.id)
  if (!result) throw new Error('Devis introuvable après création')
  return result
}

export async function updateDevis(id: string, input: DevisUpdateInput): Promise<DevisWithDetails> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = await createSupabaseClient() as any

  // Vérifier que le devis est en brouillon
  const { data: existing, error: fetchError } = await supabase
    .from('devis')
    .select('status, user_id')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (fetchError || !existing) throw new Error('Devis introuvable')
  if (existing.status !== 'brouillon') {
    throw new Error('Seul un devis en brouillon peut être modifié')
  }

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
  if (input.is_renovation_2yr !== undefined) updates.is_renovation_2yr = input.is_renovation_2yr
  if (input.discount_percent !== undefined) updates.discount_percent = input.discount_percent
  if (input.deposit_percent !== undefined) updates.deposit_percent = input.deposit_percent
  if (input.payment_conditions !== undefined) updates.payment_conditions = input.payment_conditions
  if (input.validity_days !== undefined) {
    updates.validity_days = input.validity_days
    const validUntil = new Date()
    validUntil.setDate(validUntil.getDate() + input.validity_days)
    updates.valid_until = validUntil.toISOString().split('T')[0]
  }

  if (input.lots) {
    const totaux = calculerTotaux(
      input.lots,
      (input.discount_percent as number | undefined) ?? 0,
      (input.deposit_percent as number | undefined) ?? 0,
      isAutoEntrepreneur
    )
    updates.total_ht = totaux.total_ht
    updates.total_tva = totaux.total_tva
    updates.total_ttc = totaux.total_ttc

    // Remplacer les lots entièrement
    await supabase.from('devis_lots').delete().eq('devis_id', id)

    for (const lotInput of input.lots) {
      const { data: lot } = await supabase
        .from('devis_lots')
        .insert({ devis_id: id, name: lotInput.name, sort_order: lotInput.sort_order })
        .select()
        .single()

      if (lot && lotInput.postes.length > 0) {
        const lignes = lotInput.postes.map((p) => ({
          devis_id: id,
          lot_id: lot.id,
          description: p.description,
          quantity: p.quantity,
          unit: p.unit,
          unit_price_ht: p.unit_price_ht,
          tva_rate: isAutoEntrepreneur ? 0 : p.tva_rate,
          sort_order: p.sort_order,
        }))
        await supabase.from('devis_lignes').insert(lignes)
      }
    }
  }

  const { error: updateError } = await supabase
    .from('devis')
    .update(updates)
    .eq('id', id)

  if (updateError) throw new Error(`Erreur mise à jour devis: ${updateError.message}`)

  const result = await getDevis(id)
  if (!result) throw new Error('Devis introuvable après mise à jour')
  return result
}

export async function deleteDevis(id: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = await createSupabaseClient() as any

  const { data: devis, error } = await supabase
    .from('devis')
    .select('status')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error || !devis) throw new Error('Devis introuvable')
  if (devis.status !== 'brouillon') {
    throw new Error('Seul un devis en brouillon peut être supprimé')
  }

  const { error: delError } = await supabase
    .from('devis')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)

  if (delError) throw new Error(`Erreur suppression devis: ${delError.message}`)
}

export async function duplicateDevis(id: string): Promise<DevisWithDetails> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = await createSupabaseClient() as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non authentifié')

  const original = await getDevis(id)
  if (!original) throw new Error('Devis introuvable')

  const reference = await nextReference(supabase, user.id, 'devis')

  const { data: copy, error } = await supabase
    .from('devis')
    .insert({
      user_id: user.id,
      client_id: original.client_id,
      reference,
      title: `Copie — ${original.title}`,
      object: original.object,
      site_address: original.site_address,
      site_city: original.site_city,
      site_postal_code: original.site_postal_code,
      is_renovation_2yr: original.is_renovation_2yr,
      discount_percent: original.discount_percent,
      deposit_percent: original.deposit_percent,
      payment_conditions: original.payment_conditions,
      validity_days: original.validity_days,
      total_ht: original.total_ht,
      total_tva: original.total_tva,
      total_ttc: original.total_ttc,
      status: 'brouillon',
      parent_devis_id: id,
      valid_until: (() => {
        const d = new Date()
        d.setDate(d.getDate() + original.validity_days)
        return d.toISOString().split('T')[0]
      })(),
    })
    .select()
    .single()

  if (error) throw new Error(`Erreur duplication devis: ${error.message}`)

  for (const lot of original.lots) {
    const { data: newLot } = await supabase
      .from('devis_lots')
      .insert({ devis_id: copy.id, name: lot.name, sort_order: lot.sort_order })
      .select()
      .single()

    if (newLot && lot.lignes && lot.lignes.length > 0) {
      const lignes = lot.lignes.map((l) => ({
        devis_id: copy.id,
        lot_id: newLot.id,
        description: l.description,
        quantity: l.quantity,
        unit: l.unit,
        unit_price_ht: l.unit_price_ht,
        tva_rate: l.tva_rate,
        sort_order: l.sort_order,
      }))
      await supabase.from('devis_lignes').insert(lignes)
    }
  }

  const result = await getDevis(copy.id)
  if (!result) throw new Error('Copie introuvable après duplication')
  return result
}

export async function sendDevis(id: string, email: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = await createSupabaseClient() as any

  const { data: devis, error } = await supabase
    .from('devis')
    .select('status, reference, title')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error || !devis) throw new Error('Devis introuvable')
  if (devis.status !== 'brouillon') {
    throw new Error('Ce devis a déjà été envoyé')
  }

  // Vérifier profil SIRET
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('siret')
    .eq('id', user?.id)
    .single()

  if (!profile?.siret) {
    throw new Error('SIRET manquant dans votre profil. Complétez votre profil avant d\'envoyer.')
  }

  const { error: updateError } = await supabase
    .from('devis')
    .update({ status: 'envoyé', sent_at: new Date().toISOString(), sent_to_email: email })
    .eq('id', id)

  if (updateError) throw new Error(`Erreur mise à jour statut: ${updateError.message}`)
}

export async function acceptDevis(id: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = await createSupabaseClient() as any

  const { error } = await supabase
    .from('devis')
    .update({ status: 'accepté', accepted_at: new Date().toISOString() })
    .eq('id', id)
    .in('status', ['envoyé', 'brouillon'])
    .is('deleted_at', null)

  if (error) throw new Error(`Erreur acceptation devis: ${error.message}`)
}

export async function refuseDevis(id: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = await createSupabaseClient() as any

  const { error } = await supabase
    .from('devis')
    .update({ status: 'refusé' })
    .eq('id', id)
    .in('status', ['envoyé', 'brouillon'])
    .is('deleted_at', null)

  if (error) throw new Error(`Erreur refus devis: ${error.message}`)
}
