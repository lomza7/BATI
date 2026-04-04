// DocuSeal API helpers (server-side only)

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
  total_ht: number;
  total_tva: number;
  total_ttc: number;
  tva_rate: number;
  created_at: string;
  valid_until: string | null;
}

interface QuoteLine {
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
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

// ---------- HTML Builder ----------

function esc(str: string | null | undefined): string {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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

export function buildQuoteHtml(
  quote: QuoteData,
  lines: QuoteLine[],
  client: ClientData,
  artisan: ArtisanData,
): string {
  const dc = (artisan.document_config || {}) as Record<string, string | boolean>;
  const accent = (dc.primary_color as string) || '#d35400';
  const textColor = (dc.secondary_color as string) || '#1a1a1a';
  const fontFamily = dc.font === 'serif' ? 'Georgia, serif' : "'Inter', 'Helvetica Neue', sans-serif";
  const companyName = artisan.company_name || artisan.full_name || 'Artisan';
  const mentionsLegales = (dc.mentions_legales as string) || 'Devis valable 30 jours. En cas de litige, le tribunal competent sera celui du siege social du prestataire.';

  const linesHtml = lines.map(l => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e1da;font-size:13px;color:${textColor}">${esc(l.description)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e1da;font-size:13px;color:${textColor};text-align:center">${l.quantity}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e1da;font-size:13px;color:${textColor};text-align:center">${esc(l.unit)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e1da;font-size:13px;color:${textColor};text-align:right">${fmtCurrency(l.unit_price)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e1da;font-size:13px;color:${textColor};text-align:right;font-weight:500">${fmtCurrency(l.total)}</td>
    </tr>
  `).join('');

  const clientAddress = [client.address, client.postal_code, client.city].filter(Boolean).join(', ');

  return `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:${fontFamily};background:#faf9f7;color:${textColor}">
<div style="max-width:720px;margin:0 auto;padding:32px 24px">

  <!-- Header -->
  <table style="width:100%;margin-bottom:32px" cellpadding="0" cellspacing="0">
    <tr>
      <td style="vertical-align:top">
        <p style="margin:0;font-size:16px;font-weight:700;color:${textColor}">${esc(companyName)}</p>
        ${artisan.siret ? `<p style="margin:4px 0 0;font-size:11px;color:#6b6560">SIRET : ${esc(artisan.siret)}</p>` : ''}
        ${artisan.company_address ? `<p style="margin:2px 0 0;font-size:11px;color:#6b6560">${esc(artisan.company_address)}${artisan.company_postal_code ? ', ' + esc(artisan.company_postal_code) : ''}${artisan.company_city ? ' ' + esc(artisan.company_city) : ''}</p>` : ''}
        ${artisan.company_phone ? `<p style="margin:2px 0 0;font-size:11px;color:#6b6560">Tel : ${esc(artisan.company_phone)}</p>` : ''}
        ${artisan.tva_number ? `<p style="margin:2px 0 0;font-size:11px;color:#6b6560">TVA : ${esc(artisan.tva_number)}</p>` : ''}
      </td>
      <td style="vertical-align:top;text-align:right">
        <p style="margin:0;font-size:28px;font-weight:800;color:${accent}">DEVIS</p>
        <p style="margin:6px 0 0;font-size:14px;font-weight:600;color:${textColor}">${esc(quote.quote_number)}</p>
        <p style="margin:4px 0 0;font-size:12px;color:#6b6560">Date : ${fmtDate(quote.created_at)}</p>
        ${quote.valid_until ? `<p style="margin:2px 0 0;font-size:12px;color:#6b6560">Valide jusqu'au : ${fmtDate(quote.valid_until)}</p>` : ''}
      </td>
    </tr>
  </table>

  <!-- Client -->
  <div style="background:#f5f3f0;border-radius:8px;padding:16px 20px;margin-bottom:24px">
    <p style="margin:0;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#6b6560;font-weight:600">Client</p>
    <p style="margin:8px 0 0;font-size:14px;font-weight:600;color:${textColor}">${esc(client.name)}</p>
    ${client.email ? `<p style="margin:2px 0 0;font-size:12px;color:#6b6560">${esc(client.email)}</p>` : ''}
    ${client.phone ? `<p style="margin:2px 0 0;font-size:12px;color:#6b6560">${esc(client.phone)}</p>` : ''}
    ${clientAddress ? `<p style="margin:2px 0 0;font-size:12px;color:#6b6560">${esc(clientAddress)}</p>` : ''}
  </div>

  ${quote.title ? `<p style="margin:0 0 16px;font-size:15px;font-weight:600;color:${textColor}">${esc(quote.title)}</p>` : ''}

  <!-- Lignes -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:24px" cellpadding="0" cellspacing="0">
    <thead>
      <tr>
        <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:white;background:${accent};border-radius:8px 0 0 0">Description</th>
        <th style="padding:10px 12px;text-align:center;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:white;background:${accent}">Qte</th>
        <th style="padding:10px 12px;text-align:center;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:white;background:${accent}">Unite</th>
        <th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:white;background:${accent}">Prix unit. HT</th>
        <th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:white;background:${accent};border-radius:0 8px 0 0">Total HT</th>
      </tr>
    </thead>
    <tbody>
      ${linesHtml}
    </tbody>
  </table>

  <!-- Totaux -->
  <table style="width:260px;margin-left:auto;margin-bottom:32px" cellpadding="0" cellspacing="0">
    <tr>
      <td style="padding:6px 0;font-size:13px;color:#6b6560">Total HT</td>
      <td style="padding:6px 0;font-size:13px;text-align:right;color:${textColor}">${fmtCurrency(quote.total_ht)}</td>
    </tr>
    <tr>
      <td style="padding:6px 0;font-size:13px;color:#6b6560">TVA (${quote.tva_rate}%)</td>
      <td style="padding:6px 0;font-size:13px;text-align:right;color:${textColor}">${fmtCurrency(quote.total_tva)}</td>
    </tr>
    <tr>
      <td style="padding:10px 0 6px;font-size:15px;font-weight:700;color:${textColor};border-top:2px solid ${accent}">Total TTC</td>
      <td style="padding:10px 0 6px;font-size:15px;font-weight:700;text-align:right;color:${accent};border-top:2px solid ${accent}">${fmtCurrency(quote.total_ttc)}</td>
    </tr>
  </table>

  <!-- Zone signature DocuSeal -->
  <div style="border-top:1px solid #e5e1da;padding-top:24px;margin-bottom:16px">
    <p style="margin:0 0 12px;font-size:12px;font-weight:600;color:${textColor}">Signature du client</p>
    <signature-field role="First Submitter" required="true" />
    <date-field role="First Submitter" readonly="true" />
  </div>

  <!-- Mentions legales -->
  <div style="border-top:1px solid #e5e1da;padding-top:16px">
    <p style="margin:0;font-size:10px;color:#999;line-height:1.5">
      ${esc(mentionsLegales)}
      <br/>Signature electronique realisee au sens du reglement europeen eIDAS (signature electronique avancee).
      Ce document a valeur contractuelle entre les parties.
    </p>
  </div>

</div>
</body>
</html>`.trim();
}
