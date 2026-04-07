'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Globe, Sparkles, Eye, Palette, Type, ArrowRight, Check,
  RefreshCw, ExternalLink, Copy, CheckCircle2, Pencil, X,
  Plus, Trash2, ChevronDown, ChevronUp, MapPin, Image,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { generateSlug, SITE_THEMES, type SiteTheme, type SiteContent, type ArtisanSite } from '@/lib/site-utils';
import { SiteImageUpload } from '@/components/site/site-image-upload';

const STEPS = [
  { id: 1, label: 'Informations', icon: Type },
  { id: 2, label: 'Design', icon: Palette },
  { id: 3, label: 'Sections', icon: Image },
  { id: 4, label: 'Apercu', icon: Eye },
];

const CERTIFICATIONS = [
  'RGE (Reconnu Garant de l\'Environnement)',
  'Qualibat',
  'Qualifelec',
  'QualiPAC',
  'QualiSol',
  'Handibat',
  'Eco Artisan',
  'NF Habitat',
  'Garantie decennale',
  'Assurance RC Pro',
];

export default function SiteWebPage() {
  const { user } = useAuth();
  const [step, setStep] = useState(1);

  // Step 1: Extended profile
  const [profile, setProfile] = useState({
    company: '',
    activity: '',
    city: '',
    phone: '',
    slogan: '',
    description: '',
    years_experience: '',
    zone: '',
    certifications: [] as string[],
    values: '',
    target_clients: '',
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

  // Images + legal
  const [logoUrl, setLogoUrl] = useState('');
  const [heroImageUrl, setHeroImageUrl] = useState('');
  const [legalText, setLegalText] = useState('');

  // Section toggles
  const [showServices, setShowServices] = useState(true);
  const [showProjects, setShowProjects] = useState(true);
  const [showReviews, setShowReviews] = useState(true);
  const [showContact, setShowContact] = useState(true);
  const [showMap, setShowMap] = useState(true);

  // Edit mode
  const [editing, setEditing] = useState<string | null>(null);

  // Load existing profile + site
  const loadData = useCallback(async () => {
    if (!user) return;
    setLoadingProfile(true);

    const [profileRes, siteRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
      supabase.from('artisan_sites').select('*').eq('user_id', user.id).maybeSingle(),
    ]);

    if (profileRes.data) {
      setProfile(prev => ({
        ...prev,
        company: profileRes.data.company_name || '',
        activity: profileRes.data.company_activity || '',
        city: profileRes.data.company_city || '',
        phone: profileRes.data.company_phone || '',
      }));
      if (profileRes.data.logo_url) setLogoUrl(profileRes.data.logo_url);
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
      setShowMap(site.show_map ?? true);
      if (site.hero_image_url) setHeroImageUrl(site.hero_image_url);
      if (site.legal_text) setLegalText(site.legal_text);
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
      if (!session?.access_token) throw new Error('Session expiree');

      const { data: services } = await supabase
        .from('services')
        .select('name, description')
        .eq('user_id', user!.id)
        .is('deleted_at', null)
        .limit(10);

      const { data: reviews } = await supabase
        .from('reviews')
        .select('rating')
        .eq('user_id', user!.id);

      const avgRating = reviews && reviews.length > 0
        ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
        : null;

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
          description: profile.description || undefined,
          years_experience: profile.years_experience || undefined,
          zone: profile.zone || undefined,
          certifications: profile.certifications.length > 0 ? profile.certifications : undefined,
          values: profile.values || undefined,
          target_clients: profile.target_clients || undefined,
          services: services || undefined,
          theme,
          review_count: reviews?.length || 0,
          avg_rating: avgRating,
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

      // Save logo to profiles if changed
      if (logoUrl) {
        await supabase.from('profiles').update({ logo_url: logoUrl }).eq('id', user.id);
      }

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
        show_map: showMap,
        hero_image_url: heroImageUrl || '',
        legal_text: legalText || '',
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

  // --- Inline edit helpers ---
  function updateHero(field: string, value: string) {
    if (!siteContent) return;
    setSiteContent({ ...siteContent, hero: { ...siteContent.hero, [field]: value } });
  }
  function updateAbout(field: string, value: string | string[]) {
    if (!siteContent) return;
    setSiteContent({ ...siteContent, about: { ...siteContent.about, [field]: value } });
  }
  function updateService(index: number, field: string, value: string) {
    if (!siteContent) return;
    const services = [...siteContent.services];
    services[index] = { ...services[index], [field]: value };
    setSiteContent({ ...siteContent, services });
  }
  function addService() {
    if (!siteContent) return;
    setSiteContent({
      ...siteContent,
      services: [...siteContent.services, { name: 'Nouveau service', description: 'Description du service', icon: 'Wrench' }],
    });
  }
  function removeService(index: number) {
    if (!siteContent) return;
    setSiteContent({
      ...siteContent,
      services: siteContent.services.filter((_, i) => i !== index),
    });
  }
  function updateContact(field: string, value: string) {
    if (!siteContent) return;
    setSiteContent({ ...siteContent, contact: { ...siteContent.contact, [field]: value } });
  }
  function updateFaq(index: number, field: string, value: string) {
    if (!siteContent || !siteContent.faq) return;
    const faq = [...siteContent.faq];
    faq[index] = { ...faq[index], [field]: value };
    setSiteContent({ ...siteContent, faq });
  }
  function addFaq() {
    if (!siteContent) return;
    setSiteContent({
      ...siteContent,
      faq: [...(siteContent.faq || []), { question: 'Nouvelle question', answer: 'Reponse...' }],
    });
  }
  function removeFaq(index: number) {
    if (!siteContent || !siteContent.faq) return;
    setSiteContent({
      ...siteContent,
      faq: siteContent.faq.filter((_, i) => i !== index),
    });
  }
  function updateFooter(value: string) {
    if (!siteContent) return;
    setSiteContent({ ...siteContent, footer: { ...siteContent.footer, tagline: value } });
  }

  function toggleCertification(cert: string) {
    setProfile(prev => ({
      ...prev,
      certifications: prev.certifications.includes(cert)
        ? prev.certifications.filter(c => c !== cert)
        : [...prev.certifications, cert],
    }));
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
              onClick={() => { if (s.id <= step || siteContent) setStep(s.id); }}
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
        <div className="max-w-2xl mx-auto p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ═══ Step 1: Extended Profile ═══ */}
      {step === 1 && (
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Basic info */}
          <div className="rounded-xl border border-border bg-card p-6 sm:p-8 space-y-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold text-foreground">Informations de base</h2>
                <p className="text-sm text-muted-foreground">Plus vous en donnez, meilleur sera le site</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="text-sm font-medium">Nom de l&apos;entreprise *</label>
                <Input className="mt-1" placeholder="Ex: Dupont Plomberie" value={profile.company} onChange={e => setProfile({ ...profile, company: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">Activite principale *</label>
                <Input className="mt-1" placeholder="Ex: Plombier chauffagiste" value={profile.activity} onChange={e => setProfile({ ...profile, activity: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">Ville</label>
                <Input className="mt-1" placeholder="Ex: Lyon" value={profile.city} onChange={e => setProfile({ ...profile, city: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">Telephone</label>
                <Input className="mt-1" placeholder="06 ..." value={profile.phone} onChange={e => setProfile({ ...profile, phone: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">Annees d&apos;experience</label>
                <Input className="mt-1" placeholder="Ex: 15" value={profile.years_experience} onChange={e => setProfile({ ...profile, years_experience: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Slogan / phrase d&apos;accroche</label>
              <Input className="mt-1" placeholder="Ex: Votre confort, notre priorite" value={profile.slogan} onChange={e => setProfile({ ...profile, slogan: e.target.value })} />
            </div>
          </div>

          {/* Detailed info */}
          <div className="rounded-xl border border-border bg-card p-6 sm:p-8 space-y-5">
            <h2 className="font-semibold text-foreground">Pour un site encore meilleur</h2>
            <div>
              <label className="text-sm font-medium">Decrivez votre entreprise en quelques phrases</label>
              <Textarea
                className="mt-1 min-h-[80px]"
                placeholder="Ex: Entreprise familiale creee en 2008, specialisee dans la renovation energetique. Nous intervenons sur Lyon et sa region pour tous vos travaux de plomberie et chauffage..."
                value={profile.description}
                onChange={e => setProfile({ ...profile, description: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Zone d&apos;intervention</label>
              <Input className="mt-1" placeholder="Ex: Lyon et sa metropole, Villeurbanne, Bron, Venissieux..." value={profile.zone} onChange={e => setProfile({ ...profile, zone: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium">Vos clients cibles</label>
              <Input className="mt-1" placeholder="Ex: Particuliers, syndics de copropriete, commerces..." value={profile.target_clients} onChange={e => setProfile({ ...profile, target_clients: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium">Vos valeurs / ce qui vous differencie</label>
              <Textarea
                className="mt-1 min-h-[60px]"
                placeholder="Ex: Ponctualite, proprete du chantier, devis gratuit sous 24h, travail soigne..."
                value={profile.values}
                onChange={e => setProfile({ ...profile, values: e.target.value })}
              />
            </div>
          </div>

          {/* Certifications */}
          <div className="rounded-xl border border-border bg-card p-6 sm:p-8 space-y-4">
            <h2 className="font-semibold text-foreground">Certifications et labels</h2>
            <p className="text-sm text-muted-foreground">Selectionnez ceux que vous possedez</p>
            <div className="flex flex-wrap gap-2">
              {CERTIFICATIONS.map(cert => (
                <button
                  key={cert}
                  onClick={() => toggleCertification(cert)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                    profile.certifications.includes(cert)
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-card text-muted-foreground border-border hover:border-primary/50'
                  )}
                >
                  {profile.certifications.includes(cert) && <Check className="inline h-3 w-3 mr-1" />}
                  {cert}
                </button>
              ))}
            </div>
          </div>

          {/* Images */}
          <div className="rounded-xl border border-border bg-card p-6 sm:p-8 space-y-5">
            <h2 className="font-semibold text-foreground">Images du site</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="text-sm font-medium mb-2 block">Logo de l&apos;entreprise</label>
                <SiteImageUpload
                  value={logoUrl}
                  onChange={setLogoUrl}
                  label="Ajoutez votre logo"
                  hint="PNG ou SVG transparent, 2 Mo max"
                  aspectRatio="aspect-square"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Image hero (fond de la page d&apos;accueil)</label>
                <SiteImageUpload
                  value={heroImageUrl}
                  onChange={setHeroImageUrl}
                  label="Photo de chantier, equipe..."
                  hint="Format paysage recommande, 5 Mo max"
                  aspectRatio="aspect-video"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Ces images seront affichees sur votre site. Vous pourrez les modifier apres publication.
            </p>
          </div>

          <Button className="w-full" size="lg" onClick={() => setStep(2)} disabled={!profile.company || !profile.activity}>
            Suivant <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )}

      {/* ═══ Step 2: Theme ═══ */}
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
            <Button className="flex-1" onClick={() => setStep(3)}>Suivant <ArrowRight className="ml-2 h-4 w-4" /></Button>
          </div>
        </div>
      )}

      {/* ═══ Step 3: Sections + generate ═══ */}
      {step === 3 && (
        <div className="max-w-lg mx-auto rounded-xl border border-border bg-card p-8 space-y-5">
          <h2 className="font-semibold text-foreground">Sections du site</h2>
          <p className="text-sm text-muted-foreground">Activez ou desactivez les sections</p>

          {[
            { label: 'Accueil & Hero', enabled: true, toggle: null },
            { label: 'A propos', enabled: true, toggle: null },
            { label: 'Nos services', enabled: showServices, toggle: () => setShowServices(!showServices) },
            { label: 'Realisations', enabled: showProjects, toggle: () => setShowProjects(!showProjects) },
            { label: 'Carte des chantiers', enabled: showMap, toggle: () => setShowMap(!showMap), icon: MapPin },
            { label: 'Temoignages', enabled: showReviews, toggle: () => setShowReviews(!showReviews) },
            { label: 'FAQ', enabled: true, toggle: null },
            { label: 'Contact', enabled: showContact, toggle: () => setShowContact(!showContact) },
          ].map((section) => (
            <div key={section.label} className="flex items-center justify-between rounded-lg border border-border p-3">
              <div className="flex items-center gap-3">
                <div className={cn('flex h-8 w-8 items-center justify-center rounded-md', section.enabled ? 'bg-primary/10' : 'bg-muted')}>
                  <Check className={cn('h-4 w-4', section.enabled ? 'text-primary' : 'text-muted-foreground')} />
                </div>
                <span className={cn('text-sm font-medium', section.enabled ? 'text-foreground' : 'text-muted-foreground')}>
                  {section.label}
                </span>
              </div>
              {section.toggle && (
                <button
                  onClick={section.toggle}
                  className={cn('relative h-6 w-11 rounded-full transition-colors', section.enabled ? 'bg-primary' : 'bg-muted')}
                >
                  <span className={cn('absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform', section.enabled && 'translate-x-5')} />
                </button>
              )}
            </div>
          ))}

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(2)}>Retour</Button>
            <Button className="flex-1" onClick={() => { setStep(4); handleGenerate(); }} disabled={generating}>
              <Sparkles className="mr-2 h-4 w-4" /> Generer le site
            </Button>
          </div>
        </div>
      )}

      {/* ═══ Step 4: Preview + Edit + Publish ═══ */}
      {step === 4 && (
        <div className="space-y-4">
          {generating ? (
            <div className="rounded-xl border border-border bg-card flex flex-col items-center justify-center py-20">
              <div className="relative">
                <div className="h-16 w-16 rounded-full border-4 border-muted animate-spin border-t-primary" />
                <Sparkles className="absolute inset-0 m-auto h-6 w-6 text-primary" />
              </div>
              <p className="mt-6 font-semibold text-foreground">Generation en cours...</p>
              <p className="mt-1 text-sm text-muted-foreground">L&apos;IA cree votre site vitrine</p>
            </div>
          ) : siteContent ? (
            <>
              {/* Action bar */}
              <div className="rounded-xl border border-border bg-card p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {published ? 'Votre site est en ligne' : 'Apercu du site genere'}
                  </p>
                  {published && siteUrl && (
                    <p className="text-xs text-primary mt-0.5 font-mono">{siteUrl}</p>
                  )}
                </div>
                <div className="flex gap-2 flex-wrap justify-center">
                  <Button variant="outline" size="sm" onClick={() => { setSiteContent(null); handleGenerate(); }} disabled={generating}>
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
                        <><div className="h-4 w-4 mr-2 rounded-full border-2 border-white/30 animate-spin border-t-white" /> Publication...</>
                      ) : (
                        <><Globe className="mr-2 h-4 w-4" /> Publier</>
                      )}
                    </Button>
                  )}
                </div>
              </div>

              <p className="text-xs text-center text-muted-foreground">
                Cliquez sur <Pencil className="inline h-3 w-3" /> pour modifier chaque section
              </p>

              {/* ── Hero ── */}
              <EditableSection title="Hero" editing={editing} section="hero" setEditing={setEditing}>
                {editing === 'hero' ? (
                  <div className="space-y-3 p-4">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Titre principal</label>
                      <Input value={siteContent.hero.headline} onChange={e => updateHero('headline', e.target.value)} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Sous-titre</label>
                      <Input value={siteContent.hero.subheadline} onChange={e => updateHero('subheadline', e.target.value)} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Texte du bouton</label>
                      <Input value={siteContent.hero.cta_text} onChange={e => updateHero('cta_text', e.target.value)} />
                    </div>
                  </div>
                ) : (
                  <div className="p-6 text-center" style={{
                    background: theme === 'modern' || theme === 'bold'
                      ? 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)'
                      : theme === 'warm'
                      ? 'linear-gradient(135deg, #fffbf5 0%, #fef3e2 100%)'
                      : 'linear-gradient(135deg, #f8faf9 0%, #ffffff 100%)',
                    borderRadius: '0.5rem',
                  }}>
                    <h1 className="text-lg sm:text-2xl font-bold" style={{ color: theme === 'modern' || theme === 'bold' ? '#fff' : '#111827' }}>
                      {siteContent.hero.headline}
                    </h1>
                    <p className="mt-2 text-sm" style={{ color: theme === 'modern' || theme === 'bold' ? '#94a3b8' : '#6b7280' }}>
                      {siteContent.hero.subheadline}
                    </p>
                    <div className="mt-4 inline-block px-5 py-2 rounded-md text-white text-sm font-semibold" style={{
                      backgroundColor: theme === 'modern' ? '#3b82f6' : theme === 'warm' ? '#d97706' : theme === 'clean' ? '#059669' : '#ef4444',
                    }}>
                      {siteContent.hero.cta_text}
                    </div>
                  </div>
                )}
              </EditableSection>

              {/* ── About ── */}
              <EditableSection title="A propos" editing={editing} section="about" setEditing={setEditing}>
                {editing === 'about' ? (
                  <div className="space-y-3 p-4">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Titre</label>
                      <Input value={siteContent.about.title} onChange={e => updateAbout('title', e.target.value)} />
                    </div>
                    {siteContent.about.paragraphs.map((p, i) => (
                      <div key={i}>
                        <label className="text-xs font-medium text-muted-foreground">Paragraphe {i + 1}</label>
                        <Textarea
                          value={p}
                          onChange={e => {
                            const paras = [...siteContent.about.paragraphs];
                            paras[i] = e.target.value;
                            updateAbout('paragraphs', paras);
                          }}
                          className="min-h-[80px]"
                        />
                      </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={() => updateAbout('paragraphs', [...siteContent.about.paragraphs, ''])}>
                      <Plus className="h-3 w-3 mr-1" /> Ajouter un paragraphe
                    </Button>
                  </div>
                ) : (
                  <div className="p-4">
                    <h3 className="font-semibold text-foreground mb-2">{siteContent.about.title}</h3>
                    {siteContent.about.paragraphs.map((p, i) => (
                      <p key={i} className="text-sm text-muted-foreground mb-2">{p}</p>
                    ))}
                    {siteContent.about.highlights && siteContent.about.highlights.length > 0 && (
                      <div className="flex flex-wrap gap-4 mt-3">
                        {siteContent.about.highlights.map((h, i) => (
                          <div key={i} className="text-center">
                            <p className="text-lg font-bold text-primary">{h.value}</p>
                            <p className="text-xs text-muted-foreground">{h.label}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </EditableSection>

              {/* ── Services ── */}
              <EditableSection title="Services" editing={editing} section="services" setEditing={setEditing}>
                {editing === 'services' ? (
                  <div className="space-y-3 p-4">
                    {siteContent.services.map((s, i) => (
                      <div key={i} className="flex gap-2 items-start">
                        <div className="flex-1 space-y-1">
                          <Input value={s.name} onChange={e => updateService(i, 'name', e.target.value)} placeholder="Nom" />
                          <Input value={s.description} onChange={e => updateService(i, 'description', e.target.value)} placeholder="Description" />
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => removeService(i)} className="text-red-500 mt-1">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={addService}>
                      <Plus className="h-3 w-3 mr-1" /> Ajouter un service
                    </Button>
                  </div>
                ) : (
                  <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {siteContent.services.map((s, i) => (
                      <div key={i} className="rounded-lg border border-border p-3">
                        <p className="text-sm font-semibold text-foreground">{s.name}</p>
                        <p className="text-xs text-muted-foreground mt-1">{s.description}</p>
                      </div>
                    ))}
                  </div>
                )}
              </EditableSection>

              {/* ── FAQ ── */}
              <EditableSection title="FAQ" editing={editing} section="faq" setEditing={setEditing}>
                {editing === 'faq' ? (
                  <div className="space-y-3 p-4">
                    {(siteContent.faq || []).map((f, i) => (
                      <div key={i} className="flex gap-2 items-start">
                        <div className="flex-1 space-y-1">
                          <Input value={f.question} onChange={e => updateFaq(i, 'question', e.target.value)} placeholder="Question" />
                          <Textarea value={f.answer} onChange={e => updateFaq(i, 'answer', e.target.value)} placeholder="Reponse" className="min-h-[60px]" />
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => removeFaq(i)} className="text-red-500 mt-1">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={addFaq}>
                      <Plus className="h-3 w-3 mr-1" /> Ajouter une question
                    </Button>
                  </div>
                ) : (
                  <div className="p-4 space-y-2">
                    {(siteContent.faq || []).length === 0 ? (
                      <p className="text-sm text-muted-foreground">Aucune FAQ. Cliquez sur modifier pour en ajouter.</p>
                    ) : (
                      (siteContent.faq || []).map((f, i) => (
                        <div key={i} className="border border-border rounded-lg p-3">
                          <p className="text-sm font-semibold text-foreground">{f.question}</p>
                          <p className="text-xs text-muted-foreground mt-1">{f.answer}</p>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </EditableSection>

              {/* ── Contact ��─ */}
              <EditableSection title="Contact" editing={editing} section="contact" setEditing={setEditing}>
                {editing === 'contact' ? (
                  <div className="space-y-3 p-4">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Titre</label>
                      <Input value={siteContent.contact.title} onChange={e => updateContact('title', e.target.value)} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Description</label>
                      <Textarea value={siteContent.contact.description} onChange={e => updateContact('description', e.target.value)} className="min-h-[60px]" />
                    </div>
                  </div>
                ) : (
                  <div className="p-4">
                    <h3 className="font-semibold text-foreground">{siteContent.contact.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{siteContent.contact.description}</p>
                  </div>
                )}
              </EditableSection>

              {/* ── Footer tagline ─��� */}
              <EditableSection title="Pied de page" editing={editing} section="footer" setEditing={setEditing}>
                {editing === 'footer' ? (
                  <div className="p-4">
                    <label className="text-xs font-medium text-muted-foreground">Slogan</label>
                    <Input value={siteContent.footer.tagline} onChange={e => updateFooter(e.target.value)} />
                  </div>
                ) : (
                  <div className="p-4">
                    <p className="text-sm text-muted-foreground">{siteContent.footer.tagline}</p>
                  </div>
                )}
              </EditableSection>

              {/* ── Mentions legales ── */}
              <EditableSection title="Mentions legales / CGV" editing={editing} section="legal" setEditing={setEditing}>
                {editing === 'legal' ? (
                  <div className="p-4 space-y-3">
                    <p className="text-xs text-muted-foreground">
                      Ajoutez vos conditions generales, mentions legales ou tout autre texte juridique.
                    </p>
                    <Textarea
                      value={legalText}
                      onChange={e => setLegalText(e.target.value)}
                      className="min-h-[200px] text-sm font-mono"
                      placeholder={"Mentions legales\n\nRaison sociale : ...\nSIRET : ...\nAdresse : ...\n\nConditions generales\n\n..."}
                    />
                  </div>
                ) : (
                  <div className="p-4">
                    {legalText ? (
                      <p className="text-sm text-muted-foreground whitespace-pre-line line-clamp-6">{legalText}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">Aucune mention legale. Cliquez sur Modifier pour en ajouter.</p>
                    )}
                  </div>
                )}
              </EditableSection>

              {/* ── Images ── */}
              <EditableSection title="Images" editing={editing} section="images" setEditing={setEditing}>
                {editing === 'images' ? (
                  <div className="p-4 space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Logo</label>
                      <SiteImageUpload value={logoUrl} onChange={setLogoUrl} aspectRatio="aspect-square" className="max-w-[160px]" />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Image hero</label>
                      <SiteImageUpload value={heroImageUrl} onChange={setHeroImageUrl} aspectRatio="aspect-video" />
                    </div>
                  </div>
                ) : (
                  <div className="p-4 flex gap-4">
                    {logoUrl ? (
                      <img src={logoUrl} alt="Logo" className="h-16 w-16 rounded-lg object-cover border border-border" />
                    ) : (
                      <div className="h-16 w-16 rounded-lg bg-muted/30 flex items-center justify-center text-xs text-muted-foreground">Logo</div>
                    )}
                    {heroImageUrl ? (
                      <img src={heroImageUrl} alt="Hero" className="h-16 w-28 rounded-lg object-cover border border-border" />
                    ) : (
                      <div className="h-16 w-28 rounded-lg bg-muted/30 flex items-center justify-center text-xs text-muted-foreground">Hero</div>
                    )}
                  </div>
                )}
              </EditableSection>
            </>
          ) : (
            <div className="rounded-xl border border-border bg-card flex flex-col items-center justify-center py-20 text-center px-4">
              <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="font-semibold text-foreground">Pret a generer votre site</p>
              <p className="mt-1 text-sm text-muted-foreground">Revenez a l&apos;etape 3 pour lancer la generation</p>
              <Button className="mt-4" onClick={() => setStep(3)}>Retour a la generation</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Editable section wrapper ──
function EditableSection({
  title,
  editing,
  section,
  setEditing,
  children,
}: {
  title: string;
  editing: string | null;
  section: string;
  setEditing: (s: string | null) => void;
  children: React.ReactNode;
}) {
  const isEditing = editing === section;
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 text-xs"
          onClick={() => setEditing(isEditing ? null : section)}
        >
          {isEditing ? <><X className="h-3 w-3" /> Fermer</> : <><Pencil className="h-3 w-3" /> Modifier</>}
        </Button>
      </div>
      {children}
    </div>
  );
}
