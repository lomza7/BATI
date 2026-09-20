import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from 'pdf-lib';
import {
  buildCreditNoteLegalMention,
  claimedTtc,
  creditReasonLabel,
  isCreditNote,
  netDueTtc,
  sumCreditNotesTtc,
  type InvoiceType,
} from '@/lib/invoices/credit-notes';

type DocumentKind = 'invoice' | 'quote';

interface PublicLine {
  description?: string | null;
  detail?: string | null;
  quantity?: number | null;
  unit?: string | null;
  unit_price?: number | null;
  tva_rate?: number | null;
  total?: number | null;
}

interface PublicProfile {
  company_name?: string | null;
  full_name?: string | null;
  siret?: string | null;
  tva_number?: string | null;
  company_address?: string | null;
  company_postal_code?: string | null;
  company_city?: string | null;
  company_phone?: string | null;
  insurance_company?: string | null;
  insurance_address?: string | null;
  insurance_coverage_zone?: string | null;
  insurance_contract_number?: string | null;
  insurance_warranty_type?: string | null;
  document_config?: Record<string, unknown> | null;
}

interface PublicBankAccount {
  label?: string | null;
  bank_name?: string | null;
  account_holder?: string | null;
  iban?: string | null;
  bic?: string | null;
}

interface PublicClient {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  postal_code?: string | null;
}

interface PublicDocument {
  invoice_number?: string | null;
  quote_number?: string | null;
  title?: string | null;
  description?: string | null;
  created_at?: string | null;
  issued_at?: string | null;
  due_date?: string | null;
  valid_until?: string | null;
  total_ht?: number | null;
  total_tva?: number | null;
  total_ttc?: number | null;
  tva_rate?: number | null;
  tva_breakdown?: unknown;
  invoice_type?: InvoiceType | null;
  deposit_percentage?: number | null;
  /** Renseigné uniquement sur un avoir : facture rectifiée. */
  credited_invoice_id?: string | null;
  /** Renseigné uniquement sur un avoir : motif de l'avoir. */
  credit_reason?: string | null;
  clients?: PublicClient | null;
}

/** Facture rectifiée par l'avoir, telle que la renvoie la RPC publique. */
interface PublicCreditedInvoice {
  id?: string | null;
  invoice_number?: string | null;
  title?: string | null;
  issued_at?: string | null;
  created_at?: string | null;
  total_ttc?: number | null;
}

/**
 * Acompte déjà facturé sur le même devis, tel que la RPC publique le renvoie :
 * son `total_ttc` est **net des avoirs** émis sur cet acompte.
 */
interface PublicLinkedDeposit {
  invoice_number?: string | null;
  total_ttc?: number | null;
}

/** Avoir déjà émis sur la facture affichée (montants négatifs). */
interface PublicCreditNote {
  id?: string | null;
  invoice_number?: string | null;
  total_ttc?: number | null;
  issued_at?: string | null;
  created_at?: string | null;
}

export interface PublicDocumentPayload {
  invoice?: PublicDocument | null;
  quote?: PublicDocument | null;
  lines?: PublicLine[] | null;
  artisan?: PublicProfile | null;
  bank_account?: PublicBankAccount | null;
  linked_quote_number?: string | null;
  /**
   * Acomptes déjà facturés sur le devis source — renvoyés par la RPC pour les
   * seules factures de solde, et déjà nets de leurs propres avoirs.
   */
  linked_deposits?: PublicLinkedDeposit[] | null;
  /** Présent quand le document est un avoir. */
  credited_invoice?: PublicCreditedInvoice | null;
  /** Avoirs émis sur la facture affichée (jamais sur un avoir). */
  credit_notes?: PublicCreditNote[] | null;
}

interface PdfContext {
  doc: PDFDocument;
  page: PDFPage;
  regular: PDFFont;
  bold: PDFFont;
  y: number;
  accent: ReturnType<typeof rgb>;
  pageNumber: number;
}

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 46;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const BOTTOM_LIMIT = 58;

const UNIT_LABELS: Record<string, string> = {
  u: 'Unité',
  m2: 'm²',
  ml: 'ml',
  h: 'Heure',
  forfait: 'Forfait',
};

