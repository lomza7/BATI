import Decimal from 'decimal.js'

Decimal.set({ rounding: Decimal.ROUND_HALF_UP })

export interface QuoteForConversion {
  id: string
  client_id: string | null
  title: string
  total_ht: number | string
  total_tva: number | string
  total_ttc: number | string
  acompte_pct?: number | null
}

export interface InvoiceFromQuote {
  quote_id: string
  client_id: string | null
  title: string
  invoice_type: 'invoice' | 'deposit' | 'credit_note'
  total_ht: string
  total_tva: string
  total_ttc: string
  /** For deposit: the % that was applied. For invoice: null. */
  acompte_pct: number | null
}

/**
 * Converts a quote into an invoice data object.
 * This is a pure function — it does NOT call the database.
 *
 * If acompte_pct is set on the quote, creates a 'deposit' invoice
 * for that percentage of total_ttc. Otherwise creates a full 'invoice'.
 */
export function convertQuoteToInvoice(quote: QuoteForConversion): InvoiceFromQuote {
  const totalHt = new Decimal(quote.total_ht)
  const totalTva = new Decimal(quote.total_tva)
  const totalTtc = new Decimal(quote.total_ttc)

  if (quote.acompte_pct && quote.acompte_pct > 0) {
    const pct = new Decimal(quote.acompte_pct).dividedBy(100)
    const depositHt = totalHt.times(pct).toDecimalPlaces(2)
    const depositTva = totalTva.times(pct).toDecimalPlaces(2)
    const depositTtc = totalTtc.times(pct).toDecimalPlaces(2)

    return {
      quote_id: quote.id,
      client_id: quote.client_id,
      title: `Acompte ${quote.acompte_pct}% — ${quote.title}`,
      invoice_type: 'deposit',
      total_ht: depositHt.toFixed(2),
      total_tva: depositTva.toFixed(2),
      total_ttc: depositTtc.toFixed(2),
      acompte_pct: quote.acompte_pct,
    }
  }

  return {
    quote_id: quote.id,
    client_id: quote.client_id,
    title: quote.title,
    invoice_type: 'invoice',
    total_ht: totalHt.toFixed(2),
    total_tva: totalTva.toFixed(2),
    total_ttc: totalTtc.toFixed(2),
    acompte_pct: null,
  }
}

/**
 * Creates a credit note from a locked invoice.
 * The credit note has negative amounts and references the original invoice.
 */
export function createCreditNoteData(invoice: {
  id: string
  client_id: string | null
  title: string
  total_ht: number | string
  total_tva: number | string
  total_ttc: number | string
}) {
  return {
    invoice_origine_id: invoice.id,
    client_id: invoice.client_id,
    title: `Avoir — ${invoice.title}`,
    invoice_type: 'credit_note' as const,
    total_ht: new Decimal(invoice.total_ht).negated().toFixed(2),
    total_tva: new Decimal(invoice.total_tva).negated().toFixed(2),
    total_ttc: new Decimal(invoice.total_ttc).negated().toFixed(2),
  }
}

export interface SituationInput {
  lot_id: string
  avancement_pct: number // 0–100
  montant_ht: number | string // total HT for this lot
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
  situations: SituationInput[],
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
