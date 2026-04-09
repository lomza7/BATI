import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Session utilisateur requise' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: 'Configuration Supabase manquante' }, { status: 503 });
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: 'Utilisateur non authentifie' }, { status: 401 });
  }

  // 1. Collect demo files' storage paths so we can delete them from Storage
  const { data: demoFiles } = await supabaseAdmin
    .from('document_files')
    .select('storage_bucket, storage_path')
    .eq('user_id', user.id)
    .eq('is_demo', true);

  if (demoFiles && demoFiles.length > 0) {
    // Group by bucket (should only be "documents" but stay safe)
    const byBucket = demoFiles.reduce<Record<string, string[]>>((acc, f) => {
      if (!acc[f.storage_bucket]) acc[f.storage_bucket] = [];
      acc[f.storage_bucket].push(f.storage_path);
      return acc;
    }, {});

    for (const [bucket, paths] of Object.entries(byBucket)) {
      await supabaseAdmin.storage.from(bucket).remove(paths);
    }
  }

  // 2. Delete all demo rows via SQL function
  const { error: rpcError } = await supabaseAdmin.rpc('clear_demo_data_for_user', {
    p_user_id: user.id,
  });

  if (rpcError) {
    console.error('[api/demo/clear] RPC error:', {
      message: rpcError.message,
      details: rpcError.details,
      hint: rpcError.hint,
      code: rpcError.code,
    });
    return NextResponse.json(
      {
        error: rpcError.message,
        details: rpcError.details,
        hint: rpcError.hint,
        code: rpcError.code,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
