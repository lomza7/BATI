import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase-admin';

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

  // Track items in current batch to prevent intra-batch duplicates
  const batchInvoiceNums = new Set<string>();
  const batchFingerprints = new Set<string>();

  // Cache clients by normalized name to avoid duplicate lookups
  const clientCache = new Map<string, string>();

  for (let i = 0; i < body.items.length; i++) {
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

      // 1. Client lookup/creation
      const normalizedName = item.client_name.trim();
      if (!normalizedName) {
        errors.push({ index: i, reason: 'Nom du client manquant' });
        continue;
      }

      let clientId = clientCache.get(normalizedName.toLowerCase());

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

      // 2. Geocode address
      const geo = await geocodeAddress(item.client_address, item.client_city, item.client_postal_code);

      // 3. Create project
      const projectName = item.description || 'Chantier importé';
      const { data: project, error: projectErr } = await supabaseAdmin
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

      if (projectErr || !project) {
        errors.push({ index: i, reason: 'Erreur création chantier : ' + (projectErr?.message || 'inconnu') });
        continue;
      }
      created.projects++;

      // 4. Optionally create invoice
      if (item.create_invoice) {
        // Generate next invoice number
        const { data: lastInvoice } = await supabaseAdmin
          .from('invoices')
          .select('invoice_number')
          .eq('user_id', ownerId)
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

        const { error: invoiceErr } = await supabaseAdmin
          .from('invoices')
          .insert({
            user_id: ownerId,
            invoice_number: invoiceNumber,
            client_id: clientId,
            project_id: project.id,
            title: item.description || 'Facture importée',
            status: 'payee',
            total_ht: item.amount_ht || 0,
            tva_rate: item.tva_rate || 20,
            total_ttc: item.amount_ttc || 0,
            issued_at: item.invoice_date || new Date().toISOString(),
            due_date: item.invoice_date || new Date().toISOString().split('T')[0],
            paid_at: item.invoice_date || new Date().toISOString(),
          });

        if (!invoiceErr) {
          created.invoices++;
        }
      }
    } catch (e) {
      errors.push({ index: i, reason: e instanceof Error ? e.message : 'Erreur interne' });
    }
  }

  return NextResponse.json({ created, skipped, errors });
}
