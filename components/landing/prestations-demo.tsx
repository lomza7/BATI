'use client';

import { useMemo, useState } from 'react';
import {
  Check,
  Minus,
  Package,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';

interface Prestation {
  id: number;
  name: string;
  description: string;
  category: string;
  unit: string;
  price: number;
  recurring?: 'mois' | 'trim.' | 'an';
}

const PRESTATIONS: Prestation[] = [
  { id: 1, name: 'Pose carrelage sol grès cérame', description: 'Fourniture + pose, format 60×60', category: 'Carrelage', unit: 'm²', price: 78 },
  { id: 2, name: 'Pose faïence murale SdB', description: 'Fourniture + pose jointoyée 25×40', category: 'Carrelage', unit: 'm²', price: 55 },
  { id: 3, name: 'Peinture murs 2 couches', description: 'Préparation + 2 couches acrylique mate', category: 'Peinture', unit: 'm²', price: 22 },
  { id: 4, name: 'Peinture plafond 2 couches', description: 'Sous-couche + 2 couches acrylique', category: 'Peinture', unit: 'm²', price: 26 },
  { id: 5, name: 'Remplacement mitigeur', description: 'Dépose, pose, raccordement, étanchéité', category: 'Plomberie', unit: 'unité', price: 95 },
  { id: 6, name: 'Installation WC suspendu', description: 'Bâti-support + cuvette + raccordement', category: 'Plomberie', unit: 'unité', price: 680 },
  { id: 7, name: 'Pose prise électrique 16A', description: 'Saignée, gaine, câble, prise + finition', category: 'Électricité', unit: 'unité', price: 85 },
  { id: 8, name: 'Tableau électrique complet', description: 'Coffret + disjoncteurs + câblage', category: 'Électricité', unit: 'unité', price: 1450 },
  { id: 9, name: 'Entretien chaudière gaz', description: 'Contrôle complet + attestation', category: 'Maintenance', unit: 'unité', price: 180, recurring: 'an' },
  { id: 10, name: 'Maintenance climatisation', description: 'Nettoyage + contrôle gaz', category: 'Maintenance', unit: 'unité', price: 120, recurring: 'trim.' },
  { id: 11, name: 'Entretien piscine', description: 'pH, chlore, filtres, skimmers', category: 'Maintenance', unit: 'unité', price: 250, recurring: 'mois' },
  { id: 12, name: 'Déplacement local', description: 'Aller-retour rayon 25 km', category: 'Divers', unit: 'forfait', price: 45 },
];

const CATEGORIES = ['Tous', 'Carrelage', 'Peinture', 'Plomberie', 'Électricité', 'Maintenance', 'Divers'];

function formatEuro(n: number) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n);
}

