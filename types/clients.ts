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
  updated_at: string | null
}

export interface ClientWithStats extends Client {
  quotes_count: number
  invoices_count: number
  total_invoiced_ttc: number
}

export interface ClientListResult {
  data: Client[]
  total: number
  page: number
  limit: number
}
