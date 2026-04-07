import { describe, it, expect } from 'vitest'
import { checkOnboardingComplete, isOnboardingComplete } from './onboarding'

const completeProfile = {
  siret: '73042926600015',
  insurance_decennale_number: 'DEC-2024-00123',
  insurance_decennale_company: 'AXA Assurances',
  is_auto_entrepreneur: false,
}

describe('checkOnboardingComplete()', () => {
  it('returns complete=true for a fully filled profile', () => {
    const result = checkOnboardingComplete(completeProfile)
    expect(result.complete).toBe(true)
    expect(result.missing).toEqual([])
  })

  it('returns complete=true for an auto-entrepreneur (is_auto_entrepreneur=true)', () => {
    const result = checkOnboardingComplete({ ...completeProfile, is_auto_entrepreneur: true })
    expect(result.complete).toBe(true)
  })

  // ── Missing fields ──────────────────────────────────────────────────────────

  it('flags missing siret', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = checkOnboardingComplete({ ...completeProfile, siret: undefined } as any)
    expect(result.complete).toBe(false)
    expect(result.missing).toContain('siret')
  })

  it('flags empty siret string', () => {
    const result = checkOnboardingComplete({ ...completeProfile, siret: '' })
    expect(result.complete).toBe(false)
    expect(result.missing).toContain('siret')
  })

  it('flags whitespace-only siret', () => {
    const result = checkOnboardingComplete({ ...completeProfile, siret: '   ' })
    expect(result.complete).toBe(false)
    expect(result.missing).toContain('siret')
  })

  it('flags null siret', () => {
    const result = checkOnboardingComplete({ ...completeProfile, siret: null })
    expect(result.complete).toBe(false)
    expect(result.missing).toContain('siret')
  })

  it('flags missing insurance_decennale_number', () => {
    const result = checkOnboardingComplete({
      ...completeProfile,
      insurance_decennale_number: null,
    })
    expect(result.complete).toBe(false)
    expect(result.missing).toContain('insurance_decennale_number')
  })

  it('flags missing insurance_decennale_company', () => {
    const result = checkOnboardingComplete({
      ...completeProfile,
      insurance_decennale_company: '',
    })
    expect(result.complete).toBe(false)
    expect(result.missing).toContain('insurance_decennale_company')
  })

  it('flags undefined is_auto_entrepreneur (not yet set)', () => {
    const result = checkOnboardingComplete({
      ...completeProfile,
      is_auto_entrepreneur: undefined,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    expect(result.complete).toBe(false)
    expect(result.missing).toContain('is_auto_entrepreneur')
  })

  it('flags null is_auto_entrepreneur', () => {
    const result = checkOnboardingComplete({
      ...completeProfile,
      is_auto_entrepreneur: null,
    })
    expect(result.complete).toBe(false)
    expect(result.missing).toContain('is_auto_entrepreneur')
  })

  // ── Multiple missing fields ─────────────────────────────────────────────────

  it('reports all missing fields at once', () => {
    const result = checkOnboardingComplete({})
    expect(result.complete).toBe(false)
    expect(result.missing).toContain('siret')
    expect(result.missing).toContain('insurance_decennale_number')
    expect(result.missing).toContain('insurance_decennale_company')
    expect(result.missing).toContain('is_auto_entrepreneur')
    expect(result.missing).toHaveLength(4)
  })

  it('reports only the incomplete fields when partially filled', () => {
    const result = checkOnboardingComplete({
      siret: '73042926600015',
      insurance_decennale_number: 'DEC-001',
      // missing insurance_decennale_company and is_auto_entrepreneur
    })
    expect(result.missing).toHaveLength(2)
    expect(result.missing).toContain('insurance_decennale_company')
    expect(result.missing).toContain('is_auto_entrepreneur')
  })
})

describe('isOnboardingComplete()', () => {
  it('returns true for complete profile', () => {
    expect(isOnboardingComplete(completeProfile)).toBe(true)
  })

  it('returns false for incomplete profile', () => {
    expect(isOnboardingComplete({})).toBe(false)
  })
})
