import { describe, it, expect } from 'vitest'
import { convertQuoteToInvoice, createCreditNoteData, calculateSituation } from './conversion'

const baseQuote = {
  id: 'quote-uuid-123',
  client_id: 'client-uuid-456',
  title: 'Rénovation salle de bain',
  total_ht: '1000.00',
  total_tva: '100.00', // 10% TVA rénovation
  total_ttc: '1100.00',
}

describe('convertQuoteToInvoice()', () => {
  // ── Full invoice ────────────────────────────────────────────────────────────

  it('converts a quote to a full invoice (no acompte)', () => {
    const invoice = convertQuoteToInvoice(baseQuote)
    expect(invoice.quote_id).toBe('quote-uuid-123')
    expect(invoice.client_id).toBe('client-uuid-456')
    expect(invoice.title).toBe('Rénovation salle de bain')
    expect(invoice.invoice_type).toBe('invoice')
    expect(invoice.total_ht).toBe('1000.00')
    expect(invoice.total_tva).toBe('100.00')
    expect(invoice.total_ttc).toBe('1100.00')
    expect(invoice.acompte_pct).toBeNull()
  })

  it('preserves client_id null when quote has no client', () => {
    const invoice = convertQuoteToInvoice({ ...baseQuote, client_id: null })
    expect(invoice.client_id).toBeNull()
  })

  // ── Deposit invoice ─────────────────────────────────────────────────────────

  it('creates a deposit invoice at 30%', () => {
    const invoice = convertQuoteToInvoice({ ...baseQuote, acompte_pct: 30 })
    expect(invoice.invoice_type).toBe('deposit')
    expect(invoice.total_ht).toBe('300.00')
    expect(invoice.total_tva).toBe('30.00')
    expect(invoice.total_ttc).toBe('330.00')
    expect(invoice.acompte_pct).toBe(30)
  })

  it('includes acompte percentage in title', () => {
    const invoice = convertQuoteToInvoice({ ...baseQuote, acompte_pct: 30 })
    expect(invoice.title).toBe('Acompte 30% — Rénovation salle de bain')
  })

  it('creates deposit at 50%', () => {
    const invoice = convertQuoteToInvoice({ ...baseQuote, acompte_pct: 50 })
    expect(invoice.total_ht).toBe('500.00')
    expect(invoice.total_tva).toBe('50.00')
    expect(invoice.total_ttc).toBe('550.00')
  })

  it('treats acompte_pct=0 as full invoice', () => {
    const invoice = convertQuoteToInvoice({ ...baseQuote, acompte_pct: 0 })
    expect(invoice.invoice_type).toBe('invoice')
  })

  it('treats acompte_pct=null as full invoice', () => {
    const invoice = convertQuoteToInvoice({ ...baseQuote, acompte_pct: null })
    expect(invoice.invoice_type).toBe('invoice')
  })

  it('rounds deposit amounts to 2 decimal places', () => {
    // 33% of 1000 = 330.00
    const invoice = convertQuoteToInvoice({ ...baseQuote, acompte_pct: 33 })
    expect(invoice.total_ht).toBe('330.00')
  })
})

describe('createCreditNoteData()', () => {
  const baseInvoice = {
    id: 'invoice-uuid-789',
    client_id: 'client-uuid-456',
    title: 'Rénovation salle de bain',
    total_ht: '1000.00',
    total_tva: '100.00',
    total_ttc: '1100.00',
  }

  it('creates a credit note with negative amounts', () => {
    const creditNote = createCreditNoteData(baseInvoice)
    expect(creditNote.total_ht).toBe('-1000.00')
    expect(creditNote.total_tva).toBe('-100.00')
    expect(creditNote.total_ttc).toBe('-1100.00')
  })

  it('sets invoice_type to credit_note', () => {
    const creditNote = createCreditNoteData(baseInvoice)
    expect(creditNote.invoice_type).toBe('credit_note')
  })

  it('references the original invoice id', () => {
    const creditNote = createCreditNoteData(baseInvoice)
    expect(creditNote.invoice_origine_id).toBe('invoice-uuid-789')
  })

  it('prefixes title with "Avoir —"', () => {
    const creditNote = createCreditNoteData(baseInvoice)
    expect(creditNote.title).toBe('Avoir — Rénovation salle de bain')
  })

  it('preserves client_id', () => {
    const creditNote = createCreditNoteData(baseInvoice)
    expect(creditNote.client_id).toBe('client-uuid-456')
  })

  it('handles credit note of a credit note (double negation)', () => {
    const creditNote = createCreditNoteData({
      ...baseInvoice,
      total_ht: '-300.00',
      total_ttc: '-330.00',
      total_tva: '-30.00',
    })
    expect(creditNote.total_ht).toBe('300.00')
    expect(creditNote.total_ttc).toBe('330.00')
  })
})