function text(value: unknown): string {
  return String(value ?? '')
    .normalize('NFC')
    .replace(/[\u00a0\u202f]/g, ' ')
    .replace(/[\u2010\u2011\u2012\u2013\u2014]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u2026/g, '...')
    .replace(/\u2022/g, '-');
}

function amount(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value: unknown): string {
  // `toLocaleString('fr-FR')` insère une espace fine insécable (U+202F) comme
  // séparateur de milliers dès 1 000. Les polices standard de pdf-lib sont
  // encodées en WinAnsi, qui ne sait pas représenter ce caractère et lève
  // « WinAnsi cannot encode ». Tout montant ≥ 1 000 € faisait donc échouer la
  // génération du PDF public — d'où le passage obligé par `text()`.
  return text(
    `${amount(value).toLocaleString('fr-FR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} EUR`,
  );
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return text(value);
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Paris',
  }).format(date);
}

/** Date courte JJ/MM/AAAA, ou chaîne vide si la valeur est inexploitable. */
function formatShortDate(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Europe/Paris',
  }).format(date);
}

/** `document_config` est typé `unknown` : lecture défensive d'une clé texte. */
function configString(config: Record<string, unknown>, key: string): string {
  const value = config[key];
  return typeof value === 'string' ? value.trim() : '';
}

function parseHexColor(value: unknown): ReturnType<typeof rgb> {
  const raw = typeof value === 'string' ? value.trim() : '';
  const match = raw.match(/^#([0-9a-f]{6})$/i);
  if (!match) return rgb(0.827, 0.329, 0);
  const int = Number.parseInt(match[1], 16);
  return rgb(
    ((int >> 16) & 255) / 255,
    ((int >> 8) & 255) / 255,
    (int & 255) / 255,
  );
}

function wrapText(value: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const paragraphs = text(value).split(/\r?\n/);
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push('');
      continue;
    }

    let current = '';
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        current = candidate;
        continue;
      }

      if (current) lines.push(current);
      if (font.widthOfTextAtSize(word, size) <= maxWidth) {
        current = word;
        continue;
      }

      let fragment = '';
      for (const character of word) {
        const next = fragment + character;
        if (font.widthOfTextAtSize(next, size) > maxWidth && fragment) {
          lines.push(fragment);
          fragment = character;
        } else {
          fragment = next;
        }
      }
      current = fragment;
    }
    if (current) lines.push(current);
  }

  return lines;
}

function drawFooter(context: PdfContext) {
  const footer = text(`Hellobat - Document sécurisé - Page ${context.pageNumber}`);
  context.page.drawText(footer, {
    x: MARGIN,
    y: 24,
    size: 7.5,
    font: context.regular,
    color: rgb(0.55, 0.53, 0.5),
  });
  context.page.drawLine({
    start: { x: MARGIN, y: 37 },
    end: { x: PAGE_WIDTH - MARGIN, y: 37 },
    thickness: 0.5,
    color: rgb(0.9, 0.89, 0.87),
  });
}

function addPage(context: PdfContext) {
  drawFooter(context);
  context.page = context.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  context.pageNumber += 1;
  context.y = PAGE_HEIGHT - MARGIN;
  context.page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 10,
    width: PAGE_WIDTH,
    height: 10,
    color: context.accent,
  });
}

function ensureSpace(context: PdfContext, required: number) {
  if (context.y - required < BOTTOM_LIMIT) addPage(context);
}

function drawWrapped(
  context: PdfContext,
  value: string,
  options: {
    x?: number;
    width?: number;
    size?: number;
    lineHeight?: number;
    font?: PDFFont;
    color?: ReturnType<typeof rgb>;
    gapAfter?: number;
  } = {},
) {
  const x = options.x ?? MARGIN;
  const width = options.width ?? CONTENT_WIDTH;
  const size = options.size ?? 9;
  const lineHeight = options.lineHeight ?? size * 1.35;
  const font = options.font ?? context.regular;
  const color = options.color ?? rgb(0.15, 0.14, 0.13);
  const lines = wrapText(value, font, size, width);

  for (const line of lines) {
    ensureSpace(context, lineHeight + 2);
    context.page.drawText(line, { x, y: context.y, size, font, color });
    context.y -= lineHeight;
  }
  context.y -= options.gapAfter ?? 0;
}

