import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const ADMIN_EMAIL = 'louis@maaza.pro';

// Buckets dont les objets sont range's sous le prefixe `{user_id}/`
const USER_SCOPED_BUCKETS = [
  'documents',
  'logos',
  'project-photos',
  'receipts',
  'catalog-images',
  'bank-statements',
  'site-assets',
];

async function verifyAdmin(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return null;

  const userClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: { user } } = await userClient.auth.getUser();
  if (!user || user.email !== ADMIN_EMAIL) return null;
  return user;
}

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

/**
 * DELETE /api/admin/delete-user
 * Body: { user_id: string, confirm_email: string }
 *
 * Supprime totalement un utilisateur :
 *  1. Nettoie les objets de stockage sous le prefixe `{user_id}/` dans les buckets user-scoped.
 *  2. Supprime l'utilisateur auth via l'admin API — toutes les tables publiques cascadent
 *     depuis `profiles.id` (ON DELETE CASCADE) donc aucune donnee metier ne reste.
 *
 * Apres cette operation, l'adresse email est libre et peut etre reutilisee pour un nouveau compte.
 */
export async function DELETE(request: Request) {
  const admin = await verifyAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });
  }

  let body: { user_id?: string; confirm_email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requete invalide' }, { status: 400 });
  }

  const userId = body.user_id?.trim();
  const confirmEmail = body.confirm_email?.trim().toLowerCase();

  if (!userId) {
    return NextResponse.json({ error: 'user_id manquant' }, { status: 400 });
  }
  if (!confirmEmail) {
    return NextResponse.json({ error: 'confirm_email manquant' }, { status: 400 });
  }

  const sb = getAdminClient();

  // Verifier que l'utilisateur cible existe et recuperer son email
  const { data: targetData, error: fetchError } = await sb.auth.admin.getUserById(userId);
  if (fetchError || !targetData?.user) {
    return NextResponse.json(
      { error: 'Utilisateur introuvable' },
      { status: 404 }
    );
  }

  const targetEmail = targetData.user.email?.toLowerCase() || '';

  // Empecher la suppression du compte admin
  if (targetEmail === ADMIN_EMAIL.toLowerCase()) {
    return NextResponse.json(
      { error: "Impossible de supprimer le compte administrateur" },
      { status: 403 }
    );
  }

  // Double confirmation via email saisi par l'admin
  if (targetEmail !== confirmEmail) {
    return NextResponse.json(
      { error: "L'email de confirmation ne correspond pas" },
      { status: 400 }
    );
  }

  // 1. Supprimer les objets de stockage user-scoped
  const storageErrors: string[] = [];
  for (const bucket of USER_SCOPED_BUCKETS) {
    try {
      const { data: files } = await sb.storage.from(bucket).list(userId, {
        limit: 1000,
      });
      if (!files || files.length === 0) continue;

      // Lister aussi les sous-dossiers recursivement (un seul niveau suffit pour la plupart,
      // mais on fait une passe sur les sous-dossiers eventuels)
      const paths: string[] = [];
      for (const f of files) {
        if (f.id === null) {
          // C'est un dossier — lister son contenu
          const { data: sub } = await sb.storage
            .from(bucket)
            .list(`${userId}/${f.name}`, { limit: 1000 });
          for (const s of sub || []) {
            if (s.id !== null) paths.push(`${userId}/${f.name}/${s.name}`);
          }
        } else {
          paths.push(`${userId}/${f.name}`);
        }
      }

      if (paths.length > 0) {
        const { error: removeError } = await sb.storage.from(bucket).remove(paths);
        if (removeError) storageErrors.push(`${bucket}: ${removeError.message}`);
      }
    } catch (e) {
      storageErrors.push(
        `${bucket}: ${e instanceof Error ? e.message : 'erreur inconnue'}`
      );
    }
  }

  // 2. Supprimer l'utilisateur auth (cascade via profiles.id → toutes les tables publiques)
  const { error: deleteError } = await sb.auth.admin.deleteUser(userId);
  if (deleteError) {
    return NextResponse.json(
      {
        error: `Erreur lors de la suppression de l'utilisateur : ${deleteError.message}`,
        storage_errors: storageErrors,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    deleted_user_id: userId,
    deleted_email: targetEmail,
    storage_errors: storageErrors,
  });
}
