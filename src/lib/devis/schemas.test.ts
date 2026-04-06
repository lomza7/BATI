import { describe, it, expect } from 'vitest'
import {
  posteSchema,
  lotSchema,
  devisCreateSchema,
  devisUpdateSchema,
  devisListQuerySchema,
} from './schemas'

// ---------------------------------------------------------------------------
// posteSchema
// ---------------------------------------------------------------------------

describe('posteSchema', () => {
  const validPoste = {
    description: 'Pose de carrelage',
    quantity: 10,
    unit: 'm²',
    unit_price_ht: 35,
    tva_rate: 10,
  }

  it('accepte un poste valide', () => {
    expect(posteSchema.safeParse(validPoste).success).toBe(true)
  })

  it('applique la valeur par défaut unit="u"', () => {
    const result = posteSchema.safeParse({ ...validPoste, unit: undefined })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.unit).toBe('u')
  })

  it('applique sort_order=0 par défaut', () => {
    const result = posteSchema.safeParse(validPoste)
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.sort_order).toBe(0)
  })

  it('rejette description vide', () => {
    const r = posteSchema.safeParse({ ...validPoste, description: '' })
    expect(r.success).toBe(false)
  })

  it('rejette description trop longue (>500)', () => {
    const r = posteSchema.safeParse({ ...validPoste, description: 'x'.repeat(501) })
    expect(r.success).toBe(false)
  })

  it('rejette quantity <= 0', () => {
    expect(posteSchema.safeParse({ ...validPoste, quantity: 0 }).success).toBe(false)
    expect(posteSchema.safeParse({ ...validPoste, quantity: -1 }).success).toBe(false)
  })

  it('rejette unit_price_ht négatif', () => {
    expect(posteSchema.safeParse({ ...validPoste, unit_price_ht: -1 }).success).toBe(false)
  })

  it('accepte unit_price_ht = 0 (fourniture offerte)', () => {
    expect(posteSchema.safeParse({ ...validPoste, unit_price_ht: 0 }).success).toBe(true)
  })

  it('accepte tva_rate 0, 10, 20', () => {
    for (const rate of [0, 10, 20]) {
      expect(posteSchema.safeParse({ ...validPoste, tva_rate: rate }).success).toBe(true)
    }
  })

  it('rejette tva_rate invalide (5, 19.6, 100)', () => {
    for (const rate of [5, 19.6, 100]) {
      expect(posteSchema.safeParse({ ...validPoste, tva_rate: rate }).success).toBe(false)
    }
  })
})

// ---------------------------------------------------------------------------
// lotSchema
// ---------------------------------------------------------------------------

