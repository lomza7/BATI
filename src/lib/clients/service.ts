import { createClient as createSupabaseClient } from '@/lib/supabase/server'
import type { Client, ClientWithStats, ClientListResult } from '@/types/clients'
import type { ClientCreateInput, ClientUpdateInput, ClientListQuery } from './schemas'

export type { Client, ClientWithStats, ClientListResult }

/**
 * List clients for the authenticated user with full-text search and filters.
 * Excludes soft-deleted clients.
 */
export async function listClients(query: ClientListQuery): Promise<ClientListResult> {
  const supabase = await createSupabaseClient()
  const { q, type, page, limit, has_impayes } = query
  const offset = (page - 1) * limit

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let dbQuery = (supabase as any)
    .from('clients')
    .select('*', { count: 'exact' })
    .is('deleted_at', null)
    .order('name', { ascending: true })
    .range(offset, offset + limit - 1)

  if (type) {
    dbQuery = dbQuery.eq('client_type', type)
  }

  if (q && q.trim().length > 0) {
    // Postgres full-text search via websearch syntax
    dbQuery = dbQuery.textSearch(
      'name,company_name,email,phone,siret',
      q.trim(),
      { config: 'french', type: 'websearch' }
    )
  }

  if (has_impayes) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: clientIds } = await (supabase as any)
      .from('factures')
      .select('client_id')
      .eq('status', 'en_retard')
    const ids = (clientIds ?? []).map((r: { client_id: string }) => r.client_id).filter(Boolean) as string[]
    if (ids.length === 0) {
      return { data: [], total: 0, page, limit }
    }
    dbQuery = dbQuery.in('id', ids)
  }

  const { data, count, error } = await dbQuery

  if (error) {
    throw new Error(`Erreur lors de la récupération des clients: ${error.message}`)
  }

  return {
    data: (data ?? []) as Client[],
    total: count ?? 0,
    page,
    limit,
  }
}

/**
 * Get a single client by ID (must belong to authenticated user).
 */
export async function getClient(id: string): Promise<Client | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = await createSupabaseClient() as any
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw new Error(`Erreur lors de la récupération du client: ${error.message}`)
  }

  return data as Client
}

/**
 * Get client with devis/factures stats.
 */
export async function getClientWithHistory(id: string): Promise<ClientWithStats | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = await createSupabaseClient() as any

  const [clientResult, devisResult, facturesResult] = await Promise.all([
    supabase.from('clients').select('*').eq('id', id).is('deleted_at', null).single(),
    supabase.from('devis').select('id', { count: 'exact' }).eq('client_id', id),
    supabase.from('factures').select('id,total_ttc', { count: 'exact' }).eq('client_id', id),
  ])

  if (clientResult.error) {
    if (clientResult.error.code === 'PGRST116') return null
    throw new Error(`Erreur: ${clientResult.error.message}`)
  }

  const totalFactureTtc = ((facturesResult.data ?? []) as Array<{ total_ttc: number }>).reduce(
    (sum, f) => sum + (f.total_ttc ?? 0),
    0
  )

  return {
    ...(clientResult.data as Client),
    devis_count: devisResult.count ?? 0,
    factures_count: facturesResult.count ?? 0,
    total_facture_ttc: totalFactureTtc,
  }
}

/**
 * Create a new client.
 */
export async function createClient_(input: ClientCreateInput): Promise<Client> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = await createSupabaseClient() as any

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Non authentifié')

  const { data, error } = await supabase
    .from('clients')
    .insert({ ...input, user_id: user.id })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      throw new Error('Un client avec ce SIRET existe déjà.')
    }
    throw new Error(`Erreur lors de la création du client: ${error.message}`)
  }

  return data as Client
}

/**
 * Update an existing client.
 */
export async function updateClient(id: string, input: ClientUpdateInput): Promise<Client> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = await createSupabaseClient() as any

  const { data, error } = await supabase
    .from('clients')
    .update(input)
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .single()

  if (error) {
    if (error.code === '23505') throw new Error('Un client avec ce SIRET existe déjà.')
    throw new Error(`Erreur lors de la mise à jour du client: ${error.message}`)
  }

  return data as Client
}

/**
 * Soft delete a client.
 * Blocked if the client has active devis or factures.
 */
export async function deleteClient(id: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = await createSupabaseClient() as any

  const { count: devisCount } = await supabase
    .from('devis')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', id)
    .in('status', ['brouillon', 'envoyé', 'accepté'])

  if (devisCount && devisCount > 0) {
    throw new Error(
      `Impossible de supprimer ce client : il a ${devisCount} devis actif(s). Clôturez-les d'abord.`
    )
  }

  const { count: factureCount } = await supabase
    .from('factures')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', id)
    .in('status', ['brouillon', 'émise', 'envoyée', 'en_retard'])

  if (factureCount && factureCount > 0) {
    throw new Error(
      `Impossible de supprimer ce client : il a ${factureCount} facture(s) active(s). Réglez-les d'abord.`
    )
  }

  const { error } = await supabase
    .from('clients')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    throw new Error(`Erreur lors de la suppression du client: ${error.message}`)
  }
}
