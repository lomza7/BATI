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
 * - Pour un avoir : l'écriture de vente strictement inversée, en montants
 *   positifs (le format interdit les négatifs) — cf. le bloc VENTES plus bas
 */

import { getPcgAccountForCategorySlug, PCG_ACCOUNTS, getPcgTvaAccount } from './pcg-accounts';
import { parseTvaBreakdown, type TvaBreakdownEntry } from '../tva';
import { isCreditNote } from '../invoices/credit-notes';

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
  tva_breakdown?: unknown;
  total_ttc: number | null;
  paid_at: string | null;
  issued_at?: string | null;
  created_at: string;
  /** 'standard' | 'acompte' | 'solde' | 'avoir' — seul 'avoir' inverse l'écriture. */
  invoice_type?: string | null;
  /** Numéro de la facture rectifiée, repris dans le libellé d'écriture d'un avoir. */
  credited_invoice_number?: string | null;
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

/**
 * Montant FEC : virgule décimale, pas de séparateur de milliers, et **jamais
 * de signe négatif**. Le format n'accepte que des montants positifs dans les
 * colonnes Debit et Credit (arrêté du 29/07/2013, art. A.47 A-1 LPF) : le
 * sens d'une écriture se porte par la colonne choisie, pas par le signe.
 *
 * La valeur absolue appliquée ici est un garde-fou, pas une politique : c'est
 * à l'appelant de placer le montant du bon côté (cf. le traitement des avoirs
 * dans le journal VE). Elle garantit qu'un montant négatif oublié quelque part
 * ne rend pas le fichier entier irrecevable, tout en préservant l'équilibre
 * débit / crédit de l'écriture — ce qu'un écrasement à 0 casserait.
 */
function fmtAmount(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(Number(n))) return '0,00';
  // Math.abs ramène aussi -0 et les résidus d'arrondi négatifs (-0,004) à du
  // positif, donc toFixed ne peut plus produire un « -0,00 ».
  return Math.abs(Number(n)).toFixed(2).replace('.', ',');
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

    // Un avoir est une facture rectificative (art. 289 CGI), pas une
    // annulation : l'app stocke ses montants en négatif, ce qui rend justes
    // par simple somme tous les agrégats. Mais le FEC interdit les montants
    // négatifs dans les colonnes Debit et Credit. On n'écrit donc jamais de
    // signe moins : on passe l'écriture STRICTEMENT INVERSE en valeur absolue.
    //
    //   facture : débit 411 Clients (TTC) / crédit 706 (HT par taux) + crédit 44571 (TVA)
    //   avoir   : débit 706 (HT par taux) + débit 44571 (TVA) / crédit 411 Clients (TTC)
    //
    // C'est la saisie standard d'un expert-comptable, et c'est elle qui
    // régularise la TVA collectée (art. 272-1 CGI). Le journal reste VE : un
    // avoir est une écriture de vente, pas un journal à part.
    const isAvoir = isCreditNote(inv);

    const ht = Number(inv.total_ht || 0);
    const ttc = Number(inv.total_ttc || 0);
    // La TVA déduite du couple (TTC − HT) suit le signe du document : sur un
    // avoir, la borner à 0 effacerait la TVA à régulariser.
    const totalTvaSimple = isAvoir ? Math.min(0, ttc - ht) : Math.max(0, ttc - ht);
    const docLib = `${inv.client_name || 'Client'} - ${inv.title || ''}`;
    // La référence à la facture rectifiée est obligatoire sur un avoir : on la
    // fait aussi apparaître dans le libellé d'écriture, le FEC étant souvent
    // relu tel quel par le contrôleur.
    const lib = clean(
      isAvoir
        ? `Avoir${inv.credited_invoice_number ? ` sur facture ${inv.credited_invoice_number}` : ''} - ${docLib}`
        : docLib,
    ).slice(0, 200);
    const piece = clean(inv.invoice_number);

    // Rebuild per-rate breakdown — prefer stored JSONB, fallback to single legacy rate
    const parsed = parseTvaBreakdown(inv.tva_breakdown);
    const rateGroups: TvaBreakdownEntry[] = parsed.length > 0
      ? parsed
      : [{
          rate: Number(inv.tva_rate || 20),
          base_ht: ht,
          tva_amount: totalTvaSimple,
        }];

    // Ligne 1 : compte client — débit TTC sur une facture, crédit sur un avoir
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
      isAvoir ? '0,00' : fmtAmount(ttc),
      isAvoir ? fmtAmount(ttc) : '0,00',
      '',
      '',
      dt,
      '',
      '',
    ]);

    // Une paire de lignes (ventes HT + TVA collectée) par taux de TVA.
    // Au crédit sur une facture, au débit sur un avoir.
    for (const g of rateGroups) {
      // Prestations HT (par taux)
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
        isAvoir ? fmtAmount(g.base_ht) : '0,00',
        isAvoir ? '0,00' : fmtAmount(g.base_ht),
        '',
        '',
        dt,
        '',
        '',
      ]);

      // TVA collectée (le libellé FEC intègre le taux pour lecture humaine).
      // Sur un avoir, tva_amount est négatif : on borne dans le sens du
      // document, sinon la régularisation de TVA disparaîtrait du fichier.
      // Une ligne à 0 (franchise en base, art. 293 B CGI) reste omise.
      const groupTva = isAvoir ? Math.min(0, g.tva_amount) : Math.max(0, g.tva_amount);
      if (groupTva !== 0) {
        const tvaLibWithRate = `${PCG_ACCOUNTS.tva_collectee.label} (${g.rate}%)`.slice(0, 200);
        lines.push([
          'VE',
          'Ventes',
          num,
          dt,
          PCG_ACCOUNTS.tva_collectee.account,
          tvaLibWithRate,
          '',
          '',
          piece,
          dt,
          lib,
          isAvoir ? fmtAmount(groupTva) : '0,00',
          isAvoir ? '0,00' : fmtAmount(groupTva),
          '',
          '',
          dt,
          '',
          '',
        ]);
      }
    }

    // === ENCAISSEMENT (Journal BQ) si payée ===
    // Jamais pour un avoir : un avoir n'est pas encaissable. Tant qu'il n'a
    // pas été remboursé au client, il reste une dette au crédit du compte 411
    // et ne produit aucun mouvement de trésorerie. Le remboursement effectif
    // (décaissement 411 → 512) est HORS SCOPE ici : l'application ne trace pas
    // encore ce flux, il n'y a donc rien à écrire au journal BQ.
    if (inv.paid_at && !isAvoir) {
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
