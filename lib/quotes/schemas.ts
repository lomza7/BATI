import { z } from 'zod'

export const posteSchema = z.object({
  description: z.string().min(1, 'Description requise').max(500),
  quantity: z.number().positive('Quantité doit être positive'),
  unit: z.string().min(1).max(20).default('u'),
  unit_price_ht: z.number().min(0, 'Prix doit être >= 0'),
  tva_rate: z.number().refine((v) => [0, 10, 20].includes(v), {
    message: 'TVA doit être 0%, 10% ou 20%',
  }),
  sort_order: z.number().int().min(0).default(0),
})

export const lotSchema = z.object({
  name: z.string().min(1, 'Nom du lot requis').max(200),
  sort_order: z.number().int().min(0).default(0),
  postes: z.array(posteSchema).min(1, 'Un lot doit avoir au moins un poste'),
})

export const quoteCreateSchema = z.object({
  client_id: z.string().uuid('Client invalide'),
  title: z.string().min(1, 'Titre requis').max(200).default('Devis travaux'),
  object: z.string().max(500).optional(),
  site_address: z.string().max(300).optional(),
  site_city: z.string().max(100).optional(),
  site_postal_code: z.string().max(10).optional(),
  is_renovation_2yr: z.boolean().default(false),
  discount_percent: z.number().min(0).max(100).default(0),
  deposit_percent: z.number().min(0).max(100).default(0),
  payment_conditions: z.string().max(500).default('Paiement à 30 jours'),
  validity_days: z.number().int().min(1).max(365).default(30),
  lots: z.array(lotSchema).min(1, 'Au moins un lot requis'),
})

export const quoteUpdateSchema = quoteCreateSchema.partial().omit({ lots: true }).extend({
  lots: z.array(lotSchema).min(1).optional(),
})

export const quoteListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().optional(),
  status: z.string().optional(),
  client_id: z.string().uuid().optional(),
  periode: z.enum(['mois', 'trimestre', 'annee']).optional(),
})

export type QuoteCreateInput = z.infer<typeof quoteCreateSchema>
export type QuoteUpdateInput = z.infer<typeof quoteUpdateSchema>
export type QuoteListQuery = z.infer<typeof quoteListQuerySchema>
export type LotInput = z.infer<typeof lotSchema>
export type PosteInput = z.infer<typeof posteSchema>
