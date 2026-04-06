'use client';

import { useState } from 'react';
import { Save, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { FullProfile } from '@/app/(app)/profile/page';

interface ProfileFormProps {
  profile: FullProfile | null;
  onSaved: () => void | Promise<void>;
}

interface FormState {
  siret: string;
  insurance_decennale_number: string;
  insurance_decennale_company: string;
  insurance_decennale_expiry: string;
  rge_number: string;
  rge_valid_until: string;
  is_auto_entrepreneur: boolean;
  tva_number: string;
}

function validateSiret(value: string): boolean {
  const clean = value.replace(/\s/g, '');
  if (clean.length !== 14 || !/^\d+$/.test(clean)) return false;
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    let digit = parseInt(clean[i], 10);
    if (i % 2 === 0) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

export function ProfileForm({ profile, onSaved }: ProfileFormProps) {
  const { user } = useAuth();
  const [form, setForm] = useState<FormState>({
    siret: profile?.siret ?? '',
    insurance_decennale_number: profile?.insurance_decennale_number ?? '',
    insurance_decennale_company: profile?.insurance_decennale_company ?? '',
    insurance_decennale_expiry: profile?.insurance_decennale_expiry ?? '',
    rge_number: profile?.rge_number ?? '',
    rge_valid_until: profile?.rge_valid_until ?? '',
    is_auto_entrepreneur: profile?.is_auto_entrepreneur ?? false,
    tva_number: profile?.tva_number ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [siretError, setSiretError] = useState<string | null>(null);

  function handleChange(field: keyof FormState, value: string | boolean) {
    setForm(prev => ({ ...prev, [field]: value }));
    setSaveError(null);
    setSaveSuccess(false);
    if (field === 'siret') setSiretError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaveError(null);
    setSaveSuccess(false);

    const cleanSiret = form.siret.replace(/\s/g, '');
    if (cleanSiret && !validateSiret(cleanSiret)) {
      setSiretError('SIRET invalide (14 chiffres, clé de contrôle incorrecte)');
      return;
    }

    setSaving(true);

    const siret = cleanSiret || null;
    const insuranceNumber = form.insurance_decennale_number || null;
    const insuranceCompany = form.insurance_decennale_company || null;
    const onboardingCompleted = Boolean(siret && insuranceNumber && insuranceCompany);

    const { error } = await supabase
      .from('profiles')
      .update({
        siret,
        insurance_decennale_number: insuranceNumber,
        insurance_decennale_company: insuranceCompany,
        insurance_decennale_expiry: form.insurance_decennale_expiry || null,
        rge_number: form.rge_number || null,
        rge_valid_until: form.rge_valid_until || null,
        is_auto_entrepreneur: form.is_auto_entrepreneur,
        tva_number: form.tva_number || null,
        onboarding_completed: onboardingCompleted,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (error) {
      setSaveError('Erreur lors de la sauvegarde. Veuillez réessayer.');
    } else {
      setSaveSuccess(true);
      await onSaved();
    }

    setSaving(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Identification légale */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Identification légale</CardTitle>
          <CardDescription>
            SIRET requis pour générer vos devis et factures conformes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="siret">
              SIRET <span className="text-destructive">*</span>
            </Label>
            <Input
              id="siret"
              value={form.siret}
              onChange={e => handleChange('siret', e.target.value)}
              placeholder="123 456 789 00012"
              className={`text-base min-h-[48px] ${siretError ? 'border-destructive' : ''}`}
              inputMode="numeric"
              maxLength={17}
            />
            {siretError && (
              <p className="text-sm text-destructive">{siretError}</p>
            )}
          </div>

          <div className="flex items-center justify-between min-h-[48px]">
            <div>
              <Label htmlFor="auto-entrepreneur" className="text-sm font-medium">
                Auto-entrepreneur
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                TVA non applicable — Art. 293B du CGI
              </p>
            </div>
            <Switch
              id="auto-entrepreneur"
              checked={form.is_auto_entrepreneur}
              onCheckedChange={v => handleChange('is_auto_entrepreneur', v)}
            />
          </div>

          {!form.is_auto_entrepreneur && (
            <div className="space-y-2">
              <Label htmlFor="tva-number">Numéro de TVA intracommunautaire</Label>
              <Input
                id="tva-number"
                value={form.tva_number}
                onChange={e => handleChange('tva_number', e.target.value)}
                placeholder="FR 12 345678901"
                className="text-base min-h-[48px]"
                maxLength={20}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assurance décennale */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Assurance décennale</CardTitle>
          <CardDescription>
            Obligatoire pour les travaux de construction. Apparaît sur vos devis et factures.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="insurance-number">
              Numéro de police <span className="text-destructive">*</span>
            </Label>
            <Input
              id="insurance-number"
              value={form.insurance_decennale_number}
              onChange={e => handleChange('insurance_decennale_number', e.target.value)}
              placeholder="ex: 12345678"
              className="text-base min-h-[48px]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="insurance-company">
              Compagnie d'assurance <span className="text-destructive">*</span>
            </Label>
            <Input
              id="insurance-company"
              value={form.insurance_decennale_company}
              onChange={e => handleChange('insurance_decennale_company', e.target.value)}
              placeholder="ex: MAAF Assurances"
              className="text-base min-h-[48px]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="insurance-expiry">Date d'expiration</Label>
            <Input
              id="insurance-expiry"
              type="date"
              value={form.insurance_decennale_expiry}
              onChange={e => handleChange('insurance_decennale_expiry', e.target.value)}
              className="text-base min-h-[48px]"
            />
          </div>
        </CardContent>
      </Card>

      {/* Certification RGE */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Certification RGE</CardTitle>
          <CardDescription>
            Reconnu Garant de l'Environnement. Facultatif.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rge-number">Numéro RGE</Label>
            <Input
              id="rge-number"
              value={form.rge_number}
              onChange={e => handleChange('rge_number', e.target.value)}
              placeholder="ex: E-E187388"
              className="text-base min-h-[48px]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="rge-valid-until">Valide jusqu'au</Label>
            <Input
              id="rge-valid-until"
              type="date"
              value={form.rge_valid_until}
              onChange={e => handleChange('rge_valid_until', e.target.value)}
              className="text-base min-h-[48px]"
            />
          </div>
        </CardContent>
      </Card>

      {saveError && (
        <Alert variant="destructive">
          <AlertDescription>{saveError}</AlertDescription>
        </Alert>
      )}
      {saveSuccess && (
        <Alert className="border-green-200 bg-green-50 text-green-900">
          <AlertDescription>Profil sauvegardé avec succès.</AlertDescription>
        </Alert>
      )}

      <Button
        type="submit"
        disabled={saving}
        className="w-full min-h-[52px] text-base"
        size="lg"
      >
        {saving ? (
          <><Loader2 className="h-5 w-5 mr-2 animate-spin" />Sauvegarde...</>
        ) : (
          <><Save className="h-5 w-5 mr-2" />Sauvegarder le profil</>
        )}
      </Button>
    </form>
  );
}
