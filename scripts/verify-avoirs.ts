/**
 * Vérification bout-en-bout des avoirs (factures rectificatives).
 *
 * Ce script n'a besoin d'aucun réseau : il exerce les fonctions pures du
 * domaine (calcul du net dû, construction des lignes, génération du FEC,
 * ventilation de TVA) sur des jeux de données représentatifs, et vérifie les
 * invariants légaux et comptables qu'on ne peut pas confier à `tsc`.
 *
 *   npx tsx scripts/verify-avoirs.ts
 */

import {
  buildFullCreditNoteLines,
  buildPartialCreditNoteLine,
  buildCreditNoteLegalMention,
  isCreditNote,
  isFullyCredited,
  isPartiallyCredited,
  claimedHt,
  claimedTtc,
  netDueTtc,
  netRevenueTtc,
  remainingCreditableTtc,
  sumCreditNotesTtc,
  type CreditNoteRef,
  type SourceInvoiceLine,
} from '@/lib/invoices/credit-notes';
import { computeTvaBreakdown } from '@/lib/tva';
import { buildFecFile } from '@/lib/comptabilite/fec-export';

let passed = 0;
let failed = 0;

function check(label: string, condition: boolean, detail?: string) {
  if (condition) {
    passed += 1;
    console.log(`  ok   ${label}`);
  } else {
    failed += 1;
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

function eq(label: string, actual: unknown, expected: unknown) {
  check(label, Object.is(actual, expected), `attendu ${String(expected)}, obtenu ${String(actual)}`);
}

function section(title: string) {
  console.log(`\n${title}`);
}

// ─────────────────────────────────────────────────────────────
// Jeu de données : facture 3 500 € TTC à deux taux de TVA
// ─────────────────────────────────────────────────────────────
const INVOICE = {
  id: 'inv-1',
  invoice_number: 'F-2026-001',
  invoice_type: 'standard',
  total_ht: 3000,
  total_tva: 500,
  total_ttc: 3500,
};

const SOURCE_LINES: SourceInvoiceLine[] = [
  {
    description: 'Pose carrelage',
    detail: 'Carrelage grès cérame 60x60',
    quantity: 20,
    unit: 'm2',
    unit_price: 50,
    tva_rate: 10,
    section: 'Salle de bain',
    subsection: 'Sols',
    total: 1000,
    position: 0,
  },
  {
    description: 'Fourniture robinetterie',
    detail: null,
    quantity: 1,
    unit: 'forfait',
    unit_price: 2000,
    tva_rate: 20,
    section: 'Salle de bain',
    subsection: null,
    total: 2000,
    position: 1,
  },
];

// ─────────────────────────────────────────────────────────────
section('1. Avoir total — miroir exact des lignes');
// ─────────────────────────────────────────────────────────────
const fullLines = buildFullCreditNoteLines(SOURCE_LINES, 'user-1', 'av-1');

eq('deux lignes générées', fullLines.length, 2);
check(
  'quantités restées positives',
  fullLines.every((l) => l.quantity > 0),
);
check(
  'prix unitaires inversés',
  fullLines[0].unit_price === -50 && fullLines[1].unit_price === -2000,
);
check(
  'invariant quantity * unit_price === total',
  fullLines.every((l) => Math.abs(l.quantity * l.unit_price - l.total) < 0.005),
);
eq('taux de TVA par ligne préservé (10 %)', fullLines[0].tva_rate, 10);
eq('taux de TVA par ligne préservé (20 %)', fullLines[1].tva_rate, 20);
eq('section préservée', fullLines[0].section, 'Salle de bain');
eq('subsection préservée', fullLines[0].subsection, 'Sols');
eq('detail préservé', fullLines[0].detail, 'Carrelage grès cérame 60x60');
eq('unit préservé', fullLines[0].unit, 'm2');

const fullTva = computeTvaBreakdown(fullLines);
eq('total HT de l avoir total', fullTva.total_ht, -3000);
eq('total TVA de l avoir total', fullTva.total_tva, -500);
eq('total TTC de l avoir total', fullTva.total_ttc, -3500);
eq('ventilation sur deux taux', fullTva.tva_breakdown.length, 2);
check(
  'ventilation 10 % correcte',
  fullTva.tva_breakdown.some((b) => b.rate === 10 && b.base_ht === -1000 && b.tva_amount === -100),
  JSON.stringify(fullTva.tva_breakdown),
);
check(
  'ventilation 20 % correcte',
  fullTva.tva_breakdown.some((b) => b.rate === 20 && b.base_ht === -2000 && b.tva_amount === -400),
  JSON.stringify(fullTva.tva_breakdown),
);

// ─────────────────────────────────────────────────────────────
section('2. Avoir partiel');
// ─────────────────────────────────────────────────────────────
const partial = buildPartialCreditNoteLine({
  amountHt: 200,
  tvaRate: 10,
  label: 'Geste commercial',
  userId: 'user-1',
  creditNoteId: 'av-2',
});
eq('montant HT négatif', partial.total, -200);
eq('quantité à 1', partial.quantity, 1);
eq('taux de TVA respecté', partial.tva_rate, 10);
check(
  'un montant saisi en négatif ne double pas le signe',
  buildPartialCreditNoteLine({
    amountHt: -200,
    tvaRate: 10,
    label: 'x',
    userId: 'u',
    creditNoteId: 'c',
  }).total === -200,
);
const partialTva = computeTvaBreakdown([partial]);
eq('TTC de l avoir partiel', partialTva.total_ttc, -220);

// ─────────────────────────────────────────────────────────────
section('3. Net dû, crédit partiel, crédit total');
// ─────────────────────────────────────────────────────────────
const note = (ttc: number, status = 'creee'): CreditNoteRef => ({
  id: `n-${ttc}-${status}`,
  invoice_number: 'AV-2026-001',
  total_ht: ttc / 1.2,
  total_tva: ttc - ttc / 1.2,
  total_ttc: ttc,
  status,
  credited_invoice_id: 'inv-1',
});

eq('aucun avoir : net = total', netDueTtc(INVOICE, []), 3500);
eq('avoir partiel : net déduit', netDueTtc(INVOICE, [note(-500)]), 3000);
eq('avoirs cumulés', netDueTtc(INVOICE, [note(-500), note(-200)]), 2800);
eq('avoir total : net nul', netDueTtc(INVOICE, [note(-3500)]), 0);
eq('sur-crédit : net borné à 0', netDueTtc(INVOICE, [note(-4000)]), 0);
eq('sur-crédit : CA reste négatif', netRevenueTtc(INVOICE, [note(-4000)]), -500);

check('avoir en brouillon ignoré', netDueTtc(INVOICE, [note(-500, 'brouillon')]) === 3500);
check('somme des avoirs négative', sumCreditNotesTtc([note(-500), note(-200)]) === -700);

check('facture non créditée', !isFullyCredited(INVOICE, []) && !isPartiallyCredited(INVOICE, []));
check('facture partiellement créditée', isPartiallyCredited(INVOICE, [note(-500)]));
check('facture intégralement créditée', isFullyCredited(INVOICE, [note(-3500)]));
check(
  'tolérance d un centime sur les arrondis de TVA',
  isFullyCredited(INVOICE, [note(-3499.995)]),
);
eq('reste créditable', remainingCreditableTtc(INVOICE, [note(-500)]), 3000);
eq('plus rien à créditer', remainingCreditableTtc(INVOICE, [note(-3500)]), 0);

check('détection du type avoir', isCreditNote({ invoice_type: 'avoir' }));
check('une facture normale n est pas un avoir', !isCreditNote({ invoice_type: 'standard' }));
check('null-safe', !isCreditNote(null));

// ─────────────────────────────────────────────────────────────
section('3bis. Facture de solde : ne pas créditer les acomptes');
// ─────────────────────────────────────────────────────────────
// Une facture de solde stocke le total BRUT du devis ; ce qu'elle réclame au
// client est ce total moins les acomptes déjà facturés.
const SOLDE = { total_ht: 10000, total_ttc: 12000, invoice_type: 'solde' };
const ACOMPTES_TTC = 3600; // 30 % déjà facturés

eq('solde : montant réellement réclamé', claimedTtc(SOLDE, ACOMPTES_TTC), 8400);
eq('solde : part HT au prorata', claimedHt(SOLDE, ACOMPTES_TTC), 7000);
eq('facture standard : inchangée', claimedTtc({ total_ttc: 3500, invoice_type: 'standard' }, 0), 3500);
eq(
  'standard : un acompte passé par erreur ne déduit rien',
  claimedTtc({ total_ttc: 3500, invoice_type: 'standard' }, 1000),
  3500,
);
eq('solde sans acompte : inchangé', claimedTtc(SOLDE, 0), 12000);
eq(
  'solde : le plafond de créditation suit le net réclamé',
  remainingCreditableTtc(SOLDE, [], ACOMPTES_TTC),
  8400,
);
eq(
  'solde : plafond diminué par un avoir déjà émis',
  remainingCreditableTtc(SOLDE, [note(-400)], ACOMPTES_TTC),
  8000,
);
check(
  'solde : acomptes supérieurs au total ne rendent pas le plafond négatif',
  remainingCreditableTtc(SOLDE, [], 99999) === 0,
);
check(
  'HT + TVA reste cohérent avec le TTC réclamé',
  Math.abs(claimedHt(SOLDE, ACOMPTES_TTC) / claimedTtc(SOLDE, ACOMPTES_TTC) - 10000 / 12000) < 1e-9,
);

// ─────────────────────────────────────────────────────────────
section('4. Mention légale');
// ─────────────────────────────────────────────────────────────
const mention = buildCreditNoteLegalMention({
  creditedInvoiceNumber: 'F-2026-001',
  creditedInvoiceDate: '2026-08-21T10:00:00Z',
});
check('référence la facture rectifiée', mention.includes('F-2026-001'));
check('porte la date de la facture rectifiée', mention.includes('21/08/2026'));
check('mentionne la régularisation de TVA', mention.includes('272-1'));
check('indique qu aucun paiement n est attendu', mention.toLowerCase().includes('aucun paiement'));
check(
  'fonctionne sans date',
  buildCreditNoteLegalMention({ creditedInvoiceNumber: 'F-2026-002' }).includes('F-2026-002'),
);

// ─────────────────────────────────────────────────────────────
section('5. FEC — écriture inversée, montants positifs, équilibre');
// ─────────────────────────────────────────────────────────────
const fec = buildFecFile({
  artisanName: 'SARL Test BTP',
  expenses: [],
  fiscalYear: 2026,
  invoices: [
    {
      id: 'inv-1',
      invoice_number: 'F-2026-001',
      title: 'Rénovation salle de bain',
      client_name: 'Client Durand',
      total_ht: 3000,
      tva_rate: 20,
      tva_breakdown: [
        { rate: 10, base_ht: 1000, tva_amount: 100 },
        { rate: 20, base_ht: 2000, tva_amount: 400 },
      ],
      total_ttc: 3500,
      paid_at: null,
      issued_at: '2026-08-21T10:00:00Z',
      created_at: '2026-08-21T10:00:00Z',
    },
    {
      id: 'av-1',
      invoice_number: 'AV-2026-001',
      title: 'Avoir sur F-2026-001',
      client_name: 'Client Durand',
      total_ht: -3000,
      tva_rate: 20,
      tva_breakdown: [
        { rate: 10, base_ht: -1000, tva_amount: -100 },
        { rate: 20, base_ht: -2000, tva_amount: -400 },
      ],
      total_ttc: -3500,
      paid_at: null,
      issued_at: '2026-09-01T10:00:00Z',
      created_at: '2026-09-01T10:00:00Z',
      invoice_type: 'avoir',
      credited_invoice_number: 'F-2026-001',
    } as never,
  ],
});

const rows = fec.trim().split('\r\n').slice(1).map((r) => r.split('\t'));
const IDX = { compte: 4, piece: 8, lib: 10, debit: 11, credit: 12 };

check('aucun montant négatif dans le fichier', !/-\d/.test(rows.map((r) => r[IDX.debit] + r[IDX.credit]).join(' ')));

const factureRows = rows.filter((r) => r[IDX.piece] === 'F-2026-001');
const avoirRows = rows.filter((r) => r[IDX.piece] === 'AV-2026-001');

const toNum = (s: string) => Number(String(s).replace(',', '.')) || 0;
const sumDebit = (rs: string[][]) => rs.reduce((n, r) => n + toNum(r[IDX.debit]), 0);
const sumCredit = (rs: string[][]) => rs.reduce((n, r) => n + toNum(r[IDX.credit]), 0);

check('écriture de facture équilibrée', Math.abs(sumDebit(factureRows) - sumCredit(factureRows)) < 0.005);
check('écriture d avoir équilibrée', Math.abs(sumDebit(avoirRows) - sumCredit(avoirRows)) < 0.005);
eq('avoir : total débit = TTC', Math.round(sumDebit(avoirRows) * 100) / 100, 3500);

const avoirClient = avoirRows.find((r) => r[IDX.compte] === '411');
const avoirVente = avoirRows.find((r) => r[IDX.compte] === '706');
const avoirTva = avoirRows.find((r) => r[IDX.compte] === '44571');

check('avoir : compte 411 Clients au CRÉDIT', !!avoirClient && toNum(avoirClient[IDX.credit]) === 3500);
check('avoir : compte 706 Ventes au DÉBIT', !!avoirVente && toNum(avoirVente[IDX.debit]) > 0);
check('avoir : TVA collectée 44571 au DÉBIT', !!avoirTva && toNum(avoirTva[IDX.debit]) > 0);
check(
  'avoir : sens strictement inverse de la facture',
  !!factureRows.find((r) => r[IDX.compte] === '411' && toNum(r[IDX.debit]) === 3500),
);
check(
  'avoir : libellé référence la facture rectifiée',
  avoirRows.some((r) => r[IDX.lib].includes('F-2026-001')),
);
check(
  'avoir : pas d écriture de banque (pas de remboursement)',
  !avoirRows.some((r) => r[0] === 'BQ'),
);

// ─────────────────────────────────────────────────────────────
console.log(`\n${passed} vérifications passées, ${failed} échouées`);
process.exit(failed === 0 ? 0 : 1);
