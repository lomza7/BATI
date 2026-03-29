'use client';

import { useState } from 'react';
import { Globe, Sparkles, Eye, Palette, Type, Image, ArrowRight, Check, RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const STEPS = [
  { id: 1, label: 'Profil', icon: Type },
  { id: 2, label: 'Design', icon: Palette },
  { id: 3, label: 'Contenu', icon: Image },
  { id: 4, label: 'Apercu', icon: Eye },
];

const THEMES = [
  { id: 'modern', name: 'Moderne', bg: 'bg-slate-900', accent: 'bg-blue-500' },
  { id: 'warm', name: 'Chaleureux', bg: 'bg-amber-50', accent: 'bg-amber-600' },
  { id: 'clean', name: 'Epure', bg: 'bg-white', accent: 'bg-emerald-500' },
  { id: 'bold', name: 'Dynamique', bg: 'bg-slate-800', accent: 'bg-red-500' },
];

export default function SiteWebPage() {
  const [step, setStep] = useState(1);
  const [profile, setProfile] = useState({
    company: '',
    activity: '',
    city: '',
    phone: '',
    slogan: '',
  });
  const [theme, setTheme] = useState('modern');
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);

  function handleGenerate() {
    setGenerating(true);
    setTimeout(() => {
      setGenerating(false);
      setGenerated(true);
    }, 2000);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Site web IA" description="Generez automatiquement un site vitrine professionnel">
        {generated && (
          <Button variant="outline" className="gap-2" onClick={() => { setGenerated(false); setStep(1); }}>
            <RefreshCw className="h-4 w-4" /> Regenerer
          </Button>
        )}
      </PageHeader>

      <div className="flex items-center justify-center gap-1 sm:gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center">
            <button
              onClick={() => setStep(s.id)}
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

      {step === 1 && (
        <div className="max-w-lg mx-auto rounded-xl border border-border bg-card p-8 space-y-5">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10"><Sparkles className="h-5 w-5 text-primary" /></div>
            <div>
              <h2 className="font-semibold text-foreground">Votre profil artisan</h2>
              <p className="text-sm text-muted-foreground">L&apos;IA generera le contenu a partir de ces informations</p>
            </div>
          </div>
          <div><label className="text-sm font-medium">Nom de l&apos;entreprise</label><Input className="mt-1" placeholder="Ex: Dupont Plomberie" value={profile.company} onChange={e => setProfile({ ...profile, company: e.target.value })} /></div>
          <div><label className="text-sm font-medium">Activite</label><Input className="mt-1" placeholder="Ex: Plombier chauffagiste" value={profile.activity} onChange={e => setProfile({ ...profile, activity: e.target.value })} /></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="text-sm font-medium">Ville</label><Input className="mt-1" placeholder="Ex: Lyon" value={profile.city} onChange={e => setProfile({ ...profile, city: e.target.value })} /></div>
            <div><label className="text-sm font-medium">Telephone</label><Input className="mt-1" placeholder="06 ..." value={profile.phone} onChange={e => setProfile({ ...profile, phone: e.target.value })} /></div>
          </div>
          <div><label className="text-sm font-medium">Slogan (optionnel)</label><Input className="mt-1" placeholder="Ex: Votre confort, notre priorite" value={profile.slogan} onChange={e => setProfile({ ...profile, slogan: e.target.value })} /></div>
          <Button className="w-full" onClick={() => setStep(2)} disabled={!profile.company || !profile.activity}>Suivant <ArrowRight className="ml-2 h-4 w-4" /></Button>
        </div>
      )}

      {step === 2 && (
        <div className="max-w-lg mx-auto rounded-xl border border-border bg-card p-8 space-y-5">
          <h2 className="font-semibold text-foreground">Choisissez un theme</h2>
          <div className="grid grid-cols-2 gap-3">
            {THEMES.map(t => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={cn('rounded-lg border-2 p-4 transition-all', theme === t.id ? 'border-primary shadow-md' : 'border-border hover:border-border/80')}
              >
                <div className={cn('h-20 rounded-md flex items-end p-2', t.bg)}>
                  <div className={cn('h-2 w-12 rounded-full', t.accent)} />
                </div>
                <p className="mt-2 text-sm font-medium text-foreground">{t.name}</p>
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(1)}>Retour</Button>
            <Button className="flex-1" onClick={() => setStep(3)}>Suivant <ArrowRight className="ml-2 h-4 w-4" /></Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="max-w-lg mx-auto rounded-xl border border-border bg-card p-8 space-y-5">
          <h2 className="font-semibold text-foreground">Sections du site</h2>
          <p className="text-sm text-muted-foreground">L&apos;IA generera le contenu de chaque section automatiquement</p>
          {['Accueil & Hero', 'Nos services', 'Realisations', 'Temoignages', 'Contact'].map(section => (
            <div key={section} className="flex items-center gap-3 rounded-lg border border-border p-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10"><Check className="h-4 w-4 text-primary" /></div>
              <span className="text-sm font-medium text-foreground">{section}</span>
            </div>
          ))}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(2)}>Retour</Button>
            <Button className="flex-1" onClick={() => { setStep(4); handleGenerate(); }}>
              <Sparkles className="mr-2 h-4 w-4" /> Generer le site
            </Button>
          </div>
        </div>
      )}

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
          ) : (
            <div>
              <div className="bg-slate-900 text-white p-12 text-center">
                <h1 className="text-xl sm:text-3xl font-bold">{profile.company || 'Votre Entreprise'}</h1>
                <p className="mt-2 text-lg text-slate-300">{profile.slogan || profile.activity}</p>
                <p className="mt-1 text-sm text-slate-400">{profile.city}</p>
                <Button className="mt-6">Demander un devis</Button>
              </div>
              <div className="p-4 sm:p-8 grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                {['Expertise reconnue', 'Devis gratuit', 'Garantie decennale'].map(s => (
                  <div key={s} className="text-center p-4">
                    <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-primary/10"><Check className="h-5 w-5 text-primary" /></div>
                    <h3 className="mt-3 font-semibold text-sm text-foreground">{s}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">Contenu genere par l&apos;IA</p>
                  </div>
                ))}
              </div>
              <div className="border-t border-border p-6 text-center">
                <p className="text-sm text-muted-foreground">Apercu du site genere - {profile.company}</p>
                <div className="mt-3 flex justify-center gap-2">
                  <Button variant="outline" size="sm"><Eye className="mr-2 h-4 w-4" /> Voir en plein ecran</Button>
                  <Button size="sm"><Globe className="mr-2 h-4 w-4" /> Publier</Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
