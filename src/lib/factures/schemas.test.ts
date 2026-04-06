import { describe, it, expect } from 'vitest'
import {
  posteSchema,
  lotSchema,
  factureCreateSchema,
  situationInputSchema,
  paySchema,
  sendSchema,
} from './schemas'

// ---------------------------------------------------------------------------
// posteSchema (factures — inclut tva_rate 5.5 contrairement aux devis)
// ---------------------------------------------------------------------------

describe('posteSchema (factures)', () => {
  const validPoste = {
    description: 'Isolation thermique',
    quantity: 20,
    unit: 'm²',
    unit_price_ht: 45,
    tva_rate: 5.5,
  }

  it('accepte un poste valide TVA 5.5% (spécifique factures)', () => {
    expect(posteSchema.safeParse(validPoste).success).toBe(true)
  })

  it('accepte tva_rate 0, 5.5, 10, 20', () => {
    for (const rate of [0, 5.5, 10, 20]) {
      expect(posteSchema.safeParse({ ...validPoste, tva_rate: rate }).success).toBe(true)
    }
  })

  it('rejette tva_rate 19.6 (ancien taux)', () => {
    expect(posteSchema.safeParse({ ...validPoste, tva_rate: 19.6 }).success).toBe(false)
  })

  it('accepte quantity négative (ligne d\'avoir)', () => {
    // Les avoirs peuvent avoir des quantités négatives
    expect(posteSchema.safeParse({ ...validPoste, quantity: -5 }).success).toBe(true)
  })

  it('rejette description vide', () => {
    expect(posteSchema.safeParse({ ...validPoste, description: '' }).success).toBe(false)
  })

  it('accepte unit_price_ht = 0', () => {
    expect(posteSchema.safeParse({ ...validPoste, unit_price_ht: 0 }).success).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// lotSchema (factures)
// ---------------------------------------------------------------------------

describe('lotSchema (factures)', () => {
  const validPoste = { description: 'Travaux', quantity: 1, unit_price_ht: 1000, tva_rate: 20 }

  it('accepte un lot valide', () => {
    expect(lotSchema.safeParse({ name: 'Gros œuvre', postes: [validPoste] }).success).toBe(true)
  })

  it('stocke montant_lot_ht=0 par défaut', () => {
    const result = lotSchema.safeParse({ name: 'Lot', postes: [validPoste] })
    if (result.success) expect(result.data.montant_lot_ht).toBe(0)
  })

  it('rejette un lot sans postes', () => {
    expect(lotSchema.safeParse({ name: 'Lot vide', postes: [] }).success).toBe(false)
  })

  it('rejette un lot sans nom', () => {
    expect(lotSchema.safeParse({ name: '', postes: [validPoste] }).success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// factureCreateSchema
// ---------------------------------------------------------------------------

describe('factureCreateSchema', () => {
  const validPoste = { description: 'Enduit', quantity: 1, unit_price_ht: 500, tva_rate: 10 }
  const validLot = { name: 'Plâtrerie', postes: [validPoste] }
  const validFacture = {
    client_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    lots: [validLot],
  }

  it('accepte une facture minimale valide', () => {
    expect(factureCreateSchema.safeParse(validFacture).success).toBe(true)
  })

  it('applique les valeurs par défaut', () => {
    const result = factureCreateSchema.safeParse(validFacture)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.discount_percent).toBe(0)
      expect(result.data.deposit_percent).toBe(0)
      expect(result.data.payment_terms_days).toBe(30)
    }
  })

  it('rejette client_id non-UUID', () => {
    expect(factureCreateSchema.safeParse({ ...validFacture, client_id: 'abc' }).success).toBe(false)
  })

  it('rejette une facture sans lots', () => {
    expect(factureCreateSchema.safeParse({ ...validFacture, lots: [] }).success).toBe(false)
  })

  it('rejette discount_percent négatif', () => {
    expect(factureCreateSchema.safeParse({ ...validFacture, discount_percent: -1 }).success).toBe(false)
  })

  it('rejette discount_percent > 100', () => {
    expect(factureCreateSchema.safeParse({ ...validFacture, discount_percent: 101 }).success).toBe(false)
  })

  it('accepte une facture avec lots TVA mixte (BTP réel)', () => {
    const result = factureCreateSchema.safeParse({
      ...validFacture,
      lots: [
        { name: 'Main d\'œuvre', postes: [{ description: 'MO', quantity: 8, unit_price_ht: 60, tva_rate: 10 }] },
        { name: 'Fournitures', postes: [{ description: 'Mat', quantity: 1, unit_price_ht: 400, tva_rate: 20 }] },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('accepte payment_terms_days = 0 (comptant)', () => {
    expect(factureCreateSchema.safeParse({ ...validFacture, payment_terms_days: 0 }).success).toBe(true)
  })

  it('rejette payment_terms_days > 365', () => {
    expect(factureCreateSchema.safeParse({ ...validFacture, payment_terms_days: 366 }).success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// situationInputSchema
// ---------------------------------------------------------------------------

describe('situationInputSchema', () => {
  const validLotId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'

  const validSituation = {
    avancements: [{ lot_id: validLotId, avancement_percent: 30 }],
  }

  it('accepte une situation valide', () => {
    expect(situationInputSchema.safeParse(validSituation).success).toBe(true)
  })

  it('applique is_final=false et payment_terms_days=30 par défaut', () => {
    const result = situationInputSchema.safeParse(validSituation)
    if (result.success) {
      expect(result.data.is_final).toBe(false)
      expect(result.data.payment_terms_days).toBe(30)
    }
  })

  it('accepte avancement_percent = 0', () => {
    expect(situationInputSchema.safeParse({
      avancements: [{ lot_id: validLotId, avancement_percent: 0 }],
    }).success).toBe(true)
  })

  it('accepte avancement_percent = 100', () => {
    expect(situationInputSchema.safeParse({
      avancements: [{ lot_id: validLotId, avancement_percent: 100 }],
    }).success).toBe(true)
  })

  it('rejette avancement_percent > 100', () => {
    expect(situationInputSchema.safeParse({
      avancements: [{ lot_id: validLotId, avancement_percent: 101 }],
    }).success).toBe(false)
  })

  it('rejette avancement_percent négatif', () => {
    expect(situationInputSchema.safeParse({
      avancements: [{ lot_id: validLotId, avancement_percent: -1 }],
    }).success).toBe(false)
  })

  it('rejette avancements vide (au moins 1 lot requis)', () => {
    expect(situationInputSchema.safeParse({ avancements: [] }).success).toBe(false)
  })

  it('rejette lot_id non-UUID', () => {
    expect(situationInputSchema.safeParse({
      avancements: [{ lot_id: 'pas-un-uuid', avancement_percent: 50 }],
    }).success).toBe(false)
  })

  it('accepte plusieurs avancements (multi-lots)', () => {
    const result = situationInputSchema.safeParse({
      avancements: [
        { lot_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', avancement_percent: 40 },
        { lot_id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', avancement_percent: 60 },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('accepte is_final = true (dernière situation)', () => {
    expect(situationInputSchema.safeParse({
      ...validSituation,
      is_final: true,
    }).success).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// paySchema
// ---------------------------------------------------------------------------

describe('paySchema', () => {
  it('accepte tous les modes de paiement valides', () => {
    for (const m of ['virement', 'chèque', 'espèces', 'carte', 'prélèvement']) {
      expect(paySchema.safeParse({ payment_method: m }).success).toBe(true)
    }
  })

  it('rejette un mode de paiement inconnu', () => {
    expect(paySchema.safeParse({ payment_method: 'bitcoin' }).success).toBe(false)
  })

  it('accepte paid_at optionnel', () => {
    expect(paySchema.safeParse({ payment_method: 'virement' }).success).toBe(true)
  })

  it('accepte paid_at datetime ISO valide', () => {
    expect(paySchema.safeParse({
      payment_method: 'virement',
      paid_at: '2026-04-06T10:30:00.000Z',
    }).success).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// sendSchema
// ---------------------------------------------------------------------------

describe('sendSchema', () => {
  it('accepte un email valide', () => {
    expect(sendSchema.safeParse({ email: 'client@example.fr' }).success).toBe(true)
  })

  it('rejette un email invalide', () => {
    expect(sendSchema.safeParse({ email: 'pas-un-email' }).success).toBe(false)
  })

  it('rejette un email vide', () => {
    expect(sendSchema.safeParse({ email: '' }).success).toBe(false)
  })
})
