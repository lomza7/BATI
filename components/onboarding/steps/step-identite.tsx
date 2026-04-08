'use client';

import { useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Palette,
  SkipForward,
  Upload,
  Loader2,
  Check,
  Image as ImageIcon,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { OnboardingData } from '../onboarding-modal';

const COLOR_PRESETS = [
  { value: '#d35400', label: 'Orange BTP' },
  { value: '#2563eb', label: 'Bleu' },
  { value: '#059669', label: 'Vert' },
  { value: '#dc2626', label: 'Rouge' },
  { value: '#7c3aed', label: 'Violet' },
  { value: '#18181b', label: 'Noir' },
];

interface Props {
  data: OnboardingData;
  onChange: (d: Partial<OnboardingData>) => void;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  userId: string;
}

export function StepIdentite({ data, onChange, onNext, onBack, onSkip, userId }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  async function handleLogoUpload(file: File) {
    if (!file.type.startsWith('image/')) {
      setUploadError('Seules les images sont acceptees');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Image trop lourde (5 Mo max)');
      return;
    }

    setUploading(true);
    setUploadError('');
    try {
      const ext = file.name.split('.').pop() || 'png';
      const path = `${userId}/logo-${Date.now()}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from('logos')
        .upload(path, file, { upsert: true });

      if (uploadErr) throw uploadErr;

      const { data: publicUrl } = supabase.storage.from('logos').getPublicUrl(path);
      onChange({ logoUrl: publicUrl.publicUrl });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Erreur upload');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col flex-1 animate-fade-up">
      <div className="flex items-center gap-3 mb-2">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Palette className="h-5 w-5 text-primary" />
        </div>
      </div>

      <h2 className="text-xl font-semibold text-foreground mt-3">
        Votre identite visuelle
      </h2>
      <p className="text-sm text-muted-foreground mt-2">
        Ajoutez votre logo et choisissez une couleur. Ca servira pour vos devis,
        factures et site web.
      </p>

      <div className="mt-6 space-y-5 flex-1">
        {/* Logo upload */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Logo (optionnel)</label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleLogoUpload(file);
            }}
          />
          {data.logoUrl ? (
            <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={data.logoUrl}
                alt="Logo"
                className="h-14 w-14 rounded-lg object-contain bg-white border border-border"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-emerald-800 flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5" />
                  Logo ajoute
                </p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs text-emerald-700 hover:underline mt-0.5"
                >
                  Changer
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-full h-20 rounded-xl border-2 border-dashed border-border hover:border-primary/40 hover:bg-muted/20 transition-all flex items-center justify-center gap-2 text-sm text-muted-foreground disabled:opacity-50"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Envoi en cours...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Cliquez pour telecharger votre logo
                </>
              )}
            </button>
          )}
          {uploadError && (
            <p className="text-xs text-destructive">{uploadError}</p>
          )}
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <ImageIcon className="h-3 w-3" />
            PNG, JPG ou SVG. 5 Mo maximum.
          </p>
        </div>

        {/* Color palette */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            Couleur principale
          </label>
          <div className="grid grid-cols-6 gap-2">
            {COLOR_PRESETS.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => onChange({ primaryColor: c.value })}
                className={`aspect-square rounded-xl border-2 transition-all flex items-center justify-center ${
                  data.primaryColor === c.value
                    ? 'border-foreground scale-105 shadow-sm'
                    : 'border-transparent hover:scale-105'
                }`}
                style={{ backgroundColor: c.value }}
                title={c.label}
              >
                {data.primaryColor === c.value && (
                  <Check className="h-4 w-4 text-white" strokeWidth={3} />
                )}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Utilisee pour vos documents et votre site web.
          </p>
        </div>

        {/* Tagline */}
        <div className="space-y-2">
          <label htmlFor="tagline" className="text-sm font-medium text-foreground">
            Votre slogan <span className="text-muted-foreground font-normal">(optionnel)</span>
          </label>
          <input
            id="tagline"
            type="text"
            value={data.tagline}
            onChange={(e) => onChange({ tagline: e.target.value.slice(0, 80) })}
            placeholder="Ex: Votre artisan de confiance depuis 2010"
            maxLength={80}
            className="flex h-11 w-full rounded-xl border border-border bg-muted/30 px-4 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all"
          />
          <p className="text-[11px] text-muted-foreground text-right">
            {data.tagline.length}/80 caracteres
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between mt-6">
        <button
          onClick={onBack}
          className="h-11 px-5 rounded-xl border border-border bg-white text-sm font-medium text-foreground flex items-center gap-2 hover:bg-muted/50 transition-all"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={onSkip}
            className="h-11 px-4 rounded-xl text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5 hover:bg-muted/30 transition-all"
          >
            Passer
            <SkipForward className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onNext}
            className="h-11 px-6 rounded-xl bg-primary text-primary-foreground font-medium text-sm flex items-center gap-2 hover:bg-primary/90 transition-all"
          >
            Continuer
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
