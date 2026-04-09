import { z } from 'zod';

export const AI_QUOTE_UNITS = ['u', 'forfait', 'm2', 'ml', 'm3', 'h', 'jour', 'kg', 'l', 't'] as const;

export const aiQuoteLineSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive(),
  unit: z.enum(AI_QUOTE_UNITS),
  unit_price: z.number().min(0),
  tva_rate: z.number().min(0).max(100).optional(),
  service_id: z.string().uuid().optional(),
});

export const aiQuoteAnalysisSchema = z.object({
  title: z.string().min(1),
  clientName: z.string().default(''),
  description: z.string().min(1),
  confidence: z.number().min(0).max(100),
  summary: z.string().min(1),
  assumptions: z.array(z.string()).default([]),
  lines: z.array(aiQuoteLineSchema).min(1),
});

export type AiQuoteAnalysis = z.infer<typeof aiQuoteAnalysisSchema>;
