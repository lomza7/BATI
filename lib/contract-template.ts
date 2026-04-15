/**
 * HTML builder pour un contrat recurrent BTP complet.
 * Rendu converti en PDF par DocuSeal (Chromium headless).
 *
 * Contient toutes les clauses legales B2B/B2C, SEPA, meteo, reconduction,
 * penalites de retard et signature eIDAS.
 */

import type {
  ContractCategory,
  ContractFrequency,
} from './contract-types';
import { FREQUENCY_LABELS, getContractCategory } from './contract-types';

export interface ContractData {
  contract_number: string;
  title: string;
  category_key: string;
  client_type: 'b2b' | 'b2c';
  contract_channel: 'sur_site' | 'a_distance' | 'hors_etablissement';
  duration_mode: 'determinee' | 'indeterminee';
  initial_term_months: number;
  renewal_term_months: number;
  auto_renewal: boolean;
  notice_period_months: number;
  frequency: ContractFrequency;
  visits_per_year: number;
  weather_dependent: boolean;
  site_address: string;
  site_access_notes: string;
  included_operations: string[];
  excluded_operations: string[];
  intervention_hours: string;
  emergency_phone: string;
  response_time: string;
  payment_method: 'virement' | 'sepa' | 'cb' | 'cheque' | 'especes';
  payment_timing: 'terme_a_echoir' | 'terme_echu';
  payment_terms_days: number;
  late_penalty_rate: number;
  recovery_fee: number;
  breach_cure_period_days: number;
  amount_ht: number;
  amount_tva: number;
  amount_ttc: number;
  tva_rate: number;
  start_date: string;
  end_date?: string | null;
  created_at: string;
}

export interface ContractClient {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  postal_code?: string;
  city?: string;
  siret?: string;
  legal_form?: string;
}

export interface ContractArtisan {
  company_name: string;
  full_name?: string;
  siret?: string;
  company_address?: string;
  company_postal_code?: string;
  company_city?: string;
  company_phone?: string;
  company_email?: string;
  tva_number?: string;
  rcs?: string;
  capital?: string;
  logo_url?: string;
  document_config?: Record<string, unknown>;
  insurance_name?: string;
  insurance_policy?: string;
}

function esc(str: string | null | undefined): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function fmtDate(date: string | null | undefined): string {
  if (!date) return '';
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(date));
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  virement: 'virement bancaire',
  sepa: 'prelevement SEPA',
  cb: 'carte bancaire',
  cheque: 'cheque',
  especes: 'especes (plafond 1 000 EUR TTC)',
};

