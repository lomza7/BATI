'use client';

import { useEffect, useState } from 'react';
import {
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Palette,
  RefreshCw,
  Sparkles,
  UserPlus,
  Wand2,
} from 'lucide-react';

/* ── Data ──────────────────────────────────────────────────────────── */

const ROOM_TYPES = [
  { id: 'chambre', label: 'Chambre', available: true },
  { id: 'cuisine', label: 'Cuisine', available: false },
  { id: 'salon', label: 'Salon', available: false },
  { id: 'sdb', label: 'Salle de bain', available: false },
  { id: 'facade', label: 'Façade', available: false },
  { id: 'terrasse', label: 'Terrasse', available: false },
];

const STYLES = [
  { id: 'moderne', label: 'Moderne', available: true },
  { id: 'classique', label: 'Classique', available: false },
  { id: 'industriel', label: 'Industriel', available: false },
  { id: 'scandinave', label: 'Scandinave', available: false },
  { id: 'mediterraneen', label: 'Méditerranéen', available: false },
  { id: 'zen', label: 'Zen', available: false },
];

const BEFORE_IMG = '/demo/before.jpg';
const AFTER_IMG = '/demo/after.jpg';

const STEP_ICONS = [Camera, Palette, Sparkles, Check];
const STEP_LABELS = [
  'Analyse de la photo',
  'Application du style',
  'Génération du rendu IA',
  'Finalisation',
];

/* ── Component ─────────────────────────────────────────────────────── */

type Phase = 'select' | 'generating' | 'result';

