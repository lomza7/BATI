import { z } from 'zod';

export const bankReconcileMatchSchema = z.object({
  transaction_id: z.string(),
  kind: z.enum(['expense', 'invoice']).nullable(),
  target_id: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().optional().default(''),
});

export const bankReconcileResponseSchema = z.object({
  matches: z.array(bankReconcileMatchSchema).default([]),
});

export type BankReconcileMatch = z.infer<typeof bankReconcileMatchSchema>;
export type BankReconcileResponse = z.infer<typeof bankReconcileResponseSchema>;
