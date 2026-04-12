'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import {
  Globe, Sparkles, Eye, Palette, Type, ArrowRight, Check,
  RefreshCw, ExternalLink, Copy, CheckCircle2, Pencil, X,
  Plus, Trash2, MapPin, Image, Lock, Info, MessageCircle,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { generateSlug, slugify, SITE_THEMES, type SiteTheme, type SiteContent, type ArtisanSite } from '@/lib/site-utils';
import { SiteImageUpload } from '@/components/site/site-image-upload';
import { ThemePreviewCard } from '@/components/site/theme-preview-card';
import { ThemePreviewModal } from '@/components/site/theme-preview-modal';
import { SERVICE_ICONS } from '@/components/site/site-service-icons';

// Chargement dynamique cote client uniquement : la modale embarque Leaflet
// qui touche `window` a l'import et casserait le prerendering SSR.
const SitePreviewModal = dynamic(
  () => import('@/components/site/site-preview-modal').then((m) => m.SitePreviewModal),
  { ssr: false }
);

const STEPS = [
  { id: 1, label: 'Informations', icon: Type },
  { id: 2, label: 'Design', icon: Palette },
  { id: 3, label: 'Sections', icon: Image },
  { id: 4, label: 'Aperçu', icon: Eye },
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
  const [heroLayout, setHeroLayout] = useState<'single' | 'grid' | 'carousel'>('single');
  const [heroImages, setHeroImages] = useState<string[]>(['', '', '']);
  const [legalText, setLegalText] = useState('');

  // Téléphone affiché sur le site public (à côté du bouton devis)
  const [publicPhone, setPublicPhone] = useState('');

  // WhatsApp + réseaux sociaux
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [socialLinks, setSocialLinks] = useState({
    instagram: '',
    tiktok: '',
    facebook: '',
    linkedin: '',
  });

  // Adresse publique du site (slug) + contrôle de disponibilité
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'available' | 'unavailable'>('idle');
  const [slugMessage, setSlugMessage] = useState('');

  // Section toggles
  const [showServices, setShowServices] = useState(true);
  const [showProjects, setShowProjects] = useState(true);
  const [showReviews, setShowReviews] = useState(true);
  const [showContact, setShowContact] = useState(true);
  const [showMap, setShowMap] = useState(true);

  // Edit mode
  const [editing, setEditing] = useState<string | null>(null);

  // Theme preview modal
  const [previewTheme, setPreviewTheme] = useState<SiteTheme | null>(null);

  // Full site preview modal (Step 4)
  const [showSitePreview, setShowSitePreview] = useState(false);

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
      // Par défaut, le téléphone public affiche le téléphone de l'entreprise
      setPublicPhone(profileRes.data.company_phone || '');
      // Slug par défaut généré à partir du nom + ville
      const defaultSlug = generateSlug(
        profileRes.data.company_name || '',
        profileRes.data.company_city || null,
      );
      if (defaultSlug) setSlug(defaultSlug);
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
      if (site.hero_layout) setHeroLayout(site.hero_layout);
      // On s'assure d'avoir toujours 3 slots pour l'édition
      const imgs = Array.isArray(site.hero_images) ? site.hero_images.slice(0, 3) : [];
      // Compat : si hero_images est vide mais qu'il y a une hero_image_url legacy,
      // on l'injecte en premier slot pour ne pas perdre l'image existante.
      if (imgs.length === 0 && site.hero_image_url) imgs.push(site.hero_image_url);
      while (imgs.length < 3) imgs.push('');
      setHeroImages(imgs);
      if (site.legal_text) setLegalText(site.legal_text);
      if (site.custom_slogan) {
        setProfile(prev => ({ ...prev, slogan: site.custom_slogan }));
      }
      if (site.public_phone) setPublicPhone(site.public_phone);
      if (site.whatsapp_phone) setWhatsappPhone(site.whatsapp_phone);
      if (site.social_links && typeof site.social_links === 'object') {
        setSocialLinks(prev => ({ ...prev, ...(site.social_links as Record<string, string>) }));
      }
      if (site.slug) setSlug(site.slug);
      if (site.status === 'published') {
        setPublished(true);
        setSiteUrl(`https://${site.slug}.hellobat.app`);
        setStep(4);
      }
    }

    setLoadingProfile(false);
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  // Debounced slug availability check
  useEffect(() => {
    if (!slug) {
      setSlugStatus('idle');
      setSlugMessage('');
      return;
    }
    setSlugStatus('checking');
    setSlugMessage('');
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) return;
        const res = await fetch(`/api/site/check-slug?slug=${encodeURIComponent(slug)}`, {
          signal: controller.signal,
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const data = await res.json();
        if (data.available) {
          setSlugStatus('available');
          setSlugMessage(data.reason === 'owned' ? 'C\u2019est votre adresse actuelle' : 'Adresse disponible');
        } else {
          setSlugStatus('unavailable');
          setSlugMessage(data.message || 'Adresse indisponible');
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setSlugStatus('idle');
        }
      }
    }, 400);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [slug]);

  async function handleGenerate() {
    setGenerating(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Session expirée');

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
        throw new Error(err.error || 'Erreur de génération');
      }

      const data = await res.json();
      setSiteContent(data.site_content);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de génération');
    } finally {
      setGenerating(false);
    }
  }

  async function handlePublish() {
    if (!user || !siteContent) return;

    // Slug de secours si l'utilisateur n'a rien saisi
    const finalSlug = slug || generateSlug(profile.company, profile.city);
    if (!finalSlug) {
      setError('Veuillez choisir une adresse pour votre site');
      return;
    }
    if (slugStatus === 'unavailable') {
      setError('Cette adresse n\u2019est pas disponible, choisissez-en une autre');
      return;
    }
    if (slugStatus === 'checking') {
      setError('Vérification de l\u2019adresse en cours, merci de patienter un instant');
      return;
    }

    setPublishing(true);
    setError('');
    try {
      // Save logo to profiles if changed
      if (logoUrl) {
        await supabase.from('profiles').update({ logo_url: logoUrl }).eq('id', user.id);
      }

      const payload = {
        user_id: user.id,
        slug: finalSlug,
        status: 'published',
        theme,
        site_content: siteContent,
        show_services: showServices,
        show_projects: showProjects,
        show_reviews: showReviews,
        show_contact: showContact,
        show_map: showMap,
        hero_image_url: heroImageUrl || heroImages.find(Boolean) || '',
        hero_layout: heroLayout,
        hero_images: heroImages.filter(Boolean).slice(0, 3),
        legal_text: legalText || '',
        custom_slogan: profile.slogan || '',
        public_phone: publicPhone.trim() || '',
        whatsapp_phone: whatsappPhone.trim() || '',
        social_links: Object.fromEntries(
          Object.entries(socialLinks).filter(([, v]) => v.trim())
        ),
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
      const url = `https://${finalSlug}.hellobat.app`;
      setSiteUrl(url);

      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        fetch('/api/site/revalidate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            slug: finalSlug,
            oldSlug: existingSite?.slug !== finalSlug ? existingSite?.slug : undefined,
          }),
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
  function updateAbout(
    field: string,
    value: string | string[] | { label: string; value: string }[],
  ) {
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
      faq: [...(siteContent.faq || []), { question: 'Nouvelle question', answer: 'Réponse…' }],
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
        <PageHeader title="Site web IA" description="Générez automatiquement un site vitrine professionnel" />
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 rounded-full border-2 border-muted animate-spin border-t-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Site web IA" description="Générez automatiquement un site vitrine professionnel">
        {published && siteUrl && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleCopyUrl} className="gap-2">
              {copied ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copié !' : 'Copier le lien'}
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
                <Input className="mt-1" placeholder="Ex : Dupont Plomberie" value={profile.company} onChange={e => setProfile({ ...profile, company: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">Activité principale *</label>
                <Input className="mt-1" placeholder="Ex : Plombier chauffagiste" value={profile.activity} onChange={e => setProfile({ ...profile, activity: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">Ville</label>
                <Input className="mt-1" placeholder="Ex : Lyon" value={profile.city} onChange={e => setProfile({ ...profile, city: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">Téléphone</label>
                <Input className="mt-1" placeholder="06 …" value={profile.phone} onChange={e => setProfile({ ...profile, phone: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">Années d&apos;expérience</label>
                <Input className="mt-1" placeholder="Ex : 15" value={profile.years_experience} onChange={e => setProfile({ ...profile, years_experience: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <label className="text-sm font-medium">Téléphone affiché sur le site public</label>
                <Input
                  className="mt-1"
                  placeholder="Ex : 04 78 12 34 56"
                  value={publicPhone}
                  onChange={e => setPublicPhone(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Ce numéro apparaît à côté du bouton &laquo;&nbsp;Demander un devis gratuit&nbsp;&raquo; sur votre site. Vous pouvez le modifier à tout moment.
                </p>
              </div>

              <div className="sm:col-span-2">
                <label className="text-sm font-medium">Adresse publique de votre site</label>
                <div
                  className={cn(
                    'mt-1 flex items-stretch rounded-md border bg-background overflow-hidden transition-colors',
                    slugTouched && slugStatus === 'unavailable'
                      ? 'border-red-500 focus-within:ring-2 focus-within:ring-red-500/30'
                      : slugTouched && slugStatus === 'available'
                      ? 'border-green-500 focus-within:ring-2 focus-within:ring-green-500/30'
                      : 'border-input focus-within:ring-2 focus-within:ring-ring/30'
                  )}
                >
                  <span className="flex items-center px-3 text-sm text-muted-foreground bg-muted/40 border-r border-input select-none whitespace-nowrap">
                    https://
                  </span>
                  <input
                    type="text"
                    className="flex-1 min-w-0 px-3 py-2 text-sm bg-transparent outline-none"
                    placeholder="mon-entreprise"
                    value={slug}
                    onChange={e => {
                      setSlugTouched(true);
                      // Normalise la saisie en direct pour éviter les caractères invalides
                      setSlug(slugify(e.target.value, 60));
                    }}
                    maxLength={60}
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <span className="flex items-center px-2 text-sm text-muted-foreground bg-muted/40 border-l border-input select-none whitespace-nowrap">
                    .hellobat.app
                  </span>
                  <span className="flex items-center pr-3 text-xs font-medium">
                    {slugStatus === 'checking' && (
                      <RefreshCw className="w-3.5 h-3.5 text-muted-foreground animate-spin" />
                    )}
                    {slugStatus === 'available' && (
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                    )}
                    {slugStatus === 'unavailable' && (
                      <X className="w-4 h-4 text-red-600" />
                    )}
                  </span>
                </div>
                {slugTouched && slugMessage ? (
                  <p
                    className={cn(
                      'text-xs mt-1',
                      slugStatus === 'unavailable' ? 'text-red-600' : 'text-green-600'
                    )}
                  >
                    {slugMessage}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground mt-1">
                    Personnalisez la fin de l&apos;URL. Lettres minuscules, chiffres et tirets uniquement.
                  </p>
                )}
                {existingSite?.slug && slug && existingSite.slug !== slug && (
                  <p className="text-xs text-amber-600 mt-1">
                    Attention : changer l&apos;adresse rendra l&apos;ancienne URL inaccessible.
                  </p>
                )}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Slogan / phrase d&apos;accroche</label>
              <Input className="mt-1" placeholder="Ex : Votre confort, notre priorité" value={profile.slogan} onChange={e => setProfile({ ...profile, slogan: e.target.value })} />
            </div>
          </div>

          {/* Detailed info */}
          <div className="rounded-xl border border-border bg-card p-6 sm:p-8 space-y-5">
            <h2 className="font-semibold text-foreground">Pour un site encore meilleur</h2>
            <div>
              <label className="text-sm font-medium">Décrivez votre entreprise en quelques phrases</label>
              <Textarea
                className="mt-1 min-h-[80px]"
                placeholder="Ex : Entreprise familiale créée en 2008, spécialisée dans la rénovation énergétique. Nous intervenons sur Lyon et sa région pour tous vos travaux de plomberie et chauffage…"
                value={profile.description}
                onChange={e => setProfile({ ...profile, description: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Zone d&apos;intervention</label>
              <Input className="mt-1" placeholder="Ex : Lyon et sa métropole, Villeurbanne, Bron, Vénissieux…" value={profile.zone} onChange={e => setProfile({ ...profile, zone: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium">Vos clients cibles</label>
              <Input className="mt-1" placeholder="Ex : Particuliers, syndics de copropriété, commerces…" value={profile.target_clients} onChange={e => setProfile({ ...profile, target_clients: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium">Vos valeurs / ce qui vous différencie</label>
              <Textarea
                className="mt-1 min-h-[60px]"
                placeholder="Ex : Ponctualité, propreté du chantier, devis gratuit sous 24h, travail soigné…"
                value={profile.values}
                onChange={e => setProfile({ ...profile, values: e.target.value })}
              />
            </div>
          </div>

          {/* Certifications */}
          <div className="rounded-xl border border-border bg-card p-6 sm:p-8 space-y-4">
            <h2 className="font-semibold text-foreground">Certifications et labels</h2>
            <p className="text-sm text-muted-foreground">Sélectionnez ceux que vous possédez</p>
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

          {/* WhatsApp + Réseaux sociaux */}
          <div className="rounded-xl border border-border bg-card p-6 sm:p-8 space-y-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                <MessageCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <h2 className="font-semibold text-foreground">WhatsApp &amp; Réseaux sociaux</h2>
                <p className="text-sm text-muted-foreground">Permettez à vos visiteurs de vous contacter et de vous suivre</p>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Numéro WhatsApp</label>
              <Input
                className="mt-1"
                placeholder="Ex : 06 12 34 56 78"
                value={whatsappPhone}
                onChange={e => setWhatsappPhone(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Un bouton WhatsApp flottant apparaîtra sur votre site pour que les visiteurs puissent vous contacter directement.
              </p>
            </div>

            <div className="pt-3 border-t border-border space-y-3">
              <p className="text-sm font-medium">Réseaux sociaux</p>
              <p className="text-xs text-muted-foreground -mt-2">Les liens renseignés seront affichés en bas de votre site.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                    Instagram
                  </label>
                  <Input
                    className="mt-1"
                    placeholder="https://instagram.com/votre-page"
                    value={socialLinks.instagram}
                    onChange={e => setSocialLinks(prev => ({ ...prev, instagram: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>
                    TikTok
                  </label>
                  <Input
                    className="mt-1"
                    placeholder="https://tiktok.com/@votre-compte"
                    value={socialLinks.tiktok}
                    onChange={e => setSocialLinks(prev => ({ ...prev, tiktok: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                    Facebook
                  </label>
                  <Input
                    className="mt-1"
                    placeholder="https://facebook.com/votre-page"
                    value={socialLinks.facebook}
                    onChange={e => setSocialLinks(prev => ({ ...prev, facebook: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                    LinkedIn
                  </label>
                  <Input
                    className="mt-1"
                    placeholder="https://linkedin.com/company/votre-page"
                    value={socialLinks.linkedin}
                    onChange={e => setSocialLinks(prev => ({ ...prev, linkedin: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Images */}
          <div className="rounded-xl border border-border bg-card p-6 sm:p-8 space-y-5">
            <h2 className="font-semibold text-foreground">Images du site</h2>

            <div>
              <label className="text-sm font-medium mb-2 block">Logo de l&apos;entreprise</label>
              <div className="max-w-[200px]">
                <SiteImageUpload
                  value={logoUrl}
                  onChange={setLogoUrl}
                  label="Ajoutez votre logo"
                  hint="PNG ou SVG transparent, 2 Mo max"
                  aspectRatio="aspect-square"
                />
              </div>
            </div>

            <HeroImagesEditor
              layout={heroLayout}
              onLayoutChange={setHeroLayout}
              images={heroImages}
              onImagesChange={setHeroImages}
            />

            <p className="text-xs text-muted-foreground">
              Vous pourrez modifier ces images à tout moment après publication.
            </p>
          </div>

          <Button className="w-full" size="lg" onClick={() => setStep(2)} disabled={!profile.company || !profile.activity}>
            Suivant <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )}

      {/* ═══ Step 2: Theme ═══ */}
      {step === 2 && (
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <Palette className="h-6 w-6 text-primary" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-foreground">Choisissez le style de votre site</h2>
            <p className="text-sm text-muted-foreground max-w-lg mx-auto">
              Quatre styles pensés pour les artisans. Cliquez sur <span className="font-medium text-foreground">Visualiser en grand</span> pour voir un aperçu complet de chaque thème avec un contenu d&apos;exemple.
            </p>
          </div>

          {/* Lock warning */}
          {published ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
              <Lock className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-amber-900">Thème verrouillé</p>
                <p className="text-amber-800 mt-0.5">
                  Votre site est déjà publié. Le thème ne peut plus être modifié pour préserver l&apos;identité visuelle de votre site.
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-blue-900">Choix définitif</p>
                <p className="text-blue-800 mt-0.5">
                  Le thème ne pourra plus être changé après la publication de votre site. Prenez le temps de le visualiser avant de valider.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-5">
            {(Object.keys(SITE_THEMES) as SiteTheme[]).map(t => (
              <ThemePreviewCard
                key={t}
                theme={t}
                selected={theme === t}
                onSelect={() => { if (!published) setTheme(t); }}
                onPreview={() => setPreviewTheme(t)}
              />
            ))}
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => setStep(1)}>Retour</Button>
            <Button className="flex-1" onClick={() => setStep(3)}>
              Suivant <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Theme preview modal */}
      {previewTheme && (
        <ThemePreviewModal
          open={!!previewTheme}
          theme={previewTheme}
          isCurrentSelection={theme === previewTheme}
          onClose={() => setPreviewTheme(null)}
          onConfirm={() => {
            if (!published) setTheme(previewTheme);
            setPreviewTheme(null);
          }}
        />
      )}

      {/* ═══ Step 3: Sections + generate ═══ */}
      {step === 3 && (
        <div className="max-w-2xl mx-auto rounded-xl border border-border bg-card p-6 sm:p-8 space-y-5">
          <div>
            <h2 className="font-semibold text-foreground">Sections du site</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Activez ou désactivez chaque section. Le contenu reste vivant et se met à jour automatiquement avec votre activité sur Hellobat.
            </p>
          </div>

          {[
            {
              label: 'Accueil & Hero',
              enabled: true,
              toggle: null,
              description: 'La première section vue par vos visiteurs avec votre photo d\u2019accroche, votre slogan et le bouton "Demander un devis gratuit".',
            },
            {
              label: 'À propos',
              enabled: true,
              toggle: null,
              description: 'Votre histoire, vos valeurs et vos chiffres clés (années d\u2019expérience, clients satisfaits, note Google…). Éditable dans l\u2019étape 4.',
            },
            {
              label: 'Nos services',
              enabled: showServices,
              toggle: () => setShowServices(!showServices),
              description: 'Les prestations que vous ajoutez dans l\u2019onglet "Mes prestations" apparaissent automatiquement ici. Vous pouvez aussi les éditer dans l\u2019étape 4.',
            },
            {
              label: 'Réalisations',
              enabled: showProjects,
              toggle: () => setShowProjects(!showProjects),
              description: 'Dès qu\u2019un chantier est marqué comme terminé et publié depuis l\u2019onglet Chantiers (bouton "Publier sur mon site"), il apparaît automatiquement ici avec ses photos.',
            },
            {
              label: 'Carte des chantiers',
              enabled: showMap,
              toggle: () => setShowMap(!showMap),
              icon: MapPin,
              description: 'Une carte interactive qui affiche l\u2019emplacement de tous les chantiers publiés. Vous choisissez chantier par chantier lesquels sont publics ou privés depuis l\u2019onglet Chantiers.',
            },
            {
              label: 'Témoignages',
              enabled: showReviews,
              toggle: () => setShowReviews(!showReviews),
              description: 'Les avis clients publiés depuis l\u2019onglet Avis Google s\u2019affichent ici. Vous pouvez aussi ajouter le lien vers votre fiche Google My Business pour recevoir de nouveaux avis.',
            },
            {
              label: 'FAQ',
              enabled: true,
              toggle: null,
              description: 'Les questions fréquentes générées par l\u2019IA à partir de votre activité. Éditable dans l\u2019étape 4.',
            },
            {
              label: 'Contact',
              enabled: showContact,
              toggle: () => setShowContact(!showContact),
              description: 'Quand un visiteur remplit le formulaire "Demander un devis", vous recevez un email, un lead CRM est créé, un devis en brouillon est généré, une fiche client est ajoutée et une tâche apparaît dans votre liste. Plus rien ne se perd.',
            },
          ].map((section) => (
            <div key={section.label} className="rounded-lg border border-border p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className={cn('flex h-8 w-8 items-center justify-center rounded-md shrink-0', section.enabled ? 'bg-primary/10' : 'bg-muted')}>
                    <Check className={cn('h-4 w-4', section.enabled ? 'text-primary' : 'text-muted-foreground')} />
                  </div>
                  <div className="min-w-0">
                    <p className={cn('text-sm font-medium', section.enabled ? 'text-foreground' : 'text-muted-foreground')}>
                      {section.label}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {section.description}
                    </p>
                  </div>
                </div>
                {section.toggle && (
                  <button
                    onClick={section.toggle}
                    className={cn('relative h-6 w-11 rounded-full transition-colors shrink-0 mt-0.5', section.enabled ? 'bg-primary' : 'bg-muted')}
                    aria-label={`Activer ou désactiver ${section.label}`}
                  >
                    <span className={cn('absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform', section.enabled && 'translate-x-5')} />
                  </button>
                )}
              </div>
            </div>
          ))}

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(2)}>Retour</Button>
            <Button className="flex-1" onClick={() => { setStep(4); handleGenerate(); }} disabled={generating}>
              <Sparkles className="mr-2 h-4 w-4" /> Générer le site
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
              <p className="mt-6 font-semibold text-foreground">Génération en cours…</p>
              <p className="mt-1 text-sm text-muted-foreground">L&apos;IA crée votre site vitrine</p>
            </div>
          ) : siteContent ? (
            <>
              {/* Published banner */}
              {published && siteUrl && (
                <div className="rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-emerald-50/50 p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500 text-white shrink-0">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-emerald-900">Votre site est en ligne</p>
                    <a
                      href={siteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-emerald-700 font-mono hover:underline break-all inline-flex items-center gap-1"
                    >
                      {siteUrl} <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <Button variant="outline" size="sm" onClick={handleCopyUrl} className="gap-1.5 flex-1 sm:flex-none">
                      {copied ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                      {copied ? 'Copié' : 'Copier'}
                    </Button>
                    <Button size="sm" asChild className="gap-1.5 flex-1 sm:flex-none">
                      <a href={siteUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" /> Visiter
                      </a>
                    </Button>
                  </div>
                </div>
              )}

              {/* Editor toolbar */}
              <div className="rounded-xl border border-border bg-card p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sticky top-4 z-20 shadow-sm">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                    <Pencil className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                      {published ? 'Mode édition' : 'Aperçu du site généré'}
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {published
                        ? 'Modifiez chaque section puis cliquez sur Enregistrer pour mettre à jour votre site en ligne.'
                        : 'Vérifiez le contenu, modifiez si besoin, puis publiez votre site.'}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap justify-end w-full sm:w-auto">
                  <Button variant="outline" size="sm" onClick={() => setShowSitePreview(true)}>
                    <Eye className="mr-1.5 h-4 w-4" /> Aperçu du site
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => { setSiteContent(null); handleGenerate(); }} disabled={generating}>
                    <RefreshCw className="mr-1.5 h-4 w-4" /> Régénérer
                  </Button>
                  {published ? (
                    <Button size="sm" onClick={handlePublish} disabled={publishing}>
                      {publishing ? (
                        <><div className="h-4 w-4 mr-1.5 rounded-full border-2 border-white/30 animate-spin border-t-white" /> Enregistrement…</>
                      ) : (
                        <><CheckCircle2 className="mr-1.5 h-4 w-4" /> Enregistrer les modifications</>
                      )}
                    </Button>
                  ) : (
                    <Button size="sm" onClick={handlePublish} disabled={publishing}>
                      {publishing ? (
                        <><div className="h-4 w-4 mr-1.5 rounded-full border-2 border-white/30 animate-spin border-t-white" /> Publication…</>
                      ) : (
                        <><Globe className="mr-1.5 h-4 w-4" /> Publier mon site</>
                      )}
                    </Button>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-border bg-muted/30 px-4 py-2.5 flex items-center gap-2 text-xs text-muted-foreground">
                <Pencil className="h-3 w-3 text-primary shrink-0" />
                <span>Cliquez sur <span className="font-medium text-foreground">Modifier</span> sur chaque section pour personnaliser le contenu.</span>
              </div>

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
              <EditableSection title="À propos" editing={editing} section="about" setEditing={setEditing}>
                {editing === 'about' ? (
                  <div className="space-y-4 p-4">
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

                    {/* Chiffres clés éditables */}
                    <div className="pt-3 border-t border-border">
                      <label className="text-xs font-medium text-muted-foreground">Chiffres clés</label>
                      <p className="text-xs text-muted-foreground/80 mb-2">
                        Affichés en gros sous le texte (ex : années d&apos;expérience, clients satisfaits, note Google).
                      </p>
                      <div className="space-y-2">
                        {(siteContent.about.highlights || []).map((h, i) => (
                          <div key={i} className="flex gap-2 items-start">
                            <Input
                              value={h.value}
                              onChange={e => {
                                const hs = [...(siteContent.about.highlights || [])];
                                hs[i] = { ...hs[i], value: e.target.value };
                                updateAbout('highlights', hs);
                              }}
                              placeholder="15+"
                              className="flex-1"
                              maxLength={20}
                            />
                            <Input
                              value={h.label}
                              onChange={e => {
                                const hs = [...(siteContent.about.highlights || [])];
                                hs[i] = { ...hs[i], label: e.target.value };
                                updateAbout('highlights', hs);
                              }}
                              placeholder="années d'expérience"
                              className="flex-[2]"
                              maxLength={60}
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-500 shrink-0"
                              onClick={() => {
                                const hs = (siteContent.about.highlights || []).filter((_, j) => j !== i);
                                updateAbout('highlights', hs);
                              }}
                              aria-label="Supprimer ce chiffre"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const hs = [...(siteContent.about.highlights || []), { value: '', label: '' }];
                            updateAbout('highlights', hs);
                          }}
                        >
                          <Plus className="h-3 w-3 mr-1" /> Ajouter un chiffre
                        </Button>
                      </div>
                    </div>
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
                  <div className="space-y-4 p-4">
                    {siteContent.services.map((s, i) => (
                      <div key={i} className="space-y-2 rounded-lg border border-border p-3">
                        <div className="flex gap-2 items-start">
                          <div className="flex-1 space-y-1">
                            <Input value={s.name} onChange={e => updateService(i, 'name', e.target.value)} placeholder="Nom" />
                            <Input value={s.description} onChange={e => updateService(i, 'description', e.target.value)} placeholder="Description" />
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => removeService(i)} className="text-red-500 mt-1">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1.5">Icône</p>
                          <div className="flex flex-wrap gap-1.5 rounded-md border border-border bg-muted/30 p-2">
                            {SERVICE_ICONS.map(({ name, Icon, label }) => {
                              const selected = (s.icon || 'Wrench') === name;
                              return (
                                <button
                                  key={name}
                                  type="button"
                                  onClick={() => updateService(i, 'icon', name)}
                                  title={label}
                                  className={cn(
                                    'w-8 h-8 rounded flex items-center justify-center transition-colors',
                                    selected
                                      ? 'bg-primary text-primary-foreground shadow-sm'
                                      : 'bg-background text-muted-foreground hover:bg-primary/10 hover:text-primary'
                                  )}
                                >
                                  <Icon className="w-4 h-4" />
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={addService}>
                      <Plus className="h-3 w-3 mr-1" /> Ajouter un service
                    </Button>
                  </div>
                ) : (
                  <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {siteContent.services.map((s, i) => {
                      const iconEntry = SERVICE_ICONS.find((ic) => ic.name === (s.icon || 'Wrench'));
                      const Icon = iconEntry?.Icon;
                      return (
                        <div key={i} className="rounded-lg border border-border p-3 flex items-start gap-3">
                          {Icon && (
                            <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <Icon className="w-4 h-4 text-primary" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground">{s.name}</p>
                            <p className="text-xs text-muted-foreground mt-1">{s.description}</p>
                          </div>
                        </div>
                      );
                    })}
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
                          <Textarea value={f.answer} onChange={e => updateFaq(i, 'answer', e.target.value)} placeholder="Réponse" className="min-h-[60px]" />
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

              {/* ── Mentions légales ── */}
              <EditableSection title="Mentions légales / CGV" editing={editing} section="legal" setEditing={setEditing}>
                {editing === 'legal' ? (
                  <div className="p-4 space-y-3">
                    <p className="text-xs text-muted-foreground">
                      Ajoutez vos conditions générales, mentions légales ou tout autre texte juridique.
                    </p>
                    <Textarea
                      value={legalText}
                      onChange={e => setLegalText(e.target.value)}
                      className="min-h-[200px] text-sm font-mono"
                      placeholder={"Mentions légales\n\nRaison sociale : …\nSIRET : …\nAdresse : …\n\nConditions générales\n\n…"}
                    />
                  </div>
                ) : (
                  <div className="p-4">
                    {legalText ? (
                      <p className="text-sm text-muted-foreground whitespace-pre-line line-clamp-6">{legalText}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">Aucune mention légale. Cliquez sur Modifier pour en ajouter.</p>
                    )}
                  </div>
                )}
              </EditableSection>

              {/* ── Images ── */}
              <EditableSection title="Images" editing={editing} section="images" setEditing={setEditing}>
                {editing === 'images' ? (
                  <div className="p-4 space-y-5">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Logo</label>
                      <SiteImageUpload value={logoUrl} onChange={setLogoUrl} aspectRatio="aspect-square" className="max-w-[160px]" />
                    </div>
                    <HeroImagesEditor
                      layout={heroLayout}
                      onLayoutChange={setHeroLayout}
                      images={heroImages}
                      onImagesChange={setHeroImages}
                    />
                  </div>
                ) : (
                  <div className="p-4 flex gap-4 flex-wrap">
                    {logoUrl ? (
                      <img src={logoUrl} alt="Logo" className="h-16 w-16 rounded-lg object-cover border border-border" />
                    ) : (
                      <div className="h-16 w-16 rounded-lg bg-muted/30 flex items-center justify-center text-xs text-muted-foreground">Logo</div>
                    )}
                    <div className="flex gap-2 items-center">
                      {heroImages.filter(Boolean).length > 0 ? (
                        heroImages.filter(Boolean).slice(0, 3).map((src, i) => (
                          <img key={i} src={src} alt={`Hero ${i + 1}`} className="h-16 w-20 rounded-lg object-cover border border-border" />
                        ))
                      ) : (
                        <div className="h-16 w-28 rounded-lg bg-muted/30 flex items-center justify-center text-xs text-muted-foreground">Hero</div>
                      )}
                      <span className="text-xs text-muted-foreground ml-1">
                        {heroLayout === 'single' && '1 photo'}
                        {heroLayout === 'grid' && 'Grille de 3'}
                        {heroLayout === 'carousel' && 'Carrousel de 3'}
                      </span>
                    </div>
                  </div>
                )}
              </EditableSection>
            </>
          ) : (
            <div className="rounded-xl border border-border bg-card flex flex-col items-center justify-center py-20 text-center px-4">
              <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="font-semibold text-foreground">Prêt à générer votre site</p>
              <p className="mt-1 text-sm text-muted-foreground">Revenez à l&apos;étape 3 pour lancer la génération</p>
              <Button className="mt-4" onClick={() => setStep(3)}>Retour à la génération</Button>
            </div>
          )}
        </div>
      )}

      {/* Full-site preview modal */}
      {siteContent && (
        <SitePreviewModal
          open={showSitePreview}
          onClose={() => setShowSitePreview(false)}
          theme={theme}
          siteContent={siteContent}
          slug={slug}
          logoUrl={logoUrl}
          heroImageUrl={heroImageUrl}
          heroImages={heroImages}
          heroLayout={heroLayout}
          publicPhone={publicPhone}
          whatsappPhone={whatsappPhone}
          socialLinks={socialLinks}
          legalText={legalText}
          showServices={showServices}
          showProjects={showProjects}
          showReviews={showReviews}
          showContact={showContact}
          showMap={showMap}
        />
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

// ── Hero images editor (layout + 1 ou 3 photos) ──────────────

interface HeroImagesEditorProps {
  layout: 'single' | 'grid' | 'carousel';
  onLayoutChange: (v: 'single' | 'grid' | 'carousel') => void;
  images: string[];
  onImagesChange: (v: string[]) => void;
}

function HeroImagesEditor({ layout, onLayoutChange, images, onImagesChange }: HeroImagesEditorProps) {
  const slots = layout === 'single' ? 1 : 3;

  const setImageAt = (i: number, url: string) => {
    const next = [...images];
    while (next.length < 3) next.push('');
    next[i] = url;
    onImagesChange(next);
  };

  const options: { value: 'single' | 'grid' | 'carousel'; label: string; description: string }[] = [
    {
      value: 'single',
      label: '1 photo',
      description: 'Une grande photo en fond',
    },
    {
      value: 'grid',
      label: '3 photos',
      description: 'Grille à côté du texte',
    },
    {
      value: 'carousel',
      label: 'Carrousel',
      description: '3 photos qui défilent',
    },
  ];

  return (
    <div>
      <label className="text-sm font-medium block">Photos de la section d&apos;accueil</label>
      <p className="text-xs text-muted-foreground mb-3">
        Photos de chantiers, équipe, réalisations… Format paysage recommandé.
      </p>

      <div className="grid grid-cols-3 gap-2 mb-4">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onLayoutChange(opt.value)}
            className={cn(
              'rounded-lg border p-3 text-left transition-all',
              layout === opt.value
                ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                : 'border-border hover:border-primary/40 bg-card'
            )}
          >
            <p className={cn('text-sm font-semibold', layout === opt.value ? 'text-primary' : 'text-foreground')}>
              {opt.label}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{opt.description}</p>
          </button>
        ))}
      </div>

      <div className={cn('grid gap-3', slots === 1 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-3')}>
        {Array.from({ length: slots }).map((_, i) => (
          <div key={i}>
            <p className="text-xs text-muted-foreground mb-1.5">
              {slots === 1 ? 'Photo principale' : `Photo ${i + 1}`}
            </p>
            <SiteImageUpload
              value={images[i] || ''}
              onChange={(url) => setImageAt(i, url)}
              label="Photo de chantier, équipe…"
              hint="5 Mo max"
              aspectRatio="aspect-video"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
