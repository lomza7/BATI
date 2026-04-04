// Templates email HTML pour Hellobat

interface QuoteEmailData {
  clientName: string;
  artisanName: string;
  quoteNumber: string;
  quoteTitle: string;
  totalTtc: string;
  validUntil: string | null;
  magicLink: string;
  accentColor?: string;
}

export function buildQuoteSignatureEmail(data: QuoteEmailData): string {
  const accent = data.accentColor || '#d35400';

  const validUntilLine = data.validUntil
    ? `<p style="margin:0;font-size:13px;color:#6b6560">Valide jusqu'au ${data.validUntil}</p>`
    : '';

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Devis ${data.quoteNumber}</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f3f0;font-family:'Inter','Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f3f0;padding:32px 16px">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08)">

          <!-- Header avec accent -->
          <tr>
            <td style="background-color:${accent};padding:28px 32px;text-align:center">
              <p style="margin:0;font-size:18px;font-weight:700;color:#ffffff;letter-spacing:-0.3px">
                ${escHtml(data.artisanName)}
              </p>
            </td>
          </tr>

          <!-- Contenu principal -->
          <tr>
            <td style="padding:32px 32px 24px">
              <p style="margin:0 0 6px;font-size:15px;color:#1a1a1a">
                Bonjour <strong>${escHtml(data.clientName)}</strong>,
              </p>
              <p style="margin:0 0 24px;font-size:14px;color:#6b6560;line-height:1.6">
                ${escHtml(data.artisanName)} vous a envoye un devis a consulter et signer electroniquement.
              </p>

              <!-- Bloc devis -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#faf9f7;border-radius:12px;border:1px solid #e5e1da;margin-bottom:24px">
                <tr>
                  <td style="padding:20px 24px">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td>
                          <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#999;font-weight:600">Devis</p>
                          <p style="margin:0 0 2px;font-size:15px;font-weight:600;color:#1a1a1a">${escHtml(data.quoteTitle || data.quoteNumber)}</p>
                          <p style="margin:0;font-size:12px;color:#6b6560">${escHtml(data.quoteNumber)}</p>
                          ${validUntilLine}
                        </td>
                        <td style="text-align:right;vertical-align:top">
                          <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#999;font-weight:600">Montant TTC</p>
                          <p style="margin:0;font-size:22px;font-weight:700;color:${accent}">${escHtml(data.totalTtc)}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Bouton CTA -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${data.magicLink}" target="_blank" style="display:inline-block;background-color:${accent};color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 40px;border-radius:12px;letter-spacing:-0.2px">
                      Consulter et signer mon devis
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:20px 0 0;font-size:12px;color:#999;text-align:center;line-height:1.5">
                Ce lien est personnel et securise. Il vous permet de consulter le detail du devis et de le signer electroniquement.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:0 32px 24px">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e5e1da;padding-top:16px">
                <tr>
                  <td>
                    <p style="margin:0;font-size:11px;color:#bbb;text-align:center;line-height:1.5">
                      Envoye via <span style="color:${accent};font-weight:600">Hellobat</span> — Le logiciel des artisans du batiment
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>

        <!-- Lien en clair sous l'email -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin-top:16px">
          <tr>
            <td align="center">
              <p style="margin:0;font-size:11px;color:#999">
                Si le bouton ne fonctionne pas, copiez ce lien :<br/>
                <a href="${data.magicLink}" style="color:${accent};word-break:break-all">${data.magicLink}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

function escHtml(str: string): string {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
