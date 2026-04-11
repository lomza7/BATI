import { z } from 'zod';

export const invoiceImportItemSchema = z.object({
  client_name: z.string().default(''),
  client_address: z.string().default(''),
  client_city: z.string().default(''),
  client_postal_code: z.string().default(''),
  invoice_date: z.string().default(''),
  invoice_number: z.string().default(''),
  description: z.string().default(''),
  amount_ht: z.number().min(0).default(0),
  amount_ttc: z.number().min(0).default(0),
  tva_rate: z.number().min(0).max(30).default(20),
  confidence: z.number().min(0).max(1).default(0.5),
});

export type InvoiceImportItem = z.infer<typeof invoiceImportItemSchema>;
