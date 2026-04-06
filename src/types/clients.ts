/**
 * Client types for Sprint 2.
 * These extend the base clients table with the new columns added by
 * migration 20260407000002_sprint2_clients.sql.
 * database.ts will be auto-regenerated after the migration runs.
 */

export type ClientType = 'particulier' | 'professionnel'

export interface Client {
  id: string
  user_id: string
  name: string
  email: string | null
  phone: string | null
  address: string | null
  city: string | null
  postal_code: string | null
  notes: string | null
  client_type: ClientType
  company_name: string | null
  siret: string | null
  billing_address: string | null
  billing_city: string | null
  billing_postal_code: string | null
  deleted_at: string | null
  created_at: string
  updated_at: string
}

export interface ClientWithStats extends Client {
  devis_count: number
  factures_count: number
  total_facture_ttc: number
}

export interface ClientListResult {
  data: Client[]
  total: number
  page: number
  limit: number
}
