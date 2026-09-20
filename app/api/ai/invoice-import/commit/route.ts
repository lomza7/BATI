import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { isCreditNoteImportItem } from '@/lib/ai/invoice-import-schema';
import { getNextCreditNoteNumber } from '@/lib/document-numbers';
import { CREDITABLE_STATUSES } from '@/lib/invoices/credit-notes';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface CommitItem {
  client_name: string;
  client_address: string;
  client_city: string;
  client_postal_code: string;
  invoice_date: string;
  invoice_number: string;
  description: string;
  amount_ht: number;
  amount_ttc: number;
  tva_rate: number;
  create_invoice: boolean;
  /** 'facture' (défaut) ou 'avoir'. Voir lib/ai/invoice-import-schema.ts. */
  document_type?: string;
  /** Numéro de la facture rectifiée, obligatoire pour un avoir. */
  credited_invoice_number?: string;
}

/** Arrondi à 2 décimales — même règle que lib/tva.ts. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function num(v: unknown): number {
  const parsed = Number(v);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Empreinte d'un avoir, pour le détecter en doublon.
 *
 * Un avoir importé prend un numéro REGÉNÉRÉ dans la série AV- : le numéro du
 * document scanné n'existe nulle part en base, donc la détection classique par
 * `invoice_number` ne peut rien voir. Et comme un avoir ne crée aucun chantier,
 * l'empreinte « client + adresse + date + montant » ne trouve rien non plus.
 * Sans cette clé, rescanner le même PDF le lendemain crédite la facture une
 * seconde fois et ampute le CA et la TVA collectée du double.
 *
 * NOTE : même clé dans app/api/ai/invoice-import/check-duplicates/route.ts.
 * Les deux doivent rester alignées (helper volontairement local, cf. lot
 * d'implémentation des avoirs).
 */
function creditNoteFingerprint(
  creditedInvoiceId: string,
  totalTtc: number,
  issuedAt: string | null | undefined,
): string {
  const day = String(issuedAt || '').slice(0, 10);
  return creditedInvoiceId + '|' + round2(Math.abs(num(totalTtc))).toFixed(2) + '|' + day;
}

/**
 * Numéro du document tel qu'il figure sur le document SCANNÉ.
 *
 * Hellobat REGÉNÈRE le numéro de toute facture importée (série `F-YYYY-NNN`) :
 * le numéro lu sur le papier n'existait jusqu'ici nulle part en base. Un avoir
 * scanné ensuite référence pourtant sa facture par CE numéro-là — la chaîne
 * scan → revue → validation ne pouvait donc structurellement jamais rattacher
 * un avoir à une facture importée par le même outil.
 *
 * On conserve donc le numéro d'origine dans `invoices.description`, avec la
 * même convention que l'import CSV et que `attach-pdfs` : « Importé
 * (F-2025-042) ». Cette mention apparaît sous le titre dans l'aperçu du
 * document, comme celle des devis importés : c'est la seule trace du
 * numéro d'origine, et elle rend la facture reconnaissable.
 *
 * Helpers volontairement locaux : `lib/invoices/credit-notes.ts` est partagé
 * et hors périmètre de ce lot.
 */
const SOURCE_NUMBER_PATTERN = /Importé \(([^)]+)\)/;

function buildImportDescription(sourceNumber: string | null | undefined): string {
  const trimmed = (sourceNumber || '').trim();
  return trimmed ? 'Importé (' + trimmed + ')' : '';
}

function extractSourceNumber(description: string | null | undefined): string {
  if (!description) return '';
  const match = String(description).match(SOURCE_NUMBER_PATTERN);
  return match ? match[1].trim() : '';
}

function normalizeNumber(value: string | null | undefined): string {
  return (value || '').trim().toLowerCase();
}

/**
 * Comparaison tolérante de deux raisons sociales : l'OCR d'un scan ponctue et
 * capitalise rarement comme la fiche client (« SARL Dupont » / « Dupont SARL »).
 * On compare sans accents ni ponctuation, et on accepte l'inclusion — assez
 * souple pour ne pas refuser un avoir légitime, assez strict pour distinguer
 * deux clients différents.
 */
