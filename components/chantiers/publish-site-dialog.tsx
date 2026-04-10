'use client';

import { useEffect, useMemo, useState } from 'react';
import { Globe2, Loader2, Sparkles, Image as ImageIcon, Eye, EyeOff, ExternalLink } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { slugify } from '@/lib/site-utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface PublishPhoto {
  id: string;
  url: string;
  category: string;
}

interface PublishProjectInput {
  id: string;
  name: string;
  city: string | null;
  is_public?: boolean;
  public_description?: string | null;
  public_category?: string | null;
  public_slug?: string | null;
  public_completion_date?: string | null;
  published_at?: string | null;
  end_date?: string | null;
  project_photos: PublishPhoto[];
}

interface PublishSiteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: PublishProjectInput | null;
  siteSlug: string | null;
  onPublished?: () => void;
}

const CATEGORY_SUGGESTIONS = [
  'Rénovation salle de bain',
  'Rénovation cuisine',
  'Aménagement combles',
  'Extension maison',
  'Isolation thermique',
  'Ravalement façade',
  'Rénovation complète',
  'Menuiserie extérieure',
  'Plomberie',
  'Électricité',
  'Peinture intérieure',
  'Carrelage',
  'Toiture',
  'Terrasse',
];

export function PublishSiteDialog({
  open,
  onOpenChange,
  project,
  siteSlug,
  onPublished,
}: PublishSiteDialogProps) {
  const [isPublic, setIsPublic] = useState(false);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [completionDate, setCompletionDate] = useState('');
  const [slug, setSlug] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [generatingAi, setGeneratingAi] = useState(false);
  const [slugEdited, setSlugEdited] = useState(false);

  useEffect(() => {
    if (!project || !open) return;
    setIsPublic(project.is_public ?? false);
    setDescription(project.public_description ?? '');
    setCategory(project.public_category ?? '');
    setCompletionDate(
      project.public_completion_date ||
        project.end_date ||
        new Date().toISOString().split('T')[0]
    );
    const initialSlug =
      project.public_slug || slugify(`${project.name} ${project.city ?? ''}`.trim(), 80);
    setSlug(initialSlug);
    setSlugEdited(false);
    setError('');
  }, [project, open]);

  useEffect(() => {
    if (slugEdited || !project) return;
    setSlug(slugify(`${project.name} ${project.city ?? ''}`.trim(), 80));
  }, [project, slugEdited]);

  const showcasePhotos = useMemo(() => {
    if (!project) return [] as PublishPhoto[];
    // Les photos Après + Présentation sont mises en avant pour le site.
    const order = ['presentation', 'apres', 'pendant', 'avant'];
    return [...project.project_photos].sort(
      (a, b) => order.indexOf(a.category) - order.indexOf(b.category)
    );
  }, [project]);

  async function handleGenerateAi() {
    if (!project) return;
    setGeneratingAi(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Session expirée');

      const res = await fetch('/api/ai/project-description', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          project_id: project.id,
          name: project.name,
          city: project.city,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erreur IA');
      }
      const data = await res.json();
      if (data.description) setDescription(data.description);
      if (data.category && !category) setCategory(data.category);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur IA');
    } finally {
      setGeneratingAi(false);
    }
  }

  async function handleSave() {
    if (!project) return;
    setSaving(true);
    setError('');
    try {
      const finalSlug = slugify(slug || project.name, 80);

      const payload = {
        is_public: isPublic,
        public_description: description.trim(),
        public_category: category.trim(),
        public_slug: finalSlug || null,
        public_completion_date: completionDate || null,
        published_at: isPublic ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      };

      const { error: updateError } = await supabase
        .from('projects')
        .update(payload)
        .eq('id', project.id);

      if (updateError) {
        // Slug collision - append project id suffix and retry
        if (updateError.code === '23505') {
          const suffixed = `${finalSlug}-${project.id.slice(0, 6)}`;
          const { error: retryError } = await supabase
            .from('projects')
            .update({ ...payload, public_slug: suffixed })
            .eq('id', project.id);
          if (retryError) throw retryError;
        } else {
          throw updateError;
        }
      }

      // Trigger ISR revalidation on the public site
      if (siteSlug) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          fetch('/api/site/revalidate', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ slug: siteSlug }),
          }).catch(() => {});
        }
      }

      onPublished?.();
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Impossible de publier';
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  if (!project) return null;

  const siteUrl = siteSlug
    ? `https://${siteSlug}.hellobat.app/realisations/${slug}`
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe2 className="h-5 w-5 text-[#D35400]" />
            Publier ce chantier sur mon site
          </DialogTitle>
          <DialogDescription>
            Décrivez le chantier en quelques phrases. Les photos et la description alimenteront votre site web pour être
            référencées sur Google.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Toggle publier */}
          <div className="flex items-center justify-between rounded-2xl border border-border bg-muted/30 p-4">
            <div className="flex items-start gap-3">
              <div className={`mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl ${isPublic ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'}`}>
                {isPublic ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {isPublic ? 'Visible sur votre site' : 'Masqué du site'}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isPublic
                    ? 'Ce chantier apparaîtra dans la section « Réalisations » et aura sa propre page SEO.'
                    : 'Activez pour publier ce chantier sur votre site web public.'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsPublic(!isPublic)}
              className={`relative h-6 w-11 rounded-full transition-colors ${isPublic ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${isPublic ? 'translate-x-[22px]' : 'translate-x-0.5'}`}
              />
            </button>
          </div>

          {/* Photos */}
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-semibold text-foreground">
                Photos publiées ({showcasePhotos.length})
              </p>
            </div>
            {showcasePhotos.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Ajoutez des photos (Avant / Pendant / Après) au chantier pour illustrer votre page publique.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {showcasePhotos.slice(0, 12).map((photo) => (
                  <div
                    key={photo.id}
                    className="relative aspect-square overflow-hidden rounded-lg border border-border"
                  >
                    <img src={photo.url} alt="" className="h-full w-full object-cover" />
                    <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                      {photo.category}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-3 text-[11px] text-muted-foreground">
              Toutes les photos du chantier sont publiées. Les photos &laquo;&nbsp;Après&nbsp;&raquo; et &laquo;&nbsp;Présentation&nbsp;&raquo; sont mises en avant.
            </p>
          </div>

          {/* Category */}
          <div>
            <label className="text-sm font-medium text-foreground">Type de chantier</label>
            <Input
              className="mt-1"
              placeholder="Ex : Rénovation salle de bain"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              list="chantier-category-suggestions"
            />
            <datalist id="chantier-category-suggestions">
              {CATEGORY_SUGGESTIONS.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Utilisé comme mot-clé pour le référencement Google.
            </p>
          </div>

          {/* Completion date */}
          <div>
            <label className="text-sm font-medium text-foreground">Date de réalisation</label>
            <Input
              className="mt-1"
              type="date"
              value={completionDate}
              onChange={(e) => setCompletionDate(e.target.value)}
            />
          </div>

          {/* Description */}
          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <label className="text-sm font-medium text-foreground">
                Description (ce qui a été fait)
              </label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 gap-1.5 text-xs"
                disabled={generatingAi}
                onClick={handleGenerateAi}
              >
                {generatingAi ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Sparkles className="h-3 w-3 text-[#D35400]" />
                )}
                Générer avec l&apos;IA
              </Button>
            </div>
            <Textarea
              className="min-h-[140px]"
              placeholder="Décrivez les travaux réalisés : matériaux utilisés, surface, durée, spécificités, résultat obtenu…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              150 à 300 mots idéal. Plus c&apos;est détaillé, plus Google référencera votre page.
            </p>
          </div>

          {/* Slug */}
          <div>
            <label className="text-sm font-medium text-foreground">URL de la page</label>
            <div className="mt-1 flex items-center rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              <span className="whitespace-nowrap">
                {siteSlug || '...'}.hellobat.app/realisations/
              </span>
              <input
                className="flex-1 bg-transparent outline-none font-medium text-foreground"
                value={slug}
                onChange={(e) => {
                  setSlug(slugify(e.target.value, 80));
                  setSlugEdited(true);
                }}
                placeholder="mon-chantier"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {isPublic && siteUrl && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4">
              <p className="text-xs font-semibold text-emerald-800">Une fois publié :</p>
              <a
                href={siteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 flex items-center gap-1.5 text-xs text-emerald-700 hover:underline break-all"
              >
                <ExternalLink className="h-3 w-3 shrink-0" />
                {siteUrl}
              </a>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe2 className="h-4 w-4" />}
            {isPublic ? 'Enregistrer et publier' : 'Enregistrer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
