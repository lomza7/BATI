import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { docusealFetch } from '@/lib/docuseal';
import { buildContractHtml } from '@/lib/contract-template';

export const runtime = 'nodejs';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) return NextResponse.json({ error: 'Config serveur' }, { status: 503 });
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Si déjà signé, renvoyer le PDF signé stocké (via quote_sends)
    const { data: signedSend } = await admin
      .from('quote_sends')
      .select('docuseal_signed_document_url, signed_at')
      .eq('recurring_contract_id', params.id)
      .eq('user_id', user.id)
      .not('signed_at', 'is', null)
      .order('signed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (signedSend?.docuseal_signed_document_url) {
      return NextResponse.json({ url: signedSend.docuseal_signed_document_url, signed: true });
    }

    // Sinon, regenerer le PDF non signe via DocuSeal
    const [contractRes, profileRes] = await Promise.all([
      admin.from('recurring_contracts').select('*, clients(*)').eq('id', params.id).eq('user_id', user.id).single(),
      admin.from('profiles').select('company_name, full_name, siret, company_address, company_postal_code, company_city, company_phone, tva_number, logo_url, document_config').eq('id', user.id).single(),
    ]);
    if (contractRes.error || !contractRes.data) {
      return NextResponse.json({ error: 'Contrat introuvable' }, { status: 404 });
    }

    const contract = contractRes.data;
    const cl = contract.clients || {};
    const artisanRaw = profileRes.data || { company_name: 'Artisan' };
    const amountHt = Number(contract.amount) || 0;
    const tvaRate = 20;
    const amountTva = +(amountHt * (tvaRate / 100)).toFixed(2);
    const amountTtc = +(amountHt + amountTva).toFixed(2);

    const html = buildContractHtml(
      {
        contract_number: contract.contract_number || `CONTRAT-${contract.id.slice(0, 8)}`,
        title: contract.title || '',
        category_key: contract.category_key || 'autre',
        client_type: contract.client_type || 'b2c',
        contract_channel: contract.contract_channel || 'sur_site',
        duration_mode: contract.duration_mode || 'determinee',
        initial_term_months: Number(contract.initial_term_months) || 12,
        renewal_term_months: Number(contract.renewal_term_months) || 12,
        auto_renewal: contract.auto_renewal !== false,
        notice_period_months: Number(contract.notice_period_months) || 2,
        frequency: contract.frequency || 'mensuel',
        visits_per_year: Number(contract.visits_per_year) || 1,
        weather_dependent: Boolean(contract.weather_dependent),
        site_address: contract.site_address || '',
        site_access_notes: contract.site_access_notes || '',
        included_operations: Array.isArray(contract.included_operations) ? contract.included_operations : [],
        excluded_operations: Array.isArray(contract.excluded_operations) ? contract.excluded_operations : [],
        intervention_hours: contract.intervention_hours || 'Du lundi au vendredi, 8h-18h',
        emergency_phone: contract.emergency_phone || '',
        response_time: contract.response_time || '48h ouvrees',
        payment_method: contract.payment_method || 'virement',
        payment_timing: contract.payment_timing || 'terme_echu',
        payment_terms_days: Number(contract.payment_terms_days) || 30,
        late_penalty_rate: Number(contract.late_penalty_rate) || 10,
        recovery_fee: Number(contract.recovery_fee) || 40,
        breach_cure_period_days: Number(contract.breach_cure_period_days) || 30,
        amount_ht: amountHt,
        amount_tva: amountTva,
        amount_ttc: amountTtc,
        tva_rate: tvaRate,
        start_date: contract.start_date || new Date().toISOString(),
        end_date: contract.end_date,
        created_at: contract.created_at,
      },
      {
        name: cl.name || 'Client',
        email: cl.email || '',
        phone: cl.phone || '',
        address: cl.address || '',
        postal_code: cl.postal_code || '',
        city: cl.city || '',
      },
      artisanRaw as Parameters<typeof buildContractHtml>[2],
    );

    interface DocuSealTemplate { id: number; documents?: { url: string }[] }
    const template = await docusealFetch<DocuSealTemplate>('/templates/html', {
      method: 'POST',
      body: { html, name: `Aperçu contrat ${contract.contract_number || contract.id.slice(0, 8)}` },
    });

    const url = template.documents?.[0]?.url;
    if (!url) return NextResponse.json({ error: 'Erreur génération PDF' }, { status: 502 });

    return NextResponse.json({ url, signed: false });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
