'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { QuoteAiAssistant, type AiQuoteDraft } from '@/components/devis/quote-ai-assistant';

// Dropped into sessionStorage just before we navigate back — /devis reads it
// on mount to trigger the normal applyAiDraft flow (which opens the create
// dialog pre-filled). Matches the key used by the devis list page.
const PENDING_DRAFT_KEY = 'hellobat_ai_quote_pending_draft';

export default function DevisAiPage() {
  const router = useRouter();

  function handleUseDraft(draft: AiQuoteDraft) {
    try {
      sessionStorage.setItem(PENDING_DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // If storage is unavailable (private mode on old Safari), we still
      // navigate back — the user will simply have to retry. Better than
      // crashing here.
    }
    router.push('/devis');
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
      <QuoteAiAssistant onUseDraft={handleUseDraft} />
    </div>
  );
}
