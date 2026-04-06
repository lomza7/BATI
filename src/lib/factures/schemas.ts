import { z } from 'zod'

export const posteSchema = z.object({
  description: z.string().min(1).max(500),
  quantity: z.number(),
  unit: z.string().default('u'),
  unit_price_ht: z.number().min(0),
  tva_rate: z.number().refine((v) => [0, 5.5, 10, 20].includes(v), {
    message: 'Taux TVA invalide (0, 5.5, 10 ou 20)',
  }),
  sort_order: z.number().int().default(0),
})

export const lotSchema = z.object({
  name: z.string().min(1).max(200),
  montant_lot_ht: z.number().min(0).default(0),
  sort_order: z.number().int().default(0),
  postes: z.array(posteSchema).min(1),
})

export const factureCreateSchema = z.object({
  client_id: z.string().uuid(),
  title: z.string().min(1).max(300).optional(),
  object: z.string().max(500).optional(),
  site_address: z.string().max(300).optional(),
  site_city: z.string().max(100).optional(),
  site_postal_code: z.string().max(10).optional(),
  discount_percent: z.number().min(0).max(100).default(0),
  deposit_percent: z.number().min(0).max(100).default(0),
  payment_conditions: z.string().max(500).optional(),
  payment_terms_days: z.number().int().min(0).max(365).default(30),
  lots: z.array(lotSchema).min(1),
})

export const factureUpdateSchema = factureCreateSchema.partial()

export const factureListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().optional(),
  status: z
    .enum(['brouillon', 'émise', 'envoyée', 'payée', 'en_retard', 'annulée'])
    .optional(),
  type: z.enum(['facture', 'situation', 'avoir']).optional(),
  client_id: z.string().uuid().optional(),
  periode: z.enum(['mois', 'trimestre', 'annee']).optional(),
})

export const situationInputSchema = z.object({
  is_final: z.boolean().default(false),
  payment_conditions: z.string().max(500).optional(),
  payment_terms_days: z.number().int().min(0).max(365).default(30),
  avancements: z.array(
    z.object({
      lot_id: z.string().uuid(),
      avancement_percent: z.number().min(0).max(100),
    })
  ).min(1),
})

export const paySchema = z.object({
  payment_method: z.enum(['virement', 'chèque', 'espèces', 'carte', 'prélèvement']),
  paid_at: z.string().datetime().optional(),
})

export const sendSchema = z.object({
  email: z.string().email(),
})

export type PosteInput = z.infer<typeof posteSchema>
export type LotInput = z.infer<typeof lotSchema>
export type FactureCreateInput = z.infer<typeof factureCreateSchema>
export type FactureUpdateInput = z.infer<typeof factureUpdateSchema>
export type FactureListQuery = z.infer<typeof factureListQuerySchema>
export type SituationInput = z.infer<typeof situationInputSchema>
export type PayInput = z.infer<typeof paySchema>
export type SendInput = z.infer<typeof sendSchema>