function normalizeClientName(name: string | null | undefined): string {
  return (name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function isSameClientName(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = normalizeClientName(a);
  const right = normalizeClientName(b);
  if (!left || !right) return false;
  return left === right || left.includes(right) || right.includes(left);
}

/**
 * Facture candidate au rattachement d'un avoir. Le client en fait partie : un
 * avoir ne rectifie jamais la facture d'un autre client.
 */
interface CreditTarget {
  id: string;
  client_id: string | null;
  client_name: string;
  project_id: string | null;
  invoice_type: string | null;
  status: string | null;
  /**
   * `true` quand la facture a été reconnue sur la numérotation du document
   * source (celle de l'ancien logiciel), `false` quand elle l'a été sur la
   * numérotation Hellobat — cas où l'homonymie est possible.
   */
  fromSourceNumbering: boolean;
}

interface GeoResult {
  lat: number | null;
  lng: number | null;
  city: string;
  postcode: string;
}

async function geocodeAddress(address: string, city: string, postalCode: string): Promise<GeoResult> {
  const query = [address, city, postalCode].filter(Boolean).join(' ');
  if (!query.trim()) return { lat: null, lng: null, city, postcode: postalCode };

  try {
    const url = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&limit=1`;
    const res = await fetch(url);
    if (!res.ok) return { lat: null, lng: null, city, postcode: postalCode };

    const data = await res.json();
    const feature = data.features?.[0];
    if (!feature) return { lat: null, lng: null, city, postcode: postalCode };

    const [lng, lat] = feature.geometry.coordinates;
    return {
      lat,
      lng,
      city: feature.properties.city || city,
      postcode: feature.properties.postcode || postalCode,
    };
  } catch {
    return { lat: null, lng: null, city, postcode: postalCode };
  }
}

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }
  const token = authHeader.replace('Bearer ', '').trim();

  const userClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user }, error: authError } = await userClient.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  // Resolve workspace owner
  const { data: membership } = await supabaseAdmin
    .from('workspace_memberships')
    .select('owner_user_id')
    .eq('member_user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();
  const ownerId = membership?.owner_user_id || user.id;

  let body: { items: CommitItem[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 });
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: 'Aucun élément à importer' }, { status: 400 });
  }

  if (body.items.length > 100) {
    return NextResponse.json({ error: 'Maximum 100 éléments par import' }, { status: 400 });
  }

  const created = { clients: 0, projects: 0, invoices: 0 };
  const skipped = { duplicates: 0 };
  const errors: { index: number; reason: string }[] = [];

  // Pre-fetch existing invoice numbers for duplicate detection
  const { data: existingInvoices } = await supabaseAdmin
    .from('invoices')
    .select('invoice_number')
    .eq('user_id', ownerId);

  const existingInvoiceNumbers = new Set(
    (existingInvoices || [])
      .map(function (inv) { return (inv.invoice_number || '').trim().toLowerCase(); })
      .filter(Boolean),
  );

  // Pre-fetch existing projects fingerprints (client+address+date+amount)
  const { data: existingProjects } = await supabaseAdmin
    .from('projects')
    .select('address, budget, start_date, client_id, clients(name)')
    .eq('user_id', ownerId)
    .is('deleted_at', null);

  const existingFingerprints = new Set<string>();
  if (existingProjects) {
    for (let p = 0; p < existingProjects.length; p++) {
      const proj = existingProjects[p] as Record<string, unknown>;
      const clientData = proj.clients as { name?: string } | null;
      const cName = (clientData?.name || '').trim().toLowerCase();
      const addr = ((proj.address as string) || '').trim().toLowerCase();
      const date = ((proj.start_date as string) || '').trim();
      const budget = Number(proj.budget) || 0;
      if (cName) {
        existingFingerprints.add(cName + '|' + addr + '|' + date + '|' + budget);
      }
    }
  }

  // Avoirs déjà en base, indexés par empreinte (facture rectifiée + montant +
  // date) : c'est la seule façon de reconnaître un avoir déjà importé, son
  // numéro d'origine n'étant pas conservé.
  const { data: existingCreditNotes } = await supabaseAdmin
    .from('invoices')
    .select('credited_invoice_id, total_ttc, issued_at')
    .eq('user_id', ownerId)
    .eq('invoice_type', 'avoir');

  const existingCreditNoteFingerprints = new Set(
    (existingCreditNotes || [])
      .filter(function (note) { return !!note.credited_invoice_id; })
      .map(function (note) {
        return creditNoteFingerprint(note.credited_invoice_id as string, note.total_ttc as number, note.issued_at as string | null);
      }),
  );

  // Track items in current batch to prevent intra-batch duplicates
  const batchInvoiceNums = new Set<string>();
  const batchFingerprints = new Set<string>();
  const batchCreditNoteFingerprints = new Set<string>();

  // Cache clients by normalized name to avoid duplicate lookups
  const clientCache = new Map<string, string>();

  /**
   * Client déjà connu pour ce nom — sans jamais en créer un. Sert à vérifier
   * qu'un avoir scanné porte bien sur une facture de SON client.
   */
  async function findExistingClientId(rawName: string): Promise<string | null> {
    const name = (rawName || '').trim();
    if (!name) return null;

    const cached = clientCache.get(name.toLowerCase());
    if (cached) return cached;

    const { data } = await supabaseAdmin
      .from('clients')
      .select('id')
      .eq('user_id', ownerId)
      .ilike('name', name)
      .is('deleted_at', null)
      .maybeSingle();

    if (!data?.id) return null;
    clientCache.set(name.toLowerCase(), data.id as string);
    return data.id as string;
  }

  // Factures rattachables, indexées d'une part sur la numérotation du document
  // SOURCE (conservée dans `description`), d'autre part sur celle de Hellobat.
  // On ne paie ces index que si le lot contient au moins un avoir.
  const hasCreditNoteItems = body.items.some(isCreditNoteImportItem);
  const targetBySourceNumber = new Map<string, CreditTarget>();
  const targetByInvoiceNumber = new Map<string, CreditTarget>();
  // Numéro source → facture insérée pendant CE lot, pour qu'un avoir scanné en
  // même temps que sa facture puisse la rectifier.
  const importedBySourceNumber = new Map<string, CreditTarget>();

  if (hasCreditNoteItems) {
    const { data: creditCandidates } = await supabaseAdmin
      .from('invoices')
      .select('id, invoice_number, invoice_type, status, client_id, project_id, description, clients(name)')
      .eq('user_id', ownerId);

    for (const row of creditCandidates || []) {
      const invRow = row as Record<string, unknown>;
      const clientData = invRow.clients as { name?: string } | null;
      const base = {
        id: invRow.id as string,
        client_id: (invRow.client_id as string | null) || null,
        client_name: clientData?.name || '',
        project_id: (invRow.project_id as string | null) || null,
        invoice_type: (invRow.invoice_type as string | null) || null,
        status: (invRow.status as string | null) || null,
      };

      const sourceNumber = normalizeNumber(extractSourceNumber(invRow.description as string | null));
      if (sourceNumber) {
        targetBySourceNumber.set(sourceNumber, { ...base, fromSourceNumbering: true });
      }
      const hellobatNumber = normalizeNumber(invRow.invoice_number as string | null);
      if (hellobatNumber) {
        targetByInvoiceNumber.set(hellobatNumber, { ...base, fromSourceNumbering: false });
      }
    }
  }

  // Les avoirs passent en dernier : un avoir doit pouvoir rectifier une facture
  // déposée dans le MÊME lot, qui n'existe qu'une fois insérée. Le tri est
  // stable, donc l'ordre d'un lot sans avoir reste strictement inchangé.
  const processingOrder = body.items
    .map(function (_item, index) { return index; })
    .sort(function (a, b) {
      return Number(isCreditNoteImportItem(body.items[a])) - Number(isCreditNoteImportItem(body.items[b]));
    });

  for (const i of processingOrder) {
    const item = body.items[i];

    try {
      // 0. Duplicate detection (server-side guard)
      const invoiceNum = (item.invoice_number || '').trim().toLowerCase();
      if (invoiceNum) {
        if (existingInvoiceNumbers.has(invoiceNum) || batchInvoiceNums.has(invoiceNum)) {
          errors.push({ index: i, reason: 'Doublon : facture n°' + item.invoice_number + ' déjà existante' });
          skipped.duplicates++;
          continue;
        }
        batchInvoiceNums.add(invoiceNum);
      }

      const clientNameNorm = (item.client_name || '').trim().toLowerCase();
      if (clientNameNorm) {
        const fp = clientNameNorm + '|' + (item.client_address || '').trim().toLowerCase() + '|' + (item.invoice_date || '').trim() + '|' + (item.amount_ttc || 0);
        if (existingFingerprints.has(fp) || batchFingerprints.has(fp)) {
          errors.push({ index: i, reason: 'Doublon : chantier similaire déjà existant pour ' + item.client_name });
          skipped.duplicates++;
          continue;
        }
        batchFingerprints.add(fp);
      }

      // 0 bis. Avoir : résoudre la facture rectifiée AVANT tout effet de bord.
      //
      // Un avoir est une facture rectificative (art. 289 CGI) : la base impose
      // `credited_invoice_id` non nul, pointant sur une facture émise du même
      // compte. Si on ne sait pas à quelle facture le rattacher, l'insertion
      // violerait la contrainte — autant refuser proprement la ligne ici,
      // avant d'avoir créé un client ou un chantier pour rien.
      const isAvoir = isCreditNoteImportItem(item);
      let creditedInvoice: { id: string; client_id: string | null; project_id: string | null } | null = null;
      // Montants de l'avoir, dérivés et contrôlés avant toute insertion.
      let creditPlan: { ht: number; tva: number; ttc: number; rate: number; issuedAt: string } | null = null;

      if (isAvoir) {
        if (!item.create_invoice) {
          errors.push({
            index: i,
            reason: 'Avoir : rien à créer sans la création des factures — un avoir ne crée ni client ni chantier. Activez la création des factures.',
          });
          continue;
        }

        if (!item.amount_ht && !item.amount_ttc) {
          errors.push({
            index: i,
            reason: 'Avoir : montant illisible sur le document (0 €). Créez-le manuellement depuis la facture concernée.',
          });
          continue;
        }

        const creditedNumber = (item.credited_invoice_number || '').trim();
        if (!creditedNumber) {
          errors.push({
            index: i,
            reason: 'Avoir : le numéro de la facture rectifiée est absent du document. Créez l\'avoir depuis la facture concernée.',
          });
          continue;
        }

        // Résolution sur la numérotation du document SOURCE d'abord : celle du
        // même lot, puis celle des factures déjà importées. La numérotation
        // Hellobat n'arrive qu'en dernier recours — elle partage le gabarit
        // « F-YYYY-NNN » avec celle de l'ancien logiciel, et un simple homonyme
        // rattacherait l'avoir à la facture d'un tiers.
        const creditedKey = normalizeNumber(creditedNumber);
        const target =
          importedBySourceNumber.get(creditedKey)
          || targetBySourceNumber.get(creditedKey)
          || targetByInvoiceNumber.get(creditedKey)
          || null;

        if (!target) {
          errors.push({
            index: i,
            reason: 'Avoir : la facture rectifiée « ' + creditedNumber + ' » est introuvable dans votre compte. Importez-la d\'abord.',
          });
          continue;
        }

        if (target.invoice_type === 'avoir') {
          errors.push({
            index: i,
            reason: 'Avoir : « ' + creditedNumber + ' » est déjà un avoir, un avoir ne peut pas en rectifier un autre.',
          });
          continue;
        }

        if (!(CREDITABLE_STATUSES as readonly string[]).includes(target.status || '')) {
          errors.push({
            index: i,
            reason: 'Avoir : la facture « ' + creditedNumber + ' » n\'est pas émise (statut ' + (target.status || 'inconnu') + '). Une facture en brouillon se corrige directement, sans avoir.',
          });
          continue;
        }

        // Contrôle du client. Le numéro de la facture rectifiée est lu sur un
        // document de l'ANCIEN logiciel de l'artisan : rattacher sur ce seul
        // numéro crédite la facture d'un homonyme, dont le net dû, la relance
        // et le chiffre d'affaires se retrouvent amputés — pendant que le vrai
        // client n'a jamais son avoir. On exige donc que le client lu sur le
        // document soit celui de la facture rectifiée, et on ne remplace jamais
        // silencieusement l'un par l'autre.
        const scannedClientName = (item.client_name || '').trim();
        const scannedClientId = await findExistingClientId(scannedClientName);
        const clientConfirmed =
          (!!scannedClientId && scannedClientId === target.client_id)
          || isSameClientName(scannedClientName, target.client_name);

        // Une facture sans client rattaché n'appartient à personne d'autre :
        // on l'accepte quand elle a été reconnue sur la numérotation source,
        // jamais sur un simple homonyme de la numérotation Hellobat.
        const sameClient =
          clientConfirmed || (!target.client_id && target.fromSourceNumbering);

        if (!sameClient) {
          errors.push({
            index: i,
            reason: 'Avoir : le document est au nom de « ' + (scannedClientName || 'client illisible')
              + ' » alors que la facture « ' + creditedNumber + ' » est au nom de « '
              + (target.client_name || 'un autre client')
              + ' ». Créez l\'avoir depuis la facture concernée.',
          });
          continue;
        }

        creditedInvoice = { id: target.id, client_id: target.client_id, project_id: target.project_id };

        // Montants : beaucoup d'avoirs n'affichent qu'un TTC (« Montant à
        // votre crédit : 550 € TTC »), l'IA renvoie alors 0 en HT. Recopier
        // les deux champs tels quels donnerait total_tva = tout le TTC, donc
        // 500 € de TVA réclamés à tort à l'administration. On dérive donc le
        // montant manquant depuis le taux, et on refuse la ligne si le couple
        // reste incohérent plutôt que de laisser la base la rejeter avec un
        // message Postgres en anglais.
        // `|| 20` serait faux sur un document exonéré de TVA (taux 0) : on ne
        // retombe sur 20 % que si le champ est réellement absent ou illisible.
        const rawRate = Number(item.tva_rate);
        const tvaRate = Number.isFinite(rawRate) ? Math.max(0, rawRate) : 20;
        let amountHt = Math.abs(num(item.amount_ht));
        let amountTtc = Math.abs(num(item.amount_ttc));

        if (!amountTtc && amountHt) amountTtc = round2(amountHt * (1 + tvaRate / 100));
        if (!amountHt && amountTtc) amountHt = round2(amountTtc / (1 + tvaRate / 100));

        const amountTva = round2(amountTtc - amountHt);

        if (amountTva < -0.01) {
          errors.push({
            index: i,
            reason: 'Avoir : montants incohérents sur le document (HT supérieur au TTC). Vérifiez le HT et le TTC, ou créez l\'avoir depuis la facture concernée.',
          });
          continue;
        }

        if (amountTva > amountHt + 0.01) {
          errors.push({
            index: i,
            reason: 'Avoir : TVA illisible sur le document (elle dépasserait le montant HT). Corrigez le HT ou le taux de TVA, ou créez l\'avoir depuis la facture concernée.',
          });
          continue;
        }

        const creditIssuedAt = item.invoice_date || new Date().toISOString();

        // Doublon d'avoir : même facture rectifiée, même montant, même date.
        const creditFingerprint = creditNoteFingerprint(creditedInvoice.id, amountTtc, creditIssuedAt);
        if (
          existingCreditNoteFingerprints.has(creditFingerprint)
          || batchCreditNoteFingerprints.has(creditFingerprint)
        ) {
          errors.push({
            index: i,
            reason: 'Doublon : un avoir du même montant et de la même date existe déjà sur la facture « ' + creditedNumber + ' ». Il n\'a pas été réimporté pour ne pas la créditer deux fois.',
          });
          skipped.duplicates++;
          continue;
        }
        batchCreditNoteFingerprints.add(creditFingerprint);

        creditPlan = {
          ht: -amountHt,
          tva: -Math.max(0, amountTva),
          ttc: -amountTtc,
          rate: tvaRate,
          issuedAt: creditIssuedAt,
        };
      }

      // 1. Client lookup/creation
      const normalizedName = (item.client_name || '').trim();
      let clientId: string | undefined;

      // Un avoir se rattache au client de la facture rectifiée. Ce n'est plus
      // un remplacement silencieux : le contrôle ci-dessus a vérifié que c'est
      // bien le client lu sur le document. Reprendre son identifiant évite de
      // fabriquer un doublon à partir d'un nom mal orthographié par l'OCR.
      if (creditedInvoice?.client_id) {
        clientId = creditedInvoice.client_id;
      } else if (!normalizedName) {
        errors.push({ index: i, reason: 'Nom du client manquant' });
        continue;
      } else {
        clientId = clientCache.get(normalizedName.toLowerCase());
      }

      if (!clientId) {
        // Lookup existing client
        const { data: existing } = await supabaseAdmin
          .from('clients')
          .select('id')
          .eq('user_id', ownerId)
          .ilike('name', normalizedName)
          .is('deleted_at', null)
          .maybeSingle();

        if (existing) {
          clientId = existing.id;
        } else {
          // Create new client
          const { data: newClient, error: clientErr } = await supabaseAdmin
            .from('clients')
            .insert({
              user_id: ownerId,
              name: normalizedName,
              address: item.client_address,
              city: item.client_city,
              postal_code: item.client_postal_code,
              contact_type: 'client',
            })
            .select('id')
            .single();

          if (clientErr || !newClient) {
            errors.push({ index: i, reason: 'Erreur création client : ' + (clientErr?.message || 'inconnu') });
            continue;
          }
          clientId = newClient.id;
          created.clients++;
        }

        clientCache.set(normalizedName.toLowerCase(), clientId!);
      }

      // 2. Geocode address — inutile pour un avoir, qui ne crée aucun chantier
      const geo = isAvoir
        ? { lat: null, lng: null, city: item.client_city, postcode: item.client_postal_code }
        : await geocodeAddress(item.client_address, item.client_city, item.client_postal_code);

      // 3. Create project (skip for deposits — they belong to an existing project)
      const projectName = item.description || 'Chantier importé';
      const isDeposit = /\b(acompte|accompte|solde)\b/i.test(projectName);

      let project: { id: string } | null = null;

      // Un avoir ne crée jamais de chantier : il rectifie une facture qui a
      // déjà le sien. On reprend le chantier de la facture rectifiée quand
      // elle en a un, pour que l'avoir reste dans le même dossier.
      if (isAvoir) {
        project = creditedInvoice?.project_id ? { id: creditedInvoice.project_id } : null;
      } else if (isDeposit && clientId) {
        // For deposits, try to find an existing project for the same client
        const { data: existingProject } = await supabaseAdmin
          .from('projects')
          .select('id')
          .eq('user_id', ownerId)
          .eq('client_id', clientId)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existingProject) {
          project = existingProject;
        }
        // If no existing project found for a deposit, leave project_id null
        // — never create a chantier for a deposit invoice
      }

      if (!project && !isDeposit && !isAvoir) {
        const { data: newProject, error: projectErr } = await supabaseAdmin
          .from('projects')
          .insert({
            user_id: ownerId,
            name: projectName,
            client_id: clientId,
            address: item.client_address,
            city: geo.city || item.client_city,
            postal_code: geo.postcode || item.client_postal_code,
            lat: geo.lat,
            lng: geo.lng,
            status: 'termine',
            progress: 100,
            budget: item.amount_ttc || 0,
            start_date: item.invoice_date || null,
            end_date: item.invoice_date || null,
            notes: item.invoice_number ? 'Importé depuis facture ' + item.invoice_number : 'Importé depuis facture',
            is_public: true,
            published_at: new Date().toISOString(),
          })
          .select('id')
          .single();

        if (projectErr || !newProject) {
          errors.push({ index: i, reason: 'Erreur création chantier : ' + (projectErr?.message || 'inconnu') });
          continue;
        }
        project = newProject;
        created.projects++;
      }

      if (!project && !isDeposit && !isAvoir) {
        errors.push({ index: i, reason: 'Erreur création chantier' });
        continue;
      }

      // 4 bis. Avoir : facture rectificative, série AV- dédiée, montants
      // négatifs, jamais encaissable (ni échéance, ni date de paiement, ni
      // statut « payée »). La référence à la facture rectifiée est une
      // mention légale obligatoire, portée par credited_invoice_id.
      if (isAvoir && creditedInvoice && creditPlan) {
        const creditNoteNumber = await getNextCreditNoteNumber(supabaseAdmin, ownerId);

        const { error: creditErr } = await supabaseAdmin
          .from('invoices')
          .insert({
            user_id: ownerId,
            invoice_number: creditNoteNumber,
            invoice_type: 'avoir',
            credited_invoice_id: creditedInvoice.id,
            // Un scan ne permet pas de qualifier le motif de façon fiable :
            // on marque « autre », l'artisan le précise depuis l'avoir.
            credit_reason: 'autre',
            client_id: clientId,
            project_id: project?.id || null,
            title: item.description || 'Avoir importé',
            status: 'envoyee',
            total_ht: creditPlan.ht,
            total_tva: creditPlan.tva,
            tva_rate: creditPlan.rate,
            total_ttc: creditPlan.ttc,
            issued_at: creditPlan.issuedAt,
            due_date: null,
            paid_at: null,
          });

        if (creditErr) {
          errors.push({
            index: i,
            reason: 'Avoir : création impossible (' + (creditErr.message || 'erreur inconnue') + ')',
          });
          continue;
        }

        created.invoices++;
        continue;
      }

      // Garde-fou : un avoir ne doit JAMAIS retomber dans le chemin « facture
      // standard ». Il partirait en invoice_type 'standard' avec des montants
      // négatifs, rejeté par invoices_non_avoir_positive_amounts — ou, pire,
      // enregistré comme une facture normale réclamant de l'argent au client.
      if (isAvoir) {
        errors.push({
          index: i,
          reason: 'Avoir : import impossible, la facture rectifiée n\'a pas pu être déterminée. Créez l\'avoir depuis la facture concernée.',
        });
        continue;
      }

      // 4. Optionally create invoice
      if (item.create_invoice) {
        // Generate next invoice number.
        // Les avoirs sont exclus : ils vivent dans la même table mais dans une
        // série AV- distincte. Sans ce filtre, un avoir récemment créé ferait
        // sauter le compteur des factures (AV-2026-007 -> F-2026-008).
        const { data: lastInvoice } = await supabaseAdmin
          .from('invoices')
          .select('invoice_number')
          .eq('user_id', ownerId)
          .neq('invoice_type', 'avoir')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const year = new Date().getFullYear();
        let nextNum = 1;
        if (lastInvoice?.invoice_number) {
          const match = lastInvoice.invoice_number.match(/(\d+)$/);
          if (match) nextNum = parseInt(match[1], 10) + 1;
        }
        const invoiceNumber = `F-${year}-${String(nextNum).padStart(3, '0')}`;

        const { data: insertedInvoice, error: invoiceErr } = await supabaseAdmin
          .from('invoices')
          .insert({
            user_id: ownerId,
            invoice_number: invoiceNumber,
            client_id: clientId,
            project_id: project?.id || null,
            title: item.description || 'Facture importée',
            // Numéro lu sur le document : c'est lui qu'un avoir scanné
            // référence, ici ou lors d'un import ultérieur.
            description: buildImportDescription(item.invoice_number),
            status: 'payee',
            total_ht: item.amount_ht || 0,
            tva_rate: item.tva_rate || 20,
            total_ttc: item.amount_ttc || 0,
            issued_at: item.invoice_date || new Date().toISOString(),
            due_date: item.invoice_date || new Date().toISOString().split('T')[0],
            paid_at: item.invoice_date || new Date().toISOString(),
          })
          .select('id')
          .single();

        if (!invoiceErr) {
          created.invoices++;

          const sourceNumber = normalizeNumber(item.invoice_number);
          if (insertedInvoice?.id && sourceNumber) {
            importedBySourceNumber.set(sourceNumber, {
              id: insertedInvoice.id as string,
              client_id: clientId || null,
              client_name: normalizedName,
              project_id: project?.id || null,
              invoice_type: 'standard',
              status: 'payee',
              fromSourceNumbering: true,
            });
          }
        }
      }
    } catch (e) {
      errors.push({ index: i, reason: e instanceof Error ? e.message : 'Erreur interne' });
    }
  }

  return NextResponse.json({ created, skipped, errors });
}
