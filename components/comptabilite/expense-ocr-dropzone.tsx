'use client';

import { useRef, useState } from 'react';
import { Camera, Upload, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Props {
  onFileSelected: (file: File) => Promise<void> | void;
  busy?: boolean;
  error?: string | null;
}

export function ExpenseOcrDropzone({ onFileSelected, busy = false, error = null }: Props) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    await onFileSelected(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    handleFiles(e.dataTransfer.files);
  }

  return (
    <div
      onDragEnter={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
      }}
      onDrop={handleDrop}
      className={cn(
        'relative rounded-2xl border-2 border-dashed transition-colors',
        dragActive
          ? 'border-[#D35400] bg-orange-50/50'
          : busy
          ? 'border-[#D35400]/40 bg-orange-50/30'
          : 'border-border bg-card hover:border-[#D35400]/40 hover:bg-orange-50/20',
      )}
    >
      <div className="flex flex-col items-center justify-center gap-4 p-6 sm:p-8 text-center">
        {busy ? (
          <>
            <div className="relative">
              <Loader2 className="h-10 w-10 animate-spin text-[#D35400]" />
              <Sparkles className="absolute -right-2 -top-2 h-4 w-4 text-[#D35400] animate-pulse" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Analyse IA en cours…</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Lecture de la facture, extraction TVA, fournisseur, montants
              </p>
            </div>
          </>
        ) : error ? (
          <>
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-500">
              <AlertCircle className="h-7 w-7" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-red-600">Erreur d'analyse</p>
              <p className="text-xs text-red-500/80">{error}</p>
            </div>
            <Button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="gap-2 bg-[#D35400] text-white hover:bg-[#b8470a]"
            >
              <Camera className="h-4 w-4" />
              Réessayer
            </Button>
          </>
        ) : (
          <>
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-orange-50 text-[#D35400]">
              <Camera className="h-7 w-7" />
            </div>
            <div className="space-y-1">
              <p className="text-base font-semibold text-foreground">
                Photographier une facture
              </p>
              <p className="text-xs text-muted-foreground sm:hidden">
                L&apos;IA extrait fournisseur, date, HT, TVA et catégorie automatiquement
              </p>
              <p className="hidden text-xs text-muted-foreground sm:block">
                Glissez une image ou un PDF, ou cliquez pour parcourir. L&apos;IA extrait tout automatiquement.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="gap-2 bg-[#D35400] text-white hover:bg-[#b8470a]"
              >
                <Camera className="h-4 w-4" />
                Prendre une photo
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="gap-2"
              >
                <Upload className="h-4 w-4" />
                Choisir un fichier
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              JPG, PNG, WebP ou PDF — 10 Mo max
            </p>
          </>
        )}

        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>
    </div>
  );
}
