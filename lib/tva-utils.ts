// Conversion TTC ↔ HT pour l'affichage des prix publics.
// TVA 20 % (France, taux normal).

export const TVA_RATE = 0.2;

/** Convertit "19,50" ou "19.50" (TTC) en valeur HT formatée avec virgule française. */
export function ttcToHt(ttc: string): string {
  const normalized = ttc.replace(',', '.');
  const n = Number(normalized);
  if (!Number.isFinite(n)) return ttc;
  const ht = n / (1 + TVA_RATE);
  return ht
    .toFixed(2)
    .replace(/\.?0+$/, (m) => (m.includes('.') ? '' : m))
    .replace('.', ',');
}
