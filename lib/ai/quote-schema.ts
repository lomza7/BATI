import { z } from 'zod';

export const aiQuoteLineSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive(),
  unit: z.string().min(1),
  unit_price: z.number().min(0),
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
