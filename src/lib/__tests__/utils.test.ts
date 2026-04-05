import { describe, it, expect } from 'vitest'
import { cn } from '../utils'

describe('cn()', () => {
  it('returns empty string with no arguments', () => {
    expect(cn()).toBe('')
  })

  it('returns a single class unchanged', () => {
    expect(cn('text-red-500')).toBe('text-red-500')
  })

  it('joins multiple classes', () => {
    expect(cn('text-red-500', 'font-bold')).toBe('text-red-500 font-bold')
  })

  it('ignores falsy values (undefined, null, false, empty string)', () => {
    expect(cn('text-red-500', undefined, null, false, '')).toBe('text-red-500')
  })

  it('handles conditional classes via object syntax', () => {
    expect(cn({ 'text-red-500': true, 'font-bold': false })).toBe('text-red-500')
  })

  it('handles array inputs', () => {
    expect(cn(['text-red-500', 'font-bold'])).toBe('text-red-500 font-bold')
  })

  it('resolves Tailwind conflicts — last wins', () => {
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500')
  })

  it('resolves padding conflicts', () => {
    expect(cn('p-4', 'p-6')).toBe('p-6')
  })

  it('resolves mixed padding/padding-axis conflicts', () => {
    expect(cn('px-4', 'px-6')).toBe('px-6')
  })

  it('keeps non-conflicting Tailwind utilities', () => {
    expect(cn('text-red-500', 'font-bold', 'underline')).toBe(
      'text-red-500 font-bold underline'
    )
  })

  it('handles mixed conditionals and strings', () => {
    const isActive = true
    const isDisabled = false
    expect(cn('base-class', { 'active-class': isActive, 'disabled-class': isDisabled })).toBe(
      'base-class active-class'
    )
  })

  it('handles deeply nested arrays', () => {
    expect(cn(['text-sm', ['font-medium', 'text-gray-700']])).toBe(
      'text-sm font-medium text-gray-700'
    )
  })
})