export function buildContractHtml(
  contract: ContractData,
  client: ContractClient,
  artisan: ContractArtisan,
  signatureData?: { signatureImageUrl: string; signedAt: string } | null,
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
  const category: ContractCategory = getContractCategory(contract.category_key);

  const isB2C = contract.client_type === 'b2c';
  const isB2B = !isB2C;
  const isRemoteOrOffPremises = contract.contract_channel !== 'sur_site';

  // --- Blocs identite ---
  const artisanId = [
    artisan.company_address,
    [artisan.company_postal_code, artisan.company_city].filter(Boolean).join(' '),
    artisan.siret ? `SIRET ${artisan.siret}` : '',
    artisan.rcs ? `RCS ${artisan.rcs}` : '',
    artisan.capital ? `Capital ${artisan.capital}` : '',
    artisan.tva_number ? `TVA intracom. ${artisan.tva_number}` : '',
    artisan.company_phone ? `Tel. ${artisan.company_phone}` : '',
    artisan.company_email ? artisan.company_email : '',
  ].filter(Boolean).map((l) => `<div>${esc(l)}</div>`).join('');

  const clientId = [
    client.address,
    [client.postal_code, client.city].filter(Boolean).join(' '),
    client.siret ? `SIRET ${client.siret}` : '',
    client.legal_form ? `Forme juridique : ${client.legal_form}` : '',
    client.phone ? `Tel. ${client.phone}` : '',
    client.email,
  ].filter(Boolean).map((l) => `<div>${esc(l)}</div>`).join('');

  // --- Listes operations ---
  const includedHtml = contract.included_operations.length > 0
    ? `<ul style="margin:6px 0 0 18px;padding:0">${contract.included_operations.map((o) => `<li style="margin:2px 0">${esc(o)}</li>`).join('')}</ul>`
    : '<p style="margin:6px 0 0;font-style:italic;color:' + muted + '">A definir</p>';

  const excludedHtml = contract.excluded_operations.length > 0
    ? `<ul style="margin:6px 0 0 18px;padding:0">${contract.excluded_operations.map((o) => `<li style="margin:2px 0">${esc(o)}</li>`).join('')}</ul>`
    : '<p style="margin:6px 0 0;font-style:italic;color:' + muted + '">Aucune exclusion specifique</p>';

  // --- Logo ---
  const showLogo = dc.show_logo !== false;
  const logoBlock = showLogo && artisan.logo_url
    ? `<img src="${esc(artisan.logo_url)}" alt="" style="width:48px;height:48px;border-radius:8px;object-fit:cover;display:block" />`
    : `<div style="width:48px;height:48px;border-radius:8px;background:${accent}20;color:${accent};font-weight:700;font-size:20px;line-height:48px;text-align:center">${esc(companyName.charAt(0).toUpperCase())}</div>`;

  // --- Articles conditionnels ---
  const art2Duration = contract.duration_mode === 'determinee'
    ? `Le present contrat est conclu pour une duree determinee de <strong>${contract.initial_term_months} mois</strong>, a compter du <strong>${esc(fmtDate(contract.start_date))}</strong>${contract.end_date ? `, soit jusqu'au <strong>${esc(fmtDate(contract.end_date))}</strong>` : ''}.`
    : `Le present contrat est conclu pour une duree <strong>indeterminee</strong>, a compter du <strong>${esc(fmtDate(contract.start_date))}</strong>.`;

  const art2Renewal = contract.auto_renewal && contract.duration_mode === 'determinee'
    ? `<p style="margin:8px 0 0">Il est reconductible <strong>tacitement</strong> par periodes successives de ${contract.renewal_term_months} mois, sauf denonciation par l'une des parties par lettre recommandee avec accuse de reception adressee au moins <strong>${contract.notice_period_months} mois</strong> avant l'echeance.${isB2C ? ' Conformement a l\'article L. 215-1 du Code de la consommation, le Prestataire informera le Client par ecrit, au plus tot trois mois et au plus tard un mois avant le terme de la periode en cours, de la possibilite de ne pas reconduire le contrat.' : ''}</p>`
    : '<p style="margin:8px 0 0">Le contrat ne fait l\'objet d\'aucune reconduction tacite.</p>';

  const weatherClause = contract.weather_dependent
    ? `<p style="margin:8px 0 0">Les prestations sont <strong>dependantes des conditions meteorologiques</strong>. En cas d'intemperies rendant l'intervention impossible ou dangereuse (pluie, neige, verglas, vent > 50 km/h, orage), la visite sera reportee a la date mutuellement convenue la plus proche, sans frais ni penalite pour l'une ou l'autre partie.</p>`
    : '';

  const withdrawalClause = isB2C && isRemoteOrOffPremises
    ? `
  <h3 style="margin:14px 0 4px;font-size:13px;color:${accent}">Article 11 — Droit de retractation (consommateur)</h3>
  <p style="margin:0">Conformement aux articles L. 221-18 et suivants du Code de la consommation, le Client dispose d'un delai de <strong>quatorze (14) jours</strong> a compter de la signature du present contrat pour exercer son droit de retractation, sans avoir a justifier de motifs.</p>
  <p style="margin:8px 0 0">Le droit de retractation peut etre exerce par l'envoi, avant l'expiration du delai, du formulaire type de retractation annexe au present contrat, ou de toute autre declaration exprimant la volonte de se retracter, a l'adresse du Prestataire indiquee a l'article 1.</p>
  <p style="margin:8px 0 0">Si le Client demande expressement que l'execution des prestations commence avant la fin du delai de retractation, il restera tenu au paiement des prestations effectivement fournies jusqu'a la communication de sa decision de se retracter.</p>`
    : '';

  const sepaMandate = contract.payment_method === 'sepa'
    ? `
  <div style="background:${bgSoft};border:1px solid ${border};border-radius:8px;padding:12px 16px;margin-top:10px">
    <p style="margin:0;font-size:11px;font-weight:700;color:${textColor}">Mandat de prelevement SEPA</p>
    <p style="margin:6px 0 0;font-size:10px;color:${muted};line-height:1.5">En signant le present contrat, le Client autorise le Prestataire a envoyer des instructions a sa banque pour debiter son compte, et sa banque a debiter son compte conformement aux instructions du Prestataire. Le Client beneficie d'un droit a remboursement par sa banque selon les conditions decrites dans la convention qu'il a passee avec elle. Toute demande de remboursement doit etre presentee dans les 8 semaines suivant la date de debit de son compte pour un prelevement autorise. Coordonnees IBAN/BIC communiquees separement.</p>
  </div>`
    : '';

  // --- Construction HTML ---
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Contrat ${esc(contract.contract_number)}</title>
<style>
  @page { size: A4; margin: 14mm 12mm; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 0; font-family: ${fontFamily}; background: #ffffff; color: ${textColor}; font-size: 11px; line-height: 1.5; }
  table { border-collapse: collapse; width: 100%; }
  .no-break { page-break-inside: avoid; }
  h2 { margin: 16px 0 6px; font-size: 14px; color: ${accent}; }
  h3 { margin: 12px 0 4px; font-size: 12px; color: ${accent}; }
  p { margin: 4px 0; }
</style>
</head>
<body>
<div style="max-width:780px;margin:0 auto;padding:0 4px">

  <!-- En-tete -->
  <table style="margin-bottom:16px">
    <tr>
      <td style="vertical-align:top;width:60%">
        <table>
          <tr>
            <td style="vertical-align:middle;width:58px">${logoBlock}</td>
            <td style="vertical-align:middle;padding-left:12px">
              <p style="margin:0;font-size:15px;font-weight:700">${esc(companyName)}</p>
              ${artisan.siret ? `<p style="margin:2px 0 0;font-size:10px;color:${muted}">SIRET ${esc(artisan.siret)}</p>` : ''}
            </td>
          </tr>
        </table>
      </td>
      <td style="vertical-align:top;text-align:right;width:40%">
        <p style="margin:0;font-size:24px;font-weight:800;color:${accent};letter-spacing:0.5px">CONTRAT</p>
        <p style="margin:2px 0 0;font-size:12px;color:${muted};text-transform:uppercase;letter-spacing:1px">${esc(category.label)}</p>
        <p style="margin:4px 0 0;font-size:13px;font-weight:600">${esc(contract.contract_number)}</p>
        <p style="margin:4px 0 0;font-size:10px;color:${muted}">Date : ${esc(fmtDate(contract.created_at))}</p>
      </td>
    </tr>
  </table>

  <!-- Entre les soussignes -->
  <div style="background:${bgSoft};border:1px solid ${border};border-radius:8px;padding:14px 18px;margin-bottom:14px" class="no-break">
    <p style="margin:0 0 8px;font-size:10px;font-weight:700;letter-spacing:1px;color:${muted};text-transform:uppercase">Entre les soussignes</p>
    <div style="margin-bottom:10px">
      <p style="margin:0;font-weight:700">${esc(companyName)}</p>
      <div style="font-size:10px;color:${muted};line-height:1.5;margin-top:2px">${artisanId}</div>
      <p style="margin:4px 0 0;font-style:italic;color:${muted};font-size:10px">Ci-apres denomme <strong>le Prestataire</strong>,</p>
    </div>
    <p style="margin:6px 0;text-align:center;color:${muted};font-size:10px">d'une part,</p>
    <div style="margin-bottom:6px">
      <p style="margin:0;font-weight:700">${esc(client.name)}</p>
      <div style="font-size:10px;color:${muted};line-height:1.5;margin-top:2px">${clientId}</div>
      <p style="margin:4px 0 0;font-style:italic;color:${muted};font-size:10px">Ci-apres denomme <strong>le Client</strong> (${isB2C ? 'consommateur' : 'professionnel'}),</p>
    </div>
    <p style="margin:6px 0 0;text-align:center;color:${muted};font-size:10px">d'autre part.</p>
  </div>

  <!-- Preambule -->
  <h2>Preambule</h2>
  <p>Le Client souhaite confier au Prestataire, specialiste de ${esc(category.service_family_label)}, l'execution de prestations recurrentes sur le site indique a l'article 3. Les parties se sont rapprochees et ont convenu ce qui suit.</p>

  <!-- Article 1 - Objet -->
  <h2>Article 1 — Objet du contrat</h2>
  <p>Le Prestataire s'engage a realiser, pour le compte du Client, des prestations de ${esc(category.service_family_label)}, selon les modalites et la periodicite definies aux articles suivants.</p>

  <!-- Article 2 - Duree et reconduction -->
  <h2>Article 2 — Duree et reconduction</h2>
  <p>${art2Duration}</p>
  ${art2Renewal}

  <!-- Article 3 - Lieu d'execution -->
  <h2>Article 3 — Lieu d'execution</h2>
  <p>Les prestations seront executees a l'adresse suivante : <strong>${esc(contract.site_address || 'adresse du Client')}</strong>.</p>
  ${contract.site_access_notes ? `<p style="margin:6px 0 0;color:${muted}"><em>Acces / particularites : ${esc(contract.site_access_notes)}</em></p>` : ''}

  <!-- Article 4 - Prestations incluses -->
  <h2>Article 4 — Prestations incluses</h2>
  <p>Le contrat couvre la realisation des operations suivantes, selon les regles de l'art et les normes applicables :</p>
  ${includedHtml}

  <!-- Article 5 - Prestations exclues -->
  <h2>Article 5 — Prestations exclues</h2>
  <p>Les prestations suivantes ne sont <strong>pas</strong> comprises dans le present contrat et feront l'objet d'un devis separe :</p>
  ${excludedHtml}

  <!-- Article 6 - Frequence et planification -->
  <h2>Article 6 — Frequence et planification des visites</h2>
  <p>La frequence des visites est <strong>${FREQUENCY_LABELS[contract.frequency].toLowerCase()}</strong>, soit <strong>${contract.visits_per_year} visite${contract.visits_per_year > 1 ? 's' : ''} par an</strong>.</p>
  <p style="margin:6px 0 0">Horaires d'intervention : ${esc(contract.intervention_hours)}.</p>
  <p style="margin:6px 0 0">Delai d'intervention sur demande ponctuelle : ${esc(contract.response_time)}${contract.emergency_phone ? ` — ligne dediee : <strong>${esc(contract.emergency_phone)}</strong>` : ''}.</p>
  ${weatherClause}

  <!-- Article 7 - Prix -->
  <h2>Article 7 — Prix et revision</h2>
  <p>Le montant forfaitaire annuel s'eleve a <strong>${esc(fmtCurrency(contract.amount_ht))} HT</strong>, soit <strong>${esc(fmtCurrency(contract.amount_ttc))} TTC</strong> (TVA ${contract.tva_rate}% : ${esc(fmtCurrency(contract.amount_tva))}).</p>
  <p style="margin:6px 0 0">Le prix pourra etre revise chaque annee, a la date anniversaire du contrat, selon la variation de l'indice INSEE des prix a la consommation hors tabac (ensemble des menages), sans que cette revision ne puisse exceder 5 % par an. Toute revision sera notifiee au Client par ecrit au moins 30 jours avant son application.</p>

  <!-- Article 8 - Modalites de paiement -->
  <h2>Article 8 — Modalites de paiement</h2>
  <p>Le paiement s'effectue par <strong>${esc(PAYMENT_METHOD_LABELS[contract.payment_method] || contract.payment_method)}</strong>, ${contract.payment_timing === 'terme_a_echoir' ? 'a terme a echoir (en debut de periode)' : 'a terme echu (en fin de periode)'}, selon la frequence prevue a l'article 6.</p>
  <p style="margin:6px 0 0">Les factures sont payables sous <strong>${contract.payment_terms_days} jours</strong> a compter de leur date d'emission.</p>
  <p style="margin:6px 0 0">Conformement aux articles L. 441-10 et D. 441-5 du Code de commerce, tout retard de paiement donnera lieu de plein droit, sans mise en demeure prealable, a l'application de penalites de retard au taux de <strong>${contract.late_penalty_rate} %</strong> ainsi qu'a une indemnite forfaitaire pour frais de recouvrement de <strong>${esc(fmtCurrency(contract.recovery_fee))}</strong>${isB2B ? ' (article L. 441-10 II du Code de commerce)' : ''}.</p>
  ${sepaMandate}

  <!-- Article 9 - Obligations -->
  <h2>Article 9 — Obligations des parties</h2>
  <p><strong>Le Prestataire</strong> s'engage a executer les prestations dans les regles de l'art, avec diligence et competence, et a respecter l'ensemble des normes et reglementations applicables. Il dispose des qualifications, habilitations et assurances professionnelles requises${artisan.insurance_name ? ` (RC professionnelle ${esc(artisan.insurance_name)}${artisan.insurance_policy ? ` — police n° ${esc(artisan.insurance_policy)}` : ''})` : ''}.</p>
  <p style="margin:8px 0 0"><strong>Le Client</strong> s'engage a faciliter l'acces au site, a fournir les informations utiles a l'execution des prestations, a signaler sans delai toute anomalie, et a regler les factures aux echeances prevues.</p>

  <!-- Article 10 - Resolution -->
  <h2>Article 10 — Resolution pour inexecution</h2>
  <p>En cas de manquement grave de l'une des parties a ses obligations, l'autre partie pourra resilier de plein droit le present contrat <strong>${contract.breach_cure_period_days} jours</strong> apres l'envoi d'une mise en demeure par lettre recommandee avec accuse de reception restee sans effet, sans prejudice de tous dommages et interets.</p>
  ${withdrawalClause}

  <!-- Article Force majeure -->
  <h2>Article 12 — Force majeure</h2>
  <p>Aucune des parties ne pourra etre tenue responsable de l'inexecution de ses obligations en cas de force majeure au sens de l'article 1218 du Code civil. La partie concernee en informera l'autre sans delai par tout moyen.</p>

  <!-- Article Confidentialite RGPD -->
  <h2>Article 13 — Donnees personnelles</h2>
  <p>Les donnees personnelles collectees dans le cadre du present contrat sont traitees par le Prestataire en qualite de responsable de traitement, aux fins d'execution du contrat et de facturation, conformement au RGPD. Le Client dispose d'un droit d'acces, de rectification, d'effacement, de portabilite et d'opposition qu'il peut exercer a l'adresse du Prestataire.</p>

  <!-- Article Litiges -->
  <h2>Article 14 — Loi applicable et reglement des litiges</h2>
  <p>Le present contrat est soumis au droit francais. Les parties s'efforceront de resoudre a l'amiable tout differend decoulant de son execution.</p>
  ${isB2C
    ? `<p style="margin:6px 0 0">Conformement a l'article L. 612-1 du Code de la consommation, le Client peut recourir gratuitement au mediateur de la consommation dont releve le Prestataire. A defaut d'accord amiable, les tribunaux competents sont ceux du domicile du defendeur ou du lieu d'execution du contrat au choix du Client.</p>`
    : `<p style="margin:6px 0 0">A defaut d'accord amiable, tout litige sera porte devant les tribunaux competents dans le ressort du siege social du Prestataire.</p>`}

  <!-- Totaux synthese -->
  <table style="margin:20px 0 14px" class="no-break">
    <tr>
      <td style="width:55%"></td>
      <td style="width:45%">
        <table style="border:1px solid ${border};border-radius:8px;overflow:hidden">
          <tr>
            <td style="padding:8px 14px;font-size:11px;color:${muted}">Montant annuel HT</td>
            <td style="padding:8px 14px;font-size:11px;text-align:right;font-weight:600">${esc(fmtCurrency(contract.amount_ht))}</td>
          </tr>
          <tr style="border-top:1px solid ${border}">
            <td style="padding:8px 14px;font-size:11px;color:${muted}">TVA ${contract.tva_rate}%</td>
            <td style="padding:8px 14px;font-size:11px;text-align:right;font-weight:600">${esc(fmtCurrency(contract.amount_tva))}</td>
          </tr>
          <tr style="background:${accent}10;border-top:2px solid ${border}">
            <td style="padding:12px 14px;font-size:13px;font-weight:700">Montant annuel TTC</td>
            <td style="padding:12px 14px;font-size:16px;font-weight:800;text-align:right;color:${accent}">${esc(fmtCurrency(contract.amount_ttc))}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <!-- Acceptation -->
  <div style="padding:14px 18px;border:1px solid ${border};border-radius:8px;margin-bottom:14px" class="no-break">
    <p style="margin:0">En signant ci-dessous, je, <strong>${esc(client.name)}</strong>, reconnais avoir pris connaissance et accepter sans reserve l'integralite des clauses du present contrat de ${esc(category.label.toLowerCase())} n° <strong>${esc(contract.contract_number)}</strong> pour un montant annuel de <strong>${esc(fmtCurrency(contract.amount_ttc))} TTC</strong>.</p>
  </div>

  <!-- Signature -->
  <div style="padding:18px;border:1px solid ${border};border-radius:8px;margin-bottom:14px" class="no-break">
    <p style="margin:0 0 10px;font-size:9px;font-weight:700;letter-spacing:1px;color:${muted};text-transform:uppercase">Signature du Client</p>
    <div style="min-height:110px;padding:6px 0">
      ${signatureData
        ? `<img src="${esc(signatureData.signatureImageUrl)}" alt="Signature" style="max-height:100px;max-width:280px" />`
        : `<signature-field name="Signature" role="First Submitter" required="true"></signature-field>`}
    </div>
    <p style="margin:12px 0 4px;font-size:9px;font-weight:700;letter-spacing:1px;color:${muted};text-transform:uppercase">Date</p>
    <div style="min-height:24px">
      ${signatureData
        ? `<p style="margin:0;font-size:11px">${esc(fmtDate(signatureData.signedAt))}</p>`
        : `<date-field name="Date" role="First Submitter" readonly="true"></date-field>`}
    </div>
  </div>

  <!-- Mentions legales finales -->
  <div style="padding:12px 16px;background:${bgSoft};border:1px solid ${border};border-radius:8px">
    <p style="margin:0;font-size:9px;color:${muted};line-height:1.5">Signature electronique realisee au sens du reglement europeen eIDAS (signature electronique avancee). Ce document a pleine valeur contractuelle entre les parties. Un exemplaire signe est remis au Client et conserve par le Prestataire.</p>
  </div>

</div>
</body>
</html>`.trim();
}
