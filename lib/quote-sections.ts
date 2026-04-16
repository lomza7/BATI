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

export interface SubsectionGroup<T> {
  subsectionKey: string | null;
  label: string;
  lines: T[];
  subtotalHt: number;
  subtotalTtc: number;
}

export interface NestedSectionGroup<T> {
  sectionKey: string | null;
  label: string;
  subtotalHt: number;
  subtotalTtc: number;
  /** Subsection groups in insertion order. A single null-keyed group means no subsection. */
  subsections: SubsectionGroup<T>[];
}

/** Returns true when at least one line carries a non-null section. */
export function hasSections<T extends { section?: string | null }>(lines: T[]): boolean {
  return lines.some((l) => l.section != null);
}

/** Returns true when at least one line carries a non-null subsection. */
export function hasSubsections<T extends { subsection?: string | null }>(lines: T[]): boolean {
  return lines.some((l) => l.subsection != null);
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

/**
 * Groups lines by section, then by subsection within each section, in strict
 * insertion order (per-run grouping).
 *
 * Why per-run rather than key-bucketing: the artisan controls the visual
 * order in the editor via `position`. If they place lines like
 *   [SecA / no-sub / "L1"] [SecA / sub X / "L2"] [SecA / no-sub / "L3"]
 * then the preview must show three blocks in that order, not collapse the
 * two no-sub lines into a single block at the top of SecA.
 *
 * A "run" starts whenever the section key OR the subsection key changes from
 * the previous line. Same applies to sections: a section block only continues
 * while consecutive lines share its key.
 */
export function groupLinesBySectionAndSubsection<
  T extends {
    section?: string | null;
    subsection?: string | null;
    quantity: number;
    unit_price: number;
    tva_rate?: number | null;
  },
>(lines: T[]): NestedSectionGroup<T>[] {
  const lineHt = (l: T) => l.quantity * l.unit_price;
  const lineTtc = (l: T) => lineHt(l) * (1 + (l.tva_rate ?? 20) / 100);

  const sections: NestedSectionGroup<T>[] = [];
  let currentSection: NestedSectionGroup<T> | null = null;
  let currentSubsection: SubsectionGroup<T> | null = null;

  for (const line of lines) {
    const sKey = line.section ?? null;
    const subKey = line.subsection ?? null;

    if (!currentSection || currentSection.sectionKey !== sKey) {
      const sectionLabel: string = sKey ? SECTION_LABELS[sKey] || sKey : '';
      currentSection = {
        sectionKey: sKey,
        label: sectionLabel,
        subtotalHt: 0,
        subtotalTtc: 0,
        subsections: [],
      };
      sections.push(currentSection);
      currentSubsection = null;
    }

    if (!currentSubsection || currentSubsection.subsectionKey !== subKey) {
      currentSubsection = {
        subsectionKey: subKey,
        label: subKey ?? '',
        lines: [],
        subtotalHt: 0,
        subtotalTtc: 0,
      };
      currentSection.subsections.push(currentSubsection);
    }

    const ht = lineHt(line);
    const ttc = lineTtc(line);
    currentSubsection.lines.push(line);
    currentSubsection.subtotalHt += ht;
    currentSubsection.subtotalTtc += ttc;
    currentSection.subtotalHt += ht;
    currentSection.subtotalTtc += ttc;
  }

  return sections;
}
