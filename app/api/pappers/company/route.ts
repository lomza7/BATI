import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });
  }
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });

  const apiKey = process.env.PAPPERS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'PAPPERS_API_KEY manquante' }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const siren = searchParams.get('siren');

  if (!siren) {
    return NextResponse.json({ error: 'siren requis' }, { status: 400 });
  }

  try {
    const url = `https://api.pappers.fr/v2/entreprise?api_token=${encodeURIComponent(apiKey)}&siren=${encodeURIComponent(siren)}`;
    const res = await fetch(url);

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: `Pappers: ${res.status} - ${text}` }, { status: res.status });
    }

    const r = await res.json();

    // Extract the max amount of useful info
    const dirigeant = r.representants?.[0] || {};
    const siege = r.siege || {};

    return NextResponse.json({
      siren: r.siren || '',
      siret: siege.siret || r.siret_siege || '',
      name: r.nom_entreprise || r.denomination || '',
      legal_form: r.forme_juridique || '',
      naf_code: r.code_naf || '',
      naf_label: r.libelle_code_naf || '',
      creation_date: r.date_creation || '',
      capital: r.capital || null,
      effectif: r.effectif || r.tranche_effectif || '',
      tva_number: r.numero_tva_intracommunautaire || '',
      address: siege.adresse_ligne_1 || '',
      postal_code: siege.code_postal || '',
      city: siege.ville || '',
      country: siege.pays || 'France',
      dirigeant_name: [dirigeant.prenom, dirigeant.nom].filter(Boolean).join(' ') || '',
      dirigeant_role: dirigeant.qualite || '',
      phone: siege.telephone || '',
      website: r.site_web || '',
      rcs: r.numero_rcs || '',
      statut: r.statut_rcs || '',
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erreur Pappers';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