function drawLabelValue(
  context: PdfContext,
  label: string,
  value: string,
  x: number,
  y: number,
  width: number,
) {
  context.page.drawText(text(label).toUpperCase(), {
    x,
    y,
    size: 7.5,
    font: context.bold,
    color: rgb(0.55, 0.53, 0.5),
  });
  const lines = wrapText(value, context.regular, 9, width);
  lines.slice(0, 4).forEach((line, index) => {
    context.page.drawText(line, {
      x,
      y: y - 15 - index * 12,
      size: 9,
      font: context.regular,
      color: rgb(0.15, 0.14, 0.13),
    });
  });
}

function documentLabel(kind: DocumentKind, document: PublicDocument): string {
  if (kind === 'quote') return 'DEVIS';
  // Un avoir est une facture rectificative (art. 289 CGI) : il porte son
  // propre libellé pour que le client ne le confonde pas avec une créance.
  if (isCreditNote(document)) return 'AVOIR';
  if (document.invoice_type === 'acompte') return "FACTURE D'ACOMPTE";
  if (document.invoice_type === 'solde') return 'FACTURE DE SOLDE';
  return 'FACTURE';
}

function documentNumber(kind: DocumentKind, document: PublicDocument): string {
  return text(kind === 'invoice' ? document.invoice_number : document.quote_number);
}

function parseTvaBreakdown(raw: unknown): Array<{ rate: number; base_ht: number; tva_amount: number }> {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const row = entry as Record<string, unknown>;
    const rate = amount(row.rate);
    const baseHt = amount(row.base_ht);
    const tvaAmount = amount(row.tva_amount);
    return [{ rate, base_ht: baseHt, tva_amount: tvaAmount }];
  });
}

// Colonnes du tableau des lignes. Les deux colonnes de montants sont calées
// sur leur bord DROIT : sur un avoir, les montants portent un signe « - » qui
// les élargit d'un caractère et débordait de la marge avec un calage à gauche.
const COL_DESC_X = MARGIN + 7;
const COL_QTY_X = MARGIN + 280;
const COL_UNIT_X = MARGIN + 311;
const COL_PU_RIGHT = MARGIN + 405;
const COL_TVA_X = MARGIN + 414;
const COL_TOTAL_RIGHT = MARGIN + CONTENT_WIDTH - 7;

function drawTableHeader(context: PdfContext) {
  const y = context.y;
  context.page.drawRectangle({
    x: MARGIN,
    y: y - 18,
    width: CONTENT_WIDTH,
    height: 22,
    color: rgb(0.965, 0.958, 0.945),
  });

  const headers: Array<{ label: string; x?: number; right?: number }> = [
    { label: 'Désignation', x: COL_DESC_X },
    { label: 'Qté', x: COL_QTY_X },
    { label: 'Unité', x: COL_UNIT_X },
    { label: 'TVA', x: COL_TVA_X },
    { label: 'PU HT', right: COL_PU_RIGHT },
    { label: 'Total HT', right: COL_TOTAL_RIGHT },
  ];
  for (const header of headers) {
    const label = text(header.label);
    context.page.drawText(label, {
      x: header.right !== undefined
        ? header.right - context.bold.widthOfTextAtSize(label, 7.5)
        : header.x ?? COL_DESC_X,
      y: y - 10,
      size: 7.5,
      font: context.bold,
      color: rgb(0.38, 0.36, 0.33),
    });
  }
  context.y -= 24;
}

