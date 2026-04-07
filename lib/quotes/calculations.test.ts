import { describe, it, expect } from 'vitest'
import { calculerTotaux, formatMontant } from './calculations'
import type { LotInput } from './schemas'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function lot(postes: Array<{ unit_price_ht: number; quantity: number; tva_rate: number }>): LotInput {
  return {
    name: 'Lot test',
    postes: postes.map((p, i) => ({
      description: `Poste ${i + 1}`,
      quantity: p.quantity,
      unit: 'u',
      unit_price_ht: p.unit_price_ht,
      tva_rate: p.tva_rate as 0 | 10 | 20,
      sort_order: i,
    })),
    sort_order: 0,
  }
}

function fix(n: number): string {
  return n.toFixed(2)
}

// ---------------------------------------------------------------------------
// calculerTotaux()
// ---------------------------------------------------------------------------

describe('calculerTotaux()', () => {
  // ── Basic single-rate ──────────────────────────────────────────────────────

  it('calculates a simple devis with TVA 20%', () => {
    const result = calculerTotaux(
      [lot([{ unit_price_ht: 1000, quantity: 1, tva_rate: 20 }])],
      0, 0, false
    )
    expect(fix(result.total_ht)).toBe('1000.00')
    expect(fix(result.total_tva)).toBe('200.00')
    expect(fix(result.total_ttc)).toBe('1200.00')
    expect(fix(result.remise_amount)).toBe('0.00')
    expect(fix(result.acompte_amount)).toBe('0.00')
  })

  it('calculates a simple devis with TVA 10% (travaux renovation)', () => {
    const result = calculerTotaux(
      [lot([{ unit_price_ht: 500, quantity: 1, tva_rate: 10 }])],
      0, 0, false
    )
    expect(fix(result.total_ht)).toBe('500.00')
    expect(fix(result.total_tva)).toBe('50.00')
    expect(fix(result.total_ttc)).toBe('550.00')
  })

  // ── TVA ventilée (mixed rates) ─────────────────────────────────────────────

  it('ventile TVA correctly across 10% and 20% postes', () => {
    const result = calculerTotaux(
      [lot([
        { unit_price_ht: 800, quantity: 1, tva_rate: 10 }, // main d'oeuvre renovation
        { unit_price_ht: 200, quantity: 1, tva_rate: 20 }, // matériaux
      ])],
      0, 0, false
    )
    expect(fix(result.total_ht)).toBe('1000.00')
    expect(fix(result.total_tva)).toBe('120.00') // 80 + 40
    expect(fix(result.total_ttc)).toBe('1120.00')

    const tva10 = result.tva_ventilation.find(t => t.rate === 10)
    const tva20 = result.tva_ventilation.find(t => t.rate === 20)
    expect(tva10).toBeDefined()
    expect(tva20).toBeDefined()
    expect(fix(tva10!.base_ht)).toBe('800.00')
    expect(fix(tva10!.montant_tva)).toBe('80.00')
    expect(fix(tva20!.base_ht)).toBe('200.00')
    expect(fix(tva20!.montant_tva)).toBe('40.00')
  })

  it('sorts tva_ventilation by rate ascending', () => {
    const result = calculerTotaux(
      [lot([
        { unit_price_ht: 200, quantity: 1, tva_rate: 20 },
        { unit_price_ht: 800, quantity: 1, tva_rate: 10 },
      ])],
      0, 0, false
    )
    expect(result.tva_ventilation[0]?.rate).toBe(10)
    expect(result.tva_ventilation[1]?.rate).toBe(20)
  })

  it('handles three different rates (0%, 10%, 20%)', () => {
    const result = calculerTotaux(
      [lot([
        { unit_price_ht: 100, quantity: 1, tva_rate: 0 },
        { unit_price_ht: 400, quantity: 1, tva_rate: 10 },
        { unit_price_ht: 500, quantity: 1, tva_rate: 20 },
      ])],
      0, 0, false
    )
    expect(fix(result.total_ht)).toBe('1000.00')
    expect(fix(result.total_tva)).toBe('140.00') // 0 + 40 + 100
    expect(fix(result.total_ttc)).toBe('1140.00')
  })

  // ── Auto-entrepreneur (Art. 293B) ──────────────────────────────────────────

  it('forces TVA to 0% for auto-entrepreneurs', () => {
    const result = calculerTotaux(
      [lot([
        { unit_price_ht: 800, quantity: 1, tva_rate: 10 },
        { unit_price_ht: 200, quantity: 1, tva_rate: 20 },
      ])],
      0, 0, true
    )
    expect(fix(result.total_tva)).toBe('0.00')
    expect(fix(result.total_ttc)).toBe('1000.00') // HT = TTC
    expect(result.tva_ventilation.every(t => t.rate === 0)).toBe(true)
    expect(result.tva_ventilation.every(t => t.montant_tva === 0)).toBe(true)
  })

  // ── Remise globale ─────────────────────────────────────────────────────────

  it('applies a global discount on total_ht', () => {
    const result = calculerTotaux(
      [lot([{ unit_price_ht: 1000, quantity: 1, tva_rate: 20 }])],
      10, 0, false
    )
    expect(fix(result.total_ht)).toBe('1000.00')
    expect(fix(result.remise_amount)).toBe('100.00')
    expect(fix(result.total_ht_apres_remise)).toBe('900.00')
    expect(fix(result.total_tva)).toBe('180.00')
    expect(fix(result.total_ttc)).toBe('1080.00')
  })

  it('applies discount proportionally across TVA buckets', () => {
    const result = calculerTotaux(
      [lot([
        { unit_price_ht: 600, quantity: 1, tva_rate: 10 },
        { unit_price_ht: 400, quantity: 1, tva_rate: 20 },
      ])],
      20, 0, false
    )
    expect(fix(result.total_ht_apres_remise)).toBe('800.00') // 1000 * 0.8
    const tva10 = result.tva_ventilation.find(t => t.rate === 10)
    const tva20 = result.tva_ventilation.find(t => t.rate === 20)
    expect(fix(tva10!.base_ht)).toBe('480.00') // 600 * 0.8
    expect(fix(tva20!.base_ht)).toBe('320.00') // 400 * 0.8
  })

  it('handles 100% discount (devis à 0€)', () => {
    const result = calculerTotaux(
      [lot([{ unit_price_ht: 500, quantity: 1, tva_rate: 20 }])],
      100, 0, false
    )
    expect(fix(result.total_ht_apres_remise)).toBe('0.00')
    expect(fix(result.total_tva)).toBe('0.00')
    expect(fix(result.total_ttc)).toBe('0.00')
  })

  // ── Acompte ────────────────────────────────────────────────────────────────

  it('calculates acompte as a percentage of total_ttc', () => {
    const result = calculerTotaux(
      [lot([{ unit_price_ht: 1000, quantity: 1, tva_rate: 20 }])],
      0, 30, false
    )
    expect(fix(result.total_ttc)).toBe('1200.00')
    expect(fix(result.acompte_amount)).toBe('360.00') // 30% of 1200
  })

  it('handles 0% acompte', () => {
    const result = calculerTotaux(
      [lot([{ unit_price_ht: 1000, quantity: 1, tva_rate: 20 }])],
      0, 0, false
    )
    expect(fix(result.acompte_amount)).toBe('0.00')
  })

  // ── Quantity × unit_price_ht multiplication ────────────────────────────────

  it('multiplies quantity by unit_price_ht correctly', () => {
    const result = calculerTotaux(
      [lot([{ unit_price_ht: 150, quantity: 4, tva_rate: 20 }])],
      0, 0, false
    )
    expect(fix(result.total_ht)).toBe('600.00')
    expect(fix(result.total_tva)).toBe('120.00')
    expect(fix(result.total_ttc)).toBe('720.00')
  })

  // ── Floating point precision ───────────────────────────────────────────────

  it('rounds TVA amounts to 2 decimal places (ROUND_HALF_UP)', () => {
    // 333.33 HT * 10% = 33.333 → should round to 33.33
    const result = calculerTotaux(
      [lot([{ unit_price_ht: 333.33, quantity: 1, tva_rate: 10 }])],
      0, 0, false
    )
    expect(fix(result.total_tva)).toBe('33.33')
  })

  it('rounds up at exactly .005 (ROUND_HALF_UP)', () => {
    // 333.35 * 10% = 33.335 → 33.34 with ROUND_HALF_UP
    const result = calculerTotaux(
      [lot([{ unit_price_ht: 333.35, quantity: 1, tva_rate: 10 }])],
      0, 0, false
    )
    expect(fix(result.total_tva)).toBe('33.34')
  })

  // ── Edge cases BTP ─────────────────────────────────────────────────────────

  it('handles poste at 0€', () => {
    const result = calculerTotaux(
      [lot([{ unit_price_ht: 0, quantity: 1, tva_rate: 20 }])],
      0, 0, false
    )
    expect(fix(result.total_ht)).toBe('0.00')
    expect(fix(result.total_tva)).toBe('0.00')
    expect(fix(result.total_ttc)).toBe('0.00')
  })

  it('handles empty lots array', () => {
    const result = calculerTotaux([], 0, 0, false)
    expect(fix(result.total_ht)).toBe('0.00')
    expect(fix(result.total_tva)).toBe('0.00')
    expect(fix(result.total_ttc)).toBe('0.00')
    expect(result.tva_ventilation).toEqual([])
  })

  it('handles large BTP project amounts without overflow', () => {
    // 1 lot, 50 postes × 10 000 HT = 500 000 HT
    const postes = Array.from({ length: 50 }, () => ({
      unit_price_ht: 10000,
      quantity: 1,
      tva_rate: 20 as const,
    }))
    const result = calculerTotaux([lot(postes)], 0, 0, false)
    expect(fix(result.total_ht)).toBe('500000.00')
    expect(fix(result.total_tva)).toBe('100000.00')
    expect(fix(result.total_ttc)).toBe('600000.00')
  })

  it('handles multi-lot devis correctly', () => {
    // 2 lots: gros œuvre (TVA 10%) + agencement (TVA 20%)
    const lots = [
      lot([{ unit_price_ht: 2000, quantity: 1, tva_rate: 10 }]),
      lot([{ unit_price_ht: 1000, quantity: 1, tva_rate: 20 }]),
    ]
    // Rename second lot for clarity (doesn't affect logic)
    lots[1]!.name = 'Agencement'
    const result = calculerTotaux(lots, 0, 0, false)
    expect(fix(result.total_ht)).toBe('3000.00')
    expect(fix(result.total_tva)).toBe('400.00') // 200 + 200
    expect(fix(result.total_ttc)).toBe('3400.00')
  })
})

// ---------------------------------------------------------------------------
// formatMontant()
// ---------------------------------------------------------------------------

describe('formatMontant()', () => {
  it('formats integer amount with 2 decimal places', () => {
    const result = formatMontant(1000)
    expect(result).toContain('1')
    expect(result).toContain('000')
    // Should contain EUR symbol or abbreviation
    expect(result).toMatch(/€|EUR/)
  })

  it('formats decimal amount correctly', () => {
    const result = formatMontant(1234.56)
    expect(result).toContain('1')
    expect(result).toContain('234')
    expect(result).toContain('56')
  })

  it('formats zero correctly', () => {
    const result = formatMontant(0)
    expect(result).toMatch(/0[,.]00/)
  })
})