describe('lotSchema', () => {
  const validPoste = {
    description: 'Main d\'œuvre',
    quantity: 8,
    unit: 'h',
    unit_price_ht: 60,
    tva_rate: 10,
  }

  it('accepte un lot valide avec un poste', () => {
    const result = lotSchema.safeParse({ name: 'Gros œuvre', postes: [validPoste] })
    expect(result.success).toBe(true)
  })

  it('accepte un lot avec plusieurs postes', () => {
    const result = lotSchema.safeParse({
      name: 'Second œuvre',
      postes: [
        validPoste,
        { description: 'Matériaux', quantity: 1, unit_price_ht: 500, tva_rate: 20 },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('rejette un lot sans nom', () => {
    expect(lotSchema.safeParse({ name: '', postes: [validPoste] }).success).toBe(false)
  })

  it('rejette un lot avec nom trop long (>200)', () => {
    expect(lotSchema.safeParse({ name: 'L'.repeat(201), postes: [validPoste] }).success).toBe(false)
  })

  it('rejette un lot sans postes', () => {
    expect(lotSchema.safeParse({ name: 'Lot vide', postes: [] }).success).toBe(false)
  })

  it('applique sort_order=0 par défaut', () => {
    const result = lotSchema.safeParse({ name: 'Lot', postes: [validPoste] })
    if (result.success) expect(result.data.sort_order).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// devisCreateSchema
// ---------------------------------------------------------------------------

describe('devisCreateSchema', () => {
  const validPoste = { description: 'Travaux', quantity: 1, unit_price_ht: 1000, tva_rate: 10 }
  const validLot = { name: 'Rénovation', postes: [validPoste] }

  const validDevis = {
    client_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    lots: [validLot],
  }

  it('accepte un devis minimal valide', () => {
    expect(devisCreateSchema.safeParse(validDevis).success).toBe(true)
  })

  it('applique les valeurs par défaut', () => {
    const result = devisCreateSchema.safeParse(validDevis)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.title).toBe('Devis travaux')
      expect(result.data.is_renovation_2yr).toBe(false)
      expect(result.data.discount_percent).toBe(0)
      expect(result.data.deposit_percent).toBe(0)
      expect(result.data.validity_days).toBe(30)
    }
  })

  it('rejette client_id non-UUID', () => {
    expect(devisCreateSchema.safeParse({ ...validDevis, client_id: 'pas-un-uuid' }).success).toBe(false)
  })

  it('rejette un devis sans lots', () => {
    expect(devisCreateSchema.safeParse({ ...validDevis, lots: [] }).success).toBe(false)
  })

  it('rejette discount_percent > 100', () => {
    expect(devisCreateSchema.safeParse({ ...validDevis, discount_percent: 101 }).success).toBe(false)
  })

  it('accepte discount_percent = 100 (remise totale)', () => {
    expect(devisCreateSchema.safeParse({ ...validDevis, discount_percent: 100 }).success).toBe(true)
  })

  it('rejette deposit_percent > 100', () => {
    expect(devisCreateSchema.safeParse({ ...validDevis, deposit_percent: 101 }).success).toBe(false)
  })

  it('rejette validity_days = 0', () => {
    expect(devisCreateSchema.safeParse({ ...validDevis, validity_days: 0 }).success).toBe(false)
  })

  it('accepte validity_days = 365', () => {
    expect(devisCreateSchema.safeParse({ ...validDevis, validity_days: 365 }).success).toBe(true)
  })

  it('rejette validity_days = 366', () => {
    expect(devisCreateSchema.safeParse({ ...validDevis, validity_days: 366 }).success).toBe(false)
  })

  it('accepte un chantier avec adresse partielle', () => {
    const result = devisCreateSchema.safeParse({
      ...validDevis,
      site_address: '10 rue de la Paix',
      site_city: 'Paris',
      // site_postal_code absent — optionnel
    })
    expect(result.success).toBe(true)
  })

  it('refuse un title vide', () => {
    expect(devisCreateSchema.safeParse({ ...validDevis, title: '' }).success).toBe(false)
  })

  it('refuse un title trop long (>200)', () => {
    expect(devisCreateSchema.safeParse({ ...validDevis, title: 'T'.repeat(201) }).success).toBe(false)
  })

  it('accepte plusieurs lots avec TVA mixte (BTP réel)', () => {
    const result = devisCreateSchema.safeParse({
      ...validDevis,
      lots: [
        { name: 'Maçonnerie', postes: [{ description: 'MO', quantity: 1, unit_price_ht: 800, tva_rate: 10 }] },
        { name: 'Matériaux', postes: [{ description: 'Béton', quantity: 1, unit_price_ht: 400, tva_rate: 20 }] },
      ],
    })
    expect(result.success).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// devisUpdateSchema
// ---------------------------------------------------------------------------

describe('devisUpdateSchema', () => {
  it('accepte un objet vide (tous les champs optionnels)', () => {
    expect(devisUpdateSchema.safeParse({}).success).toBe(true)
  })

  it('accepte la mise à jour partielle du title', () => {
    expect(devisUpdateSchema.safeParse({ title: 'Nouveau titre' }).success).toBe(true)
  })

  it('accepte la mise à jour des lots', () => {
    const result = devisUpdateSchema.safeParse({
      lots: [{ name: 'L', postes: [{ description: 'P', quantity: 1, unit_price_ht: 100, tva_rate: 20 }] }],
    })
    expect(result.success).toBe(true)
  })

  it('rejette des lots vides si fournis', () => {
    expect(devisUpdateSchema.safeParse({ lots: [] }).success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// devisListQuerySchema
// ---------------------------------------------------------------------------

describe('devisListQuerySchema', () => {
  it('applique les valeurs par défaut (page=1, limit=20)', () => {
    const result = devisListQuerySchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.page).toBe(1)
      expect(result.data.limit).toBe(20)
    }
  })

  it('coerce page et limit depuis des strings (query params)', () => {
    const result = devisListQuerySchema.safeParse({ page: '3', limit: '50' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.page).toBe(3)
      expect(result.data.limit).toBe(50)
    }
  })

  it('rejette limit > 100', () => {
    expect(devisListQuerySchema.safeParse({ limit: '101' }).success).toBe(false)
  })

  it('accepte periode mois/trimestre/annee', () => {
    for (const p of ['mois', 'trimestre', 'annee']) {
      expect(devisListQuerySchema.safeParse({ periode: p }).success).toBe(true)
    }
  })

  it('rejette une periode invalide', () => {
    expect(devisListQuerySchema.safeParse({ periode: 'semaine' }).success).toBe(false)
  })

  it('accepte client_id UUID valide', () => {
    expect(devisListQuerySchema.safeParse({
      client_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    }).success).toBe(true)
  })

  it('rejette client_id non-UUID', () => {
    expect(devisListQuerySchema.safeParse({ client_id: 'not-a-uuid' }).success).toBe(false)
  })
})
