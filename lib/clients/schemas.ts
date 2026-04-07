import { z } from 'zod'

export const clientCreateSchema = z.object({
  name: z.string().min(1, 'Le nom est obligatoire').max(255),
  email: z
    .string()
    .email('Email invalide')
    .optional()
    .or(z.literal(''))
    .transform((v) => v || undefined),
  phone: z.string().max(20).optional(),
  address: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  postal_code: z
    .string()
    .regex(/^\d{5}$/, 'Code postal invalide (5 chiffres)')
    .optional()
    .or(z.literal(''))
    .transform((v) => v || undefined),
  notes: z.string().max(2000).optional(),
  client_type: z.enum(['particulier', 'professionnel']).default('particulier'),
  company_name: z.string().max(255).optional(),
  siret: z
    .string()
    .regex(/^\d{14}$/, 'SIRET invalide (14 chiffres)')
    .optional()
    .or(z.literal(''))
    .transform((v) => v || undefined),
  billing_address: z.string().max(500).optional(),
  billing_city: z.string().max(100).optional(),
  billing_postal_code: z
    .string()
    .regex(/^\d{5}$/, 'Code postal de facturation invalide (5 chiffres)')
    .optional()
    .or(z.literal(''))
    .transform((v) => v || undefined),
})

export const clientUpdateSchema = clientCreateSchema.partial()

export const clientListQuerySchema = z.object({
  q: z.string().optional(),
  type: z.enum(['particulier', 'professionnel']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  has_impayes: z
    .string()
    .optional()
    .transform((v) => v === 'true' || v === '1'),
})

export type ClientCreateInput = z.infer<typeof clientCreateSchema>
export type ClientUpdateInput = z.infer<typeof clientUpdateSchema>
export type ClientListQuery = z.infer<typeof clientListQuerySchema>

export function isDuplicateClient(
  candidate: { email?: string; phone?: string; siret?: string },
  existing: { email?: string | null; phone?: string | null; siret?: string | null }
): boolean {
  if (candidate.siret && existing.siret) {
    if (candidate.siret === existing.siret) return true
  }
  if (candidate.email && existing.email) {
    if (candidate.email.trim().toLowerCase() === existing.email.trim().toLowerCase()) return true
  }
  if (candidate.phone && existing.phone) {
    const normalize = (p: string) => {
      const digits = p.replace(/\D/g, '')
      if (digits.length === 11 && digits.startsWith('33')) return '0' + digits.slice(2)
      return digits
    }
    if (normalize(candidate.phone) === normalize(existing.phone)) return true
  }
  return false
}
