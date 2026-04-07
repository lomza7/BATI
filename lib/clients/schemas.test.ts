import { describe, it, expect } from 'vitest'
import { clientCreateSchema, clientUpdateSchema, isDuplicateClient } from './schemas'

describe('clientCreateSchema', () => {
  // ── Valid inputs ────────────────────────────────────────────────────────────

  it('accepts a minimal valid client (name only)', () => {
    const result = clientCreateSchema.safeParse({ name: 'Jean Dupont' })
    expect(result.success).toBe(true)
  })

  it('accepts a fully-populated client', () => {
    const result = clientCreateSchema.safeParse({
      name: 'ACME Construction',
      email: 'contact@acme.fr',
      phone: '0612345678',
      address: '12 rue de la Paix',
      city: 'Paris',
      postal_code: '75001',
      notes: 'Bon payeur',
    })
    expect(result.success).toBe(true)
  })

  it('accepts client without email (optional)', () => {
    const result = clientCreateSchema.safeParse({ name: 'Marie Martin' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.email).toBeUndefined()
    }
  })

  it('transforms empty email string to undefined', () => {
    const result = clientCreateSchema.safeParse({ name: 'Test', email: '' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.email).toBeUndefined()
    }
  })

  it('transforms empty postal_code string to undefined', () => {
    const result = clientCreateSchema.safeParse({ name: 'Test', postal_code: '' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.postal_code).toBeUndefined()
    }
  })

  // ── Validation errors ───────────────────────────────────────────────────────

  it('rejects missing name', () => {
    const result = clientCreateSchema.safeParse({ email: 'test@test.fr' })
    expect(result.success).toBe(false)
  })

  it('rejects empty name string', () => {
    const result = clientCreateSchema.safeParse({ name: '' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid email format', () => {
    const result = clientCreateSchema.safeParse({ name: 'Test', email: 'pas-un-email' })
    expect(result.success).toBe(false)
  })

  it('rejects email missing domain', () => {
    const result = clientCreateSchema.safeParse({ name: 'Test', email: 'test@' })
    expect(result.success).toBe(false)
  })

  it('rejects postal_code with letters', () => {
    const result = clientCreateSchema.safeParse({ name: 'Test', postal_code: '7500A' })
    expect(result.success).toBe(false)
  })

  it('rejects postal_code with 4 digits', () => {
    const result = clientCreateSchema.safeParse({ name: 'Test', postal_code: '7500' })
    expect(result.success).toBe(false)
  })

  it('rejects postal_code with 6 digits', () => {
    const result = clientCreateSchema.safeParse({ name: 'Test', postal_code: '750011' })
    expect(result.success).toBe(false)
  })

  it('rejects name exceeding 255 characters', () => {
    const result = clientCreateSchema.safeParse({ name: 'A'.repeat(256) })
    expect(result.success).toBe(false)
  })

  // ── Edge cases BTP ──────────────────────────────────────────────────────────

  it('accepts client without an address (chantier sans adresse)', () => {
    const result = clientCreateSchema.safeParse({
      name: 'Client sans adresse',
      email: 'x@y.fr',
    })
    expect(result.success).toBe(true)
  })

  it('accepts artisan input with unicode characters in name', () => {
    const result = clientCreateSchema.safeParse({ name: 'Müller & Søren Ñoño' })
    expect(result.success).toBe(true)
  })
})

describe('clientUpdateSchema', () => {
  it('accepts an empty object (all fields optional)', () => {
    const result = clientUpdateSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('accepts a partial update with only email', () => {
    const result = clientUpdateSchema.safeParse({ email: 'new@mail.fr' })
    expect(result.success).toBe(true)
  })

  it('rejects invalid email even in partial update', () => {
    const result = clientUpdateSchema.safeParse({ email: 'bad-email' })
    expect(result.success).toBe(false)
  })
})

describe('isDuplicateClient()', () => {
  // ── Email duplicates ────────────────────────────────────────────────────────

  it('detects duplicate by exact email match', () => {
    expect(isDuplicateClient(
      { email: 'jean@dupont.fr' },
      { email: 'jean@dupont.fr' }
    )).toBe(true)
  })

  it('detects duplicate with case-insensitive email comparison', () => {
    expect(isDuplicateClient(
      { email: 'Jean@Dupont.FR' },
      { email: 'jean@dupont.fr' }
    )).toBe(true)
  })

  it('detects duplicate with leading/trailing email whitespace', () => {
    expect(isDuplicateClient(
      { email: '  jean@dupont.fr  ' },
      { email: 'jean@dupont.fr' }
    )).toBe(true)
  })

  it('does not flag different emails as duplicate', () => {
    expect(isDuplicateClient(
      { email: 'jean@dupont.fr' },
      { email: 'pierre@dupont.fr' }
    )).toBe(false)
  })

  // ── Phone duplicates ────────────────────────────────────────────────────────

  it('detects duplicate by exact phone match', () => {
    expect(isDuplicateClient(
      { phone: '0612345678' },
      { phone: '0612345678' }
    )).toBe(true)
  })

  it('detects duplicate with phone formatting differences', () => {
    // French mobile formatted vs unformatted
    expect(isDuplicateClient(
      { phone: '06 12 34 56 78' },
      { phone: '0612345678' }
    )).toBe(true)
  })

  it('detects duplicate ignoring international prefix', () => {
    expect(isDuplicateClient(
      { phone: '+33612345678' },
      { phone: '0612345678' }
    )).toBe(true)
  })

  it('does not flag different phones as duplicate', () => {
    expect(isDuplicateClient(
      { phone: '0612345678' },
      { phone: '0687654321' }
    )).toBe(false)
  })

  // ── No contact info ─────────────────────────────────────────────────────────

  it('does not flag as duplicate when both emails are absent', () => {
    expect(isDuplicateClient(
      {},
      { email: null, phone: null }
    )).toBe(false)
  })

  it('does not flag as duplicate when candidate has no contact info', () => {
    expect(isDuplicateClient(
      {},
      { email: 'existing@mail.fr', phone: '0600000000' }
    )).toBe(false)
  })

  it('does not flag as duplicate when existing has no contact info', () => {
    expect(isDuplicateClient(
      { email: 'new@mail.fr', phone: '0611111111' },
      { email: null, phone: null }
    )).toBe(false)
  })
})
