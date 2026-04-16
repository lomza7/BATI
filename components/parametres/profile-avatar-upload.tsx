'use client';

import { useRef, useState } from 'react';
import { Camera, Loader2, Trash2, User as UserIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';

const BUCKET = 'avatars';
const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT_MIME = new Set<string>([
  'image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'image/heic',
]);

interface ProfileAvatarUploadProps {
  avatarUrl: string;
  fullName?: string;
  onChange: (url: string) => void;
}

function initials(name: string | undefined, fallback: string): string {
  const source = (name || fallback || '').trim();
  if (!source) return '?';
  const parts = source.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || source[0]!.toUpperCase();
}

export function ProfileAvatarUpload({ avatarUrl, fullName, onChange }: ProfileAvatarUploadProps) {
  const { user, refreshProfile } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | null) {
    if (!file || !user) return;
    setError(null);

    if (file.size > MAX_BYTES) {
      setError('Image trop lourde (max 5 Mo).');
      return;
    }
    if (!ACCEPT_MIME.has(file.type)) {
      setError('Format non supporté. Utilisez PNG, JPG, WebP, GIF ou HEIC.');
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      const path = `${user.id}/avatar.${ext}`;

      // Upsert remplace l'éventuel ancien fichier au même path.
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
        cacheControl: '3600',
        upsert: true,
        contentType: file.type,
      });
      if (upErr) {
        setError('Upload impossible. Réessayez.');
        return;
      }

      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
      // `?t=...` pour casser le cache navigateur après replacement.
      const url = `${urlData.publicUrl}?t=${Date.now()}`;

      const { error: updErr } = await supabase
        .from('profiles')
        .update({ avatar_url: url })
        .eq('id', user.id);
      if (updErr) {
        setError('Mise à jour du profil impossible.');
        return;
      }

      onChange(url);
      // Refresh du contexte auth pour que la sidebar (et autres consommateurs)
      // affichent la nouvelle photo sans attendre un reload de page.
      void refreshProfile();
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function handleRemove() {
    if (!user) return;
    setError(null);
    setUploading(true);
    try {
      // On tente de retirer tous les ext possibles au même path.
      const exts = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'heic'];
      await supabase.storage
        .from(BUCKET)
        .remove(exts.map((e) => `${user.id}/avatar.${e}`));

      await supabase.from('profiles').update({ avatar_url: '' }).eq('id', user.id);
      onChange('');
      void refreshProfile();
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div className="relative">
        <div className="h-20 w-20 rounded-full overflow-hidden bg-muted flex items-center justify-center border border-border">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="Photo de profil" className="h-full w-full object-cover" />
          ) : (
            <span className="text-xl font-medium text-muted-foreground">
              {fullName ? initials(fullName, user?.email || '') : <UserIcon className="h-8 w-8" />}
            </span>
          )}
        </div>
        {uploading && (
          <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-white" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">Photo de profil</p>
        <p className="text-xs text-muted-foreground mb-2">
          Visible dans le menu et pour vos collaborateurs. PNG, JPG ou WebP, max 5 Mo.
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,image/heic"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            disabled={uploading}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="gap-1.5"
          >
            <Camera className="h-3.5 w-3.5" />
            {avatarUrl ? 'Changer' : 'Ajouter une photo'}
          </Button>
          {avatarUrl && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRemove}
              disabled={uploading}
              className="gap-1.5 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Retirer
            </Button>
          )}
        </div>
        {error && (
          <p className="text-xs text-red-600 mt-2">{error}</p>
        )}
      </div>
    </div>
  );
}
