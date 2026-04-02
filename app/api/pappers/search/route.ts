import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

interface PappersResult {
  siren: string;
  nom_entreprise: string;
  denomination?: string;
  nom?: string;
  prenom?: string;
  siege: {
    adresse_ligne_1?: string;
    code_postal?: string;
    ville?: string;
  };
  code_naf?: string;
  libelle_code_naf?: string;
  forme_juridique?: string;
}

export async function GET(request: Request) {
  const apiKey = process.env.PAPPERS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'PAPPERS_API_KEY manquante' }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');

  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    const url = `https://api.pappers.fr/v2/recherche?api_token=${encodeURIComponent(apiKey)}&q=${encodeURIComponent(q)}&par_page=5&precision=standard`;
    const res = await fetch(url, { cache: 'no-store' });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: `Pappers: ${res.status} - ${text}` }, { status: res.status });
    }

    const data = await res.json();
    const results = (data.resultats || []).map((r: PappersResult) => ({
      siren: r.siren,
      name: r.nom_entreprise || r.denomination || [r.prenom, r.nom].filter(Boolean).join(' '),
      address: r.siege?.adresse_ligne_1 || '',
      postal_code: r.siege?.code_postal || '',
      city: r.siege?.ville || '',
      naf_code: r.code_naf || '',
      naf_label: r.libelle_code_naf || '',
      legal_form: r.forme_juridique || '',
    }));

    return NextResponse.json({ results });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erreur Pappers';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
