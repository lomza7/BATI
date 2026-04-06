import { describe, it, expect } from 'vitest'
import { convertDevisToFacture, createAvoir, calculateSituation } from './conversion'

const baseDevis = {
  id: 'devis-uuid-123',
  client_id: 'client-uuid-456',
  title: 'Rénovation salle de bain',
  total_ht: '1000.00',
  total_tva: '100.00', // 10% TVA rénovation
  total_ttc: '1100.00',
}

describe('convertDevisToFacture()', () => {
  // ── Full facture ────────────────────────────────────────────────────────────

  it('converts a devis to a full facture (no acompte)', () => {
    const facture = convertDevisToFacture(baseDevis)
    expect(facture.devis_id).toBe('devis-uuid-123')
    expect(facture.client_id).toBe('client-uuid-456')
    expect(facture.title).toBe('Rénovation salle de bain')
    expect(facture.facture_type).toBe('facture')
    expect(facture.total_ht).toBe('1000.00')
    expect(facture.total_tva).toBe('100.00')
    expect(facture.total_ttc).toBe('1100.00')
    expect(facture.acompte_pct).toBeNull()
  })

  it('preserves client_id null when devis has no client', () => {
    const facture = convertDevisToFacture({ ...baseDevis, client_id: null })
    expect(facture.client_id).toBeNull()
  })

  // ── Acompte facture ─────────────────────────────────────────────────────────

  it('creates an acompte facture at 30%', () => {
    const facture = convertDevisToFacture({ ...baseDevis, acompte_pct: 30 })
    expect(facture.facture_type).toBe('acompte')
    expect(facture.total_ht).toBe('300.00')
    expect(facture.total_tva).toBe('30.00')
    expect(facture.total_ttc).toBe('330.00')
    expect(facture.acompte_pct).toBe(30)
  })

  it('includes acompte percentage in title', () => {
    const facture = convertDevisToFacture({ ...baseDevis, acompte_pct: 30 })
    expect(facture.title).toBe('Acompte 30% — Rénovation salle de bain')
  })

  it('creates acompte at 50%', () => {
    const facture = convertDevisToFacture({ ...baseDevis, acompte_pct: 50 })
    expect(facture.total_ht).toBe('500.00')
    expect(facture.total_tva).toBe('50.00')
    expect(facture.total_ttc).toBe('550.00')
  })

  it('treats acompte_pct=0 as full facture', () => {
    const facture = convertDevisToFacture({ ...baseDevis, acompte_pct: 0 })
    expect(facture.facture_type).toBe('facture')
  })

  it('treats acompte_pct=null as full facture', () => {
    const facture = convertDevisToFacture({ ...baseDevis, acompte_pct: null })
    expect(facture.facture_type).toBe('facture')
  })

  it('rounds acompte amounts to 2 decimal places', () => {
    // 33.33% of 1000 = 333.3... → 333.33
    const devis = { ...baseDevis, total_ht: '1000.00', total_tva: '100.00', total_ttc: '1100.00' }
    const facture = convertDevisToFacture({ ...devis, acompte_pct: 33 })
    expect(facture.total_ht).toBe('330.00')
  })
})

describe('createAvoir()', () => {
  const baseFacture = {
    id: 'facture-uuid-789',
    client_id: 'client-uuid-456',
    title: 'Rénovation salle de bain',
    total_ht: '1000.00',
    total_tva: '100.00',
    total_ttc: '1100.00',
  }

  it('creates an avoir with negative amounts', () => {
    const avoir = createAvoir(baseFacture)
    expect(avoir.total_ht).toBe('-1000.00')
    expect(avoir.total_tva).toBe('-100.00')
    expect(avoir.total_ttc).toBe('-1100.00')
  })

  it('sets facture_type to avoir', () => {
    const avoir = createAvoir(baseFacture)
    expect(avoir.facture_type).toBe('avoir')
  })

  it('references the original facture id', () => {
    const avoir = createAvoir(baseFacture)
    expect(avoir.facture_origine_id).toBe('facture-uuid-789')
  })

  it('prefixes title with "Avoir —"', () => {
    const avoir = createAvoir(baseFacture)
    expect(avoir.title).toBe('Avoir — Rénovation salle de bain')
  })

  it('preserves client_id', () => {
    const avoir = createAvoir(baseFacture)
    expect(avoir.client_id).toBe('client-uuid-456')
  })

  it('handles avoir of an avoir (double negation)', () => {
    // Edge case: an avoir of a partial acompte
    const avoir = createAvoir({ ...baseFacture, total_ht: '-300.00', total_ttc: '-330.00', total_tva: '-30.00' })
    expect(avoir.total_ht).toBe('300.00')
    expect(avoir.total_ttc).toBe('330.00')
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
