// Parser OFX (Open Financial Exchange)
// Format clé-valeur indenté ou XML, utilisé par la plupart des banques traditionnelles.
//
// On extrait les blocs <STMTTRN>...</STMTTRN> et leurs champs :
//   <DTPOSTED>20260401 — date posting
//   <TRNAMT>-123.45 — montant signé
//   <FITID>ABC123 — ID unique (idempotence)
//   <NAME>...
//   <MEMO>...
//   <TRNTYPE>DEBIT|CREDIT|...

import type { ParsedStatement, ParsedTransaction } from './index';

export function parseOfx(content: string): ParsedStatement {
  // Strip OFX headers (lignes au début avant <OFX>)
  let body = content;
  const ofxStart = body.search(/<OFX>/i);
  if (ofxStart > -1) body = body.slice(ofxStart);

  // Normalize : OFX SGML peut être "indenté", on flatten en remplaçant \r\n par espaces
  // mais on garde les balises intactes
  const flat = body.replace(/[\r\n]+/g, '\n');

  const transactions: ParsedTransaction[] = [];
  let periodStart: string | null = null;
  let periodEnd: string | null = null;

  // Période globale
  const dtStart = pickFirst(flat, /<DTSTART>([^\s<]+)/i);
  const dtEnd = pickFirst(flat, /<DTEND>([^\s<]+)/i);
  if (dtStart) periodStart = parseOfxDate(dtStart);
  if (dtEnd) periodEnd = parseOfxDate(dtEnd);

  // Bank info
  const bankId = pickFirst(flat, /<BANKID>([^\s<]+)/i) || '';
  const acctId = pickFirst(flat, /<ACCTID>([^\s<]+)/i) || '';
  const bankName = bankIdToName(bankId);

  // Soldes
  const ledgerBalance = parseOfxAmount(pickFirst(flat, /<LEDGERBAL>[\s\S]*?<BALAMT>([^\s<]+)/i));
  const availBalance = parseOfxAmount(pickFirst(flat, /<AVAILBAL>[\s\S]*?<BALAMT>([^\s<]+)/i));

  // Extract STMTTRN blocks
  const trnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  let m: RegExpExecArray | null;

  while ((m = trnRegex.exec(flat)) !== null) {
    const block = m[1];

    const trnType = pickFirst(block, /<TRNTYPE>([^\s<]+)/i);
    const dtPosted = pickFirst(block, /<DTPOSTED>([^\s<]+)/i);
    const dtUser = pickFirst(block, /<DTUSER>([^\s<]+)/i);
    const trnAmt = pickFirst(block, /<TRNAMT>([^\s<]+)/i);
    const fitid = pickFirst(block, /<FITID>([^\s<]+)/i);
    const name = pickFirst(block, /<NAME>([^\n<]+)/i);
    const memo = pickFirst(block, /<MEMO>([^\n<]+)/i);

    if (!dtPosted || !trnAmt) continue;

    const date = parseOfxDate(dtPosted);
    if (!date) continue;

    const amount = parseOfxAmount(trnAmt);
    if (amount == null || isNaN(amount)) continue;

    const labelParts: string[] = [];
    if (name) labelParts.push(name.trim());
    if (memo && memo.trim() !== name?.trim()) labelParts.push(memo.trim());
    const label = labelParts.join(' — ').trim() || (trnType || 'Transaction');

    transactions.push({
      transaction_date: date,
      value_date: dtUser ? parseOfxDate(dtUser) : null,
      label,
      amount: +amount.toFixed(2),
      direction: amount >= 0 ? 'credit' : 'debit',
      fitid: fitid || null,
    });

    if (!periodStart || date < periodStart) periodStart = date;
    if (!periodEnd || date > periodEnd) periodEnd = date;
  }

  if (transactions.length === 0) {
    throw new Error('Aucune transaction lisible trouvée dans le fichier OFX.');
  }

  return {
    format: 'ofx',
    bank_name: bankName,
    account_iban: acctId,
    period_start: periodStart,
    period_end: periodEnd,
    opening_balance: null,
    closing_balance: ledgerBalance ?? availBalance,
    transactions,
  };
}

function pickFirst(text: string, regex: RegExp): string | null {
  const m = text.match(regex);
  return m ? m[1].trim() : null;
}

function parseOfxDate(input: string | null): string | null {
  if (!input) return null;
  // OFX format : YYYYMMDD ou YYYYMMDDHHMMSS[.XXX][TZ]
  const m = input.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

function parseOfxAmount(input: string | null): number | null {
  if (input == null) return null;
  const s = input.trim().replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function bankIdToName(bankId: string): string {
  if (!bankId) return '';
  // Quelques mappings courants pour les banques FR (codes BIC partiels)
  const map: Record<string, string> = {
    '30004': 'BNP Paribas',
    '30003': 'Société Générale',
    '30002': 'LCL',
    '20041': 'La Banque Postale',
    '10278': 'Crédit Mutuel',
    '17807': 'Banque Populaire',
    '14706': 'Crédit Agricole',
    '12548': 'Boursorama',
  };
  return map[bankId] || bankId;
}
