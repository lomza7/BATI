'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { computeTvaBreakdown } from '@/lib/tva';
import { getNextQuoteNumber } from '@/lib/document-numbers';
import { QuoteAiAssistant, type AiQuoteDraft } from '@/components/devis/quote-ai-assistant';

// Direct-save path: the assistant now persists the quote itself and jumps
// straight back to the list. No more handoff through sessionStorage + a
// pre-filled create dialog (that path was racy — the lines state would
// sometimes arrive empty at saveQuote time, producing 0€ ghost drafts).
export default function DevisAiPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleUseDraft(draft: AiQuoteDraft) {
    if (!user) {
      setSaveError('Tu dois être connecté pour enregistrer un devis.');
      return;
    }

    setSaving(true);
    setSaveError(null);

    try {
      // Drop empty lines and compute totals client-side (same helper the
      // manual flow uses, so numbers stay consistent).
      const validLines = draft.lines
        .map((line) => ({
          description: (line.description || '').trim(),
          detail: (line.detail || '').trim() || null,
          quantity: Number(line.quantity) || 0,
          unit: line.unit || 'u',
          unit_price: Number(line.unit_price) || 0,
          tva_rate: typeof line.tva_rate === 'number' ? line.tva_rate : 20,
        }))
        .filter((line) => line.description.length > 0);

      if (validLines.length === 0) {
        setSaveError('Aucune ligne valide à enregistrer.');
        setSaving(false);
        return;
      }

      const tva = computeTvaBreakdown(validLines);

      const validUntil = new Date();
      validUntil.setDate(validUntil.getDate() + 30);
      const validUntilStr = validUntil.toISOString().split('T')[0];

      // Match a client by name if the assistant didn't already have one
      // selected explicitly.
      let clientId: string | null = draft.clientId;
      if (!clientId && draft.clientName?.trim()) {
        const { data } = await supabase
          .from('clients')
          .select('id')
          .eq('user_id', user.id)
          .ilike('name', draft.clientName.trim())
          .is('deleted_at', null)
          .maybeSingle();
        if (data) clientId = data.id;
      }

      const title = draft.title.trim() || 'Devis IA';
      const description = draft.description || '';

      // Insert the quote. On a unique-violation (23505) — another insert
      // snuck in between our number lookup and our write — we retry up to
      // two more times before giving up.
      const insertQuote = async () => {
        const quoteNumber = await getNextQuoteNumber(supabase, user.id);
        return supabase
          .from('quotes')
          .insert({
            user_id: user.id,
            quote_number: quoteNumber,
            client_id: clientId,
            title,
            description,
            status: 'brouillon',
            total_ht: tva.total_ht,
            total_tva: tva.total_tva,
            total_ttc: tva.total_ttc,
            tva_rate: tva.primary_rate,
            tva_breakdown: tva.tva_breakdown,
            valid_until: validUntilStr,
          })
          .select('id, quote_number')
          .single();
      };

      let insertResult = await insertQuote();
      let retries = 0;
      while (insertResult.error && insertResult.error.code === '23505' && retries < 2) {
        retries += 1;
        insertResult = await insertQuote();
      }

      if (insertResult.error || !insertResult.data) {
        throw new Error(insertResult.error?.message || 'Impossible de créer le devis.');
      }

      const quoteId = insertResult.data.id;
      const finalNumber = insertResult.data.quote_number;

      // Insert lines. If this fails we leave an empty quote behind — rare,
      // and the user can still see it in the list and fix it.
      const { error: linesError } = await supabase.from('quote_lines').insert(
        validLines.map((line, i) => ({
          user_id: user.id,
          quote_id: quoteId,
          description: line.description,
          detail: line.detail || null,
          quantity: line.quantity,
          unit: line.unit,
          unit_price: line.unit_price,
          tva_rate: line.tva_rate,
          total: line.quantity * line.unit_price,
          position: i,
        })),
      );

      if (linesError) {
        throw new Error(linesError.message);
      }

      // Create the matching lead row so the pipeline picks it up, mirroring
      // the manual save path.
      await supabase.from('leads').insert({
        user_id: user.id,
        name: title || `Devis ${finalNumber}`,
        client_id: clientId,
        quote_id: quoteId,
        stage: 'devis_envoye',
        source: 'devis',
        value: tva.total_ttc,
        notes: description,
      });

      // Success → jump back to the list with a query param the list page
      // picks up to show a confirmation banner.
      router.push(`/devis?ai_created=${encodeURIComponent(finalNumber)}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue.';
      setSaveError(message);
      setSaving(false);
    }
  }

  return (
    <div className="pb-24 sm:pb-8">
      <button
        type="button"
        onClick={() => router.push('/devis')}
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour aux devis
      </button>
      <div className="mb-5">
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
          Devis avec IA
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Décris ton chantier à voix haute, l&apos;IA rédige ton devis.
        </p>
      </div>
      {saveError && (
        <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {saveError}
        </div>
      )}
      <QuoteAiAssistant onUseDraft={handleUseDraft} saving={saving} />
    </div>
  );
}
