'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { FileText, Loader2, Paperclip, Trash2, Upload } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export interface CompanyAttachment {
  id: string;
  name: string;
  mime_type: string;
  size_bytes: number;
  storage_path: string;
  attach_to_quotes: boolean;
  attach_to_invoices: boolean;
  created_at: string;
}

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 Mo

function formatBytes(n: number) {
  if (!n) return '0 o';
  const units = ['o', 'Ko', 'Mo', 'Go'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

export function CompanyAttachmentsCard() {
  const { user } = useAuth();
  const [items, setItems] = useState<CompanyAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadItems = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('company_attachments')
      .select('id, name, mime_type, size_bytes, storage_path, attach_to_quotes, attach_to_invoices, created_at')
      .order('position', { ascending: true })
      .order('created_at', { ascending: true });
    setItems((data as CompanyAttachment[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadItems(); }, [loadItems]);

  async function handleUpload(file: File) {
    if (!user) return;
    setError(null);

    if (file.size > MAX_FILE_BYTES) {
      setError(`Le fichier depasse la taille maximale de ${formatBytes(MAX_FILE_BYTES)}.`);
      return;
    }

    setUploading(true);

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '_');
    const storagePath = `${user.id}/${Date.now()}_${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from('company-attachments')
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || 'application/octet-stream',
      });

    if (uploadError) {
      setError(`Echec de l'envoi : ${uploadError.message}`);
      setUploading(false);
      return;
    }

    const { error: insertError } = await supabase.from('company_attachments').insert({
      name: file.name,
      mime_type: file.type || 'application/octet-stream',
      size_bytes: file.size,
      storage_path: storagePath,
    });

    if (insertError) {
      // Rollback storage upload to keep storage and DB in sync
      await supabase.storage.from('company-attachments').remove([storagePath]);
      setError(`Echec de l'enregistrement : ${insertError.message}`);
      setUploading(false);
      return;
    }

    setUploading(false);
    await loadItems();
  }

  async function handleDelete(item: CompanyAttachment) {
    if (!confirm(`Supprimer "${item.name}" ?`)) return;
    await supabase.storage.from('company-attachments').remove([item.storage_path]);
    await supabase.from('company_attachments').delete().eq('id', item.id);
    await loadItems();
  }

  async function toggleFlag(item: CompanyAttachment, key: 'attach_to_quotes' | 'attach_to_invoices', value: boolean) {
    setItems(prev => prev.map(it => (it.id === item.id ? { ...it, [key]: value } : it)));
    await supabase
      .from('company_attachments')
      .update({ [key]: value, updated_at: new Date().toISOString() })
      .eq('id', item.id);
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Paperclip className="h-5 w-5" /> Attestations et assurances
        </CardTitle>
        <CardDescription>
          Deposez ici vos attestations d&apos;assurance, decennale, RGE, Kbis, etc. Elles seront jointes par defaut a vos devis et factures envoyes au client. Vous pourrez les decocher avant l&apos;envoi.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Formats acceptes : PDF, JPG, PNG. Taille max : 10 Mo par fichier.
          </p>
          <div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploading ? 'Envoi...' : 'Ajouter un document'}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) handleUpload(file);
                e.target.value = '';
              }}
            />
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-muted-foreground/20 px-4 py-8 text-center">
            <FileText className="mx-auto h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground mt-2">
              Aucun document deposes pour l&apos;instant.
            </p>
          </div>
        ) : (
          <ul className="divide-y rounded-xl border">
            {items.map(item => (
              <li key={item.id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <FileText className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{formatBytes(item.size_bytes)}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={item.attach_to_quotes}
                      onCheckedChange={v => toggleFlag(item, 'attach_to_quotes', v)}
                    />
                    <Label className="text-xs">Devis</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={item.attach_to_invoices}
                      onCheckedChange={v => toggleFlag(item, 'attach_to_invoices', v)}
                    />
                    <Label className="text-xs">Factures</Label>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(item)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
