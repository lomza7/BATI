/**
 * Factur-X EN16931 structural validation
 * Validates required fields before XML embedding.
 * Bloquant avant émission.
 */

export interface FacturxValidationError {
  field: string
  message: string
}

export interface FacturxValidationResult {
  valid: boolean
  errors: FacturxValidationError[]
}

interface ValidatableFacture {
  reference: string
  type: string
  total_ht: number
  total_tva: number
  total_ttc: number
  emitted_at: string | null
  client_id: string | null
  client?: {
    name: string
    siret: string | null
    client_type: string
    billing_address: string | null
    billing_city: string | null
    billing_postal_code: string | null
  } | null
  lots: Array<{
    lignes?: Array<{
      description: string
      quantity: number
      unit_price_ht: number
      tva_rate: number
    }>
  }>
}

interface ValidatableProfile {
  siret: string | null
  company_name: string | null
  full_name: string | null
  address: string | null
  city: string | null
  postal_code: string | null
  is_auto_entrepreneur: boolean
}

export function validateFacturx(
  facture: ValidatableFacture,
  profile: ValidatableProfile
): FacturxValidationResult {
  const errors: FacturxValidationError[] = []

  // Référence obligatoire
  if (!facture.reference || facture.reference.trim().length === 0) {
    errors.push({ field: 'reference', message: 'La référence de la facture est obligatoire.' })
  }

  // Vendeur — SIRET obligatoire
  if (!profile.siret || profile.siret.replace(/\s/g, '').length !== 14) {
    errors.push({
      field: 'profile.siret',
      message: 'SIRET artisan invalide ou manquant (14 chiffres requis).',
    })
  }

  // Vendeur — nom/raison sociale
  if (!profile.company_name && !profile.full_name) {
    errors.push({
      field: 'profile.name',
      message: "Raison sociale ou nom de l'artisan manquant.",
    })
  }

  // Vendeur — adresse
  if (!profile.address || !profile.city || !profile.postal_code) {
    errors.push({
      field: 'profile.address',
      message: "Adresse complète de l'artisan requise (rue, ville, code postal).",
    })
  }

  // Acheteur — obligatoire
  if (!facture.client_id || !facture.client) {
    errors.push({ field: 'client_id', message: 'Un client est obligatoire pour émettre une facture.' })
  } else {
    // Acheteur — nom
    if (!facture.client.name || facture.client.name.trim().length === 0) {
      errors.push({ field: 'client.name', message: 'Nom du client manquant.' })
    }

    // Acheteur — SIRET obligatoire si professionnel (B2B)
    if (
      facture.client.client_type === 'professionnel' &&
      (!facture.client.siret || facture.client.siret.replace(/\s/g, '').length !== 14)
    ) {
      errors.push({
        field: 'client.siret',
        message: 'SIRET client obligatoire pour les clients professionnels (B2B).',
      })
    }
  }

  // Lignes — au moins une
  const totalLignes = facture.lots.reduce((acc, lot) => acc + (lot.lignes?.length ?? 0), 0)
  if (totalLignes === 0) {
    errors.push({ field: 'lignes', message: 'La facture doit contenir au moins une ligne.' })
  }

  // Lignes — validation individuelle
  let lineIdx = 0
  for (const lot of facture.lots) {
    for (const ligne of lot.lignes ?? []) {
      lineIdx++
      if (!ligne.description || ligne.description.trim().length === 0) {
        errors.push({ field: `ligne[${lineIdx}].description`, message: `Ligne ${lineIdx} : description manquante.` })
      }
      if (ligne.quantity === 0) {
        errors.push({ field: `ligne[${lineIdx}].quantity`, message: `Ligne ${lineIdx} : quantité ne peut pas être 0.` })
      }
      if (!profile.is_auto_entrepreneur && (ligne.tva_rate < 0 || ligne.tva_rate > 100)) {
        errors.push({
          field: `ligne[${lineIdx}].tva_rate`,
          message: `Ligne ${lineIdx} : taux TVA invalide (0, 10 ou 20%).`,
        })
      }
    }
  }

  // Montants cohérents
  if (facture.total_ttc < 0 && facture.type !== 'avoir') {
    errors.push({ field: 'total_ttc', message: 'Le total TTC ne peut pas être négatif (hors avoir).' })
  }

  return { valid: errors.length === 0, errors }
}
