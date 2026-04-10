'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Check,
  Loader2,
  Wand2,
  Camera,
  Mic,
  Send,
  PenLine,
  FileText,
  Sparkles,
  Calculator,
  TrendingUp,
  History,
  ScrollText,
  ShieldCheck,
  RefreshCw,
  PartyPopper,
} from 'lucide-react';

/* ── Constants ─────────────────────────────────────────────────────── */

const DEFAULT_TRANSCRIPT =
  "Rénovation complète salle de bain chez M. Dupont au 14 rue des Tilleuls à Lyon 7e. Surface 6 m². Dépose de l'ancien carrelage sol et mur, faïence murale jusqu'à 1m80, nouveau receveur douche extra-plat 90×90, meuble vasque 80 cm avec miroir LED, robinetterie thermostatique, sèche-serviettes électrique 500 W. Reprise complète de l'étanchéité.";

const ANALYSIS_STEPS = [
  { label: 'Lecture attentive de ta demande', Icon: FileText },
  { label: 'Identification des prestations BTP', Icon: Sparkles },
  { label: 'Estimation des surfaces et quantités', Icon: Calculator },
  { label: 'Consultation des prix du marché français', Icon: TrendingUp },
  { label: 'Prise en compte de ton historique tarifaire', Icon: History },
  { label: 'Rédaction des lignes de devis', Icon: ScrollText },
  { label: 'Vérification finale et cohérence', Icon: ShieldCheck },
];

const GENERATED_LINES = [
  { label: 'Dépose carrelage sol + faïence murale existante', qty: '1 f', price: '450,00' },
  { label: 'Fourniture + pose carrelage sol 60×60 gris anthracite', qty: '6 m²', price: '540,00' },
  { label: 'Fourniture + pose faïence murale blanche mate', qty: '12 m²', price: '780,00' },
  { label: 'Receveur douche extra-plat 90×90 + bonde', qty: '1 u', price: '380,00' },
  { label: 'Meuble vasque 80 cm + miroir LED intégré', qty: '1 u', price: '620,00' },
  { label: 'Étanchéité sol et mur complète (SEL + SPEC)', qty: '1 f', price: '680,00' },
  { label: "Main d'œuvre, évacuation gravats, nettoyage", qty: '1 f', price: '1 050,00' },
];

const STEP_INTERVAL = 500;

const PHOTOS = [
  { from: 'from-slate-300', to: 'to-slate-500', label: 'Salle de bain' },
  { from: 'from-stone-300', to: 'to-stone-500', label: 'Mur douche' },
  { from: 'from-zinc-300', to: 'to-zinc-500', label: 'Sol actuel' },
];

const CONFETTI_COLORS = ['#D35400', '#e67e22', '#f39c12', '#27ae60', '#2980b9', '#8e44ad', '#e74c3c'];

/* ── Component ─────────────────────────────────────────────────────── */

type Phase = 'idle' | 'analyzing' | 'ready' | 'sent';

