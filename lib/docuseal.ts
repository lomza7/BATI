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
  _lines: QuoteLine[],
  client: ClientData,
  artisan: ArtisanData,
): string {
  const dc = (artisan.document_config || {}) as Record<string, string | boolean>;
  const accent = (dc.primary_color as string) || '#d35400';
  const textColor = (dc.secondary_color as string) || '#1a1a1a';
  const fontFamily = dc.font === 'serif' ? 'Georgia, serif' : "'Inter', 'Helvetica Neue', sans-serif";
  const companyName = artisan.company_name || artisan.full_name || 'Artisan';

  // Template minimal : le detail du devis est deja affiche sur notre page.
  // DocuSeal ne sert qu'a capturer la signature avec audit trail + certificat.
  return `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:${fontFamily};background:#ffffff;color:${textColor}">
<div style="max-width:600px;margin:0 auto;padding:24px">

  <!-- Resume -->
  <table style="width:100%;margin-bottom:24px" cellpadding="0" cellspacing="0">
    <tr>
      <td>
        <p style="margin:0;font-size:14px;font-weight:700;color:${textColor}">${esc(companyName)}</p>
      </td>
      <td style="text-align:right">
        <p style="margin:0;font-size:18px;font-weight:800;color:${accent}">DEVIS ${esc(quote.quote_number)}</p>
      </td>
    </tr>
  </table>

  <table style="width:100%;background:#f9f8f6;border-radius:8px;padding:0;margin-bottom:24px" cellpadding="0" cellspacing="0">
    <tr>
      <td style="padding:16px 20px">
        <p style="margin:0 0 4px;font-size:12px;color:#6b6560">Client : <strong style="color:${textColor}">${esc(client.name)}</strong></p>
        ${quote.title ? `<p style="margin:0 0 4px;font-size:12px;color:#6b6560">Objet : <strong style="color:${textColor}">${esc(quote.title)}</strong></p>` : ''}
        <p style="margin:0 0 4px;font-size:12px;color:#6b6560">Date : ${fmtDate(quote.created_at)}</p>
        ${quote.valid_until ? `<p style="margin:0 0 4px;font-size:12px;color:#6b6560">Valide jusqu'au : ${fmtDate(quote.valid_until)}</p>` : ''}
        <p style="margin:8px 0 0;font-size:16px;font-weight:700;color:${accent}">Montant TTC : ${fmtCurrency(quote.total_ttc)}</p>
      </td>
    </tr>
  </table>

  <p style="margin:0 0 16px;font-size:13px;color:#6b6560;line-height:1.5">
    En signant ci-dessous, je, <strong>${esc(client.name)}</strong>, accepte les conditions et les prix du devis <strong>${esc(quote.quote_number)}</strong> d'un montant de <strong>${fmtCurrency(quote.total_ttc)}</strong>.
  </p>

  <!-- Zone signature -->
  <div style="border-top:1px solid #e5e1da;padding-top:20px;margin-bottom:16px">
    <p style="margin:0 0 12px;font-size:12px;font-weight:600;color:${textColor}">Signature du client</p>
    <signature-field role="First Submitter" required="true" />
    <date-field role="First Submitter" readonly="true" />
  </div>

  <!-- Mentions -->
  <p style="margin:0;font-size:9px;color:#999;line-height:1.4">
    Signature electronique realisee au sens du reglement europeen eIDAS (signature electronique avancee). Ce document a valeur contractuelle entre les parties.
  </p>

</div>
</body>
</html>`.trim();
}