describe('calculateSituation()', () => {
  const lots = [
    { lot_id: 'lot-gros-oeuvre', avancement_pct: 40, montant_ht: '5000.00' },
    { lot_id: 'lot-electricite', avancement_pct: 60, montant_ht: '2000.00' },
  ]

  it('calculates situation amounts from avancement percentages', () => {
    const { results, errors } = calculateSituation(lots)
    expect(errors).toEqual([])
    expect(results).toHaveLength(2)

    const grosOeuvre = results.find(r => r.lot_id === 'lot-gros-oeuvre')!
    expect(grosOeuvre.montant_situation_ht).toBe('2000.00') // 40% of 5000

    const elec = results.find(r => r.lot_id === 'lot-electricite')!
    expect(elec.montant_situation_ht).toBe('1200.00') // 60% of 2000
  })

  it('accepts 0% avancement (pas de travaux ce mois)', () => {
    const { results, errors } = calculateSituation([
      { lot_id: 'lot-1', avancement_pct: 0, montant_ht: '1000.00' },
    ])
    expect(errors).toEqual([])
    expect(results[0]?.montant_situation_ht).toBe('0.00')
  })

  it('accepts 100% avancement (lot terminé)', () => {
    const { results, errors } = calculateSituation([
      { lot_id: 'lot-1', avancement_pct: 100, montant_ht: '3000.00' },
    ])
    expect(errors).toEqual([])
    expect(results[0]?.montant_situation_ht).toBe('3000.00')
  })

  it('rejects avancement > 100% (invalid input)', () => {
    const { results, errors } = calculateSituation([
      { lot_id: 'lot-1', avancement_pct: 110, montant_ht: '1000.00' },
    ])
    expect(errors.length).toBeGreaterThan(0)
    expect(results).toHaveLength(0)
  })

  it('rejects negative avancement', () => {
    const { results, errors } = calculateSituation([
      { lot_id: 'lot-1', avancement_pct: -10, montant_ht: '1000.00' },
    ])
    expect(errors.length).toBeGreaterThan(0)
    expect(results).toHaveLength(0)
  })

  it('rejects situation that would exceed 100% cumul', () => {
    const previousCumuls = new Map([['lot-1', 70]])
    const { results, errors } = calculateSituation(
      [{ lot_id: 'lot-1', avancement_pct: 40, montant_ht: '1000.00' }],
      previousCumuls
    )
    // 70 + 40 = 110% → error
    expect(errors.length).toBeGreaterThan(0)
    expect(results).toHaveLength(0)
  })

  it('accepts situation at exactly 100% cumul', () => {
    const previousCumuls = new Map([['lot-1', 60]])
    const { results, errors } = calculateSituation(
      [{ lot_id: 'lot-1', avancement_pct: 40, montant_ht: '1000.00' }],
      previousCumuls
    )
    // 60 + 40 = 100% → OK
    expect(errors).toEqual([])
    expect(results[0]?.montant_situation_ht).toBe('400.00')
  })

  it('handles lots with no previous cumul', () => {
    const previousCumuls = new Map<string, number>()
    const { errors } = calculateSituation(
      [{ lot_id: 'lot-new', avancement_pct: 50, montant_ht: '2000.00' }],
      previousCumuls
    )
    expect(errors).toEqual([])
  })

  it('processes valid lots even when some have errors', () => {
    const { results, errors } = calculateSituation([
      { lot_id: 'lot-ok', avancement_pct: 50, montant_ht: '1000.00' },
      { lot_id: 'lot-bad', avancement_pct: 150, montant_ht: '500.00' },
    ])
    expect(results).toHaveLength(1)
    expect(results[0]?.lot_id).toBe('lot-ok')
    expect(errors).toHaveLength(1)
  })
})
