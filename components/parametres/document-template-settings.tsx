'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Check,
  Save,
  Upload,
  X,
  FileText,
  Palette,
  CreditCard,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import {
  type DocumentConfig,
  DEFAULT_DOCUMENT_CONFIG,
  TEMPLATE_PRESETS,
  COLOR_PRESETS,
  FONT_OPTIONS,
  PAYMENT_TERMS_PRESETS,
  mergeDocConfig,
} from '@/lib/document-templates';
import { DocumentPreview } from './document-preview';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function DocumentTemplateSettings() {
  const { user } = useAuth();
  const [config, setConfig] = useState<DocumentConfig>(DEFAULT_DOCUMENT_CONFIG);
  const [logoUrl, setLogoUrl] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewType, setPreviewType] = useState<'devis' | 'facture'>('devis');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadConfig = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('document_config, logo_url, company_name')
      .eq('id', user.id)
      .maybeSingle();
    if (data) {
      setConfig(mergeDocConfig(data.document_config as Partial<DocumentConfig>));
      setLogoUrl(data.logo_url || '');
      setCompanyName(data.company_name || '');
    }
  }, [user]);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  async function saveConfig() {
    if (!user) return;
    setSaving(true);
    await supabase
      .from('profiles')
      .update({ document_config: config, logo_url: logoUrl })
      .eq('id', user.id);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function uploadLogo(file: File) {
    if (!user) return;
    setUploading(true);
    const ext = file.name.split('.').pop() || 'png';
    const path = `${user.id}/logo.${ext}`;

    // Remove old logo first
    await supabase.storage.from('logos').remove([path]);

    const { error } = await supabase.storage.from('logos').upload(path, file, {
      cacheControl: '3600',
      upsert: true,
    });

    if (!error) {
      const { data: urlData } = supabase.storage.from('logos').getPublicUrl(path);
      const url = urlData.publicUrl + '?t=' + Date.now();
      setLogoUrl(url);
      await supabase.from('profiles').update({ logo_url: url }).eq('id', user.id);
    }
    setUploading(false);
  }

  function removeLogo() {
    setLogoUrl('');
  }

  function applyPreset(presetValue: string) {
    const preset = TEMPLATE_PRESETS.find(p => p.value === presetValue);
    if (preset) {
      setConfig(prev => ({
        ...prev,
        template: preset.value,
        primary_color: preset.colors.primary,
        secondary_color: preset.colors.secondary,
      }));
    }
  }

  function updateConfig<K extends keyof DocumentConfig>(key: K, value: DocumentConfig[K]) {
    setConfig(prev => ({ ...prev, [key]: value }));
  }

  function applyPaymentPreset(presetValue: string) {
    const preset = PAYMENT_TERMS_PRESETS.find(p => p.value === presetValue);
    if (!preset) return;
    setConfig(prev => ({
      ...prev,
      payment_terms_preset: preset.value,
      payment_terms: preset.body,
    }));
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
      {/* Settings panel */}
      <div className="space-y-6">
        {/* Template presets */}
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5" /> Template
            </CardTitle>
            <CardDescription>Choisissez un style de base pour vos documents</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {TEMPLATE_PRESETS.map(preset => (
                <button
                  key={preset.value}
                  type="button"
                  className={cn(
                    'relative rounded-xl border-2 p-4 text-left transition-all hover:shadow-md',
                    config.template === preset.value
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-border hover:border-primary/30'
                  )}
                  onClick={() => applyPreset(preset.value)}
                >
                  {config.template === preset.value && (
                    <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                      <Check className="h-3 w-3 text-white" />
                    </div>
                  )}
                  <div className="flex gap-1.5 mb-2">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: preset.colors.primary }} />
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: preset.colors.secondary }} />
                  </div>
                  <p className="font-medium text-sm">{preset.label}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{preset.description}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Colors & Font */}
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Palette className="h-5 w-5" /> Couleurs et police
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Primary color */}
            <div>
              <Label className="text-sm">Couleur principale</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {COLOR_PRESETS.map(c => (
                  <button
                    key={c.value}
                    type="button"
                    className={cn(
                      'h-8 w-8 rounded-full border-2 transition-transform hover:scale-110',
                      config.primary_color === c.value ? 'border-foreground scale-110' : 'border-transparent'
                    )}
                    style={{ backgroundColor: c.value }}
                    title={c.label}
                    onClick={() => updateConfig('primary_color', c.value)}
                  />
                ))}
                <div className="relative">
                  <input
                    type="color"
                    value={config.primary_color}
                    onChange={e => updateConfig('primary_color', e.target.value)}
                    className="h-8 w-8 rounded-full cursor-pointer border-2 border-dashed border-muted-foreground/30"
                    title="Couleur personnalisée"
                  />
                </div>
              </div>
            </div>

            {/* Font */}
            <div>
              <Label className="text-sm">Police de caractères</Label>
              <Select value={config.font} onValueChange={v => updateConfig('font', v)}>
                <SelectTrigger className="mt-1.5 w-full sm:w-[280px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FONT_OPTIONS.map(f => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Header style */}
            <div>
              <Label className="text-sm">Style d&apos;en-tête</Label>
              <Select value={config.header_style} onValueChange={v => updateConfig('header_style', v as DocumentConfig['header_style'])}>
                <SelectTrigger className="mt-1.5 w-full sm:w-[280px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard (logo + infos)</SelectItem>
                  <SelectItem value="banner">Bannière colorée</SelectItem>
                  <SelectItem value="compact">Compact (une ligne)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Logo */}
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-lg">Logo</CardTitle>
            <CardDescription>Votre logo apparaîtra sur vos devis et factures</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              {logoUrl ? (
                <div className="relative">
                  <img src={logoUrl} alt="Logo" className="h-16 w-16 rounded-lg object-cover border" />
                  <button
                    type="button"
                    className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-destructive text-white flex items-center justify-center hover:bg-destructive/80"
                    onClick={removeLogo}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <div className="h-16 w-16 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center text-muted-foreground">
                  <Upload className="h-6 w-6" />
                </div>
              )}
              <div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4" />
                  {uploading ? 'Upload...' : logoUrl ? 'Changer' : 'Importer un logo'}
                </Button>
                <p className="text-[11px] text-muted-foreground mt-1">PNG ou JPG, max 1 Mo</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) uploadLogo(file);
                    e.target.value = '';
                  }}
                />
              </div>
            </div>

            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <div>
                <Label className="text-sm">Afficher le logo</Label>
                <p className="text-[11px] text-muted-foreground">Sur l&apos;en-tête des documents</p>
              </div>
              <Switch checked={config.show_logo} onCheckedChange={v => updateConfig('show_logo', v)} />
            </div>

            <div className="flex items-center justify-between mt-3">
              <div>
                <Label className="text-sm">Mention &quot;Créé avec Hellobat&quot;</Label>
                <p className="text-[11px] text-muted-foreground">Petit filigrane en bas du document</p>
              </div>
              <Switch checked={config.show_watermark} onCheckedChange={v => updateConfig('show_watermark', v)} />
            </div>
          </CardContent>
        </Card>

        {/* Mentions */}
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-lg">Textes personnalisés</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-sm">Pied de page</Label>
              <Input
                className="mt-1.5"
                placeholder="Ex: Merci pour votre confiance !"
                value={config.footer_text}
                onChange={e => updateConfig('footer_text', e.target.value)}
              />
            </div>
            <div>
              <Label className="text-sm">Mentions légales</Label>
              <Textarea
                className="mt-1.5 resize-none"
                rows={3}
                placeholder="Conditions générales, validité, tribunal compétent..."
                value={config.mentions_legales}
                onChange={e => updateConfig('mentions_legales', e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Conditions de paiement */}
        <Card className="rounded-2xl border-primary/15">
          <CardHeader>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  Conditions de paiement
                </CardTitle>
                <CardDescription className="mt-1">
                  Affichées en bas de vos devis et factures. Conformes à la loi française.
                </CardDescription>
              </div>
              <span className="inline-flex items-center gap-1 h-6 px-2.5 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] font-semibold text-emerald-700 whitespace-nowrap">
                <Sparkles className="h-3 w-3" />
                Pré-remplies
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Preset cards */}
            <div>
              <Label className="text-sm">Modèle</Label>
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {PAYMENT_TERMS_PRESETS.map(preset => {
                  const active = config.payment_terms_preset === preset.value;
                  return (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => applyPaymentPreset(preset.value)}
                      className={cn(
                        'relative text-left rounded-xl border-2 p-3 transition-all hover:shadow-sm',
                        active
                          ? 'border-primary bg-primary/5'
                          : 'border-border bg-white hover:border-primary/30',
                      )}
                    >
                      {active && (
                        <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                          <Check className="h-3 w-3 text-white" />
                        </div>
                      )}
                      <p className="text-sm font-medium text-foreground pr-6">
                        {preset.label}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {preset.short}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Editable text */}
            <div>
              <div className="flex items-center justify-between">
                <Label className="text-sm">Texte affiché sur le document</Label>
                <span className="text-[10px] text-muted-foreground">
                  Modifiable
                </span>
              </div>
              <Textarea
                className="mt-1.5 resize-none text-xs leading-relaxed"
                rows={6}
                value={config.payment_terms}
                onChange={e => {
                  updateConfig('payment_terms', e.target.value);
                  // Switching to manual edits → mark as custom
                  updateConfig('payment_terms_preset', 'custom');
                }}
              />
            </div>

            {/* Toggles */}
            <div className="space-y-3 pt-2 border-t border-border">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <Label className="text-sm">Afficher sur les devis</Label>
                  <p className="text-[11px] text-muted-foreground">
                    Vos clients voient les conditions avant de signer.
                  </p>
                </div>
                <Switch
                  checked={config.payment_terms_on_quotes}
                  onCheckedChange={v => updateConfig('payment_terms_on_quotes', v)}
                />
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <Label className="text-sm flex items-center gap-1.5">
                    Afficher sur les factures
                    <span className="inline-flex items-center h-4 px-1.5 rounded-full bg-red-50 text-[9px] font-semibold uppercase tracking-wide text-red-700 border border-red-200">
                      Obligatoire
                    </span>
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    Les pénalités de retard sont exigées par la loi française.
                  </p>
                </div>
                <Switch
                  checked={config.payment_terms_on_invoices}
                  onCheckedChange={v => updateConfig('payment_terms_on_invoices', v)}
                />
              </div>

              {!config.payment_terms_on_invoices && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 flex items-start gap-2.5">
                  <AlertTriangle className="h-4 w-4 text-red-700 flex-shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-red-900">
                      Légalement obligatoire sur vos factures
                    </p>
                    <p className="text-[11px] text-red-800 mt-0.5 leading-relaxed">
                      L&apos;absence des conditions de paiement (délais et
                      pénalités de retard) vous expose à une amende administrative
                      pouvant aller jusqu&apos;à 75 000 €. Nous vous recommandons
                      vivement de réactiver l&apos;option.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Save */}
        <div className="flex justify-end">
          <Button onClick={saveConfig} disabled={saving} className="gap-2">
            {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {saved ? 'Enregistré !' : saving ? 'Enregistrement...' : 'Enregistrer le design'}
          </Button>
        </div>
      </div>

      {/* Preview panel — sticky on desktop */}
      <div className="xl:sticky xl:top-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Aperçu en direct</p>
          <div className="flex gap-1 rounded-lg border p-0.5">
            <button
              type="button"
              className={cn('px-2.5 py-1 rounded-md text-xs font-medium transition-colors', previewType === 'devis' ? 'bg-primary text-white' : 'hover:bg-muted')}
              onClick={() => setPreviewType('devis')}
            >
              Devis
            </button>
            <button
              type="button"
              className={cn('px-2.5 py-1 rounded-md text-xs font-medium transition-colors', previewType === 'facture' ? 'bg-primary text-white' : 'hover:bg-muted')}
              onClick={() => setPreviewType('facture')}
            >
              Facture
            </button>
          </div>
        </div>
        <DocumentPreview
          config={config}
          logoUrl={logoUrl}
          companyName={companyName || 'Mon Entreprise'}
          type={previewType}
        />
      </div>
    </div>
  );
}
