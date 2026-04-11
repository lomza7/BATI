// DocuSeal API helpers (server-side only)

import { parseTvaBreakdown, formatTvaRate, type TvaBreakdownEntry } from './tva';

const DOCUSEAL_API_URL = process.env.DOCUSEAL_API_URL || 'https://api.docuseal.eu';

interface DocuSealFetchOptions {
  method?: string;
  body?: unknown;
}

export async function docusealFetch<T = unknown>(path: string, options: DocuSealFetchOptions = {}): Promise<T> {
  const apiKey = process.env.DOCUSEAL_API_KEY;
  if (!apiKey) throw new Error('DOCUSEAL_API_KEY manquante');

  const res = await fetch(`${DOCUSEAL_API_URL}${path}`, {
    method: options.method || 'GET',
    headers: {
      'X-Auth-Token': apiKey,
      'Content-Type': 'application/json',
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DocuSeal API error ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

// ---------- Types ----------

interface QuoteData {
  quote_number: string;
  title: string;
  description?: string | null;
  total_ht: number;
  total_tva: number;
  total_ttc: number;
  tva_rate: number;
  tva_breakdown?: unknown;
  created_at: string;
  valid_until: string | null;
}

interface QuoteLine {
  description: string;
  detail?: string | null;
  quantity: number;
  unit: string;
  unit_price: number;
  tva_rate?: number;
  total: number;
}

interface ClientData {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  postal_code?: string;
  city?: string;
}

interface ArtisanData {
  company_name: string;
  full_name?: string;
  siret?: string;
  company_address?: string;
  company_postal_code?: string;
  company_city?: string;
  company_phone?: string;
  tva_number?: string;
  logo_url?: string;
  document_config?: Record<string, unknown>;
}

// ---------- Helpers ----------

function esc(str: string | null | undefined): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escMultiline(str: string | null | undefined): string {
  return esc(str).replace(/\n/g, '<br/>');
}

function fmtCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function fmtDate(date: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(date));
}

const UNIT_LABELS: Record<string, string> = {
  u: 'Unité',
  m2: 'm²',
  m3: 'm³',
  ml: 'ml',
  h: 'Heure',
  j: 'Jour',
  forfait: 'Forfait',
  kg: 'kg',
  l: 'L',
};

// ---------- HTML Builder ----------

/**
 * Construit le HTML complet d'un devis pour DocuSeal.
 *
 * DocuSeal convertit ce HTML en PDF via un Chromium headless.
 * Le PDF généré est :
 *   1. Affiché au client dans l'iframe de signature
 *   2. Renvoyé au webhook comme "document signé" avec la signature incrustée
 *
 * Règles importantes :
 * - Uniquement du CSS inline (pas de classes, pas de variables --xxx)
 * - Utiliser des tables pour les layouts (plus fiable qu'en flex/grid en print)
 * - Le `<signature-field>` a besoin d'un wrapper avec assez de hauteur pour
 *   que l'image de signature s'incruste correctement dans le PDF final
 * - Tous les textes utilisateur doivent être échappés (esc / escMultiline)
 */
export function buildQuoteHtml(
  quote: QuoteData,
  lines: QuoteLine[],
  client: ClientData,
  artisan: ArtisanData,
): string {
  const dc = (artisan.document_config || {}) as Record<string, string | boolean>;
  const accent = (dc.primary_color as string) || '#d35400';
  const textColor = (dc.secondary_color as string) || '#1a1a1a';
  const muted = '#6b6560';
  const border = '#e5e1da';
  const bgSoft = '#faf9f7';
  const fontFamily = dc.font === 'serif'
    ? "Georgia, 'Times New Roman', serif"
    : "'Helvetica Neue', Helvetica, Arial, sans-serif";
  const companyName = artisan.company_name || artisan.full_name || 'Artisan';
  const showLogo = dc.show_logo !== false;
  const logoUrl = (artisan.logo_url as string) || '';
  const footerText = (dc.footer_text as string) || '';
  const mentionsLegales = (dc.mentions_legales as string) || '';

  const legacyRate = Number(quote.tva_rate) || 0;
  const totalHt = Number(quote.total_ht) || 0;
  const totalTva = Number(quote.total_tva) || 0;
  const totalTtc = Number(quote.total_ttc) || 0;

  // Rebuild breakdown — prefer stored JSONB, fallback to single-rate
  const parsed = parseTvaBreakdown(quote.tva_breakdown);
  const tvaBreakdown: TvaBreakdownEntry[] = parsed.length > 0
    ? parsed
    : [{ rate: legacyRate, base_ht: totalHt, tva_amount: totalTva }];
  const isFranchise = tvaBreakdown.length === 1 && tvaBreakdown[0].rate === 0;
  const isMultiRate = tvaBreakdown.length > 1;

  // Lines rows — handle empty state (+ TVA column per line)
  const linesRows = lines.length > 0
    ? lines.map((l) => {
        const lineTotal = Number(l.total) || Number(l.quantity) * Number(l.unit_price);
        const lineTvaRate = Number(l.tva_rate ?? legacyRate);
        return `
          <tr>
            <td style="padding:10px 12px;border-bottom:1px solid ${border};font-size:12px;color:${textColor};vertical-align:top;word-wrap:break-word">${escMultiline(l.description)}${l.detail ? `<div style="font-size:10px;color:${muted};margin-top:2px;line-height:1.4">${escMultiline(l.detail)}</div>` : ''}</td>
            <td style="padding:10px 6px;border-bottom:1px solid ${border};font-size:12px;color:${textColor};text-align:center;vertical-align:top">${esc(String(l.quantity))}</td>
            <td style="padding:10px 6px;border-bottom:1px solid ${border};font-size:12px;color:${muted};text-align:center;vertical-align:top">${esc(UNIT_LABELS[l.unit] || l.unit || '')}</td>
            <td style="padding:10px 6px;border-bottom:1px solid ${border};font-size:12px;color:${textColor};text-align:right;vertical-align:top;white-space:nowrap">${esc(fmtCurrency(Number(l.unit_price) || 0))}</td>
            <td style="padding:10px 6px;border-bottom:1px solid ${border};font-size:10px;color:${muted};text-align:center;vertical-align:top;white-space:nowrap">${esc(formatTvaRate(lineTvaRate))}</td>
            <td style="padding:10px 12px;border-bottom:1px solid ${border};font-size:12px;color:${textColor};text-align:right;font-weight:600;vertical-align:top;white-space:nowrap">${esc(fmtCurrency(lineTotal))}</td>
          </tr>`;
      }).join('')
    : `
        <tr>
          <td colspan="6" style="padding:24px 12px;text-align:center;font-size:12px;color:${muted};font-style:italic">
            Aucune ligne saisie
          </td>
        </tr>`;

  // TVA rows for the totals table — one row per rate when multi-rate
  const tvaRowsHtml = isMultiRate
    ? tvaBreakdown.map((b) => `
          <tr style="border-top:1px solid ${border}">
            <td style="padding:6px 14px;font-size:10px;color:${muted}">TVA ${esc(formatTvaRate(b.rate))} sur ${esc(fmtCurrency(b.base_ht))}</td>
            <td style="padding:6px 14px;font-size:10px;text-align:right;color:${textColor};font-weight:500">${esc(fmtCurrency(b.tva_amount))}</td>
          </tr>`).join('') + `
          <tr style="border-top:1px dashed ${border}">
            <td style="padding:6px 14px;font-size:11px;color:${muted};font-weight:600">Total TVA</td>
            <td style="padding:6px 14px;font-size:11px;text-align:right;color:${textColor};font-weight:600">${esc(fmtCurrency(totalTva))}</td>
          </tr>`
    : `
          <tr style="border-top:1px solid ${border}">
            <td style="padding:8px 14px;font-size:11px;color:${muted}">TVA ${isFranchise ? '(non appl.)' : esc(formatTvaRate(tvaBreakdown[0]?.rate ?? legacyRate))}</td>
            <td style="padding:8px 14px;font-size:11px;text-align:right;color:${textColor};font-weight:600">${esc(fmtCurrency(totalTva))}</td>
          </tr>`;

  // Client block
  const clientLines: string[] = [];
  if (client.email) clientLines.push(esc(client.email));
  if (client.phone) clientLines.push(esc(client.phone));
  if (client.address) clientLines.push(esc(client.address));
  const cityLine = [client.postal_code, client.city].filter(Boolean).join(' ');
  if (cityLine) clientLines.push(esc(cityLine));

  // Artisan address block
  const artisanAddressLines: string[] = [];
  if (artisan.company_address) artisanAddressLines.push(esc(artisan.company_address));
  const artisanCity = [artisan.company_postal_code, artisan.company_city].filter(Boolean).join(' ');
  if (artisanCity) artisanAddressLines.push(esc(artisanCity));
  if (artisan.company_phone) artisanAddressLines.push(`Tél : ${esc(artisan.company_phone)}`);
  if (artisan.tva_number) artisanAddressLines.push(`TVA : ${esc(artisan.tva_number)}`);

  // Logo ou fallback initiale
  const logoBlock = showLogo && logoUrl
    ? `<img src="${esc(logoUrl)}" alt="" style="width:48px;height:48px;border-radius:8px;object-fit:cover;display:block" />`
    : `<div style="width:48px;height:48px;border-radius:8px;background:${accent}20;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;color:${accent};line-height:48px;text-align:center">${esc(companyName.charAt(0).toUpperCase())}</div>`;

  const defaultMentions = `Devis valable ${quote.valid_until ? `jusqu'au ${fmtDate(quote.valid_until)}. ` : ''}Signature électronique réalisée au sens du règlement européen eIDAS (signature électronique avancée). Ce document a valeur contractuelle entre les parties.${isFranchise ? ' TVA non applicable, art. 293 B du CGI.' : ''}`;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Devis ${esc(quote.quote_number)}</title>
<style>
  @page { size: A4; margin: 14mm 12mm; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 0; font-family: ${fontFamily}; background: #ffffff; color: ${textColor}; font-size: 12px; line-height: 1.4; }
  table { border-collapse: collapse; width: 100%; }
  .no-break { page-break-inside: avoid; }
</style>
</head>
<body>
<div style="max-width:780px;margin:0 auto;padding:0 4px">

  <!-- En-tête : société + DEVIS -->
  <table style="margin-bottom:20px">
    <tr>
      <td style="vertical-align:top;width:60%">
        <table>
          <tr>
            <td style="vertical-align:middle;width:58px">${logoBlock}</td>
            <td style="vertical-align:middle;padding-left:12px">
              <p style="margin:0;font-size:15px;font-weight:700;color:${textColor}">${esc(companyName)}</p>
              ${artisan.siret ? `<p style="margin:2px 0 0;font-size:10px;color:${muted}">SIRET : ${esc(artisan.siret)}</p>` : ''}
            </td>
          </tr>
        </table>
        ${artisanAddressLines.length > 0 ? `
        <div style="margin-top:8px;padding-left:70px;font-size:10px;color:${muted};line-height:1.5">
          ${artisanAddressLines.map(l => `<div>${l}</div>`).join('')}
        </div>` : ''}
      </td>
      <td style="vertical-align:top;text-align:right;width:40%">
        <p style="margin:0;font-size:26px;font-weight:800;color:${accent};letter-spacing:0.5px">DEVIS</p>
        <p style="margin:4px 0 0;font-size:13px;font-weight:600;color:${textColor}">${esc(quote.quote_number)}</p>
        <p style="margin:6px 0 0;font-size:10px;color:${muted}">Date : ${fmtDate(quote.created_at)}</p>
        ${quote.valid_until ? `<p style="margin:2px 0 0;font-size:10px;color:${muted}">Valable jusqu'au : ${fmtDate(quote.valid_until)}</p>` : ''}
      </td>
    </tr>
  </table>

  <!-- Bloc client -->
  <div style="background:${bgSoft};border:1px solid ${border};border-radius:8px;padding:14px 18px;margin-bottom:18px" class="no-break">
    <p style="margin:0 0 6px;font-size:9px;font-weight:700;letter-spacing:1px;color:${muted};text-transform:uppercase">Client</p>
    <p style="margin:0;font-size:13px;font-weight:700;color:${textColor}">${esc(client.name)}</p>
    ${clientLines.length > 0 ? `<div style="margin-top:4px;font-size:10px;color:${muted};line-height:1.5">${clientLines.map(l => `<div>${l}</div>`).join('')}</div>` : ''}
  </div>

  <!-- Titre + description -->
  ${quote.title || quote.description ? `
  <div style="margin-bottom:14px;padding:0 2px" class="no-break">
    ${quote.title ? `<h2 style="margin:0 0 4px;font-size:15px;font-weight:700;color:${textColor}">${esc(quote.title)}</h2>` : ''}
    ${quote.description ? `<p style="margin:0;font-size:11px;color:${muted};line-height:1.5;white-space:pre-wrap">${escMultiline(quote.description)}</p>` : ''}
  </div>` : ''}

  <!-- Tableau des lignes -->
  <table style="margin-bottom:4px;border:1px solid ${border};border-radius:8px;overflow:hidden">
    <thead>
      <tr style="background:${accent}12">
        <th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:700;color:${accent};text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid ${border}">Description</th>
        <th style="padding:10px 6px;text-align:center;font-size:10px;font-weight:700;color:${accent};text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid ${border};width:44px">Qté</th>
        <th style="padding:10px 6px;text-align:center;font-size:10px;font-weight:700;color:${accent};text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid ${border};width:60px">Unité</th>
        <th style="padding:10px 6px;text-align:right;font-size:10px;font-weight:700;color:${accent};text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid ${border};width:85px">P.U. HT</th>
        <th style="padding:10px 6px;text-align:center;font-size:10px;font-weight:700;color:${accent};text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid ${border};width:52px">TVA</th>
        <th style="padding:10px 12px;text-align:right;font-size:10px;font-weight:700;color:${accent};text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid ${border};width:95px">Total HT</th>
      </tr>
    </thead>
    <tbody>
      ${linesRows}
    </tbody>
  </table>

  <!-- Totaux -->
  <table style="margin-top:14px;margin-bottom:24px" class="no-break">
    <tr>
      <td style="width:55%"></td>
      <td style="width:45%">
        <table style="border:1px solid ${border};border-radius:8px;overflow:hidden">
          <tr>
            <td style="padding:8px 14px;font-size:11px;color:${muted}">Total HT</td>
            <td style="padding:8px 14px;font-size:11px;text-align:right;color:${textColor};font-weight:600">${esc(fmtCurrency(totalHt))}</td>
          </tr>
          ${tvaRowsHtml}
          <tr style="background:${accent}10;border-top:2px solid ${border}">
            <td style="padding:12px 14px;font-size:13px;font-weight:700;color:${textColor}">Total TTC</td>
            <td style="padding:12px 14px;font-size:16px;font-weight:800;text-align:right;color:${accent}">${esc(fmtCurrency(totalTtc))}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <!-- Paragraphe d'acceptation -->
  <div style="padding:14px 18px;border:1px solid ${border};border-radius:8px;margin-bottom:18px;background:#ffffff" class="no-break">
    <p style="margin:0;font-size:11px;color:${textColor};line-height:1.6">
      En signant ci-dessous, je, <strong>${esc(client.name)}</strong>, accepte les conditions et les prix du devis <strong>${esc(quote.quote_number)}</strong> d'un montant de <strong>${esc(fmtCurrency(totalTtc))} TTC</strong>.
    </p>
  </div>

  <!-- Zone signature : prévoir de la hauteur pour que DocuSeal
       incruste la signature et la date correctement dans le PDF final -->
  <div style="padding:18px 18px 22px;border:1px solid ${border};border-radius:8px;margin-bottom:18px;background:#ffffff" class="no-break">
    <p style="margin:0 0 10px;font-size:9px;font-weight:700;letter-spacing:1px;color:${muted};text-transform:uppercase">Signature du client</p>
    <div style="min-height:110px;padding:6px 0">
      <signature-field name="Signature" role="First Submitter" required="true"></signature-field>
    </div>
    <p style="margin:12px 0 4px;font-size:9px;font-weight:700;letter-spacing:1px;color:${muted};text-transform:uppercase">Date</p>
    <div style="min-height:24px">
      <date-field name="Date" role="First Submitter" readonly="true"></date-field>
    </div>
  </div>

  <!-- Mentions légales -->
  <div style="padding:12px 16px;background:${bgSoft};border:1px solid ${border};border-radius:8px;margin-bottom:10px">
    <p style="margin:0;font-size:9px;color:${muted};line-height:1.5;white-space:pre-wrap">${mentionsLegales ? escMultiline(mentionsLegales) : defaultMentions}</p>
  </div>

  ${footerText ? `<p style="margin:12px 0 0;font-size:9px;text-align:center;color:${muted};font-weight:500">${escMultiline(footerText)}</p>` : ''}

</div>
</body>
</html>`.trim();
}