export function PrestationsInteractiveDemo() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Tous');
  const [cart, setCart] = useState<Record<number, number>>({ 1: 24, 3: 55 });
  const [flashId, setFlashId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    return PRESTATIONS.filter((p) => {
      const matchesCat = category === 'Tous' || p.category === category;
      const matchesQuery =
        !query ||
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        p.description.toLowerCase().includes(query.toLowerCase());
      return matchesCat && matchesQuery;
    });
  }, [category, query]);

  const cartItems = useMemo(() => {
    return Object.entries(cart)
      .map(([id, qty]) => {
        const p = PRESTATIONS.find((x) => x.id === Number(id));
        return p ? { ...p, qty } : null;
      })
      .filter((x): x is Prestation & { qty: number } => x !== null);
  }, [cart]);

  const totalHT = cartItems.reduce((sum, item) => sum + item.price * item.qty, 0);
  const totalTVA = totalHT * 0.2;
  const totalTTC = totalHT + totalTVA;

  function addToDevis(id: number) {
    setCart((c) => ({ ...c, [id]: (c[id] || 0) + 1 }));
    setFlashId(id);
    setTimeout(() => setFlashId((curr) => (curr === id ? null : curr)), 450);
  }

  function updateQty(id: number, delta: number) {
    setCart((c) => {
      const next = (c[id] || 0) + delta;
      if (next <= 0) {
        const { [id]: _removed, ...rest } = c;
        return rest;
      }
      return { ...c, [id]: next };
    });
  }

  function removeFromCart(id: number) {
    setCart((c) => {
      const { [id]: _removed, ...rest } = c;
      return rest;
    });
  }

  return (
    <div className="text-[var(--landing-text)]">
      {/* Summary bar — one line on mobile, 3 cards on desktop */}
      <div className="hidden md:grid grid-cols-3 gap-3 mb-4">
        <StatCard label="Prestations" value={`${PRESTATIONS.length}`} />
        <StatCard label="Catégories" value={`${CATEGORIES.length - 1}`} />
        <StatCard
          label="Récurrentes"
          value={`${PRESTATIONS.filter((p) => p.recurring).length}`}
          accent
        />
      </div>
      <div className="md:hidden flex items-center justify-between gap-2 mb-4 px-3 py-2.5 rounded-xl bg-white border border-[var(--landing-border)]">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[var(--landing-accent)]/10 flex items-center justify-center shrink-0">
            <Package className="w-4 h-4 text-[var(--landing-accent)]" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold leading-tight">Mes prestations</div>
            <div className="text-[11px] text-[var(--landing-muted)] leading-tight">
              {PRESTATIONS.length} services · {CATEGORIES.length - 1} catégories
            </div>
          </div>
        </div>
        <span className="shrink-0 text-[10px] font-medium px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
          {PRESTATIONS.filter((p) => p.recurring).length} récur.
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_300px] lg:grid-cols-[1fr_320px]">
        {/* Left: library */}
        <div className="space-y-3 min-w-0">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--landing-muted)]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher…"
              className="w-full pl-10 pr-3 py-2.5 text-sm rounded-xl border border-[var(--landing-border)] bg-white focus:outline-none focus:ring-2 focus:ring-[var(--landing-accent)]/20 focus:border-[var(--landing-accent)]/40"
            />
          </div>

          {/* Categories */}
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide -mx-1 px-1 pb-1">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={`shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                  category === c
                    ? 'bg-[var(--landing-accent)] text-white border-[var(--landing-accent)]'
                    : 'bg-white text-[var(--landing-muted)] border-[var(--landing-border)] hover:text-[var(--landing-text)]'
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          {/* Prestations list */}
          <div className="space-y-2 md:max-h-[420px] md:overflow-y-auto md:pr-1 md:-mr-1">
            {filtered.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--landing-border)] bg-white py-8 text-center text-sm text-[var(--landing-muted)]">
                Aucune prestation trouvée
              </div>
            ) : (
              filtered.map((p) => {
                const inCart = cart[p.id] > 0;
                const flashing = flashId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addToDevis(p.id)}
                    className={`w-full text-left rounded-xl border bg-white px-3 py-3 transition-all ${
                      flashing
                        ? 'border-[var(--landing-accent)] shadow-[0_0_0_3px_rgba(211,84,0,0.15)] -translate-y-px'
                        : inCart
                        ? 'border-[var(--landing-accent)]/40 bg-[var(--landing-accent)]/[0.04]'
                        : 'border-[var(--landing-border)] hover:border-[var(--landing-accent)]/40 active:bg-[var(--landing-off)]'
                    }`}
                  >
                    {/* Row 1: name + price */}
                    <div className="flex items-start gap-3">
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
                          inCart
                            ? 'bg-[var(--landing-accent)] text-white'
                            : 'bg-[var(--landing-stone)] text-[var(--landing-muted)]'
                        }`}
                      >
                        {inCart ? <Check className="w-4 h-4" /> : <Package className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium leading-tight break-words">
                          {p.name}
                        </div>
                        <div className="text-[11px] text-[var(--landing-muted)] mt-0.5 truncate">
                          {p.description}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-semibold tabular-nums">
                          {formatEuro(p.price)}
                        </div>
                        <div className="text-[10px] text-[var(--landing-muted)]">/ {p.unit}</div>
                      </div>
                    </div>
                    {/* Row 2: badges (category, recurring, in-cart count) */}
                    <div className="flex items-center flex-wrap gap-1.5 mt-2 pl-12">
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[var(--landing-stone)] text-[var(--landing-muted)]">
                        {p.category}
                      </span>
                      {p.recurring && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                          <RefreshCw className="w-2.5 h-2.5" /> /{p.recurring}
                        </span>
                      )}
                      {inCart && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--landing-accent)]/10 text-[var(--landing-accent)] ml-auto">
                          × {cart[p.id]} dans le devis
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right: devis builder */}
        <div className="rounded-xl border border-[var(--landing-border)] bg-[var(--landing-off)] overflow-hidden flex flex-col">
          <div className="flex items-center gap-2 px-3 py-3 bg-white border-b border-[var(--landing-border)]">
            <Sparkles className="w-4 h-4 text-[var(--landing-accent)]" />
            <span className="text-sm font-semibold">Nouveau devis</span>
            <span className="ml-auto text-[11px] text-[var(--landing-muted)] font-mono">
              D-2026-043
            </span>
          </div>

          {cartItems.length === 0 ? (
            <div className="py-8 px-4 text-center text-sm text-[var(--landing-muted)]">
              <Package className="w-6 h-6 mx-auto mb-2 opacity-40" />
              Cliquez sur une prestation pour l&rsquo;ajouter au devis
            </div>
          ) : (
            <div className="p-2 space-y-2 md:max-h-[320px] md:overflow-y-auto">
              {cartItems.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg bg-white border border-[var(--landing-border)] p-2.5"
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium leading-tight break-words">
                        {item.name}
                      </div>
                      <div className="text-[10px] text-[var(--landing-muted)] mt-0.5">
                        {formatEuro(item.price)} / {item.unit}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFromCart(item.id)}
                      aria-label="Supprimer"
                      className="p-1 -m-1 text-[var(--landing-muted)] hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-1.5">
                      <QtyButton onClick={() => updateQty(item.id, -1)} icon={Minus} />
                      <span className="text-xs font-semibold w-6 text-center tabular-nums">
                        {item.qty}
                      </span>
                      <QtyButton onClick={() => updateQty(item.id, 1)} icon={Plus} />
                    </div>
                    <div className="text-xs font-semibold text-[var(--landing-accent)] tabular-nums">
                      {formatEuro(item.price * item.qty)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="border-t border-[var(--landing-border)] bg-white p-3 space-y-1">
            <Row label="Sous-total HT" value={formatEuro(totalHT)} />
            <Row label="TVA 20 %" value={formatEuro(totalTVA)} muted />
            <div className="flex justify-between items-baseline pt-2 mt-1 border-t border-[var(--landing-border)]">
              <span className="text-xs font-semibold uppercase tracking-wide">
                Total TTC
              </span>
              <span className="text-base font-bold text-[var(--landing-accent)] tabular-nums">
                {formatEuro(totalTTC)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Helper tip */}
      <div className="mt-4 flex items-start gap-2 rounded-xl bg-[var(--landing-accent)]/5 border border-[var(--landing-accent)]/15 px-3 py-2.5">
        <Sparkles className="w-3.5 h-3.5 text-[var(--landing-accent)] shrink-0 mt-0.5" />
        <p className="text-[11px] sm:text-xs leading-snug text-[var(--landing-muted)]">
          <span className="text-[var(--landing-text)] font-medium">Votre bibliothèque = carburant de l&rsquo;IA devis.</span>{' '}
          Dictez un devis à la voix, l&rsquo;IA pioche dans vos prestations avec vos prix,
          unités et marges.
        </p>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`p-3 rounded-xl border ${
        accent
          ? 'border-emerald-200 bg-emerald-50/50'
          : 'border-[var(--landing-border)] bg-white'
      }`}
    >
      <div
        className={`text-[10px] font-medium uppercase tracking-wide ${
          accent ? 'text-emerald-700' : 'text-[var(--landing-muted)]'
        }`}
      >
        {label}
      </div>
      <div
        className={`text-lg font-bold mt-0.5 ${
          accent ? 'text-emerald-800' : 'text-[var(--landing-text)]'
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function QtyButton({
  onClick,
  icon: Icon,
}: {
  onClick: () => void;
  icon: typeof Plus;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-6 h-6 rounded-md border border-[var(--landing-border)] bg-white hover:bg-[var(--landing-accent)] hover:text-white hover:border-[var(--landing-accent)] transition-colors flex items-center justify-center text-[var(--landing-muted)]"
    >
      <Icon className="w-3 h-3" />
    </button>
  );
}

function Row({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex justify-between text-xs">
      <span className={muted ? 'text-[var(--landing-muted)]' : ''}>{label}</span>
      <span className={`tabular-nums ${muted ? 'text-[var(--landing-muted)]' : 'font-medium'}`}>
        {value}
      </span>
    </div>
  );
}
