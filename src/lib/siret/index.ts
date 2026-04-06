/**
 * SIRET validation using the Luhn algorithm.
 *
 * SIRET = SIREN (9 digits) + NIC (5 digits) = 14 digits total.
 * Validity: the 14-digit number passes the Luhn check.
 *
 * Special case: "La Poste" SIREN 356000000 is a known Luhn-exception in some
 * implementations. We do NOT special-case it here — standard Luhn only.
 */

/**
 * Returns true if the input is a valid 14-digit SIRET according to Luhn.
 */
export function validateSiret(siret: string): boolean {
  const cleaned = siret.replace(/\s/g, '')

  if (!/^\d{14}$/.test(cleaned)) {
    return false
  }

  return luhn(cleaned)
}

/**
 * Standard Luhn algorithm.
 * Processes digits from right to left: double every second digit;
 * if result > 9 subtract 9; sum all; valid if sum % 10 === 0.
 */
function luhn(digits: string): boolean {
  let sum = 0
  let isSecond = false

  for (let i = digits.length - 1; i >= 0; i--) {
    let d = parseInt(digits[i]!, 10)

    if (isSecond) {
      d *= 2
      if (d > 9) d -= 9
    }

    sum += d
    isSecond = !isSecond
  }

  return sum % 10 === 0
}
