import { z } from 'zod';

export const tvaLineSchema = z.object({
  rate: z.number().min(0).max(30),
  ht: z.number().min(0),
  tva: z.number().min(0),
});

export const ocrLineItemSchema = z.object({
  description: z.string(),
  quantity: z.number().default(1),
  unit_price_ht: z.number().default(0),
  amount_ht: z.number().min(0).default(0),
  tva_rate: z.number().default(20),
  category_slug: z.string().default('autres'),
});

export const expenseOcrSchema = z.object({
  supplier: z.string().default(''),
  supplier_siret: z.string().default(''),
  invoice_number: z.string().default(''),
  date: z.string().default(''),
  description: z.string().default(''),
  amount_ht: z.number().min(0).default(0),
  amount_ttc: z.number().min(0).default(0),
  tva_total: z.number().min(0).default(0),
  tva_breakdown: z.array(tvaLineSchema).default([]),
  is_autoliquidation: z.boolean().default(false),
  payment_method: z
    .enum(['cb', 'virement', 'especes', 'cheque', 'prelevement', 'autre'])
    .nullable()
    .default(null),
  category_slug: z.string().default('autres'),
  confidence: z.number().min(0).max(1).default(0.5),
  lines: z.array(ocrLineItemSchema).default([]),
});

export type OcrLineItem = z.infer<typeof ocrLineItemSchema>;
export type ExpenseOcrResult = z.infer<typeof expenseOcrSchema>;
