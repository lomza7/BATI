import { describe, it, expect } from 'vitest'
import { validateFacturx } from './validate'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const validProfile = {
  siret: '73042926600010',
  company_name: 'SARL Martin BTP',
  full_name: 'Jean Martin',
  address: '12 rue des Artisans',
  city: 'Paris',
  postal_code: '75001',
  is_auto_entrepreneur: false,
}

const validClientPro = {
  name: 'SARL Dupont Construction',
  siret: '66204244900048',
  client_type: 'professionnel',
  billing_address: '5 av. de la Gare',
  billing_city: 'Lyon',
  billing_postal_code: '69001',
}

const validClientParticulier = {
  name: 'Marie Dupont',
  siret: null,
  client_type: 'particulier',
  billing_address: null,
  billing_city: null,
  billing_postal_code: null,
}

function makeFacture(overrides: Record<string, unknown> = {}) {
  return {
    reference: 'FAC-2026-001',
    type: 'facture',
    total_ht: 1000,
    total_tva: 200,
    total_ttc: 1200,
    emitted_at: null,
    client_id: 'client-uuid-123',
    client: validClientPro,
    lots: [
      {
        lignes: [
          { description: 'Maçonnerie', quantity: 10, unit_price_ht: 100, tva_rate: 20 },
        ],
      },
    ],
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// validateFacturx()
// ---------------------------------------------------------------------------

describe('validateFacturx()', () => {
  // ── Cas valides ────────────────────────────────────────────────────────────

  it('valide une facture complète client pro', () => {
    const result = validateFacturx(makeFacture(), validProfile)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('valide une facture client particulier (sans SIRET requis)', () => {
    const result = validateFacturx(
      makeFacture({ client: validClientParticulier }),
      validProfile
    )
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('valide un avoir (total_ttc négatif autorisé)', () => {
    const result = validateFacturx(
      makeFacture({ type: 'avoir', total_ttc: -1200, total_ht: -1000, total_tva: -200 }),
      validProfile
    )
    expect(result.valid).toBe(true)
  })

  it('valide avec auto-entrepreneur (TVA 0% sur les lignes)', () => {
    const factureAE = makeFacture({
      lots: [{
        lignes: [{ description: 'Peinture', quantity: 1, unit_price_ht: 800, tva_rate: 0 }],
      }],
    })
    const result = validateFacturx(factureAE, { ...validProfile, is_auto_entrepreneur: true })
    expect(result.valid).toBe(true)
  })

  // ── Profil vendeur — champs obligatoires ──────────────────────────────────

  it('rejette si SIRET artisan manquant', () => {
    const result = validateFacturx(makeFacture(), { ...validProfile, siret: null })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.field === 'profile.siret')).toBe(true)
  })

  it('rejette si SIRET artisan invalide (< 14 chiffres)', () => {
    const result = validateFacturx(makeFacture(), { ...validProfile, siret: '1234567890' })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.field === 'profile.siret')).toBe(true)
  })

  it('rejette si SIRET artisan avec espaces invalide (longueur < 14)', () => {
    const result = validateFacturx(makeFacture(), { ...validProfile, siret: '123 456' })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.field === 'profile.siret')).toBe(true)
  })

  it('rejette si nom/raison sociale artisan manquant', () => {
    const result = validateFacturx(
      makeFacture(),
      { ...validProfile, company_name: null, full_name: null }
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.field === 'profile.name')).toBe(true)
  })

  it('accepte si seulement full_name fourni (sans company_name)', () => {
    const result = validateFacturx(makeFacture(), { ...validProfile, company_name: null })
    expect(result.valid).toBe(true)
  })

  it('rejette si adresse artisan incomplète (city manquante)', () => {
    const result = validateFacturx(makeFacture(), { ...validProfile, city: null })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.field === 'profile.address')).toBe(true)
  })

  it('rejette si adresse artisan incomplète (postal_code manquant)', () => {
    const result = validateFacturx(makeFacture(), { ...validProfile, postal_code: null })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.field === 'profile.address')).toBe(true)
  })

  // ── Acheteur (client) ─────────────────────────────────────────────────────

  it('rejette si client_id manquant', () => {
    const result = validateFacturx(makeFacture({ client_id: null, client: null }), validProfile)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.field === 'client_id')).toBe(true)
  })

  it('rejette si client pro sans SIRET (B2B obligatoire)', () => {
    const clientSansSiret = { ...validClientPro, siret: null }
    const result = validateFacturx(makeFacture({ client: clientSansSiret }), validProfile)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.field === 'client.siret')).toBe(true)
  })

  it('rejette si client pro avec SIRET trop court', () => {
    const clientSiretCourt = { ...validClientPro, siret: '1234567' }
    const result = validateFacturx(makeFacture({ client: clientSiretCourt }), validProfile)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.field === 'client.siret')).toBe(true)
  })

  it('accepte un client particulier sans SIRET (B2C)', () => {
    const result = validateFacturx(
      makeFacture({ client: validClientParticulier }),
      validProfile
    )
    expect(result.valid).toBe(true)
  })

  it('rejette si nom client vide', () => {
    const clientSansNom = { ...validClientPro, name: '' }
    const result = validateFacturx(makeFacture({ client: clientSansNom }), validProfile)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.field === 'client.name')).toBe(true)
  })

  // ── Lignes ────────────────────────────────────────────────────────────────

  it('rejette si aucune ligne', () => {
    const result = validateFacturx(makeFacture({ lots: [{ lignes: [] }] }), validProfile)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.field === 'lignes')).toBe(true)
  })

  it('rejette si lots vide', () => {
    const result = validateFacturx(makeFacture({ lots: [] }), validProfile)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.field === 'lignes')).toBe(true)
  })

  it('rejette une ligne avec description vide', () => {
    const lots = [{ lignes: [{ description: '', quantity: 1, unit_price_ht: 100, tva_rate: 20 }] }]
    const result = validateFacturx(makeFacture({ lots }), validProfile)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.field.includes('description'))).toBe(true)
  })

  it('rejette une ligne avec quantité 0', () => {
    const lots = [{ lignes: [{ description: 'Test', quantity: 0, unit_price_ht: 100, tva_rate: 20 }] }]
    const result = validateFacturx(makeFacture({ lots }), validProfile)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.field.includes('quantity'))).toBe(true)
  })

  it('accepte une ligne avec quantité négative (avoir)', () => {
    const lots = [{ lignes: [{ description: 'Avoir', quantity: -1, unit_price_ht: 100, tva_rate: 20 }] }]
    const result = validateFacturx(makeFacture({ type: 'avoir', lots }), validProfile)
    // quantity négative OK pour avoir (validée en amont par le type)
    expect(result.errors.some(e => e.field.includes('quantity'))).toBe(false)
  })

  // ── Montants ──────────────────────────────────────────────────────────────

  it('rejette si total_ttc négatif sur une facture ordinaire', () => {
    const result = validateFacturx(
      makeFacture({ total_ttc: -100 }),
      validProfile
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.field === 'total_ttc')).toBe(true)
  })

  it('accepte total_ttc négatif sur un avoir', () => {
    const result = validateFacturx(
      makeFacture({ type: 'avoir', total_ttc: -1200 }),
      validProfile
    )
    expect(result.errors.some(e => e.field === 'total_ttc')).toBe(false)
  })

  // ── Accumulation d'erreurs ────────────────────────────────────────────────

  it('rapporte toutes les erreurs en une seule passe', () => {
    const result = validateFacturx(
      makeFacture({ client_id: null, client: null }),
      { ...validProfile, siret: null, company_name: null, full_name: null }
    )
    expect(result.valid).toBe(false)
    // Doit rapporter : SIRET manquant + nom manquant + client manquant
    expect(result.errors.length).toBeGreaterThanOrEqual(3)
  })
})
