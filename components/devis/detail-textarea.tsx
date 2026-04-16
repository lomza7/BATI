'use client';

import { useRef, useEffect, useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';

interface Props {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  onAiGenerate?: () => Promise<string>;
  onAiError?: (message: string) => void;
  aiDisabled?: boolean;
}

const BULLET = '• ';

export function DetailTextarea({ value, onChange, onBlur, placeholder, onAiGenerate, onAiError, aiDisabled }: Props) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(el.scrollHeight, 76)}px`;
  }, [value]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== 'Enter' || e.shiftKey) return;
    e.preventDefault();
    const target = e.currentTarget;
    const start = target.selectionStart ?? value.length;
    const end = target.selectionEnd ?? value.length;

    const needsLeadingBullet = value.trim().length === 0 && start === 0;
    const insert = needsLeadingBullet ? `${BULLET}` : `\n${BULLET}`;

    const next = value.slice(0, start) + insert + value.slice(end);
    onChange(next);

    requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      const cursor = start + insert.length;
      el.focus();
      el.setSelectionRange(cursor, cursor);
    });
  }

  async function handleAiClick() {
    if (!onAiGenerate || loading) return;
    setLoading(true);
    try {
      const detail = await onAiGenerate();
      onChange(detail);
    } catch (err) {
      const message = err instanceof Error ? err.message : "L'IA n'a pas pu générer le détail.";
      onAiError?.(message);
    } finally {
      setLoading(false);
    }
  }

  const hasExisting = value.trim().length > 0;
  const aiLabel = loading
    ? 'Génération...'
    : hasExisting
      ? 'Améliorer avec l\u2019IA'
      : 'Générer avec l\u2019IA';

  return (
    <div className="relative">
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={onBlur}
        placeholder={placeholder}
        rows={3}
        disabled={loading}
        className="w-full min-h-[76px] rounded-md border border-input bg-background px-3 py-2 pr-3 text-sm leading-relaxed ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y disabled:opacity-60"
      />
      {onAiGenerate && (
        <button
          type="button"
          onClick={handleAiClick}
          disabled={loading || aiDisabled}
          title={aiLabel}
          className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full border border-[#d35400]/25 bg-white/90 px-2 py-1 text-[11px] font-medium text-[#a34700] shadow-sm transition hover:border-[#d35400]/45 hover:bg-[#fff7f0] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
          <span>{aiLabel}</span>
        </button>
      )}
    </div>
  );
}
