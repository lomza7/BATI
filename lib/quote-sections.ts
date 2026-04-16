// Section grouping for quote/invoice lines
// "materiel" = supplies/equipment, "main_oeuvre" = labor/installation

export const QUOTE_SECTIONS = [
  { value: 'materiel', label: 'Matériel fournis' },
  { value: 'main_oeuvre', label: "Main d'oeuvre et installation" },
] as const;

export type QuoteSection = (typeof QUOTE_SECTIONS)[number]['value'];

export const SECTION_LABELS: Record<string, string> = {
  materiel: 'Matériel fournis',
  main_oeuvre: "Main d'oeuvre et installation",
};

// Order in which sections appear in rendered documents
const SECTION_ORDER: (string | null)[] = ['materiel', 'main_oeuvre', null];

export interface SectionGroup<T> {
  sectionKey: string | null;
  label: string;
  lines: T[];
  subtotalHt: number;
  subtotalTtc: number;
}

/** Returns true when at least one line carries a non-null section. */
export function hasSections<T extends { section?: string | null }>(lines: T[]): boolean {
  return lines.some((l) => l.section != null);
}

/**
 * Groups lines by section for rendering.
 * Each line must expose `section`, `quantity` and `unit_price`.
 * Returns groups in display order: matériel, main d'oeuvre, then unsectioned.
 */
export function groupLinesBySection<
  T extends { section?: string | null; quantity: number; unit_price: number; tva_rate?: number | null },
>(lines: T[]): SectionGroup<T>[] {
  const buckets = new Map<string | null, T[]>();

  for (const line of lines) {
    const key = line.section ?? null;
    const arr = buckets.get(key);
    if (arr) {
      arr.push(line);
    } else {
      buckets.set(key, [line]);
    }
  }

  const lineHt = (l: T) => l.quantity * l.unit_price;
  const lineTtc = (l: T) => lineHt(l) * (1 + (l.tva_rate ?? 20) / 100);

  const groups: SectionGroup<T>[] = [];

  for (const key of SECTION_ORDER) {
    const bucket = buckets.get(key);
    if (!bucket || bucket.length === 0) continue;
    groups.push({
      sectionKey: key,
      label: key ? SECTION_LABELS[key] || key : '',
      lines: bucket,
      subtotalHt: bucket.reduce((sum, l) => sum + lineHt(l), 0),
      subtotalTtc: bucket.reduce((sum, l) => sum + lineTtc(l), 0),
    });
  }

  // Any section keys not in SECTION_ORDER (future-proofing)
  buckets.forEach((bucket, key) => {
    if (SECTION_ORDER.includes(key)) return;
    groups.push({
      sectionKey: key,
      label: key ? SECTION_LABELS[key] || key : '',
      lines: bucket,
      subtotalHt: bucket.reduce((s: number, l) => s + lineHt(l), 0),
      subtotalTtc: bucket.reduce((s: number, l) => s + lineTtc(l), 0),
    });
  });

  return groups;
}