function drawLineRow(context: PdfContext, line: PublicLine) {
  const description = [text(line.description || 'Prestation'), text(line.detail)].filter(Boolean).join('\n');
  const descriptionLines = wrapText(description, context.regular, 8.5, 260);
  const rowHeight = Math.max(30, descriptionLines.length * 11 + 12);
  ensureSpace(context, rowHeight + 25);
  if (context.y > PAGE_HEIGHT - 90) drawTableHeader(context);

  const top = context.y;
  descriptionLines.forEach((value, index) => {
    context.page.drawText(value, {
      x: MARGIN + 7,
      y: top - 12 - index * 11,
      size: 8.5,
      font: context.regular,
      color: rgb(0.15, 0.14, 0.13),
    });
  });

  // Sur un avoir, `quantity` reste positif et ce sont `unit_price` / `total`
  // qui sont négatifs : l'invariant quantité x PU = total est préservé.
  const values: Array<{ value: string; x?: number; right?: number }> = [
    { value: text((amount(line.quantity) || 1).toLocaleString('fr-FR')), x: COL_QTY_X },
    { value: UNIT_LABELS[text(line.unit)] || text(line.unit || 'u'), x: COL_UNIT_X },
    { value: text(`${amount(line.tva_rate).toLocaleString('fr-FR')} %`), x: COL_TVA_X },
    { value: formatCurrency(line.unit_price), right: COL_PU_RIGHT },
    { value: formatCurrency(line.total), right: COL_TOTAL_RIGHT },
  ];
  for (const item of values) {
    context.page.drawText(item.value, {
      x: item.right !== undefined
        ? item.right - context.regular.widthOfTextAtSize(item.value, 7.5)
        : item.x ?? COL_DESC_X,
      y: top - 12,
      size: 7.5,
      font: context.regular,
      color: rgb(0.15, 0.14, 0.13),
    });
  }

  context.page.drawLine({
    start: { x: MARGIN, y: top - rowHeight },
    end: { x: PAGE_WIDTH - MARGIN, y: top - rowHeight },
    thickness: 0.5,
    color: rgb(0.9, 0.89, 0.87),
  });
  context.y -= rowHeight;
}

