/**
 * TVA par ligne — helpers partagés.
 *
 * Le BTP français applique plusieurs taux de TVA selon la nature des travaux :
 *  - 20%  : taux normal
 *  - 10%  : travaux de rénovation dans un logement de +2 ans
 *  - 5,5% : rénovation énergétique, amélioration de l'habitat
 *  - 0%   : franchise en base de TVA (art. 293 B CGI)
 *
 * Un devis / une facture peut mixer plusieurs taux. On stocke donc :
 *  - tva_rate sur chaque ligne
 *  - tva_breakdown JSONB sur le document : [{rate, base_ht, tva_amount}]
 *  - total_tva : somme de tva_amount
 *  - tva_rate du document : le taux "majoritaire" (plus grosse base HT)
 *    pour rester lisible dans les code paths legacy qui l'utilisent.
 */

export const LINE_TVA_RATES = [0, 5.5, 10, 20] as const;

export type LineTvaRate = typeof LINE_TVA_RATES[number];

export interface TvaLine {
  quantity: number;
  unit_price: number;
  tva_rate: number;
}

export interface TvaBreakdownEntry {
  rate: number;
  base_ht: number;
  tva_amount: number;
}

export interface TvaTotals {
  total_ht: number;
  total_tva: number;
  total_ttc: number;
  tva_breakdown: TvaBreakdownEntry[];
  /** Taux majoritaire (plus grosse base HT) — pour colonne quotes.tva_rate / invoices.tva_rate */
  primary_rate: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Calcule les totaux HT / TVA / TTC et le breakdown par taux.
 * Accepte n'importe quel objet qui a `quantity`, `unit_price` et `tva_rate`.
 * Les lignes sans description sont conservées ici — le filtrage se fait côté caller.
 */
export function computeTvaBreakdown(lines: TvaLine[]): TvaTotals {
  const buckets = new Map<number, { base_ht: number; tva_amount: number }>();

  let totalHt = 0;
  let totalTva = 0;

  for (const line of lines) {
    const qty = Number(line.quantity) || 0;
    const price = Number(line.unit_price) || 0;
    const rate = Number(line.tva_rate);
    // taux invalide → on rabat sur 20% (jamais undefined dans un breakdown)
    const safeRate = Number.isFinite(rate) && rate >= 0 ? rate : 20;

    const lineHt = qty * price;
    if (lineHt === 0) continue;

    const lineTva = lineHt * (safeRate / 100);
    totalHt += lineHt;
    totalTva += lineTva;

    const existing = buckets.get(safeRate) || { base_ht: 0, tva_amount: 0 };
    existing.base_ht += lineHt;
    existing.tva_amount += lineTva;
    buckets.set(safeRate, existing);
  }

  // Ordre : taux croissant (0 d'abord, 20 en dernier) — lecture naturelle
  const sortedRates = Array.from(buckets.keys()).sort((a, b) => a - b);
  const tva_breakdown: TvaBreakdownEntry[] = sortedRates.map((rate) => {
    const b = buckets.get(rate)!;
    return {
      rate,
      base_ht: round2(b.base_ht),
      tva_amount: round2(b.tva_amount),
    };
  });

  // Taux majoritaire : celui qui a la plus grosse base HT
  let primary_rate = 20;
  let maxBase = -1;
  for (const entry of tva_breakdown) {
    if (entry.base_ht > maxBase) {
      maxBase = entry.base_ht;
      primary_rate = entry.rate;
    }
  }

  const total_ht = round2(totalHt);
  const total_tva = round2(totalTva);
  const total_ttc = round2(totalHt + totalTva);

  return {
    total_ht,
    total_tva,
    total_ttc,
    tva_breakdown,
    primary_rate,
  };
}

/**
 * Parse une valeur tva_breakdown qui vient de la DB (JSONB) et valide la structure.
 * Renvoie [] si la valeur est corrompue / vide.
 */
export function parseTvaBreakdown(raw: unknown): TvaBreakdownEntry[] {
  if (!Array.isArray(raw)) return [];
  const result: TvaBreakdownEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const rate = Number(obj.rate);
    const base_ht = Number(obj.base_ht);
    const tva_amount = Number(obj.tva_amount);
    if (!Number.isFinite(rate) || !Number.isFinite(base_ht) || !Number.isFinite(tva_amount)) continue;
    result.push({ rate, base_ht, tva_amount });
  }
  return result.sort((a, b) => a.rate - b.rate);
}

/**
 * Formatte un taux en libellé ("5,5 %", "20 %").
 */
export function formatTvaRate(rate: number): string {
  if (!Number.isFinite(rate)) return '—';
  if (Number.isInteger(rate)) return `${rate} %`;
  return `${String(rate).replace('.', ',')} %`;
}