export function RendusInteractiveDemo() {
  const [phase, setPhase] = useState<Phase>('select');
  const [roomIndex, setRoomIndex] = useState(0);
  const [styleIndex, setStyleIndex] = useState(0);
  const [stepIndex, setStepIndex] = useState(-1);
  const [sliderValue, setSliderValue] = useState(50);
  const [showLead, setShowLead] = useState(false);

  /* Generation animation */
  useEffect(() => {
    if (phase !== 'generating') return;
    setStepIndex(-1);
    let step = 0;
    const interval = setInterval(function () {
      setStepIndex(step);
      step++;
      if (step >= STEP_LABELS.length) {
        clearInterval(interval);
        setTimeout(function () {
          setPhase('result');
          setSliderValue(50);
          setTimeout(function () {
            setShowLead(true);
          }, 800);
        }, 400);
      }
    }, 450);
    return function () {
      clearInterval(interval);
    };
  }, [phase]);

  function handleGenerate() {
    setPhase('generating');
    setShowLead(false);
  }

  function handleReset() {
    setPhase('select');
    setStepIndex(-1);
    setShowLead(false);
    setSliderValue(50);
  }

  const room = ROOM_TYPES[roomIndex];
  const style = STYLES[styleIndex];

  return (
    <div className="space-y-3">
      {/* ── Phase SELECT ── */}
      {phase === 'select' && (
        <>
          {/* Photo preview */}
          <div className="relative aspect-[4/3] rounded-xl overflow-hidden">
            <img
              src={BEFORE_IMG}
              alt="Photo avant travaux"
              className="w-full h-full object-cover"
            />
            <div className="absolute top-2 left-2 text-[8px] font-bold text-white bg-black/40 px-1.5 py-0.5 rounded">
              AVANT
            </div>
            <div className="absolute bottom-2 right-2 text-[8px] text-white/80 bg-black/40 px-1.5 py-0.5 rounded flex items-center gap-1">
              <Camera className="w-2.5 h-2.5" />
              {room.label.toLowerCase()}-avant.jpg
            </div>
          </div>

          {/* Room selector */}
          <div>
            <div className="text-[9px] font-semibold text-[var(--landing-muted)] uppercase tracking-wider mb-1.5">
              Type de pièce
            </div>
            <div className="flex gap-1 flex-wrap">
              {ROOM_TYPES.map(function (r, i) {
                return (
                  <button
                    key={r.id}
                    type="button"
                    disabled={!r.available}
                    onClick={function () {
                      if (r.available) setRoomIndex(i);
                    }}
                    className={
                      'px-2 py-1 rounded-full text-[9px] font-semibold transition-all ' +
                      (i === roomIndex
                        ? 'bg-[var(--landing-accent)] text-white'
                        : !r.available
                          ? 'bg-[var(--landing-off)] text-[var(--landing-muted)] opacity-40 cursor-not-allowed'
                          : 'bg-[var(--landing-off)] text-[var(--landing-muted)] hover:bg-[var(--landing-stone)]')
                    }
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Style selector */}
          <div>
            <div className="text-[9px] font-semibold text-[var(--landing-muted)] uppercase tracking-wider mb-1.5">
              Style souhaité
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {STYLES.map(function (s, i) {
                return (
                  <button
                    key={s.id}
                    type="button"
                    disabled={!s.available}
                    onClick={function () {
                      if (s.available) setStyleIndex(i);
                    }}
                    className={
                      'rounded-lg p-1.5 text-center transition-all ' +
                      (i === styleIndex
                        ? 'ring-2 ring-[var(--landing-accent)] shadow-sm'
                        : !s.available
                          ? 'border border-[var(--landing-border)] opacity-40 cursor-not-allowed'
                          : 'border border-[var(--landing-border)] hover:border-[var(--landing-accent)]/40')
                    }
                  >
                    <div className="text-[8px] font-semibold text-[var(--landing-text)]">
                      {s.label}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Generate button */}
          <button
            type="button"
            onClick={handleGenerate}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--landing-accent)] text-white px-4 py-3 text-[12px] font-semibold shadow-sm hover:opacity-90 transition-opacity min-h-[44px]"
          >
            <Wand2 className="w-4 h-4" />
            Générer l&apos;avant/après
          </button>
        </>
      )}

      {/* ── Phase GENERATING ── */}
      {phase === 'generating' && (
        <>
          {/* Photo with AI overlay */}
          <div className="relative aspect-[4/3] rounded-xl overflow-hidden">
            <img
              src={BEFORE_IMG}
              alt="Photo avant travaux"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
              <div className="text-center">
                <div className="w-8 h-8 mx-auto mb-1 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                <div className="text-[10px] font-semibold text-white">
                  IA en cours…
                </div>
              </div>
            </div>
          </div>

          {/* Steps */}
          <div className="space-y-1.5">
            {STEP_LABELS.map(function (label, i) {
              const done = i <= stepIndex;
              const active =
                i === stepIndex + 1 || (stepIndex === -1 && i === 0);
              const Icon = STEP_ICONS[i];
              return (
                <div key={i} className="flex items-center gap-2">
                  <div
                    className={
                      'w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ' +
                      (done
                        ? 'bg-emerald-500'
                        : active
                          ? 'bg-[var(--landing-accent)]'
                          : 'bg-[var(--landing-stone)]')
                    }
                  >
                    {done ? (
                      <Check className="w-3 h-3 text-white" />
                    ) : active ? (
                      <div className="w-2.5 h-2.5 rounded-full border border-white/50 border-t-white animate-spin" />
                    ) : (
                      <Icon className="w-2.5 h-2.5 text-[var(--landing-muted)]" />
                    )}
                  </div>
                  <span
                    className={
                      'text-[10px] font-medium transition-colors duration-300 ' +
                      (done
                        ? 'text-emerald-600'
                        : active
                          ? 'text-[var(--landing-text)]'
                          : 'text-[var(--landing-muted)]')
                    }
                  >
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── Phase RESULT ── */}
      {phase === 'result' && (
        <>
          {/* Before/After slider */}
          <div className="relative aspect-[4/3] rounded-xl overflow-hidden select-none">
            {/* Before (full background) */}
            <img
              src={BEFORE_IMG}
              alt="Avant travaux"
              className="absolute inset-0 w-full h-full object-cover"
            />
            {/* After (clipped by slider) */}
            <div
              className="absolute inset-0"
              style={{
                clipPath: 'inset(0 ' + (100 - sliderValue) + '% 0 0)',
              }}
            >
              <img
                src={AFTER_IMG}
                alt="Après travaux — rendu IA"
                className="w-full h-full object-cover"
              />
            </div>
            {/* Slider line */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg"
              style={{ left: sliderValue + '%' }}
            >
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 bg-white rounded-full shadow-md flex items-center justify-center">
                <div className="flex gap-0.5">
                  <ChevronLeft className="w-2.5 h-2.5 text-[var(--landing-muted)]" />
                  <ChevronRight className="w-2.5 h-2.5 text-[var(--landing-muted)]" />
                </div>
              </div>
            </div>
            {/* Labels */}
            <div className="absolute bottom-2 left-2 text-[8px] font-bold text-white bg-black/50 px-1.5 py-0.5 rounded">
              AVANT
            </div>
            <div className="absolute top-2 right-2 text-[8px] font-bold text-white bg-[var(--landing-accent)] px-1.5 py-0.5 rounded flex items-center gap-0.5">
              <Sparkles className="w-2 h-2" />
              APRÈS
            </div>
            {/* Range input overlay */}
            <input
              type="range"
              min={0}
              max={100}
              value={sliderValue}
              onChange={function (e) {
                setSliderValue(Number(e.target.value));
              }}
              className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize"
              style={{ zIndex: 10 }}
            />
          </div>

          {/* Info */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] font-semibold text-[var(--landing-text)]">
                {room.label} — Style {style.label}
              </div>
              <div className="text-[9px] text-[var(--landing-muted)]">
                Glissez pour comparer avant/après
              </div>
            </div>
            <div className="text-[9px] font-medium text-[var(--landing-accent)]">
              Généré en 4s
            </div>
          </div>

          {/* Lead captured notification */}
          {showLead && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                <UserPlus className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-bold text-emerald-800">
                  Nouveau lead capturé !
                </div>
                <div className="text-[9px] text-emerald-600">
                  prospect@example.com — via votre lien personnalisé
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-center pt-0.5">
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center justify-center gap-1.5 text-[10px] font-semibold text-[var(--landing-muted)] hover:text-[var(--landing-text)] transition-colors"
            >
              <RefreshCw className="w-2.5 h-2.5" />
              Recommencer la démo
            </button>
          </div>
        </>
      )}
    </div>
  );
}
