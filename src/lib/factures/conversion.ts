import Decimal from 'decimal.js'

Decimal.set({ rounding: Decimal.ROUND_HALF_UP })

export interface DevisForConversion {
  id: string
  client_id: string | null
  title: string
  total_ht: number | string
  total_tva: number | string
  total_ttc: number | string
  acompte_pct?: number | null
}

export interface FactureFromDevis {
  devis_id: string
  client_id: string | null
  title: string
  facture_type: 'facture' | 'acompte' | 'avoir'
  total_ht: string
  total_tva: string
  total_ttc: string
  /** For acompte: the % that was applied. For facture: null. */
  acompte_pct: number | null
}

/**
 * Converts a devis into a facture data object.
 * This is a pure function — it does NOT call the database.
 *
 * If acompte_pct is set on the devis, creates an 'acompte' facture
 * for that percentage of total_ttc. Otherwise creates a full 'facture'.
 */
export function convertDevisToFacture(devis: DevisForConversion): FactureFromDevis {
  const totalHt = new Decimal(devis.total_ht)
  const totalTva = new Decimal(devis.total_tva)
  const totalTtc = new Decimal(devis.total_ttc)

  if (devis.acompte_pct && devis.acompte_pct > 0) {
    const pct = new Decimal(devis.acompte_pct).dividedBy(100)
    const acompteHt = totalHt.times(pct).toDecimalPlaces(2)
    const acompteTva = totalTva.times(pct).toDecimalPlaces(2)
    const acompteTtc = totalTtc.times(pct).toDecimalPlaces(2)

    return {
      devis_id: devis.id,
      client_id: devis.client_id,
      title: `Acompte ${devis.acompte_pct}% — ${devis.title}`,
      facture_type: 'acompte',
      total_ht: acompteHt.toFixed(2),
      total_tva: acompteTva.toFixed(2),
      total_ttc: acompteTtc.toFixed(2),
      acompte_pct: devis.acompte_pct,
    }
  }

  return {
    devis_id: devis.id,
    client_id: devis.client_id,
    title: devis.title,
    facture_type: 'facture',
    total_ht: totalHt.toFixed(2),
    total_tva: totalTva.toFixed(2),
    total_ttc: totalTtc.toFixed(2),
    acompte_pct: null,
  }
}

/**
 * Creates an avoir (credit note) from a locked facture.
 * The avoir has negative amounts and references the original facture.
 */
export function createAvoir(facture: {
  id: string
  client_id: string | null
  title: string
  total_ht: number | string
  total_tva: number | string
  total_ttc: number | string
}) {
  return {
    facture_origine_id: facture.id,
    client_id: facture.client_id,
    title: `Avoir — ${facture.title}`,
    facture_type: 'avoir' as const,
    total_ht: new Decimal(facture.total_ht).negated().toFixed(2),
    total_tva: new Decimal(facture.total_tva).negated().toFixed(2),
    total_ttc: new Decimal(facture.total_ttc).negated().toFixed(2),
  }
}

export interface SituationTravaux {
  lot_id: string
  avancement_pct: number // 0–100
  montant_ht: number | string // total HT for this lot (from devis)
}

export interface SituationResult {
  lot_id: string
  avancement_pct: number
  montant_situation_ht: string
}

/**
 * Calculates the billable amount for each lot in a situation de travaux.
 *
 * Rules:
 * - avancement_pct must be 0–100
 * - Total cumulated situations cannot exceed 100% per lot
 * - montant_situation_ht = avancement_pct% of lot montant_ht
 */
export function calculateSituation(
  situations: SituationTravaux[],
  previousCumuls: Map<string, number> = new Map()
): { results: SituationResult[]; errors: string[] } {
  const results: SituationResult[] = []
  const errors: string[] = []

  for (const sit of situations) {
    if (sit.avancement_pct < 0 || sit.avancement_pct > 100) {
      errors.push(`lot ${sit.lot_id}: avancement_pct doit être entre 0 et 100`)
      continue
    }

    const previousCumul = previousCumuls.get(sit.lot_id) ?? 0
    const newCumul = previousCumul + sit.avancement_pct

    if (newCumul > 100) {
      errors.push(
        `lot ${sit.lot_id}: cumul d'avancement (${newCumul}%) dépasse 100%`
      )
      continue
    }

    const montantHt = new Decimal(sit.montant_ht)
    const montantSituation = montantHt
      .times(new Decimal(sit.avancement_pct).dividedBy(100))
      .toDecimalPlaces(2)

    results.push({
      lot_id: sit.lot_id,
      avancement_pct: sit.avancement_pct,
      montant_situation_ht: montantSituation.toFixed(2),
    })
  }

  return { results, errors }
}
