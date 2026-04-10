'use client';

import { Check, Eye, Type } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SITE_THEMES, type SiteTheme } from '@/lib/site-utils';

interface ThemePreviewCardProps {
  theme: SiteTheme;
  selected: boolean;
  onSelect: () => void;
  onPreview: () => void;
}

export function ThemePreviewCard({ theme, selected, onSelect, onPreview }: ThemePreviewCardProps) {
  const s = SITE_THEMES[theme];

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-2xl border-2 bg-card transition-all',
        selected
          ? 'border-primary shadow-lg ring-4 ring-primary/10'
          : 'border-border hover:border-border/60 hover:shadow-md'
      )}
    >
      {/* ── Mini website mockup ── */}
      <button
        type="button"
        onClick={onSelect}
        className="block w-full text-left"
        aria-label={`Sélectionner le thème ${s.name}`}
      >
        <div
          className="relative aspect-[16/11] overflow-hidden"
          style={{ backgroundColor: s.bg, fontFamily: s.fontFamily }}
        >
          {/* Header bar */}
          <div
            className="flex items-center justify-between px-3 py-2 border-b"
            style={{ borderColor: s.border }}
          >
            <div className="flex items-center gap-1.5">
              <div
                className="h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: s.accent, borderRadius: s.radius }}
              />
              <div className="h-1.5 w-10 rounded-sm" style={{ backgroundColor: s.text }} />
            </div>
            <div className="flex gap-1.5">
              <div className="h-1 w-5 rounded" style={{ backgroundColor: s.textMuted }} />
              <div className="h-1 w-5 rounded" style={{ backgroundColor: s.textMuted }} />
              <div className="h-1 w-5 rounded" style={{ backgroundColor: s.textMuted }} />
              <div
                className="h-3 w-8 rounded"
                style={{ backgroundColor: s.accent, borderRadius: s.radius }}
              />
            </div>
          </div>

          {/* Hero */}
          <div
            className="px-3 py-4 text-center relative"
            style={{
              background: `linear-gradient(135deg, ${s.bg} 0%, ${s.bgAlt} 100%)`,
            }}
          >
            <div className="h-2 w-32 mx-auto rounded mb-1.5" style={{ backgroundColor: s.heading }} />
            <div className="h-2 w-24 mx-auto rounded mb-2" style={{ backgroundColor: s.heading }} />
            <div className="h-1 w-28 mx-auto rounded mb-1" style={{ backgroundColor: s.textMuted }} />
            <div className="h-1 w-20 mx-auto rounded mb-2.5" style={{ backgroundColor: s.textMuted }} />
            <div
              className="inline-flex items-center justify-center px-3 py-1.5"
              style={{ backgroundColor: s.accent, borderRadius: s.radius }}
            >
              <div className="h-1.5 w-12 rounded bg-white/95" />
            </div>
          </div>

          {/* Services grid */}
          <div className="grid grid-cols-3 gap-1.5 px-3 py-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="p-1.5 border flex flex-col gap-1"
                style={{
                  backgroundColor: s.cardBg,
                  borderColor: s.border,
                  borderRadius: s.radius,
                }}
              >
                <div
                  className="h-2.5 w-2.5 rounded-sm"
                  style={{ backgroundColor: s.accent, borderRadius: s.radius }}
                />
                <div className="h-1 w-full rounded" style={{ backgroundColor: s.text }} />
                <div className="h-0.5 w-3/4 rounded" style={{ backgroundColor: s.textMuted }} />
              </div>
            ))}
          </div>
        </div>
      </button>

      {/* ── Info & actions ── */}
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-sm text-foreground">{s.name}</p>
              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/50 rounded px-1.5 py-0.5">
                <Type className="h-2.5 w-2.5" /> {s.fontLabel}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{s.tagline}</p>
          </div>
          {selected && (
            <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center shrink-0 shadow-sm">
              <Check className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground line-clamp-2 leading-snug">
          <span className="font-medium text-foreground/80">Idéal pour : </span>
          {s.target}
        </p>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onPreview();
          }}
          className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-medium rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors py-2"
        >
          <Eye className="h-3.5 w-3.5" /> Visualiser en grand
        </button>
      </div>
    </div>
  );
}
