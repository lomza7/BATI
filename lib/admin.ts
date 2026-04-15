import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

export async function isAdminUser(sb: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await sb
    .from('profiles')
    .select('is_admin')
    .eq('id', userId)
    .maybeSingle();
  return Boolean(data?.is_admin);
}

/**
 * Pour les routes API admin : vérifie le Bearer token + que l'user est admin.
 * Retourne l'user si OK, null sinon.
 */
export async function verifyAdminRequest(request: Request): Promise<User | null> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return null;

  const userClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return null;

  const admin = await isAdminUser(userClient, user.id);
  if (!admin) return null;

  return user;
}
