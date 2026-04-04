'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Globe, Sparkles, Eye, Palette, Type, Image, ArrowRight, Check,
  RefreshCw, ExternalLink, Copy, CheckCircle2,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { generateSlug, SITE_THEMES, type SiteTheme, type SiteContent, type ArtisanSite } from '@/lib/site-utils';

const STEPS = [
  { id: 1, label: 'Profil', icon: Type },
  { id: 2, label: 'Design', icon: Palette },
  { id: 3, label: 'Contenu', icon: Image },
  { id: 4, label: 'Apercu', icon: Eye },
];

export default function SiteWebPage() {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [profile, setProfile] = useState({
    company: '',
    activity: '',
    city: '',
    phone: '',
    slogan: '',
  });
  const [theme, setTheme] = useState<SiteTheme>('modern');
  const [generating, setGenerating] = useState(false);
  const [siteContent, setSiteContent] = useState<SiteContent | null>(null);
  const [existingSite, setExistingSite] = useState<ArtisanSite | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);
  const [siteUrl, setSiteUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Section toggles
  const [showServices, setShowServices] = useState(true);
  const [showProjects, setShowProjects] = useState(true);
  const [showReviews, setShowReviews] = useState(true);
  const [showContact, setShowContact] = useState(true);

  // Load existing profile + site
  const loadData = useCallback(async () => {
    if (!user) return;
    setLoadingProfile(true);

    const [profileRes, siteRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
      supabase.from('artisan_sites').select('*').eq('user_id', user.id).maybeSingle(),
    ]);

    if (profileRes.data) {
      setProfile({
        company: profileRes.data.company_name || '',
        activity: profileRes.data.company_activity || '',
        city: profileRes.data.company_city || '',
        phone: profileRes.data.company_phone || '',
        slogan: '',
      });
    }

    if (siteRes.data) {
      const site = siteRes.data as ArtisanSite;
      setExistingSite(site);
      setTheme(site.theme);
      setSiteContent(site.site_content as SiteContent);
      setShowServices(site.show_services);
      setShowProjects(site.show_projects);
      setShowReviews(site.show_reviews);
      setShowContact(site.show_contact);
      if (site.custom_slogan) {
        setProfile(prev => ({ ...prev, slogan: site.custom_slogan }));
      }
      if (site.status === 'published') {
        setPublished(true);
        setSiteUrl(`https://hellobat.app/site/${site.slug}`);
        setStep(4);
      }
    }

    setLoadingProfile(false);
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleGenerate() {
    setGenerating(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Session expirée');

      // Fetch user services for context
      const { data: services } = await supabase
        .from('services')
        .select('name, description')
        .eq('user_id', user!.id)
        .limit(10);

      const res = await fetch('/api/ai/site-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          company_name: profile.company,
          activity: profile.activity,
          city: profile.city,
          slogan: profile.slogan || undefined,
          services: services || undefined,
          theme,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erreur de generation');
      }

      const data = await res.json();
      setSiteContent(data.site_content);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de generation');
    } finally {
      setGenerating(false);
    }
  }

  async function handlePublish() {
    if (!user || !siteContent) return;
    setPublishing(true);
    setError('');
    try {
      const slug = existingSite?.slug || generateSlug(profile.company, profile.city);

      const payload = {
        user_id: user.id,
        slug,
        status: 'published',
        theme,
        site_content: siteContent,
        show_services: showServices,
        show_projects: showProjects,
        show_reviews: showReviews,
        show_contact: showContact,
        custom_slogan: profile.slogan || '',
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      let result;
      if (existingSite) {
        result = await supabase
          .from('artisan_sites')
          .update(payload)
          .eq('id', existingSite.id)
          .select()
          .single();
      } else {
        result = await supabase
          .from('artisan_sites')
          .insert(payload)
          .select()
          .single();
      }

      if (result.error) throw result.error;

      setExistingSite(result.data as ArtisanSite);
      setPublished(true);
      const url = `https://hellobat.app/site/${slug}`;
      setSiteUrl(url);

      // Revalidate
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        fetch('/api/site/revalidate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ slug }),
        }).catch(() => {});
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : (err as { message?: string })?.message || 'Erreur de publication';
      setError(message);
    } finally {
      setPublishing(false);
    }
  }

  function handleCopyUrl() {
    navigator.clipboard.writeText(siteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loadingProfile) {
    return (
      <div className="space-y-6">
        <PageHeader title="Site web IA" description="Generez automatiquement un site vitrine professionnel" />
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 rounded-full border-2 border-muted animate-spin border-t-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Site web IA" description="Generez automatiquement un site vitrine professionnel">
        {published && siteUrl && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleCopyUrl} className="gap-2">
              {copied ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copie !' : 'Copier le lien'}
            </Button>
            <Button size="sm" asChild className="gap-2">
              <a href={siteUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" /> Voir le site
              </a>
            </Button>
          </div>
        )}
      </PageHeader>

      {/* Stepper */}
      <div className="flex items-center justify-center gap-1 sm:gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center">
            <button
              onClick={() => {
                if (s.id <= step || siteContent) setStep(s.id);
              }}
              className={cn(
                'flex items-center gap-2 rounded-full px-2 py-1.5 sm:px-4 sm:py-2 text-sm font-medium transition-all',
                step === s.id ? 'bg-primary text-primary-foreground shadow-md' :
                step > s.id ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'
              )}
            >
              {step > s.id ? <Check className="h-4 w-4" /> : <s.icon className="h-4 w-4" />}
              <span className="hidden sm:inline">{s.label}</span>
            </button>
            {i < STEPS.length - 1 && <ArrowRight className="h-4 w-4 mx-1 sm:mx-2 text-muted-foreground" />}
          </div>
        ))}
      </div>

      {error && (
        <div className="max-w-lg mx-auto p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Step 1: Profile */}
      {step === 1 && (
        <div className="max-w-lg mx-auto rounded-xl border border-border bg-card p-8 space-y-5">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Votre profil artisan</h2>
              <p className="text-sm text-muted-foreground">L&apos;IA generera le contenu a partir de ces informations</p>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Nom de l&apos;entreprise</label>
            <Input className="mt-1" placeholder="Ex: Dupont Plomberie" value={profile.company} onChange={e => setProfile({ ...profile, company: e.target.value })} />
          </div>
          <div>
            <label className="text-sm font-medium">Activite</label>
            <Input className="mt-1" placeholder="Ex: Plombier chauffagiste" value={profile.activity} onChange={e => setProfile({ ...profile, activity: e.target.value })} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Ville</label>
              <Input className="mt-1" placeholder="Ex: Lyon" value={profile.city} onChange={e => setProfile({ ...profile, city: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium">Telephone</label>
              <Input className="mt-1" placeholder="06 ..." value={profile.phone} onChange={e => setProfile({ ...profile, phone: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Slogan (optionnel)</label>
            <Input className="mt-1" placeholder="Ex: Votre confort, notre priorite" value={profile.slogan} onChange={e => setProfile({ ...profile, slogan: e.target.value })} />
          </div>
          <Button className="w-full" onClick={() => setStep(2)} disabled={!profile.company || !profile.activity}>
            Suivant <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Step 2: Theme */}
      {step === 2 && (
        <div className="max-w-lg mx-auto rounded-xl border border-border bg-card p-8 space-y-5">
          <h2 className="font-semibold text-foreground">Choisissez un theme</h2>
          <div className="grid grid-cols-2 gap-3">
            {(Object.keys(SITE_THEMES) as SiteTheme[]).map(t => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={cn(
                  'rounded-lg border-2 p-4 transition-all',
                  theme === t ? 'border-primary shadow-md' : 'border-border hover:border-border/80'
                )}
              >
                <div className={cn('h-20 rounded-md flex items-end p-2', SITE_THEMES[t].preview_bg)}>
                  <div className={cn('h-2 w-12 rounded-full', SITE_THEMES[t].preview_accent)} />
                </div>
                <p className="mt-2 text-sm font-medium text-foreground">{SITE_THEMES[t].name}</p>
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(1)}>Retour</Button>
            <Button className="flex-1" onClick={() => setStep(3)}>
              Suivant <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Sections + generate */}
      {step === 3 && (
        <div className="max-w-lg mx-auto rounded-xl border border-border bg-card p-8 space-y-5">
          <h2 className="font-semibold text-foreground">Sections du site</h2>
          <p className="text-sm text-muted-foreground">Activez ou desactivez les sections de votre site</p>

          {[
            { label: 'Accueil & Hero', enabled: true, toggle: null },
            { label: 'A propos', enabled: true, toggle: null },
            { label: 'Nos services', enabled: showServices, toggle: () => setShowServices(!showServices) },
            { label: 'Realisations', enabled: showProjects, toggle: () => setShowProjects(!showProjects) },
            { label: 'Temoignages', enabled: showReviews, toggle: () => setShowReviews(!showReviews) },
            { label: 'Contact', enabled: showContact, toggle: () => setShowContact(!showContact) },
          ].map((section) => (
            <div key={section.label} className="flex items-center justify-between rounded-lg border border-border p-3">
              <div className="flex items-center gap-3">
                <div className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-md',
                  section.enabled ? 'bg-primary/10' : 'bg-muted'
                )}>
                  <Check className={cn('h-4 w-4', section.enabled ? 'text-primary' : 'text-muted-foreground')} />
                </div>
                <span className={cn('text-sm font-medium', section.enabled ? 'text-foreground' : 'text-muted-foreground')}>
                  {section.label}
                </span>
              </div>
              {section.toggle && (
                <button
                  onClick={section.toggle}
                  className={cn(
                    'relative h-6 w-11 rounded-full transition-colors',
                    section.enabled ? 'bg-primary' : 'bg-muted'
                  )}
                >
                  <span className={cn(
                    'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform',
                    section.enabled && 'translate-x-5'
                  )} />
                </button>
              )}
            </div>
          ))}

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(2)}>Retour</Button>
            <Button
              className="flex-1"
              onClick={() => { setStep(4); handleGenerate(); }}
              disabled={generating}
            >
              <Sparkles className="mr-2 h-4 w-4" /> Generer le site
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: Preview + Publish */}
      {step === 4 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {generating ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="relative">
                <div className="h-16 w-16 rounded-full border-4 border-muted animate-spin border-t-primary" />
                <Sparkles className="absolute inset-0 m-auto h-6 w-6 text-primary" />
              </div>
              <p className="mt-6 font-semibold text-foreground">Generation en cours...</p>
              <p className="mt-1 text-sm text-muted-foreground">L&apos;IA cree votre site vitrine</p>
            </div>
          ) : siteContent ? (
            <div>
              {/* Mini preview */}
              <div
                className="p-8 sm:p-12 text-center"
                style={{
                  background: theme === 'modern' || theme === 'bold'
                    ? 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)'
                    : theme === 'warm'
                    ? 'linear-gradient(135deg, #fffbf5 0%, #fef3e2 100%)'
                    : 'linear-gradient(135deg, #ffffff 0%, #f8faf9 100%)',
                }}
              >
                <h1
                  className="text-xl sm:text-3xl font-bold"
                  style={{
                    color: theme === 'modern' || theme === 'bold' ? '#ffffff' : '#111827',
                  }}
                >
                  {siteContent.hero?.headline || profile.company}
                </h1>
                <p
                  className="mt-2 text-base sm:text-lg"
                  style={{
                    color: theme === 'modern' || theme === 'bold' ? '#94a3b8' : '#6b7280',
                  }}
                >
                  {siteContent.hero?.subheadline || profile.activity}
                </p>
                <div
                  className="mt-6 inline-block px-6 py-2.5 rounded-md text-white font-semibold text-sm"
                  style={{
                    backgroundColor:
                      theme === 'modern' ? '#3b82f6' :
                      theme === 'warm' ? '#d97706' :
                      theme === 'clean' ? '#059669' : '#ef4444',
                  }}
                >
                  {siteContent.hero?.cta_text || 'Demander un devis'}
                </div>
              </div>

              {/* Services preview */}
              {siteContent.services?.length > 0 && (
                <div className="p-4 sm:p-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {siteContent.services.slice(0, 3).map((s, i) => (
                    <div key={i} className="text-center p-4 rounded-lg border border-border">
                      <h3 className="font-semibold text-sm text-foreground">{s.name}</h3>
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{s.description}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* About preview */}
              {siteContent.about?.paragraphs?.[0] && (
                <div className="px-4 sm:px-8 pb-6">
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {siteContent.about.paragraphs[0]}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="border-t border-border p-6">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-center sm:text-left">
                    <p className="text-sm text-muted-foreground">
                      {published ? 'Votre site est en ligne !' : 'Apercu du site genere'}
                    </p>
                    {published && siteUrl && (
                      <p className="text-xs text-primary mt-1 font-mono">{siteUrl}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setSiteContent(null); handleGenerate(); }}
                      disabled={generating}
                    >
                      <RefreshCw className="mr-2 h-4 w-4" /> Regenerer
                    </Button>
                    {published ? (
                      <>
                        <Button variant="outline" size="sm" onClick={handlePublish} disabled={publishing}>
                          {publishing ? 'Mise a jour...' : 'Mettre a jour'}
                        </Button>
                        <Button size="sm" asChild>
                          <a href={siteUrl} target="_blank" rel="noopener noreferrer">
                            <Globe className="mr-2 h-4 w-4" /> Voir le site
                          </a>
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" onClick={handlePublish} disabled={publishing}>
                        {publishing ? (
                          <>
                            <div className="h-4 w-4 mr-2 rounded-full border-2 border-white/30 animate-spin border-t-white" />
                            Publication...
                          </>
                        ) : (
                          <>
                            <Globe className="mr-2 h-4 w-4" /> Publier
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center px-4">
              <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="font-semibold text-foreground">Pret a generer votre site</p>
              <p className="mt-1 text-sm text-muted-foreground">Revenez a l&apos;etape 3 pour lancer la generation</p>
              <Button className="mt-4" onClick={() => setStep(3)}>
                Retour a la generation
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
