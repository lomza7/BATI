/**
 * Export FEC (Fichier des Écritures Comptables)
 * Format légal : arrêté du 29/07/2013, modifié par l'arrêté du 22/12/2017.
 *
 * - Encodage : UTF-8 (autorisé depuis 2014)
 * - Séparateur : tabulation
 * - 18 colonnes obligatoires
 * - Une ligne d'en-tête + une ligne par mouvement
 * - Pour une dépense : 2 lignes (charge HT + TVA déductible) côté débit, 1 ligne fournisseur côté crédit
 * - Pour une facture payée : 1 ligne banque débit + 1 ligne client crédit + ligne(s) vente HT + TVA collectée
 */

import { getPcgAccountForCategorySlug, PCG_ACCOUNTS, getPcgTvaAccount } from './pcg-accounts';

interface FecExpense {
  id: string;
  date: string;
  description: string;
  supplier: string;
  amount_ht: number | null;
  tva_amount: number | null;
  amount: number | null;
  tva_rate: number | null;
  category_slug: string | null;
  invoice_number?: string | null;
}

interface FecInvoice {
  id: string;
  invoice_number: string;
  title: string;
  client_name: string;
  total_ht: number | null;
  tva_rate: number | null;
  total_ttc: number | null;
  paid_at: string | null;
  issued_at?: string | null;
  created_at: string;
}

interface FecOptions {
  artisanName: string;
  expenses: FecExpense[];
  invoices: FecInvoice[];
  fiscalYear: number;
}

const FEC_HEADERS = [
  'JournalCode',
  'JournalLib',
  'EcritureNum',
  'EcritureDate',
  'CompteNum',
  'CompteLib',
  'CompAuxNum',
  'CompAuxLib',
  'PieceRef',
  'PieceDate',
  'EcritureLib',
  'Debit',
  'Credit',
  'EcritureLet',
  'DateLet',
  'ValidDate',
  'Montantdevise',
  'Idevise',
];