export async function createPublicDocumentPdf(
  payload: PublicDocumentPayload,
  kind: DocumentKind,
): Promise<Uint8Array> {
  const document = kind === 'invoice' ? payload.invoice : payload.quote;
  if (!document) throw new Error('Document introuvable');

  const artisan = payload.artisan || {};
  const client = document.clients || {};
  const config = artisan.document_config || {};

  // Un avoir n'est jamais encaissable : ni échéance, ni RIB, ni conditions de
  // paiement, ni pénalités de retard. Ses montants sont négatifs en base.
  const isCredit = kind === 'invoice' && isCreditNote(document);
  const credited = isCredit ? payload.credited_invoice || null : null;
  const creditedNumber = text(credited?.invoice_number || '');
  const creditedDate = formatShortDate(credited?.issued_at || credited?.created_at);

  // Avoirs déjà émis sur cette facture : le PDF ne doit pas réclamer un
  // montant déjà crédité au client. La RPC exclut les avoirs en brouillon,
  // d'où le statut « envoyee » passé aux helpers partagés.
  const creditNotes = (kind === 'invoice' && !isCredit ? payload.credit_notes || [] : []).map(
    (note) => ({
      invoice_number: text(note.invoice_number || ''),
      total_ttc: amount(note.total_ttc),
      status: 'envoyee',
    }),
  );
  const creditedTtc = creditNotes.length > 0 ? sumCreditNotesTtc(creditNotes) : 0;

  // Acomptes déjà facturés : sur une facture de SOLDE, `total_ttc` porte le
  // total BRUT du devis et la déduction des acomptes est une vue recalculée à
  // la lecture. Sans elle, le PDF — pièce archivée et opposable — réclamerait
  // au client davantage que la page /f/[token] et que le paiement en ligne.
  const linkedDeposits = (
    kind === 'invoice' && !isCredit && document.invoice_type === 'solde'
      ? payload.linked_deposits || []
      : []
  ).map((deposit) => ({
    invoice_number: text(deposit.invoice_number || ''),
    total_ttc: amount(deposit.total_ttc),
  }));
  const depositsTtc = linkedDeposits.reduce((sum, deposit) => sum + deposit.total_ttc, 0);

  // Ordre de déduction : d'abord ce que la facture réclame réellement (acomptes
  // déduits sur un solde), puis les avoirs émis sur cette facture. Les acomptes
  // arrivent déjà nets de leurs propres avoirs : aucune double déduction.
  const netToPayTtc = netDueTtc(
    {
      total_ttc: claimedTtc(
        { total_ttc: amount(document.total_ttc), invoice_type: document.invoice_type },
        depositsTtc,
      ),
    },
    creditNotes,
  );
  const hasDeductions = creditNotes.length > 0 || linkedDeposits.length > 0;
  // Un solde affiche « Reste à payer », comme la page publique et l'aperçu.
  const netToPayLabel = linkedDeposits.length > 0 ? 'Reste à payer TTC' : 'Net à payer TTC';

  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const accent = parseHexColor(config.primary_color);
  const firstPage = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const context: PdfContext = {
    doc: pdf,
    page: firstPage,
    regular,
    bold,
    y: PAGE_HEIGHT - MARGIN,
    accent,
    pageNumber: 1,
  };

  firstPage.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 10,
    width: PAGE_WIDTH,
    height: 10,
    color: accent,
  });

  const number = documentNumber(kind, document);
  const companyName = text(artisan.company_name || artisan.full_name || 'Artisan');
  pdf.setTitle(`${documentLabel(kind, document)} ${number}`);
  pdf.setAuthor(companyName);
  pdf.setCreator('Hellobat');
  pdf.setCreationDate(new Date());

  context.page.drawText(companyName, {
    x: MARGIN,
    y: context.y,
    size: 17,
    font: bold,
    color: rgb(0.12, 0.11, 0.1),
  });
  const label = text(documentLabel(kind, document));
  context.page.drawText(label, {
    x: PAGE_WIDTH - MARGIN - bold.widthOfTextAtSize(label, 20),
    y: context.y,
    size: 20,
    font: bold,
    color: accent,
  });
  context.y -= 20;

  const companyLines = [
    artisan.siret ? `SIRET : ${artisan.siret}` : '',
    artisan.tva_number ? `TVA : ${artisan.tva_number}` : '',
    artisan.company_address || '',
    [artisan.company_postal_code, artisan.company_city].filter(Boolean).join(' '),
    artisan.company_phone ? `Tél. : ${artisan.company_phone}` : '',
  ].filter(Boolean);
  companyLines.forEach((line) => {
    context.page.drawText(text(line), {
      x: MARGIN,
      y: context.y,
      size: 8.5,
      font: regular,
      color: rgb(0.42, 0.4, 0.37),
    });
    context.y -= 11;
  });

  context.page.drawText(number, {
    x: PAGE_WIDTH - MARGIN - bold.widthOfTextAtSize(number, 10),
    y: PAGE_HEIGHT - MARGIN - 27,
    size: 10,
    font: bold,
    color: rgb(0.15, 0.14, 0.13),
  });
  const dateLabel = text(
    kind === 'invoice'
      ? `Date : ${formatDate(document.issued_at || document.created_at)}`
      : `Date : ${formatDate(document.created_at)}`,
  );
  context.page.drawText(dateLabel, {
    x: PAGE_WIDTH - MARGIN - regular.widthOfTextAtSize(dateLabel, 8.5),
    y: PAGE_HEIGHT - MARGIN - 43,
    size: 8.5,
    font: regular,
    color: rgb(0.42, 0.4, 0.37),
  });

  if (isCredit) {
    // À la place de l'échéance (un avoir n'en a pas) : la référence à la
    // facture rectifiée, obligatoire et attendue au premier coup d'oeil.
    if (creditedNumber) {
      const longRef = text(
        creditedDate
          ? `Rectifie la facture ${creditedNumber} du ${creditedDate}`
          : `Rectifie la facture ${creditedNumber}`,
      );
      const shortRef = text(`Rectifie la facture ${creditedNumber}`);
      const refLabel = bold.widthOfTextAtSize(longRef, 8.5) <= 300 ? longRef : shortRef;
      context.page.drawText(refLabel, {
        x: PAGE_WIDTH - MARGIN - bold.widthOfTextAtSize(refLabel, 8.5),
        y: PAGE_HEIGHT - MARGIN - 57,
        size: 8.5,
        font: bold,
        color: accent,
      });
    }
  } else {
    const deadline = kind === 'invoice' ? document.due_date : document.valid_until;
    if (deadline) {
      const deadlineLabel = text(
        kind === 'invoice'
          ? `Échéance : ${formatDate(deadline)}`
          : `Valide jusqu'au : ${formatDate(deadline)}`,
      );
      context.page.drawText(deadlineLabel, {
        x: PAGE_WIDTH - MARGIN - regular.widthOfTextAtSize(deadlineLabel, 8.5),
        y: PAGE_HEIGHT - MARGIN - 57,
        size: 8.5,
        font: regular,
        color: rgb(0.42, 0.4, 0.37),
      });
    }
  }

  context.y = Math.min(context.y, PAGE_HEIGHT - 150);
  const blockY = context.y;
  context.page.drawRectangle({
    x: MARGIN,
    y: blockY - 82,
    width: CONTENT_WIDTH,
    height: 82,
    color: rgb(0.982, 0.978, 0.968),
    borderColor: rgb(0.9, 0.89, 0.87),
    borderWidth: 0.7,
  });

  const clientAddress = [
    text(client.name || 'Client'),
    text(client.address),
    [client.postal_code, client.city].filter(Boolean).join(' '),
    text(client.email),
    text(client.phone),
  ].filter(Boolean).join('\n');
  drawLabelValue(
    context,
    isCredit ? 'Avoir établi pour' : 'Facturé à',
    clientAddress,
    MARGIN + 14,
    blockY - 17,
    220,
  );

  // `drawLabelValue` tronque à 4 lignes. Sur un avoir, on s'en tient à la
  // référence à la facture rectifiée et au motif : le titre répète déjà cette
  // référence et la description porte la mention légale complète, qui figure
  // en entier dans le bloc MENTIONS LÉGALES — empilée ici, elle n'y tenait pas
  // et se terminait sur une phrase coupée.
  const referenceLines = (
    isCredit
      ? [
          creditedNumber
            ? `Avoir sur la facture ${creditedNumber}${creditedDate ? ` du ${creditedDate}` : ''}`
            : '',
          document.credit_reason ? `Motif : ${creditReasonLabel(document.credit_reason)}` : '',
        ]
      : [
          document.title || '',
          document.description || '',
          document.invoice_type === 'acompte' && document.deposit_percentage
            ? `Acompte de ${document.deposit_percentage} %${payload.linked_quote_number ? ` sur ${payload.linked_quote_number}` : ''}`
            : '',
          document.invoice_type === 'solde' && payload.linked_quote_number
            ? `Solde du devis ${payload.linked_quote_number}`
            : '',
        ]
  ).filter(Boolean).join('\n');
  drawLabelValue(context, 'Objet', text(referenceLines || number), MARGIN + 270, blockY - 17, 215);
  context.y = blockY - 104;

  drawTableHeader(context);
  for (const line of payload.lines || []) drawLineRow(context, line);

  // Un libellé d'avoir est plus long : le bloc des totaux démarre plus à
  // gauche pour ne pas chevaucher le montant, calé sur la marge droite.
  const totalsX = PAGE_WIDTH - MARGIN - (isCredit || hasDeductions ? 260 : 220);
  const breakdown = parseTvaBreakdown(document.tva_breakdown);
  const totalTva = document.total_tva ?? breakdown.reduce((sum, row) => sum + row.tva_amount, 0);
  const totalRows = [
    { label: isCredit ? "Total HT de l'avoir" : 'Total HT', value: formatCurrency(document.total_ht), bold: false },
    ...breakdown.map((row) => ({
      label: `TVA ${row.rate.toLocaleString('fr-FR')} %`,
      value: formatCurrency(row.tva_amount),
      bold: false,
    })),
    ...(breakdown.length === 0
      ? [{ label: `TVA ${amount(document.tva_rate).toLocaleString('fr-FR')} %`, value: formatCurrency(totalTva), bold: false }]
      : []),
    { label: isCredit ? "Total TTC de l'avoir" : 'Total TTC', value: formatCurrency(document.total_ttc), bold: true },
    // Facture partiellement ou totalement créditée : on n'affiche jamais un
    // montant déjà remboursé comme restant dû.
    ...(creditNotes.length > 0
      ? [{ label: 'Avoirs émis', value: formatCurrency(creditedTtc), bold: false }]
      : []),
    // Facture de solde : les acomptes déjà facturés viennent en déduction,
    // dans le même ordre d'affichage que /f/[token].
    ...(linkedDeposits.length > 0
      ? [
          {
            label: 'Acomptes déjà versés',
            // `-0` se formate « -0,00 » : on neutralise le cas d'un acompte
            // intégralement crédité par un avoir.
            value: formatCurrency(depositsTtc ? -depositsTtc : 0),
            bold: false,
          },
        ]
      : []),
    ...(hasDeductions
      ? [{ label: netToPayLabel, value: formatCurrency(netToPayTtc), bold: true }]
      : []),
  ];

  // Le bloc peut porter jusqu'à trois lignes de plus (avoirs émis, acomptes
  // déduits, reste à payer) que les trois lignes historiques : la réserve
  // verticale suit son contenu.
  ensureSpace(context, Math.max(145, 60 + totalRows.length * 24));
  context.y -= 14;

  for (const row of totalRows) {
    if (row.bold) {
      context.page.drawLine({
        start: { x: totalsX, y: context.y + 8 },
        end: { x: PAGE_WIDTH - MARGIN, y: context.y + 8 },
        thickness: 1,
        color: accent,
      });
    }
    const font = row.bold ? bold : regular;
    const size = row.bold ? 12 : 9;
    context.page.drawText(text(row.label), {
      x: totalsX,
      y: context.y,
      size,
      font,
      color: row.bold ? accent : rgb(0.38, 0.36, 0.33),
    });
    context.page.drawText(row.value, {
      x: PAGE_WIDTH - MARGIN - font.widthOfTextAtSize(row.value, size),
      y: context.y,
      size,
      font,
      color: row.bold ? accent : rgb(0.15, 0.14, 0.13),
    });
    context.y -= row.bold ? 23 : 17;
  }

  if (isCredit) {
    // Les totaux sont négatifs : on redonne le montant en valeur absolue,
    // exprimé du point de vue du client, pour lever toute ambiguïté.
    const creditLabel = text(
      `Montant à votre crédit : ${formatCurrency(Math.abs(amount(document.total_ttc)))}`,
    );
    ensureSpace(context, 24);
    context.page.drawText(creditLabel, {
      x: PAGE_WIDTH - MARGIN - regular.widthOfTextAtSize(creditLabel, 9),
      y: context.y,
      size: 9,
      font: regular,
      color: rgb(0.38, 0.36, 0.33),
    });
    context.y -= 17;
  }

  const bank = payload.bank_account;
  // Aucun RIB sur un avoir : il n'appelle aucun virement du client.
  if (kind === 'invoice' && !isCredit && bank && (bank.iban || bank.bic)) {
    ensureSpace(context, 90);
    context.y -= 8;
    drawWrapped(context, 'COORDONNÉES BANCAIRES', {
      size: 8,
      font: bold,
      color: accent,
      gapAfter: 4,
    });
    const bankText = [
      bank.account_holder ? `Titulaire : ${bank.account_holder}` : '',
      bank.bank_name ? `Banque : ${bank.bank_name}` : '',
      bank.iban ? `IBAN : ${bank.iban}` : '',
      bank.bic ? `BIC : ${bank.bic}` : '',
      `Référence du virement : ${number}`,
    ].filter(Boolean).join('\n');
    drawWrapped(context, bankText, { size: 8.5, lineHeight: 12, gapAfter: 8 });
  }

  const customLegal = configString(config, 'mentions_legales');
  const paymentTerms = configString(config, 'payment_terms');
  const legalParts: string[] = [];

  if (isCredit) {
    // Mentions obligatoires de l'avoir : référence spécifique et non
    // équivoque à la facture rectifiée (art. 242 nonies A ann. II CGI) et
    // régularisation de la TVA collectée (art. 272-1 CGI). Les conditions de
    // paiement (`payment_terms`) sont volontairement écartées : elles
    // annonceraient une échéance et des pénalités qui n'existent pas ici.
    legalParts.push(
      creditedNumber
        ? buildCreditNoteLegalMention({
            // `creditedDate` n'est non vide que si la date est exploitable :
            // c'est le garde-fou contre un `Intl.format(Invalid Date)`.
            creditedInvoiceDate: creditedDate
              ? credited?.issued_at || credited?.created_at || null
              : null,
            creditedInvoiceNumber: creditedNumber,
          })
        : "Avoir rectificatif. TVA régularisée conformément à l'article 272-1 du Code général des impôts. Ce document ne donne lieu à aucun paiement de votre part.",
    );
    if (document.credit_reason) {
      legalParts.push(`Motif de l'avoir : ${creditReasonLabel(document.credit_reason)}.`);
    }
    if (customLegal) legalParts.push(customLegal);
  } else {
    const legalDefault = kind === 'invoice'
      ? `Échéance de paiement : ${formatDate(document.due_date)}. En cas de retard, des pénalités sont exigibles. Indemnité forfaitaire de recouvrement : 40 EUR.`
      : 'Devis valable pendant la durée indiquée. Les travaux débutent après acceptation du devis selon les conditions convenues.';
    legalParts.push(
      (kind === 'invoice' ? paymentTerms : customLegal) || customLegal || legalDefault,
    );
    if (linkedDeposits.length > 0) {
      // Traçabilité du montant réclamé : le client doit pouvoir rapprocher le
      // reste à payer des factures d'acompte déjà reçues, montants nets des
      // avoirs éventuellement émis dessus.
      const depositReferences = linkedDeposits
        .filter((deposit) => deposit.invoice_number)
        .map((deposit) => `${deposit.invoice_number} (${formatCurrency(deposit.total_ttc)})`)
        .join(', ');
      legalParts.push(
        depositReferences
          ? `Acompte(s) déjà facturé(s) et déduit(s) : ${depositReferences}.`
          : 'Les acomptes déjà facturés sur ce chantier sont déduits du montant indiqué ci-dessus.',
      );
    }
    if (creditNotes.length > 0) {
      const references = creditNotes
        .filter((note) => note.invoice_number)
        .map((note) => `${note.invoice_number} (${formatCurrency(note.total_ttc)})`)
        .join(', ');
      legalParts.push(
        references
          ? `Avoir(s) rattaché(s) à cette facture : ${references}.`
          : 'Un ou plusieurs avoirs ont été émis sur cette facture.',
      );
    }
    if (hasDeductions) {
      legalParts.push(`Seul le montant indiqué ci-dessus (${netToPayLabel}) reste dû.`);
    }
  }

  const legal = text(legalParts.filter(Boolean).join('\n'));
  ensureSpace(context, 70);
  context.y -= 6;
  drawWrapped(context, isCredit ? 'MENTIONS LÉGALES' : 'CONDITIONS ET MENTIONS LÉGALES', {
    size: 8,
    font: bold,
    color: rgb(0.38, 0.36, 0.33),
    gapAfter: 4,
  });
  drawWrapped(context, legal, {
    size: 7.5,
    lineHeight: 10,
    color: rgb(0.45, 0.43, 0.4),
    gapAfter: 6,
  });

  const insurance = [
    artisan.insurance_warranty_type || '',
    artisan.insurance_company ? `Assureur : ${artisan.insurance_company}` : '',
    artisan.insurance_contract_number ? `Contrat n° : ${artisan.insurance_contract_number}` : '',
    artisan.insurance_coverage_zone ? `Zone couverte : ${artisan.insurance_coverage_zone}` : '',
    artisan.insurance_address || '',
  ].filter(Boolean).join(' - ');
  if (insurance) {
    drawWrapped(context, `Assurance professionnelle - ${insurance}`, {
      size: 7.5,
      lineHeight: 10,
      color: rgb(0.45, 0.43, 0.4),
    });
  }

  drawFooter(context);
  return pdf.save();
}

export function getPublicDocumentFilename(
  payload: PublicDocumentPayload,
  kind: DocumentKind,
): string {
  const document = kind === 'invoice' ? payload.invoice : payload.quote;
  const number = document ? documentNumber(kind, document) : 'document';
  const prefix = kind === 'quote'
    ? 'Devis'
    : isCreditNote(document)
      ? 'Avoir'
      : 'Facture';
  return `${prefix}-${number || 'document'}.pdf`.replace(/[^a-zA-Z0-9._-]/g, '-');
}
