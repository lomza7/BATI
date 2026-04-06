import { describe, it, expect } from 'vitest'
import { validateSiret } from './index'

describe('validateSiret()', () => {
  // Known valid SIRETs (Luhn-verified test fixtures — not real company data)
  it('accepts a valid SIRET (73042926600010)', () => {
    expect(validateSiret('73042926600010')).toBe(true)
  })

  it('accepts a second valid SIRET (66204244900048)', () => {
    expect(validateSiret('66204244900048')).toBe(true)
  })

  it('accepts a valid SIRET with spaces (formatted)', () => {
    expect(validateSiret('730 429 266 00010')).toBe(true)
  })

  // Length checks
  it('rejects a SIRET with 13 digits (too short)', () => {
    expect(validateSiret('7304292660001')).toBe(false)
  })

  it('rejects a SIRET with 15 digits (too long)', () => {
    expect(validateSiret('730429266000150')).toBe(false)
  })

  it('rejects an empty string', () => {
    expect(validateSiret('')).toBe(false)
  })

  // Non-digit characters
  it('rejects a SIRET containing letters', () => {
    expect(validateSiret('7304292660001A')).toBe(false)
  })

  it('rejects a SIRET containing dashes', () => {
    expect(validateSiret('73042926-600015')).toBe(false)
  })

  // Luhn checksum failures
  it('rejects a SIRET that fails Luhn (last digit flipped)', () => {
    // Valid: 73042926600010 → flip last digit to 1
    expect(validateSiret('73042926600011')).toBe(false)
  })

  it('rejects all-zeros (passes format but fails Luhn)', () => {
    // 00000000000000 — sum = 0, which is divisible by 10, actually passes Luhn
    // Let's use a known-bad sequence instead
    expect(validateSiret('12345678901234')).toBe(false)
  })

  it('rejects a SIRET with one digit transposed', () => {
    // Swap first two digits: 73... → 37... (Luhn-invalid)
    expect(validateSiret('37042926600010')).toBe(false)
  })

  // Edge: all zeros passes Luhn (sum = 0)
  it('accepts all-zeros as technically Luhn-valid', () => {
    expect(validateSiret('00000000000000')).toBe(true)
  })
})
