'use client';

import { useState } from 'react';
import {
  Globe,
  Sparkles,
  Star,
  Phone,
  Mail,
  Wrench,
  Zap,
  Thermometer,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';

/* ── Themes ────────────────────────────────────────────────────────── */

const THEMES = [
  {
    id: 'moderne',
    label: 'Moderne',
    bg: '#1a1a2e',
    bgAlt: '#16213e',
    accent: '#3b82f6',
    text: '#ffffff',
    textMuted: '#94a3b8',
    font: 'sans-serif',
  },
  {
    id: 'chaleureux',
    label: 'Chaleureux',
    bg: '#faf5ef',
    bgAlt: '#f5ead8',
    accent: '#b45309',
    text: '#1c1917',
    textMuted: '#78716c',
    font: 'Georgia, serif',
  },
  {
    id: 'epure',
    label: 'Épuré',
    bg: '#ffffff',
    bgAlt: '#f0fdf4',
    accent: '#059669',
    text: '#111827',
    textMuted: '#6b7280',
    font: 'sans-serif',
  },
  {
    id: 'dynamique',
    label: 'Dynamique',
    bg: '#18181b',
    bgAlt: '#27272a',
    accent: '#ef4444',
    text: '#fafafa',
    textMuted: '#a1a1aa',
    font: 'sans-serif',
  },
];

const SERVICES = [
  { name: 'Dépannage', icon: Wrench },
  { name: 'Rénovation', icon: Zap },
  { name: 'Entretien', icon: Thermometer },
];

/* ── Component ─────────────────────────────────────────────────────── */

export function SiteWebInteractiveDemo() {
  const [themeIndex, setThemeIndex] = useState(2);
  const [published, setPublished] = useState(false);

  const theme = THEMES[themeIndex];

  function handlePublish() {
    setPublished(true);
  }

  function handleReset() {
    setPublished(false);
  }

  return (
    <div className="space-y-3">
      {/* ── AI badge ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-[#D97706]/10 text-[#D97706] font-semibold">
          <Sparkles className="w-2.5 h-2.5" /> Contenu généré par Claude
        </span>
        <span className="text-[9px] text-[var(--landing-muted)]">
          87 % du contenu rédigé par l'IA
        </span>
      </div>

      {/* ── Theme selector ── */}
      {!published && (
        <div>
          <div className="text-[10px] font-semibold text-[var(--landing-muted)] uppercase tracking-wider mb-2">
            Choisir un thème
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {THEMES.map((t, i) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setThemeIndex(i)}
                className={`rounded-lg p-1.5 text-center transition-all duration-200 ${
                  i === themeIndex
                    ? 'ring-2 ring-[var(--landing-accent)] shadow-md'
                    : 'border border-[var(--landing-border)] hover:border-[var(--landing-accent)]/40'
                }`}
              >
                <div
                  className="h-5 rounded-md mb-1"
                  style={{ background: `linear-gradient(135deg, ${t.bg}, ${t.accent})` }}
                />
                <span className="text-[8px] font-semibold text-[var(--landing-text)]">
                  {t.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Site preview ── */}
      <div
        className="rounded-xl overflow-hidden transition-all duration-500"
        style={{
          background: theme.bg,
          fontFamily: theme.font,
        }}
      >
        {/* Hero */}
        <div className="px-4 py-5 text-center" style={{ background: theme.bgAlt }}>
          <div
            className="text-sm font-bold mb-1 transition-colors duration-500"
            style={{ color: theme.text }}
          >
            Leroy Plomberie
          </div>
          <div
            className="text-[10px] mb-3 transition-colors duration-500"
            style={{ color: theme.textMuted }}
          >
            Votre plombier de confiance à Lyon depuis 1998
          </div>
          <div className="flex justify-center gap-2">
            <span
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-semibold text-white transition-colors duration-500"
              style={{ background: theme.accent }}
            >
              <Mail className="w-2.5 h-2.5" /> Demander un devis
            </span>
            <span
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-semibold border transition-colors duration-500"
              style={{ color: theme.text, borderColor: theme.textMuted + '40' }}
            >
              <Phone className="w-2.5 h-2.5" /> 06 12 34 56 78
            </span>
          </div>
        </div>

        {/* Services */}
        <div className="px-4 py-3">
          <div
            className="text-[10px] font-bold mb-2 text-center transition-colors duration-500"
            style={{ color: theme.text }}
          >
            Nos services
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {SERVICES.map((s) => (
              <div
                key={s.name}
                className="rounded-lg p-2 text-center transition-colors duration-500"
                style={{ background: theme.bgAlt }}
              >
                <div className="flex justify-center mb-1">
                  <s.icon className="w-3.5 h-3.5 transition-colors duration-500" style={{ color: theme.accent }} />
                </div>
                <div className="text-[8px] font-semibold transition-colors duration-500" style={{ color: theme.text }}>
                  {s.name}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Reviews snippet */}
        <div className="px-4 py-2 border-t transition-colors duration-500" style={{ borderColor: theme.textMuted + '20' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star key={s} className="w-2.5 h-2.5 fill-current transition-colors duration-500" style={{ color: theme.accent }} />
              ))}
              <span className="text-[9px] font-semibold ml-1 transition-colors duration-500" style={{ color: theme.text }}>
                4.8
              </span>
            </div>
            <span className="text-[8px] transition-colors duration-500" style={{ color: theme.textMuted }}>
              32 avis Google
            </span>
          </div>
        </div>

        {/* URL bar */}
        <div
          className="px-4 py-2 flex items-center gap-1.5 border-t transition-colors duration-500"
          style={{ borderColor: theme.textMuted + '20', background: theme.bgAlt }}
        >
          <Globe className="w-3 h-3 transition-colors duration-500" style={{ color: theme.accent }} />
          <span className="text-[9px] font-medium transition-colors duration-500" style={{ color: theme.textMuted }}>
            leroy-plomberie.hellobat.app
          </span>
          <ExternalLink className="w-2.5 h-2.5 ml-auto transition-colors duration-500" style={{ color: theme.textMuted }} />
        </div>
      </div>

      {/* ── Publish / Published ── */}
      {!published ? (
        <button
          type="button"
          onClick={handlePublish}
          className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--landing-accent)] text-white px-4 py-3 text-[12px] font-semibold shadow-sm hover:opacity-90 transition-opacity min-h-[44px]"
        >
          <Globe className="w-4 h-4" />
          Publier mon site
        </button>
      ) : (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center">
          <div className="flex justify-center mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
          </div>
          <div className="text-sm font-bold text-emerald-800 mb-0.5">
            Site publié !
          </div>
          <div className="text-[11px] text-emerald-600 mb-0.5">
            leroy-plomberie.hellobat.app
          </div>
          <div className="text-[10px] text-emerald-700/70 mb-3">
            Votre site est en ligne et référencé sur Google.
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--landing-muted)] hover:text-[var(--landing-text)] transition-colors"
          >
            <RefreshCw className="w-2.5 h-2.5" />
            Recommencer la démo
          </button>
        </div>
      )}
    </div>
  );
}
