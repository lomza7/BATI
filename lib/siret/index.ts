/**
 * SIRET validation using the Luhn algorithm.
 * SIRET = SIREN (9 digits) + NIC (5 digits) = 14 digits total.
 */

export function validateSiret(siret: string): boolean {
  const cleaned = siret.replace(/\s/g, '')
  if (!/^\d{14}$/.test(cleaned)) return false
  return luhn(cleaned)
}

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
