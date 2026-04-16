import { supabase } from '@/lib/supabase';

export function normalizeTitle(title: string): string {
  return title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

export async function lookupPrestationDetail(title: string): Promise<string | null> {
  const norm = normalizeTitle(title);
  if (!norm) return null;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('prestation_details')
    .select('detail')
    .eq('user_id', user.id)
    .eq('title_norm', norm)
    .maybeSingle();

  return data?.detail ?? null;
}

export async function savePrestationDetail(title: string, detail: string): Promise<void> {
  const norm = normalizeTitle(title);
  const trimmedTitle = title.trim();
  const trimmedDetail = detail.trim();
  if (!norm || !trimmedTitle || !trimmedDetail) return;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from('prestation_details')
    .upsert(
      {
        user_id: user.id,
        title_norm: norm,
        title: trimmedTitle,
        detail: trimmedDetail,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,title_norm' }
    );
}
