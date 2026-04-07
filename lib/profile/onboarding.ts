/**
 * Onboarding gate logic for Artisan profiles.
 *
 * An artisan cannot create quotes or invoices until onboarding is complete.
 * Required fields per spec HEL-68 § 0:
 *   - siret
 *   - insurance_decennale_number
 *   - insurance_decennale_company
 *   - is_auto_entrepreneur (boolean, must be explicitly set)
 */

export interface ProfileOnboardingFields {
  siret?: string | null
  insurance_decennale_number?: string | null
  insurance_decennale_company?: string | null
  is_auto_entrepreneur?: boolean | null
}

export interface OnboardingCheckResult {
  complete: boolean
  missing: string[]
}

/**
 * Checks whether a profile meets the onboarding requirements.
 *
 * Returns `complete: true` if all required fields are non-null and non-empty.
 * Returns the list of missing field names otherwise.
 */
export function checkOnboardingComplete(
  profile: ProfileOnboardingFields
): OnboardingCheckResult {
  const missing: string[] = []

  if (!profile.siret?.trim()) {
    missing.push('siret')
  }
  if (!profile.insurance_decennale_number?.trim()) {
    missing.push('insurance_decennale_number')
  }
  if (!profile.insurance_decennale_company?.trim()) {
    missing.push('insurance_decennale_company')
  }
  if (profile.is_auto_entrepreneur === null || profile.is_auto_entrepreneur === undefined) {
    missing.push('is_auto_entrepreneur')
  }

  return {
    complete: missing.length === 0,
    missing,
  }
}

/**
 * Returns true if the profile has completed onboarding.
 * Shorthand for `checkOnboardingComplete(profile).complete`.
 */
export function isOnboardingComplete(profile: ProfileOnboardingFields): boolean {
  return checkOnboardingComplete(profile).complete
}
