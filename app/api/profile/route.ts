import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const patchSchema = z.object({
  siret: z.string().max(14).nullable().optional(),
  insurance_decennale_number: z.string().max(50).nullable().optional(),
  insurance_decennale_company: z.string().max(100).nullable().optional(),
  insurance_decennale_expiry: z.string().nullable().optional(),
  rge_number: z.string().max(50).nullable().optional(),
  rge_valid_until: z.string().nullable().optional(),
  is_auto_entrepreneur: z.boolean().optional(),
  tva_number: z.string().max(20).nullable().optional(),
});

function getSupabaseUserClient(authHeader: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader } } }
  );
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  }

  const userClient = getSupabaseUserClient(authHeader);
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  }

  const { data, error } = await userClient
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: 'Erreur lors de la récupération du profil.' }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function PATCH(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  }

  const userClient = getSupabaseUserClient(authHeader);
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Données invalides.', details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const updates: Record<string, unknown> = { ...parsed.data, updated_at: new Date().toISOString() };

  // Récupère le profil actuel pour calculer onboarding_completed
  const { data: current } = await userClient
    .from('profiles')
    .select('siret, insurance_decennale_number, insurance_decennale_company, onboarding_completed')
    .eq('id', user.id)
    .maybeSingle();

  const effectiveSiret = 'siret' in updates ? updates.siret : current?.siret;
  const effectiveInsuranceNumber = 'insurance_decennale_number' in updates
    ? updates.insurance_decennale_number
    : current?.insurance_decennale_number;
  const effectiveInsuranceCompany = 'insurance_decennale_company' in updates
    ? updates.insurance_decennale_company
    : current?.insurance_decennale_company;

  if (effectiveSiret && effectiveInsuranceNumber && effectiveInsuranceCompany) {
    updates.onboarding_completed = true;
  }

  const { data, error } = await userClient
    .from('profiles')
    .update(updates)
    .eq('id', user.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: 'Erreur lors de la mise à jour du profil.' }, { status: 500 });
  }

  return NextResponse.json(data);
}
