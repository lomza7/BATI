import { supabase } from '@/lib/supabase';

export interface GenerateQuoteDetailInput {
  description: string;
  existingDetail?: string;
  quoteTitle?: string;
  otherLines?: { description: string; detail?: string | null; quantity?: number; unit?: string | null }[];
}

export async function generateQuoteDetail(input: GenerateQuoteDetailInput): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('Authentification requise.');

  const res = await fetch('/api/ai/quote-detail', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      description: input.description,
      existing_detail: input.existingDetail,
      quote_title: input.quoteTitle,
      other_lines: input.otherLines,
    }),
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(json?.error || "L'IA n'a pas pu générer le détail.");
  }

  const detail = typeof json?.detail === 'string' ? json.detail : '';
  if (!detail) throw new Error("Réponse IA vide.");
  return detail;
}