function fmtDate(d: string | null | undefined): string {
  if (!d) return '';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${dd}`;
}

function fmtAmount(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n)) return '0,00';
  // FEC : virgule décimale, pas de séparateur de milliers
  return n.toFixed(2).replace('.', ',');
}

function clean(s: string | null | undefined): string {
  if (!s) return '';
  return String(s).replace(/[\t\r\n]/g, ' ').trim();
}

export function buildFecFile(opts: FecOptions): string {
  const { artisanName, expenses, invoices, fiscalYear } = opts;
  const lines: string[][] = [FEC_HEADERS];

  let ecritureCounter = 1;

  // === ACHATS (Journal AC) ===
  for (const exp of expenses) {
    if (!exp.date) continue;
    const dt = fmtDate(exp.date);
    const num = `AC${String(ecritureCounter).padStart(6, '0')}`;
    ecritureCounter += 1;

    const cat = getPcgAccountForCategorySlug(exp.category_slug);
    const ht = Number(exp.amount_ht || 0);
    const tva = Number(exp.tva_amount || 0);
    const ttc = Number(exp.amount || ht + tva);

    const lib = clean(`${exp.supplier || 'Fournisseur'} - ${exp.description || ''}`).slice(0, 200);
    const piece = clean(exp.invoice_number || exp.id.slice(0, 8));

    // Ligne 1 : débit charge HT
    lines.push([
      'AC',
      'Achats',
      num,
      dt,
      cat.account,
      cat.label,
      '',
      '',
      piece,
      dt,
      lib,
      fmtAmount(ht),
      '0,00',
      '',
      '',
      dt,
      '',
      '',
    ]);

    // Ligne 2 : débit TVA déductible (si applicable)
    if (tva > 0) {
      const tvaAcc = getPcgTvaAccount(Number(exp.tva_rate || 20), 'deductible');
      lines.push([
        'AC',
        'Achats',
        num,
        dt,
        tvaAcc.account,
        tvaAcc.label,
        '',
        '',
        piece,
        dt,
        lib,
        fmtAmount(tva),
        '0,00',
        '',
        '',
        dt,
        '',
        '',
      ]);
    }

    // Ligne 3 : crédit fournisseur (TTC)
    lines.push([
      'AC',
      'Achats',
      num,
      dt,
      PCG_ACCOUNTS.fournisseurs.account,
      PCG_ACCOUNTS.fournisseurs.label,
      '',
      clean(exp.supplier),
      piece,
      dt,
      lib,
      '0,00',
      fmtAmount(ttc),
      '',
      '',
      dt,
      '',
      '',
    ]);
  }

  // === VENTES (Journal VE) ===
  for (const inv of invoices) {
    const issueDate = inv.issued_at || inv.created_at;
    if (!issueDate) continue;
    const dt = fmtDate(issueDate);
    const num = `VE${String(ecritureCounter).padStart(6, '0')}`;
    ecritureCounter += 1;

    const ht = Number(inv.total_ht || 0);
    const ttc = Number(inv.total_ttc || 0);
    const tva = Math.max(0, ttc - ht);
    const lib = clean(`${inv.client_name || 'Client'} - ${inv.title || ''}`).slice(0, 200);
    const piece = clean(inv.invoice_number);

    // Ligne 1 : débit client TTC
    lines.push([
      'VE',
      'Ventes',
      num,
      dt,
      PCG_ACCOUNTS.clients.account,
      PCG_ACCOUNTS.clients.label,
      '',
      clean(inv.client_name),
      piece,
      dt,
      lib,
      fmtAmount(ttc),
      '0,00',
      '',
      '',
      dt,
      '',
      '',
    ]);

    // Ligne 2 : crédit prestations HT
    lines.push([
      'VE',
      'Ventes',
      num,
      dt,
      PCG_ACCOUNTS.ventes_prestations.account,
      PCG_ACCOUNTS.ventes_prestations.label,
      '',
      '',
      piece,
      dt,
      lib,
      '0,00',
      fmtAmount(ht),
      '',
      '',
      dt,
      '',
      '',
    ]);

    // Ligne 3 : crédit TVA collectée
    if (tva > 0) {
      lines.push([
        'VE',
        'Ventes',
        num,
        dt,
        PCG_ACCOUNTS.tva_collectee.account,
        PCG_ACCOUNTS.tva_collectee.label,
        '',
        '',
        piece,
        dt,
        lib,
        '0,00',
        fmtAmount(tva),
        '',
        '',
        dt,
        '',
        '',
      ]);
    }

    // === ENCAISSEMENT (Journal BQ) si payée ===
    if (inv.paid_at) {
      const payDt = fmtDate(inv.paid_at);
      const payNum = `BQ${String(ecritureCounter).padStart(6, '0')}`;
      ecritureCounter += 1;

      // Débit banque
      lines.push([
        'BQ',
        'Banque',
        payNum,
        payDt,
        PCG_ACCOUNTS.banque.account,
        PCG_ACCOUNTS.banque.label,
        '',
        '',
        piece,
        payDt,
        `Encaissement ${piece}`,
        fmtAmount(ttc),
        '0,00',
        '',
        '',
        payDt,
        '',
        '',
      ]);

      // Crédit client
      lines.push([
        'BQ',
        'Banque',
        payNum,
        payDt,
        PCG_ACCOUNTS.clients.account,
        PCG_ACCOUNTS.clients.label,
        '',
        clean(inv.client_name),
        piece,
        payDt,
        `Encaissement ${piece}`,
        '0,00',
        fmtAmount(ttc),
        '',
        '',
        payDt,
        '',
        '',
      ]);
    }
  }

  // Pas de mouvement : générer un FEC vide avec en-tête seul est valide
  void artisanName;
  void fiscalYear;

  return lines.map((row) => row.join('\t')).join('\r\n') + '\r\n';
}

export function fecFileName(siren: string | null, fiscalYearEnd: string): string {
  const cleanSiren = (siren || '').replace(/\D/g, '').padStart(9, '0').slice(0, 9);
  const dt = fmtDate(fiscalYearEnd) || '00000000';
  return `${cleanSiren}FEC${dt}.txt`;
}
