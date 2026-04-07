import { describe, it, expect } from 'vitest'
import { calculerTotaux, formatMontant } from './calculations'
import type { LotInput } from './schemas'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function lot(
  name: string,
  postes: Array<{ qty: number; pu: number; tva: number }>
): LotInput {
  return {
    name,
    montant_lot_ht: postes.reduce((s, p) => s + p.qty * p.pu, 0),
    sort_order: 0,
    postes: postes.map((p, i) => ({
      description: `Poste ${i + 1}`,
      quantity: p.qty,
      unit: 'u',
      unit_price_ht: p.pu,
      tva_rate: p.tva,
      sort_order: i,
    })),
  }
}

function fix(n: number): string {
  return n.toFixed(2)
}

// ---------------------------------------------------------------------------
// calculerTotaux()
// ---------------------------------------------------------------------------

describe('calculerTotaux()', () => {
  // ── Taux uniques ──────────────────────────────────────────────────────────

  it('calcule une facture simple TVA 20%', () => {
    const result = calculerTotaux(
      [lot('Travaux neufs', [{ qty: 1, pu: 1000, tva: 20 }])],
      0, 0, false
    )
    expect(fix(result.total_ht)).toBe('1000.00')
    expect(fix(result.total_tva)).toBe('200.00')
    expect(fix(result.total_ttc)).toBe('1200.00')
    expect(fix(result.remise_amount)).toBe('0.00')
  })

  it('calcule une facture simple TVA 10% (rénovation)', () => {
    const result = calculerTotaux(
      [lot('Rénovation', [{ qty: 1, pu: 500, tva: 10 }])],
      0, 0, false
    )
    expect(fix(result.total_ht)).toBe('500.00')
    expect(fix(result.total_tva)).toBe('50.00')
    expect(fix(result.total_ttc)).toBe('550.00')
  })

  it('calcule une facture TVA 5.5% (travaux eau/énergie)', () => {
    const result = calculerTotaux(
      [lot('Isolation', [{ qty: 1, pu: 2000, tva: 5.5 }])],
      0, 0, false
    )
    expect(fix(result.total_ht)).toBe('2000.00')
    expect(fix(result.total_tva)).toBe('110.00')
    expect(fix(result.total_ttc)).toBe('2110.00')
  })

  // ── TVA mixte — TEST DE RÉGRESSION pour bug createSituation() ────────────
  // Ce test documente le comportement attendu que le fix doit implémenter.
  // Une situation sur une facture mère mixte DOIT produire une TVA ventilée,
  // pas un taux unique hardcodé à 20%.

  it('ventile TVA correctement sur facture mixte 10% + 20% (régression situation)', () => {
    // Scénario : maçon rénovation — main d'œuvre TVA 10%, matériaux TVA 20%
    const result = calculerTotaux(
      [
        lot('Main d\'œuvre', [{ qty: 1, pu: 1200, tva: 10 }]),
        lot('Matériaux',    [{ qty: 1, pu:  800, tva: 20 }]),
      ],
      0, 0, false
    )
    expect(fix(result.total_ht)).toBe('2000.00')
    expect(fix(result.total_tva)).toBe('280.00') // 120 + 160, PAS 400 (si 20% sur tout)
    expect(fix(result.total_ttc)).toBe('2280.00')

    const tva10 = result.tva_ventilation.find(t => t.rate === 10)
    const tva20 = result.tva_ventilation.find(t => t.rate === 20)
    expect(tva10).toBeDefined()
    expect(tva20).toBeDefined()
    expect(fix(tva10!.base_ht)).toBe('1200.00')
    expect(fix(tva10!.montant_tva)).toBe('120.00')
    expect(fix(tva20!.base_ht)).toBe('800.00')
    expect(fix(tva20!.montant_tva)).toBe('160.00')
  })

  it('ventile TVA correctement sur 3 taux différents (0% + 10% + 20%)', () => {
    const result = calculerTotaux(
      [
        lot('Exonéré',      [{ qty: 1, pu:  500, tva: 0  }]),
        lot('Rénovation',   [{ qty: 1, pu: 1000, tva: 10 }]),
        lot('Neuf',         [{ qty: 1, pu:  500, tva: 20 }]),
      ],
      0, 0, false
    )
    expect(fix(result.total_ht)).toBe('2000.00')
    expect(fix(result.total_tva)).toBe('200.00') // 0 + 100 + 100
    expect(fix(result.total_ttc)).toBe('2200.00')
    expect(result.tva_ventilation).toHaveLength(3)
  })

  it('trie tva_ventilation par taux croissant', () => {
    const result = calculerTotaux(
      [
        lot('L20', [{ qty: 1, pu: 500, tva: 20 }]),
        lot('L10', [{ qty: 1, pu: 500, tva: 10 }]),
        lot('L0',  [{ qty: 1, pu: 500, tva: 0  }]),
      ],
      0, 0, false
    )
    const rates = result.tva_ventilation.map(t => t.rate)
    expect(rates).toEqual([0, 10, 20])
  })

  // ── Auto-entrepreneur (Art. 293B CGI) ─────────────────────────────────────

  it('force TVA 0% pour un auto-entrepreneur (Art.293B)', () => {
    const result = calculerTotaux(
      [
        lot('MO', [{ qty: 1, pu: 800, tva: 10 }]),
        lot('Mat', [{ qty: 1, pu: 200, tva: 20 }]),
      ],
      0, 0, true // isAutoEntrepreneur = true
    )
    expect(fix(result.total_tva)).toBe('0.00')
    expect(fix(result.total_ttc)).toBe('1000.00') // HT = TTC
    expect(result.tva_ventilation.every(t => t.rate === 0)).toBe(true)
    expect(result.tva_ventilation.every(t => t.montant_tva === 0)).toBe(true)
  })

  // ── Remise globale ─────────────────────────────────────────────────────────

  it('applique une remise globale proportionnellement aux taux TVA', () => {
    const result = calculerTotaux(
      [
        lot('MO',  [{ qty: 1, pu: 600, tva: 10 }]),
        lot('Mat', [{ qty: 1, pu: 400, tva: 20 }]),
      ],
      20, // 20% remise
      0,
      false
    )
    expect(fix(result.remise_amount)).toBe('200.00')
    expect(fix(result.total_ht_apres_remise)).toBe('800.00') // 1000 * 0.8
    const tva10 = result.tva_ventilation.find(t => t.rate === 10)
    const tva20 = result.tva_ventilation.find(t => t.rate === 20)
    expect(fix(tva10!.base_ht)).toBe('480.00') // 600 * 0.8
    expect(fix(tva20!.base_ht)).toBe('320.00') // 400 * 0.8
  })

  it('remise 100% → tout à zéro', () => {
    const result = calculerTotaux(
      [lot('T', [{ qty: 1, pu: 1000, tva: 20 }])],
      100, 0, false
    )
    expect(fix(result.total_ht_apres_remise)).toBe('0.00')
    expect(fix(result.total_tva)).toBe('0.00')
    expect(fix(result.total_ttc)).toBe('0.00')
  })

  // ── Acompte déduit ─────────────────────────────────────────────────────────

  it('stocke deposit_amount_deducted sans l\'appliquer aux montants HT/TVA', () => {
    // L'acompte est déduit AFFICHAGE uniquement — les montants HT/TVA restent bruts
    const result = calculerTotaux(
      [lot('T', [{ qty: 1, pu: 1000, tva: 20 }])],
      0,
      360, // acompte déduit : 30% de 1200 TTC = 360
      false
    )
    expect(fix(result.total_ht)).toBe('1000.00')
    expect(fix(result.total_ttc)).toBe('1200.00')
    expect(result.deposit_amount_deducted).toBe(360)
    // TTC net à payer = 1200 - 360 = 840 (calculé côté affichage)
  })

  // ── Multi-lots ─────────────────────────────────────────────────────────────

  it('agrège correctement plusieurs lots avec le même taux TVA', () => {
    const result = calculerTotaux(
      [
        lot('Lot 1', [{ qty: 2, pu: 500, tva: 10 }]),
        lot('Lot 2', [{ qty: 3, pu: 200, tva: 10 }]),
      ],
      0, 0, false
    )
    // 1000 + 600 = 1600 HT, TVA 10% = 160
    expect(fix(result.total_ht)).toBe('1600.00')
    expect(fix(result.total_tva)).toBe('160.00')
    expect(result.tva_ventilation).toHaveLength(1) // un seul taux
    expect(result.tva_ventilation[0]!.rate).toBe(10)
  })

  // ── Précision Decimal.js ───────────────────────────────────────────────────

  it('évite les erreurs virgule flottante', () => {
    // 333.33 HT * 10% = 33.333 → arrondi à 33.33
    const result = calculerTotaux(
      [lot('T', [{ qty: 1, pu: 333.33, tva: 10 }])],
      0, 0, false
    )
    expect(fix(result.total_tva)).toBe('33.33')
  })

  it('ROUND_HALF_UP : 33.335 → 33.34', () => {
    // 333.35 * 10% = 33.335 → 33.34 avec ROUND_HALF_UP
    const result = calculerTotaux(
      [lot('T', [{ qty: 1, pu: 333.35, tva: 10 }])],
      0, 0, false
    )
    expect(fix(result.total_tva)).toBe('33.34')
  })

  // ── Edge cases BTP ─────────────────────────────────────────────────────────

  it('gère un devis à 0€ (lots vides de montant)', () => {
    const result = calculerTotaux(
      [lot('T', [{ qty: 1, pu: 0, tva: 20 }])],
      0, 0, false
    )
    expect(fix(result.total_ht)).toBe('0.00')
    expect(fix(result.total_tva)).toBe('0.00')
    expect(fix(result.total_ttc)).toBe('0.00')
  })

  it('gère un tableau de lots vide', () => {
    const result = calculerTotaux([], 0, 0, false)
    expect(fix(result.total_ht)).toBe('0.00')
    expect(fix(result.total_tva)).toBe('0.00')
    expect(result.tva_ventilation).toEqual([])
  })

  it('gère un grand chantier BTP sans overflow (500 000€)', () => {
    const postes = Array.from({ length: 50 }, () => ({ qty: 1, pu: 10000, tva: 20 }))
    const result = calculerTotaux([lot('Grand chantier', postes)], 0, 0, false)
    expect(fix(result.total_ht)).toBe('500000.00')
    expect(fix(result.total_tva)).toBe('100000.00')
    expect(fix(result.total_ttc)).toBe('600000.00')
  })
})

// ---------------------------------------------------------------------------
// formatMontant()
// ---------------------------------------------------------------------------

describe('formatMontant()', () => {
  it('formate un montant entier en euros', () => {
    expect(formatMontant(1000)).toMatch(/€|EUR/)
  })

  it('formate zéro correctement', () => {
    expect(formatMontant(0)).toMatch(/0[,.]00/)
  })

  it('formate un montant décimal', () => {
    const result = formatMontant(1234.56)
    expect(result).toContain('1')
    expect(result).toContain('234')
    expect(result).toContain('56')
  })
})