export function DevisInteractiveDemo() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [transcript, setTranscript] = useState(DEFAULT_TRANSCRIPT);
  const [currentStep, setCurrentStep] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  /* Analysis step animation */
  useEffect(() => {
    if (phase !== 'analyzing') {
      setCurrentStep(0);
      return;
    }
    let step = 0;
    setCurrentStep(0);
    const id = setInterval(() => {
      step += 1;
      if (step >= ANALYSIS_STEPS.length) {
        clearInterval(id);
        setTimeout(() => setPhase('ready'), 400);
        return;
      }
      setCurrentStep(step);
    }, STEP_INTERVAL);
    return () => clearInterval(id);
  }, [phase]);

  /* Confetti animation */
  useEffect(() => {
    if (phase !== 'sent') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;
    canvas.width = w * 2;
    canvas.height = h * 2;
    ctx.scale(2, 2);

    const particles = Array.from({ length: 50 }, () => ({
      x: w / 2 + (Math.random() - 0.5) * 60,
      y: h / 2,
      vx: (Math.random() - 0.5) * 12,
      vy: -Math.random() * 10 - 4,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      size: Math.random() * 6 + 3,
      rot: Math.random() * 360,
      rs: (Math.random() - 0.5) * 15,
      o: 1,
    }));

    let raf = 0;
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      let alive = false;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.vy += 0.25;
        p.y += p.vy;
        p.rot += p.rs;
        p.o -= 0.008;
        if (p.o <= 0) continue;
        alive = true;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rot * Math.PI) / 180);
        ctx.globalAlpha = p.o;
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      }
      if (alive) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  function handleGenerate() {
    if (!transcript.trim()) return;
    setPhase('analyzing');
  }

  function handleReset() {
    setPhase('idle');
    setTranscript(DEFAULT_TRANSCRIPT);
  }

  const showInput = phase === 'idle' || phase === 'analyzing';

  return (
    <div className="space-y-3">
      {/* ── Transcript + photos (idle & analyzing) ── */}
      {showInput && (
        <>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--landing-accent)] text-white">
              <Mic className="h-3 w-3" />
            </div>
            <div>
              <span className="text-[11px] font-semibold text-[var(--landing-text)]">
                Décris ton chantier
              </span>
              <span className="ml-1.5 inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full bg-[#D97706]/10 text-[#D97706] font-semibold">
                <Sparkles className="w-2.5 h-2.5" /> Claude Sonnet
              </span>
            </div>
          </div>

          <div className="flex items-end gap-[2px] h-5">
            {Array.from({ length: 35 }).map((_, i) => (
              <span
                key={i}
                className="flex-1 rounded-sm bg-[var(--landing-accent)]/30"
                style={{ height: `${Math.abs(Math.sin(i * 0.5) * Math.cos(i * 0.3)) * 80 + 15}%` }}
              />
            ))}
          </div>

          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            disabled={phase === 'analyzing'}
            rows={4}
            className="w-full resize-none rounded-lg border border-[var(--landing-border)] bg-white p-3 text-[11px] leading-relaxed text-[var(--landing-text)] placeholder:text-[var(--landing-muted)] focus:border-[var(--landing-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--landing-accent)]/30 disabled:opacity-60 min-h-[100px] sm:min-h-[120px]"
            placeholder="Ex : Rénovation salle de bain, dépose carrelage, pose receveur douche..."
          />

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--landing-muted)]">
              Photos
            </span>
            {PHOTOS.map((ph, i) => (
              <div
                key={i}
                className={`relative w-12 h-12 sm:w-14 sm:h-14 rounded-lg bg-gradient-to-br ${ph.from} ${ph.to} border border-[var(--landing-border)] flex items-center justify-center overflow-hidden`}
              >
                <Camera className="w-4 h-4 text-white/80" />
                <span className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-[7px] text-center py-0.5 truncate px-0.5">
                  {ph.label}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Generate button (idle) ── */}
      {phase === 'idle' && (
        <button
          type="button"
          onClick={handleGenerate}
          disabled={!transcript.trim()}
          className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--landing-accent)] text-white px-4 py-3 text-[12px] font-semibold shadow-sm hover:opacity-90 transition-opacity disabled:opacity-40 min-h-[44px]"
        >
          <Wand2 className="w-4 h-4" />
          Lancer la magie
        </button>
      )}

      {/* ── Analysis steps (analyzing) ── */}
      {phase === 'analyzing' && (
        <div className="space-y-1.5 py-1">
          {ANALYSIS_STEPS.map((step, i) => {
            const done = i < currentStep;
            const active = i === currentStep;
            const StepIcon = step.Icon;
            return (
              <div
                key={i}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-1.5 transition-all duration-300 ${
                  active ? 'bg-[var(--landing-accent)]/10' : done ? 'opacity-60' : 'opacity-30'
                }`}
              >
                <div
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors duration-300 ${
                    done
                      ? 'bg-emerald-100 text-emerald-600'
                      : active
                      ? 'bg-[var(--landing-accent)] text-white'
                      : 'bg-[var(--landing-stone)] text-[var(--landing-muted)]'
                  }`}
                >
                  {done ? (
                    <Check className="w-3 h-3" />
                  ) : active ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <StepIcon className="w-3 h-3" />
                  )}
                </div>
                <span
                  className={`text-[11px] ${
                    active ? 'font-semibold text-[var(--landing-text)]' : 'text-[var(--landing-muted)]'
                  }`}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Generated quote card (ready) ── */}
      {phase === 'ready' && (
        <div className="rounded-xl border border-[var(--landing-accent)]/30 bg-white shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-[var(--landing-accent)]/10 to-transparent px-4 py-3 border-b border-[var(--landing-border)]">
            <div className="flex items-center gap-1.5 flex-wrap mb-1">
              <span className="text-[10px] font-mono text-[var(--landing-accent)] font-bold">
                D-2026-043
              </span>
              <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--landing-accent)]/10 text-[var(--landing-accent)] font-bold">
                <Sparkles className="w-2.5 h-2.5" /> Rédigé par Claude
              </span>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                92 %
              </span>
            </div>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-[var(--landing-text)]">
                  Rénovation salle de bain
                </div>
                <div className="text-[10px] text-[var(--landing-muted)]">
                  M. Dupont · 14 rue des Tilleuls, Lyon 7e
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[9px] text-[var(--landing-muted)] uppercase tracking-wide">TTC</div>
                <div className="text-sm font-bold text-[var(--landing-text)]">4 950,00 €</div>
              </div>
            </div>
          </div>

          <div className="divide-y divide-[var(--landing-border)]">
            {GENERATED_LINES.map((line, i) => (
              <div
                key={i}
                className="flex items-start gap-2 px-4 py-2 text-[11px] hover:bg-[var(--landing-off)]/40 transition-colors"
              >
                <Check className="w-3 h-3 text-emerald-500 mt-0.5 shrink-0" />
                <span className="flex-1 text-[var(--landing-text)] min-w-0">{line.label}</span>
                <span className="text-[var(--landing-muted)] shrink-0 w-10 text-right">{line.qty}</span>
                <span className="font-semibold text-[var(--landing-text)] shrink-0 w-16 text-right">
                  {line.price} €
                </span>
              </div>
            ))}
          </div>

          <div className="bg-[var(--landing-off)] px-4 py-3 space-y-1">
            <div className="flex justify-between text-[11px] text-[var(--landing-muted)]">
              <span>Sous-total HT</span>
              <span className="font-semibold text-[var(--landing-text)]">4 500,00 €</span>
            </div>
            <div className="flex justify-between text-[11px] text-[var(--landing-muted)]">
              <span>TVA 10 % (rénovation)</span>
              <span className="font-semibold text-[var(--landing-text)]">450,00 €</span>
            </div>
            <div className="flex justify-between text-xs pt-1 border-t border-[var(--landing-border)]">
              <span className="font-bold text-[var(--landing-text)]">Total TTC</span>
              <span className="font-bold text-[var(--landing-accent)]">4 950,00 €</span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 px-4 py-2.5 border-t border-[var(--landing-border)] bg-white">
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-lg border border-[var(--landing-border)] bg-white text-[var(--landing-text)] px-2.5 py-1.5 text-[10px] font-semibold hover:bg-[var(--landing-off)] transition-colors"
            >
              <PenLine className="w-2.5 h-2.5" />
              Modifier
            </button>
            <button
              type="button"
              onClick={() => setPhase('sent')}
              className="inline-flex items-center gap-1 rounded-lg bg-[var(--landing-accent)] text-white px-3 py-1.5 text-[10px] font-semibold shadow-sm hover:opacity-90 transition-opacity"
            >
              <Send className="w-2.5 h-2.5" />
              Envoyer au client
            </button>
          </div>

          <div className="flex justify-center py-2 border-t border-[var(--landing-border)]">
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--landing-muted)] hover:text-[var(--landing-text)] transition-colors"
            >
              <RefreshCw className="w-2.5 h-2.5" />
              Recommencer la démo
            </button>
          </div>
        </div>
      )}

      {/* ── Sent celebration ── */}
      {phase === 'sent' && (
        <div className="relative rounded-xl border border-emerald-200 bg-white shadow-sm overflow-hidden">
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ zIndex: 10 }}
          />
          <div className="relative flex flex-col items-center justify-center py-10 px-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 mb-4">
              <PartyPopper className="w-7 h-7 text-emerald-600" />
            </div>
            <h3 className="text-lg font-bold text-[var(--landing-text)] mb-1">
              Devis envoyé !
            </h3>
            <p className="text-[12px] text-[var(--landing-muted)] mb-1">
              M. Dupont va recevoir son devis par email avec un lien de signature électronique.
            </p>
            <p className="text-[11px] text-emerald-600 font-semibold mb-5">
              Bravo, tout ça en moins de 30 secondes.
            </p>
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--landing-accent)] text-white px-4 py-2.5 text-[11px] font-semibold shadow-sm hover:opacity-90 transition-opacity"
            >
              <RefreshCw className="w-3 h-3" />
              Recommencer la démo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
