export type InvoiceStatus = 'brouillon' | 'émise' | 'envoyée' | 'payée' | 'en_retard' | 'annulée'
export type InvoiceType = 'invoice' | 'situation' | 'credit_note'

export interface InvoiceLine {
  id: string
  invoice_id: string
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

export interface InvoiceLot {
  id: string
  invoice_id: string
  name: string
  montant_lot_ht: number
  sort_order: number
  created_at: string
  lignes?: InvoiceLine[]
}

export interface Invoice {
  id: string
  user_id: string
  client_id: string | null
  quote_id: string | null
  parent_invoice_id: string | null
  invoice_number: string
  title: string
  type: InvoiceType
  object: string | null
  site_address: string | null
  site_city: string | null
  site_postal_code: string | null
  status: InvoiceStatus
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

export interface InvoiceClient {
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

export interface InvoiceWithDetails extends Invoice {
  lots: InvoiceLot[]
  client: InvoiceClient | null
}

export interface InvoiceListResult {
  data: Invoice[]
  total: number
  page: number
  limit: number
}

export interface InvoiceDashboard {
  ca_du_mois: number
  invoices_overdue_count: number
  invoices_overdue_amount: number
  encaissements_attendus: number
}

export interface SituationProgress {
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

export interface InvoiceTotaux {
  total_ht: number
  remise_amount: number
  total_ht_apres_remise: number
  tva_ventilation: TvaVentilation[]
  total_tva: number
  total_ttc: number
  deposit_amount_deducted: number
}
