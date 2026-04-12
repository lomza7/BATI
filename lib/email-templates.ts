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

interface InvoiceEmailData {
  clientName: string;
  artisanName: string;
  invoiceNumber: string;
  invoiceTitle: string;
  totalTtc: string;
  dueDate: string | null;
  magicLink: string;
  hasOnlinePayment: boolean;
  accentColor?: string;
  /** Type de facture — change le libellé et la narration de l'email */
  invoiceType?: 'standard' | 'acompte' | 'solde';
  /** Pourcentage pour une facture d'acompte (ex: 30) */
  depositPercentage?: number | null;
  /** Numéro du devis source (pour acompte/solde) */
  relatedQuoteNumber?: string | null;
}

export function buildInvoicePaymentEmail(data: InvoiceEmailData): string {
  const accent = data.accentColor || '#d35400';

  const dueDateLine = data.dueDate
    ? `<p style="margin:0;font-size:13px;color:#6b6560">Echeance : ${data.dueDate}</p>`
    : '';

  const invoiceType = data.invoiceType || 'standard';
  const isDeposit = invoiceType === 'acompte';
  const isFinal = invoiceType === 'solde';

  const depositLabel = data.depositPercentage
    ? `${Number.isInteger(data.depositPercentage) ? data.depositPercentage : data.depositPercentage.toFixed(2).replace('.', ',')}%`
    : '';

  // Libellé du bloc récapitulatif — remplace « Facture »
  const headerBlockLabel = isDeposit
    ? `Facture d'acompte${depositLabel ? ` ${depositLabel}` : ''}`
    : isFinal
      ? 'Facture de solde'
      : 'Facture';

  // Sujet visuel du titre de l'email (balise <title>) + narration
  const documentNoun = isDeposit
    ? `une facture d'acompte${depositLabel ? ` de ${depositLabel}` : ''}${data.relatedQuoteNumber ? ` sur le devis ${escHtml(data.relatedQuoteNumber)}` : ''}`
    : isFinal
      ? `la facture de solde${data.relatedQuoteNumber ? ` du devis ${escHtml(data.relatedQuoteNumber)}` : ''}`
      : 'une facture';

  const introNote = isDeposit
    ? `Afin de démarrer les travaux, ${escHtml(data.artisanName)} vous adresse ${documentNoun}.`
    : isFinal
      ? `${escHtml(data.artisanName)} vous adresse ${documentNoun}. Les acomptes déjà versés sont automatiquement déduits du montant à régler.`
      : `${escHtml(data.artisanName)} vous a envoye une facture.`;

  const paymentNote = data.hasOnlinePayment
    ? isDeposit
      ? "Vous pouvez régler cet acompte en ligne en un clic."
      : 'Vous pouvez consulter le detail de la facture et la payer en ligne en un clic.'
    : 'Vous pouvez consulter le detail de la facture en cliquant sur le bouton ci-dessous.';

  const ctaLabel = data.hasOnlinePayment
    ? isDeposit
      ? "Payer l'acompte"
      : 'Voir et payer ma facture'
    : 'Consulter ma facture';

  // Titre de l'onglet
  const titleTag = isDeposit
    ? `Facture d'acompte ${data.invoiceNumber}`
    : isFinal
      ? `Facture de solde ${data.invoiceNumber}`
      : `Facture ${data.invoiceNumber}`;

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${titleTag}</title>
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
                ${introNote} ${paymentNote}
              </p>

              <!-- Bloc facture -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#faf9f7;border-radius:12px;border:1px solid #e5e1da;margin-bottom:24px">
                <tr>
                  <td style="padding:20px 24px">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td>
                          <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#999;font-weight:600">${escHtml(headerBlockLabel)}</p>
                          <p style="margin:0 0 2px;font-size:15px;font-weight:600;color:#1a1a1a">${escHtml(data.invoiceTitle || data.invoiceNumber)}</p>
                          <p style="margin:0;font-size:12px;color:#6b6560">${escHtml(data.invoiceNumber)}</p>
                          ${dueDateLine}
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
                      ${ctaLabel}
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:20px 0 0;font-size:12px;color:#999;text-align:center;line-height:1.5">
                Ce lien est personnel et securise.${data.hasOnlinePayment ? ' Le paiement est gere par Stripe, aucune donnee bancaire ne transite par notre plateforme.' : ''}
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

interface AccountantInvitationData {
  artisanName: string;
  accountantName: string;
  accountantEmail: string;
  accessUrl: string;
  expiresAt: string;
  scopeLabel: string;
  accentColor?: string;
}

export function buildAccountantInvitationEmail(data: AccountantInvitationData): string {
  const accent = data.accentColor || '#d35400';
  const greeting = data.accountantName ? escHtml(data.accountantName) : 'Bonjour';

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Accès comptable Hellobat</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f3f0;font-family:'Inter','Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f3f0;padding:32px 16px">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08)">

          <tr>
            <td style="background-color:${accent};padding:28px 32px;text-align:center">
              <p style="margin:0;font-size:18px;font-weight:700;color:#ffffff;letter-spacing:-0.3px">
                ${escHtml(data.artisanName)}
              </p>
              <p style="margin:6px 0 0;font-size:13px;color:#ffffff;opacity:0.9">
                Accès comptable sécurisé
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:32px 32px 8px">
              <p style="margin:0 0 6px;font-size:15px;color:#1a1a1a">
                ${greeting},
              </p>
              <p style="margin:0 0 20px;font-size:14px;color:#6b6560;line-height:1.6">
                <strong>${escHtml(data.artisanName)}</strong> vous donne accès à ses données comptables
                via Hellobat. Vous pouvez consulter ses dépenses, factures et exporter le FEC pour le
                bilan, en lecture seule.
              </p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;background-color:#faf8f5;border-radius:12px;border:1px solid #ece8e0">
                <tr>
                  <td style="padding:16px 20px">
                    <p style="margin:0 0 8px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#9a9590">
                      Périmètre partagé
                    </p>
                    <p style="margin:0 0 12px;font-size:14px;color:#1a1a1a">
                      ${escHtml(data.scopeLabel)}
                    </p>
                    <p style="margin:0 0 8px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#9a9590">
                      Valable jusqu'au
                    </p>
                    <p style="margin:0;font-size:14px;color:#1a1a1a">
                      ${escHtml(data.expiresAt)}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:0 32px 32px">
              <a href="${data.accessUrl}" style="display:inline-block;background-color:${accent};color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:10px">
                Accéder aux données comptables
              </a>
              <p style="margin:16px 0 0;font-size:11px;color:#9a9590;line-height:1.5">
                Lien personnel et confidentiel — ne le partagez pas.
              </p>
            </td>
          </tr>

          <tr>
            <td style="background-color:#faf8f5;padding:20px 32px">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <p style="margin:0;font-size:11px;color:#bbb;text-align:center;line-height:1.5">
                      Envoyé via <span style="color:${accent};font-weight:600">Hellobat</span> — Le logiciel des artisans du bâtiment
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin-top:16px">
          <tr>
            <td align="center">
              <p style="margin:0;font-size:11px;color:#999">
                Si le bouton ne fonctionne pas, copiez ce lien :<br/>
                <a href="${data.accessUrl}" style="color:${accent};word-break:break-all">${data.accessUrl}</a>
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

interface ReferralInviteData {
  senderName: string;
  companyName: string;
  recipientName?: string;
  customMessage?: string;
  referralLink: string;
  trackingPixelUrl: string;
  accentColor?: string;
}

export function buildReferralInviteEmail(data: ReferralInviteData): string {
  const accent = data.accentColor || '#d35400';
  const greeting = data.recipientName ? `Bonjour ${escHtml(data.recipientName)}` : 'Bonjour';
  const personalNote = data.customMessage
    ? `<p style="margin:0 0 18px;font-size:14px;color:#1a1a1a;line-height:1.6;font-style:italic;border-left:3px solid ${accent};padding-left:14px">"${escHtml(data.customMessage)}"</p>`
    : '';

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invitation Hellobat</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f3f0;font-family:'Inter','Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f3f0;padding:32px 16px">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08)">

          <tr>
            <td style="background-color:${accent};padding:32px 32px 28px;text-align:center">
              <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#ffffff;opacity:0.85;text-transform:uppercase;letter-spacing:1.2px">
                Invitation Hellobat
              </p>
              <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.4px">
                2 mois offerts
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:32px 32px 8px">
              <p style="margin:0 0 12px;font-size:15px;color:#1a1a1a">
                ${greeting},
              </p>
              <p style="margin:0 0 18px;font-size:14px;color:#6b6560;line-height:1.6">
                <strong>${escHtml(data.senderName)}</strong>${data.companyName && data.companyName !== data.senderName ? ` (${escHtml(data.companyName)})` : ''} utilise <strong>Hellobat</strong>, le logiciel tout-en-un pour les artisans du batiment, et vous invite a l'essayer.
              </p>

              ${personalNote}

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#faf8f5;border-radius:12px;border:1px solid #ece8e0;margin:6px 0 22px">
                <tr>
                  <td style="padding:18px 22px">
                    <p style="margin:0 0 6px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;color:${accent}">
                      Offre de parrainage
                    </p>
                    <p style="margin:0;font-size:14px;color:#1a1a1a;line-height:1.55">
                      Inscrivez-vous via le lien ci-dessous et profitez de <strong>2 mois gratuits</strong> sur votre abonnement Hellobat.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:0 32px 32px">
              <a href="${data.referralLink}" style="display:inline-block;background-color:${accent};color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 36px;border-radius:12px;letter-spacing:-0.2px">
                Profiter de mes 2 mois gratuits
              </a>
              <p style="margin:14px 0 0;font-size:11px;color:#9a9590;line-height:1.5">
                Aucune carte bancaire requise pour creer le compte.
              </p>
            </td>
          </tr>

          <tr>
            <td style="background-color:#faf8f5;padding:20px 32px">
              <p style="margin:0;font-size:11px;color:#bbb;text-align:center;line-height:1.5">
                Envoye via <span style="color:${accent};font-weight:600">Hellobat</span> — Le logiciel des artisans du batiment
              </p>
            </td>
          </tr>

        </table>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin-top:16px">
          <tr>
            <td align="center">
              <p style="margin:0;font-size:11px;color:#999">
                Si le bouton ne fonctionne pas, copiez ce lien :<br/>
                <a href="${data.referralLink}" style="color:${accent};word-break:break-all">${data.referralLink}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
  <img src="${data.trackingPixelUrl}" width="1" height="1" alt="" style="display:block;border:0;width:1px;height:1px"/>
</body>
</html>`.trim();
}

interface VerificationCodeEmailData {
  code: string;
  expiresInMinutes: number;
}

export function buildVerificationCodeEmail(data: VerificationCodeEmailData): string {
  const accent = '#d35400';
  const digits = data.code.split('');

  const codeCells = digits
    .map(
      (d) =>
        `<td align="center" style="width:44px;padding:0 4px"><div style="background-color:#faf8f5;border:2px solid #ece8e0;border-radius:10px;font-size:28px;font-weight:700;color:#1a1a1a;padding:14px 0;letter-spacing:0;font-family:'SF Mono',Menlo,Consolas,monospace">${d}</div></td>`
    )
    .join('');

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Votre code de verification Hellobat</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f3f0;font-family:'Inter','Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f3f0;padding:32px 16px">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08)">

          <tr>
            <td style="background-color:${accent};padding:32px 32px 28px;text-align:center">
              <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#ffffff;opacity:0.85;text-transform:uppercase;letter-spacing:1.2px">
                Hellobat
              </p>
              <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.4px">
                Verifiez votre adresse email
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:36px 32px 12px">
              <p style="margin:0 0 14px;font-size:15px;color:#1a1a1a">
                Bonjour,
              </p>
              <p style="margin:0 0 28px;font-size:14px;color:#6b6560;line-height:1.65">
                Bienvenue sur <strong>Hellobat</strong>. Pour confirmer votre adresse email et acceder a votre espace, saisissez ce code de verification :
              </p>

              <table role="presentation" align="center" cellpadding="0" cellspacing="0" style="margin:0 auto 24px">
                <tr>
                  ${codeCells}
                </tr>
              </table>

              <p style="margin:0 0 8px;font-size:13px;color:#6b6560;text-align:center">
                Ce code expire dans <strong>${data.expiresInMinutes} minutes</strong>.
              </p>
              <p style="margin:0 0 28px;font-size:12px;color:#9a9590;text-align:center;line-height:1.5">
                Si vous n'etes pas a l'origine de cette inscription, vous pouvez ignorer ce message.
              </p>
            </td>
          </tr>

          <tr>
            <td style="background-color:#faf8f5;padding:22px 32px">
              <p style="margin:0;font-size:11px;color:#bbb;text-align:center;line-height:1.5">
                Hellobat — Le logiciel des artisans du batiment
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

interface RenduCampaignEmailData {
  artisanName: string;
  clientName: string;
  campaignUrl: string;
  projectType?: string;
  accentColor?: string;
}

export function buildRenduCampaignEmail(data: RenduCampaignEmailData): string {
  const accent = data.accentColor || '#d35400';
  const greeting = data.clientName ? `Bonjour ${escHtml(data.clientName)}` : 'Bonjour';
  const projectLine = data.projectType
    ? `<p style="margin:0 0 18px;font-size:14px;color:#1a1a1a;line-height:1.6;font-style:italic;border-left:3px solid ${accent};padding-left:14px">Projet : ${escHtml(data.projectType)}</p>`
    : '';

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Visualisez vos travaux avant signature</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f3f0;font-family:'Inter','Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f3f0;padding:32px 16px">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08)">

          <tr>
            <td style="background-color:${accent};padding:32px 32px 28px;text-align:center">
              <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#ffffff;opacity:0.85;text-transform:uppercase;letter-spacing:1.2px">
                ${escHtml(data.artisanName)}
              </p>
              <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.4px">
                Visualisez vos travaux avant de signer
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:32px 32px 8px">
              <p style="margin:0 0 14px;font-size:15px;color:#1a1a1a">
                ${greeting},
              </p>
              <p style="margin:0 0 18px;font-size:14px;color:#6b6560;line-height:1.65">
                <strong>${escHtml(data.artisanName)}</strong> vous offre un outil exclusif :
                envoyez une simple photo de votre piece ou facade, et notre IA vous montre
                <strong>en quelques secondes a quoi ressembleront vos travaux apres rénovation</strong>.
              </p>

              ${projectLine}

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#faf8f5;border-radius:12px;border:1px solid #ece8e0;margin:6px 0 22px">
                <tr>
                  <td style="padding:18px 22px">
                    <p style="margin:0 0 8px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;color:${accent}">
                      Comment ca marche
                    </p>
                    <p style="margin:0 0 6px;font-size:13px;color:#1a1a1a;line-height:1.55">
                      <strong>1.</strong> Cliquez sur le bouton ci-dessous
                    </p>
                    <p style="margin:0 0 6px;font-size:13px;color:#1a1a1a;line-height:1.55">
                      <strong>2.</strong> Uploadez la photo de votre piece
                    </p>
                    <p style="margin:0 0 6px;font-size:13px;color:#1a1a1a;line-height:1.55">
                      <strong>3.</strong> Choisissez un style et generez plusieurs avant/apres
                    </p>
                    <p style="margin:0;font-size:13px;color:#1a1a1a;line-height:1.55">
                      <strong>4.</strong> Marquez vos preferes — vous les recevrez par email
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:0 32px 32px">
              <a href="${data.campaignUrl}" style="display:inline-block;background-color:${accent};color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:12px;letter-spacing:-0.2px">
                Visualiser mon projet
              </a>
              <p style="margin:14px 0 0;font-size:11px;color:#9a9590;line-height:1.5">
                Lien personnel et confidentiel — ne le partagez pas.
              </p>
            </td>
          </tr>

          <tr>
            <td style="background-color:#faf8f5;padding:20px 32px">
              <p style="margin:0;font-size:11px;color:#bbb;text-align:center;line-height:1.5">
                Envoye via <span style="color:${accent};font-weight:600">Hellobat</span> — Le logiciel des artisans du batiment
              </p>
            </td>
          </tr>

        </table>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin-top:16px">
          <tr>
            <td align="center">
              <p style="margin:0;font-size:11px;color:#999">
                Si le bouton ne fonctionne pas, copiez ce lien :<br/>
                <a href="${data.campaignUrl}" style="color:${accent};word-break:break-all">${data.campaignUrl}</a>
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

// ---------- Relance facture impayée ----------

export interface PaymentReminderEmailData {
  clientName: string;
  artisanName: string;
  invoiceNumber: string;
  invoiceTitle: string;
  totalTtc: string;
  dueDate: string | null;
  magicLink: string;
  hasOnlinePayment: boolean;
  accentColor?: string;
  reminderLevel: 1 | 2 | 3;
  bodyText: string; // Already interpolated plain text
}

export function buildPaymentReminderEmail(data: PaymentReminderEmailData): string {
  const accent = data.accentColor || '#d35400';

  const levelLabels: Record<number, string> = {
    1: 'Relance 1/3',
    2: 'Relance 2/3',
    3: 'Relance 3/3 — Dernier rappel',
  };
  const levelColors: Record<number, string> = {
    1: '#3b82f6',
    2: '#f59e0b',
    3: '#ef4444',
  };

  const badgeColor = levelColors[data.reminderLevel] || accent;
  const badgeLabel = levelLabels[data.reminderLevel] || 'Relance';

  const dueDateLine = data.dueDate
    ? `<p style="margin:0;font-size:13px;color:#6b6560">Échéance : ${escHtml(data.dueDate)}</p>`
    : '';

  const ctaLabel = data.hasOnlinePayment ? 'Voir et payer ma facture' : 'Consulter ma facture';

  // Convert plain text body to HTML paragraphs
  const bodyHtml = data.bodyText
    .split('\n\n')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 12px;font-size:14px;color:#6b6560;line-height:1.6">${escHtml(p).replace(/\n/g, '<br/>')}</p>`)
    .join('');

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Relance — Facture ${escHtml(data.invoiceNumber)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f3f0;font-family:'Inter','Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f3f0;padding:32px 16px">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08)">

          <!-- Header -->
          <tr>
            <td style="background-color:${accent};padding:28px 32px;text-align:center">
              <p style="margin:0;font-size:18px;font-weight:700;color:#ffffff;letter-spacing:-0.3px">
                ${escHtml(data.artisanName)}
              </p>
            </td>
          </tr>

          <!-- Badge relance -->
          <tr>
            <td style="padding:16px 32px 0;text-align:center">
              <span style="display:inline-block;background-color:${badgeColor};color:#ffffff;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;padding:4px 12px;border-radius:20px">
                ${escHtml(badgeLabel)}
              </span>
            </td>
          </tr>

          <!-- Contenu principal -->
          <tr>
            <td style="padding:20px 32px 24px">
              ${bodyHtml}

              <!-- Bloc facture -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#faf9f7;border-radius:12px;border:1px solid #e5e1da;margin-bottom:24px">
                <tr>
                  <td style="padding:20px 24px">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td>
                          <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#999;font-weight:600">Facture</p>
                          <p style="margin:0 0 2px;font-size:15px;font-weight:600;color:#1a1a1a">${escHtml(data.invoiceTitle || data.invoiceNumber)}</p>
                          <p style="margin:0;font-size:12px;color:#6b6560">${escHtml(data.invoiceNumber)}</p>
                          ${dueDateLine}
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
                      ${ctaLabel}
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:20px 0 0;font-size:12px;color:#999;text-align:center;line-height:1.5">
                Ce lien est personnel et sécurisé.
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
                      Envoyé via <span style="color:${accent};font-weight:600">Hellobat</span> — Le logiciel des artisans du bâtiment
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>

        <!-- Lien en clair -->
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
