export type DevisStatus = 'brouillon' | 'envoyé' | 'accepté' | 'refusé' | 'expiré' | 'facturé'

export interface DevisLigne {
  id: string
  devis_id: string
  lot_id: string | null
  description: string
  quantity: number
  unit: string
  unit_price_ht: number
  tva_rate: number
  total_ht: number
  sort_order: number
  created_at: string
}

export interface DevisLot {
  id: string
  devis_id: string
  name: string
  sort_order: number
  created_at: string
  lignes?: DevisLigne[]
}

export interface Devis {
  id: string
  user_id: string
  client_id: string | null
  reference: string
  title: string
  description: string | null
  object: string | null
  site_address: string | null
  site_city: string | null
  site_postal_code: string | null
  status: DevisStatus
  is_renovation_2yr: boolean
  discount_percent: number
  deposit_percent: number
  payment_conditions: string
  validity_days: number
  version: number
  parent_devis_id: string | null
  total_ht: number
  total_tva: number
  total_ttc: number
  pdf_url: string | null
  sent_to_email: string | null
  valid_until: string | null
  accepted_at: string | null
  sent_at: string | null
  deleted_at: string | null
  created_at: string
  updated_at: string
}

export interface DevisWithDetails extends Devis {
  lots: DevisLot[]
  client?: {
    id: string
    name: string
    email: string | null
    phone: string | null
    company_name: string | null
    client_type: string
    billing_address: string | null
    billing_city: string | null
    billing_postal_code: string | null
  } | null
}

export interface DevisListResult {
  data: Devis[]
  total: number
  page: number
  limit: number
}

export interface TvaVentilation {
  rate: number
  base_ht: number
  montant_tva: number
}

export interface DevisTotaux {
  total_ht: number
  tva_ventilation: TvaVentilation[]
  total_tva: number
  remise_amount: number
  total_ht_apres_remise: number
  total_ttc: number
  acompte_amount: number
}
