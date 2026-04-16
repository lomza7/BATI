'use client';

import { useRef, useState } from 'react';
import { FileText, Loader as Loader2, Upload, X } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (catalog: any) => void;
}

const MAX_BYTES = 50 * 1024 * 1024;

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export function UploadSupplierPdfDialog({ open, onClose, onCreated }: Props) {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [supplierName, setSupplierName] = useState('');
  const [catalogName, setCatalogName] = useState('');
  const [description, setDescription] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  function reset() {
    setFile(null);
    setSupplierName('');
    setCatalogName('');
    setDescription('');
    setError('');
    setUploading(false);
  }

  function handleClose() {
    if (uploading) return;
    reset();
    onClose();
  }

  function pickFile(f: File) {
    setError('');
    if (f.type !== 'application/pdf') {
      setError('Seuls les fichiers PDF sont acceptés.');
      return;
    }
    if (f.size > MAX_BYTES) {
      setError('Le fichier dépasse 50 Mo.');
      return;
    }
    setFile(f);
    if (!catalogName.trim()) {
      const base = f.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').trim();
      setCatalogName(base);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) pickFile(f);
  }

  async function handleSubmit() {
    if (!user || !file || !catalogName.trim()) return;
    setUploading(true);
    setError('');

    const uid = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const path = `${user.id}/${uid}.pdf`;

    const { error: upErr } = await supabase.storage
      .from('catalog-pdfs')
      .upload(path, file, { contentType: 'application/pdf', upsert: false });

    if (upErr) {
      setUploading(false);
      setError("Échec de l'upload. Réessayez.");
      return;
    }

    const { data: urlData } = supabase.storage.from('catalog-pdfs').getPublicUrl(path);
    const publicUrl = urlData.publicUrl;

    const { data, error: insErr } = await supabase
      .from('catalogs')
      .insert({
        user_id: user.id,
        name: catalogName.trim(),
        description: description.trim(),
        emoji: '📄',
        catalog_type: 'supplier_pdf',
        supplier_name: supplierName.trim() || null,
        pdf_file_url: publicUrl,
        pdf_file_name: file.name,
        pdf_file_size: file.size,
        status: 'published',
      })
      .select()
      .maybeSingle();

    if (insErr || !data) {
      await supabase.storage.from('catalog-pdfs').remove([path]);
      setUploading(false);
      setError("Impossible d'enregistrer le catalogue.");
      return;
    }

    setUploading(false);
    onCreated(data);
    reset();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogTitle className="text-lg font-semibold text-foreground">
          Importer un catalogue fournisseur
        </DialogTitle>
        <p className="text-sm text-muted-foreground -mt-1">
          Uploadez le PDF de votre fournisseur (Leroy Merlin, Saint-Gobain, Point P…) pour le transmettre à vos clients.
        </p>

        <div className="space-y-4 mt-2">
          {!file ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              className={`rounded-xl border-2 border-dashed p-6 sm:p-8 text-center cursor-pointer transition-all ${
                dragOver
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:bg-muted/30'
              }`}
            >
              <div className={`h-12 w-12 mx-auto rounded-xl flex items-center justify-center mb-3 transition-all ${
                dragOver ? 'bg-primary/10 scale-110' : 'bg-muted/50'
              }`}>
                <Upload className={`h-6 w-6 ${dragOver ? 'text-primary' : 'text-muted-foreground/50'}`} />
              </div>
              <p className="text-sm font-medium text-foreground">
                {dragOver ? 'Déposez le PDF ici' : 'Glissez un PDF ou cliquez pour choisir'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">PDF uniquement — 50 Mo max</p>
              <input
                ref={inputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) pickFile(f); e.target.value = ''; }}
              />
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-muted/30 p-3 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">{formatSize(file.size)}</p>
              </div>
              <button
                onClick={() => { setFile(null); setError(''); }}
                disabled={uploading}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-all disabled:opacity-40"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">
                Nom du catalogue <span className="text-destructive">*</span>
              </label>
              <input
                value={catalogName}
                onChange={(e) => setCatalogName(e.target.value)}
                placeholder="Ex : Carrelage 2026"
                className="w-full h-10 rounded-lg border border-border bg-white px-3 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">
                Fournisseur
              </label>
              <input
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder="Ex : Leroy Merlin, Saint-Gobain…"
                className="w-full h-10 rounded-lg border border-border bg-white px-3 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">
                Description (optionnel)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Un mot pour votre client…"
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={handleClose}
              disabled={uploading}
              className="h-10 px-4 rounded-lg border border-border bg-white text-sm font-medium text-foreground hover:bg-muted/50 transition-all disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              onClick={handleSubmit}
              disabled={uploading || !file || !catalogName.trim()}
              className="h-10 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-medium flex items-center gap-2 hover:bg-primary/90 transition-all disabled:opacity-40"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Upload…
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Importer
                </>
              )}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
