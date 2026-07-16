import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from 'pdf-lib';

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
  invoice_type?: 'standard' | 'acompte' | 'solde' | null;
  deposit_percentage?: number | null;
  clients?: PublicClient | null;
}

export interface PublicDocumentPayload {
  invoice?: PublicDocument | null;
  quote?: PublicDocument | null;
  lines?: PublicLine[] | null;
  artisan?: PublicProfile | null;
  bank_account?: PublicBankAccount | null;
  linked_quote_number?: string | null;
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
  return `${amount(value).toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} EUR`;
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
  const footer = `Hellobat - Document sécurisé - Page ${context.pageNumber}`;
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

function drawTableHeader(context: PdfContext) {
  const y = context.y;
  context.page.drawRectangle({
    x: MARGIN,
    y: y - 18,
    width: CONTENT_WIDTH,
    height: 22,
    color: rgb(0.965, 0.958, 0.945),
  });

  const headers = [
    { label: 'Désignation', x: MARGIN + 7 },
    { label: 'Qté', x: MARGIN + 277 },
    { label: 'Unité', x: MARGIN + 311 },
    { label: 'PU HT', x: MARGIN + 358 },
    { label: 'TVA', x: MARGIN + 412 },
    { label: 'Total HT', x: MARGIN + 449 },
  ];
  for (const header of headers) {
    context.page.drawText(header.label, {
      x: header.x,
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

  const values = [
    { value: String(amount(line.quantity) || 1), x: MARGIN + 280 },
    { value: UNIT_LABELS[text(line.unit)] || text(line.unit || 'u'), x: MARGIN + 311 },
    { value: formatCurrency(line.unit_price), x: MARGIN + 355 },
    { value: `${amount(line.tva_rate)} %`, x: MARGIN + 414 },
    { value: formatCurrency(line.total), x: MARGIN + 449 },
  ];
  for (const item of values) {
    context.page.drawText(item.value, {
      x: item.x,
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
  const label = documentLabel(kind, document);
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
  const dateLabel = kind === 'invoice'
    ? `Date : ${formatDate(document.issued_at || document.created_at)}`
    : `Date : ${formatDate(document.created_at)}`;
  context.page.drawText(dateLabel, {
    x: PAGE_WIDTH - MARGIN - regular.widthOfTextAtSize(dateLabel, 8.5),
    y: PAGE_HEIGHT - MARGIN - 43,
    size: 8.5,
    font: regular,
    color: rgb(0.42, 0.4, 0.37),
  });
  const deadline = kind === 'invoice' ? document.due_date : document.valid_until;
  if (deadline) {
    const deadlineLabel = kind === 'invoice'
      ? `Échéance : ${formatDate(deadline)}`
      : `Valide jusqu'au : ${formatDate(deadline)}`;
    context.page.drawText(deadlineLabel, {
      x: PAGE_WIDTH - MARGIN - regular.widthOfTextAtSize(deadlineLabel, 8.5),
      y: PAGE_HEIGHT - MARGIN - 57,
      size: 8.5,
      font: regular,
      color: rgb(0.42, 0.4, 0.37),
    });
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
  drawLabelValue(context, 'Facturé à', clientAddress, MARGIN + 14, blockY - 17, 220);

  const referenceLines = [
    document.title || '',
    document.description || '',
    document.invoice_type === 'acompte' && document.deposit_percentage
      ? `Acompte de ${document.deposit_percentage} %${payload.linked_quote_number ? ` sur ${payload.linked_quote_number}` : ''}`
      : '',
    document.invoice_type === 'solde' && payload.linked_quote_number
      ? `Solde du devis ${payload.linked_quote_number}`
      : '',
  ].filter(Boolean).join('\n');
  drawLabelValue(context, 'Objet', text(referenceLines || number), MARGIN + 270, blockY - 17, 215);
  context.y = blockY - 104;

  drawTableHeader(context);
  for (const line of payload.lines || []) drawLineRow(context, line);

  ensureSpace(context, 145);
  context.y -= 14;
  const totalsX = PAGE_WIDTH - MARGIN - 220;
  const breakdown = parseTvaBreakdown(document.tva_breakdown);
  const totalTva = document.total_tva ?? breakdown.reduce((sum, row) => sum + row.tva_amount, 0);
  const totalRows = [
    { label: 'Total HT', value: formatCurrency(document.total_ht), bold: false },
    ...breakdown.map((row) => ({
      label: `TVA ${row.rate.toLocaleString('fr-FR')} %`,
      value: formatCurrency(row.tva_amount),
      bold: false,
    })),
    ...(breakdown.length === 0
      ? [{ label: `TVA ${amount(document.tva_rate).toLocaleString('fr-FR')} %`, value: formatCurrency(totalTva), bold: false }]
      : []),
    { label: 'Total TTC', value: formatCurrency(document.total_ttc), bold: true },
  ];

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
    context.page.drawText(row.label, {
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

  const bank = payload.bank_account;
  if (kind === 'invoice' && bank && (bank.iban || bank.bic)) {
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

  const legalDefault = kind === 'invoice'
    ? `Échéance de paiement : ${formatDate(document.due_date)}. En cas de retard, des pénalités sont exigibles. Indemnité forfaitaire de recouvrement : 40 EUR.`
    : 'Devis valable pendant la durée indiquée. Les travaux débutent après acceptation du devis selon les conditions convenues.';
  const legal = text(
    (kind === 'invoice' ? config.payment_terms : config.mentions_legales) ||
      config.mentions_legales ||
      legalDefault,
  );
  ensureSpace(context, 70);
  context.y -= 6;
  drawWrapped(context, 'CONDITIONS ET MENTIONS LÉGALES', {
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
  const prefix = kind === 'invoice' ? 'Facture' : 'Devis';
  return `${prefix}-${number || 'document'}.pdf`.replace(/[^a-zA-Z0-9._-]/g, '-');
}
