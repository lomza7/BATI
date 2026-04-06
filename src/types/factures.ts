export type FactureStatus = 'brouillon' | 'émise' | 'envoyée' | 'payée' | 'en_retard' | 'annulée'
export type FactureType = 'facture' | 'situation' | 'avoir'

export interface FactureLigne {
  id: string
  facture_id: string
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

export interface FactureLot {
  id: string
  facture_id: string
  name: string
  montant_lot_ht: number
  sort_order: number
  created_at: string
  lignes?: FactureLigne[]
}

export interface Facture {
  id: string
  user_id: string
  client_id: string | null
  devis_id: string | null
  parent_facture_id: string | null
  reference: string
  title: string
  type: FactureType
  object: string | null
  site_address: string | null
  site_city: string | null
  site_postal_code: string | null
  status: FactureStatus
  is_final: boolean
  total_ht: number
  total_tva: number
  total_ttc: number
  discount_percent: number
  deposit_amount_deducted: number
  payment_terms_days: number
  payment_conditions: string
  due_date: string | null
  paid_at: string | null
  payment_method: string | null
  pdf_url: string | null
  facturx_xml: string | null
  is_auto_entrepreneur_invoice: boolean
  emitted_at: string | null
  sent_to_email: string | null
  deleted_at: string | null
  created_at: string
  updated_at: string
}

export interface FactureClient {
  id: string
  name: string
  email: string | null
  phone: string | null
  company_name: string | null
  siret: string | null
  client_type: string
  billing_address: string | null
  billing_city: string | null
  billing_postal_code: string | null
}

export interface FactureWithDetails extends Facture {
  lots: FactureLot[]
  client: FactureClient | null
}

export interface FactureListResult {
  data: Facture[]
  total: number
  page: number
  limit: number
}

export interface FactureDashboard {
  ca_du_mois: number
  factures_en_retard_count: number
  factures_en_retard_montant: number
  encaissements_attendus: number
}

export interface SituationAvancement {
  lot_id: string
  lot_name: string
  montant_lot_ht: number
  avancement_percent: number
  cumul_precedent_ht: number
  montant_situation_ht: number
}

export interface TvaVentilation {
  rate: number
  base_ht: number
  montant_tva: number
}

export interface FactureTotaux {
  total_ht: number
  remise_amount: number
  total_ht_apres_remise: number
  tva_ventilation: TvaVentilation[]
  total_tva: number
  total_ttc: number
  deposit_amount_deducted: number
}
