/**
 * Mapping catégories Hellobat → comptes du Plan Comptable Général français.
 * Utilisé pour générer le FEC (Fichier des Écritures Comptables).
 */

export const PCG_DEFAULT_EXPENSE_ACCOUNT = '6068';

/** Catégorie → compte de charge (classe 6) */
export const PCG_CATEGORY_TO_ACCOUNT: Record<string, { account: string; label: string }> = {
  materiaux:      { account: '6063', label: 'Fournitures d\'entretien et petit équipement' },
  outillage:      { account: '6068', label: 'Autres matières et fournitures' },
  sous_traitance: { account: '611',  label: 'Sous-traitance générale' },
  carburant:      { account: '6061', label: 'Fournitures non stockables (eau, énergie)' },
  vehicule:       { account: '6155', label: 'Entretien et réparations sur biens mobiliers' },
  assurances:     { account: '616',  label: 'Primes d\'assurances' },
  telephone:      { account: '626',  label: 'Frais postaux et frais de télécommunications' },
  loyer:          { account: '613',  label: 'Locations' },
  fournitures:    { account: '6064', label: 'Fournitures administratives' },
  banque:         { account: '627',  label: 'Services bancaires et assimilés' },
  honoraires:     { account: '6226', label: 'Honoraires' },
  formation:      { account: '6228', label: 'Divers (rémunérations d\'intermédiaires)' },
  autres:         { account: '6068', label: 'Autres matières et fournitures' },
};

/** Comptes "racines" pour ventilation TVA et tiers */
export const PCG_ACCOUNTS = {
  // Tiers
  fournisseurs:           { account: '401',   label: 'Fournisseurs' },
  clients:                { account: '411',   label: 'Clients' },
  // TVA
  tva_deductible_biens:   { account: '44566', label: 'TVA déductible sur autres biens et services' },
  tva_deductible_immo:    { account: '44562', label: 'TVA déductible sur immobilisations' },
  tva_collectee:          { account: '44571', label: 'TVA collectée' },
  tva_a_decaisser:        { account: '44551', label: 'TVA à décaisser' },
  // Recettes (classe 7)
  ventes_prestations:     { account: '706',   label: 'Prestations de services' },
  ventes_marchandises:    { account: '707',   label: 'Ventes de marchandises' },
  // Banque
  banque:                 { account: '512',   label: 'Banques' },
  caisse:                 { account: '530',   label: 'Caisse' },
};

export function getPcgAccountForCategorySlug(slug: string | null | undefined): { account: string; label: string } {
  if (!slug) return { account: PCG_DEFAULT_EXPENSE_ACCOUNT, label: 'Charges diverses' };
  return PCG_CATEGORY_TO_ACCOUNT[slug] || { account: PCG_DEFAULT_EXPENSE_ACCOUNT, label: 'Charges diverses' };
}

export function getPcgTvaAccount(rate: number, side: 'collectee' | 'deductible'): { account: string; label: string } {
  if (side === 'collectee') return PCG_ACCOUNTS.tva_collectee;
  return PCG_ACCOUNTS.tva_deductible_biens;
}
