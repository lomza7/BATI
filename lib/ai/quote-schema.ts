import { z } from 'zod';

export const AI_QUOTE_UNITS = ['u', 'forfait', 'm2', 'ml', 'm3', 'h', 'jour', 'kg', 'l', 't'] as const;

export const aiQuoteLineSchema = z.object({
  description: z.string().min(1),
  detail: z.string().optional(),
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

// Single clarifying question the assistant can ask the craftsman before
// drafting the quote. Kept short so it can be read aloud on a mobile screen
// and answered in one or two spoken sentences.
export const clarifyQuestionSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(3).max(240),
  reason: z.string().min(3).max(240),
});

export type ClarifyQuestion = z.infer<typeof clarifyQuestionSchema>;

// The assistant can answer in two forms: it either has enough context to
// produce the draft, or it needs 1-3 clarifications first. We use a zod
// discriminated union on `status` so the client can branch safely.
export const aiQuoteReadyResponseSchema = z.object({
  status: z.literal('ready'),
  analysis: aiQuoteAnalysisSchema,
});

export const aiQuoteClarifyResponseSchema = z.object({
  status: z.literal('clarify'),
  questions: z.array(clarifyQuestionSchema).min(1).max(3),
});

export const aiQuoteResponseSchema = z.discriminatedUnion('status', [
  aiQuoteReadyResponseSchema,
  aiQuoteClarifyResponseSchema,
]);

export type AiQuoteResponse = z.infer<typeof aiQuoteResponseSchema>;

// Conversation turns exchanged between the craftsman and the assistant
// during a quote session. The client owns the whole history and re-sends it
// on each call — the server stays stateless.
export const quoteTurnSchema = z.discriminatedUnion('kind', [
  z.object({
    role: z.literal('user'),
    kind: z.literal('transcript'),
    text: z.string().min(1),
  }),
  z.object({
    role: z.literal('assistant'),
    kind: z.literal('questions'),
    questions: z.array(clarifyQuestionSchema).min(1).max(3),
  }),
  z.object({
    role: z.literal('user'),
    kind: z.literal('answers'),
    answers: z.array(
      z.object({
        question_id: z.string().min(1),
        question_text: z.string().min(1),
        text: z.string().min(1),
      }),
    ),
  }),
]);

export type QuoteTurn = z.infer<typeof quoteTurnSchema>;
