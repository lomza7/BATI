'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Check,
  Euro,
  PartyPopper,
  RefreshCw,
  User,
} from 'lucide-react';

/* ── Data ──────────────────────────────────────────────────────────── */

const COLUMNS = [
  { id: 'nouveau', label: 'Nouveau', dot: 'bg-slate-400' },
  { id: 'contacte', label: 'Contacté', dot: 'bg-blue-500' },
  { id: 'devis', label: 'Devis envoyé', dot: 'bg-amber-500' },
  { id: 'gagne', label: 'Gagné', dot: 'bg-emerald-500' },
];

interface Lead {
  id: number;
  name: string;
  initials: string;
  project: string;
  amount: string;
  column: string;
}

const INITIAL_LEADS: Lead[] = [
  { id: 1, name: 'M. Dupont', initials: 'MD', project: 'Salle de bain', amount: '8 500 €', column: 'nouveau' },
  { id: 2, name: 'Mme Bernard', initials: 'MB', project: 'Toiture terrasse', amount: '15 200 €', column: 'nouveau' },
  { id: 3, name: 'SCI Martin', initials: 'SM', project: 'Réfection façade', amount: '22 000 €', column: 'contacte' },
  { id: 4, name: 'M. Leroy', initials: 'ML', project: 'Plomberie complète', amount: '6 300 €', column: 'devis' },
  { id: 5, name: 'Mme Petit', initials: 'MP', project: 'Clim mono-split', amount: '3 800 €', column: 'devis' },
];

const CONFETTI_COLORS = ['#D35400', '#e67e22', '#f39c12', '#27ae60', '#2980b9', '#8e44ad'];

/* ── Component ─────────────────────────────────────────────────────── */

export function ProspectionInteractiveDemo() {
  const [leads, setLeads] = useState<Lead[]>(INITIAL_LEADS);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [wonId, setWonId] = useState<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  /* Confetti on won */
  useEffect(() => {
    if (wonId === null) return;
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
      x: w / 2 + (Math.random() - 0.5) * 80,
      y: h * 0.4,
      vx: (Math.random() - 0.5) * 14,
      vy: -Math.random() * 10 - 3,
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
        p.o -= 0.01;
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

    const timeout = setTimeout(() => setWonId(null), 2500);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timeout);
    };
  }, [wonId]);

  function handleCardClick(lead: Lead) {
    if (selectedId === lead.id) {
      setSelectedId(null);
      return;
    }
    if (selectedId !== null) {
      setSelectedId(null);
      return;
    }
    setSelectedId(lead.id);
  }

  function handleColumnClick(colId: string) {
    if (selectedId === null) return;
    const lead = leads.find((l) => l.id === selectedId);
    if (!lead || lead.column === colId) {
      setSelectedId(null);
      return;
    }

    setLeads((prev) =>
      prev.map((l) => (l.id === selectedId ? { ...l, column: colId } : l))
    );

    if (colId === 'gagne') {
      setWonId(selectedId);
    }
    setSelectedId(null);
  }

  function handleReset() {
    setLeads(INITIAL_LEADS);
    setSelectedId(null);
    setWonId(null);
  }

  const hasChanges = JSON.stringify(leads) !== JSON.stringify(INITIAL_LEADS);

  return (
    <div className="relative space-y-2">
      {/* Confetti canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ zIndex: 20 }}
      />

      {/* Instruction */}
      <div className="text-center">
        <span className="text-[9px] text-[var(--landing-accent)] font-medium">
          {selectedId
            ? 'Cliquez sur une colonne pour déplacer le prospect'
            : 'Cliquez sur un prospect pour le déplacer'}
        </span>
      </div>

      {/* Kanban columns */}
      <div className="flex gap-1.5">
        {COLUMNS.map((col) => {
          const colLeads = leads.filter((l) => l.column === col.id);
          const isTarget = selectedId !== null;

          return (
            <div
              key={col.id}
              className={`flex-1 min-w-0 rounded-lg p-1.5 transition-all duration-200 ${
                isTarget
                  ? 'cursor-pointer ring-1 ring-[var(--landing-accent)]/30 hover:ring-[var(--landing-accent)] hover:bg-[var(--landing-accent)]/5'
                  : 'bg-[var(--landing-off)]'
              }`}
              onClick={() => handleColumnClick(col.id)}
            >
              {/* Column header */}
              <div className="flex items-center gap-1 mb-1.5 px-1">
                <div className={`w-2 h-2 rounded-full ${col.dot}`} />
                <span className="text-[8px] font-bold text-[var(--landing-text)] uppercase tracking-wider truncate">
                  {col.label}
                </span>
                {colLeads.length > 0 && (
                  <span className="text-[8px] text-[var(--landing-muted)] font-semibold ml-auto shrink-0">
                    {colLeads.length}
                  </span>
                )}
              </div>

              {/* Cards */}
              <div className="space-y-1 min-h-[60px]">
                {colLeads.map((lead) => {
                  const isSelected = selectedId === lead.id;
                  const isWon = col.id === 'gagne';
                  return (
                    <button
                      key={lead.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCardClick(lead);
                      }}
                      className={`w-full text-left rounded-md p-1.5 border transition-all duration-200 ${
                        isSelected
                          ? 'border-[var(--landing-accent)] ring-2 ring-[var(--landing-accent)]/30 shadow-md bg-white scale-[1.02]'
                          : isWon
                          ? 'border-emerald-200 bg-emerald-50 hover:shadow-sm'
                          : 'border-[var(--landing-border)] bg-white hover:shadow-sm hover:border-[var(--landing-accent)]/30'
                      }`}
                    >
                      <div className="flex items-center gap-1 mb-0.5">
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 text-white text-[6px] font-bold ${
                          isWon ? 'bg-emerald-500' : 'bg-[var(--landing-accent)]'
                        }`}>
                          {isWon ? <Check className="w-2.5 h-2.5" /> : lead.initials[0]}
                        </div>
                        <span className="text-[8px] font-semibold text-[var(--landing-text)] truncate">
                          {lead.name}
                        </span>
                      </div>
                      <div className="text-[7px] text-[var(--landing-muted)] truncate">
                        {lead.project}
                      </div>
                      <div className={`text-[8px] font-bold mt-0.5 ${
                        isWon ? 'text-emerald-600' : 'text-[var(--landing-accent)]'
                      }`}>
                        {lead.amount}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Reset */}
      {hasChanges && (
        <div className="flex justify-center pt-0.5">
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
