'use client';

import { useState } from 'react';
import { Paintbrush, Upload, Sparkles, ArrowRight, Check, Eye, Download, Image, Camera } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const STEPS = [
  { id: 1, label: 'Photo', icon: Camera },
  { id: 2, label: 'Style', icon: Paintbrush },
  { id: 3, label: 'Generation', icon: Sparkles },
  { id: 4, label: 'Resultat', icon: Eye },
];

const STYLES = [
  { id: 'moderne', name: 'Moderne', desc: 'Lignes epurees, materiaux contemporains' },
  { id: 'classique', name: 'Classique', desc: 'Elegance traditionnelle, moulures' },
  { id: 'industriel', name: 'Industriel', desc: 'Metal, brique, brut' },
  { id: 'scandinave', name: 'Scandinave', desc: 'Bois clair, minimaliste' },
  { id: 'mediterraneen', name: 'Mediterraneen', desc: 'Pierre, terre cuite, chaleur' },
  { id: 'zen', name: 'Zen / Japandi', desc: 'Equilibre, nature, serenite' },
];

const ROOM_TYPES = [
  'Salon', 'Cuisine', 'Salle de bain', 'Chambre', 'Terrasse', 'Bureau', 'Entree',
];

export default function PlansRendusPage() {
  const [step, setStep] = useState(1);
  const [selectedStyle, setSelectedStyle] = useState('');
  const [roomType, setRoomType] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);

  function handleGenerate() {
    setStep(3);
    setGenerating(true);
    setTimeout(() => {
      setGenerating(false);
      setGenerated(true);
      setStep(4);
    }, 3000);
  }

  function reset() {
    setStep(1);
    setSelectedStyle('');
    setRoomType('');
    setGenerated(false);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Plans & Rendus IA" description="Transformez vos photos en rendus 3D professionnels">
        {generated && <Button variant="outline" onClick={reset}>Nouveau rendu</Button>}
      </PageHeader>

      <div className="flex items-center justify-center gap-1 sm:gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center">
            <div className={cn(
              'flex items-center gap-2 rounded-full px-2 py-1.5 sm:px-4 sm:py-2 text-sm font-medium transition-all',
              step === s.id ? 'bg-primary text-primary-foreground shadow-md' :
              step > s.id ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'
            )}>
              {step > s.id ? <Check className="h-4 w-4" /> : <s.icon className="h-4 w-4" />}
              <span className="hidden sm:inline">{s.label}</span>
            </div>
            {i < STEPS.length - 1 && <ArrowRight className="h-4 w-4 mx-1 sm:mx-2 text-muted-foreground" />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="max-w-lg mx-auto">
          <div className="rounded-xl border-2 border-dashed border-border bg-card p-12 text-center transition-all hover:border-primary/50">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mx-auto">
              <Upload className="h-8 w-8 text-primary" />
            </div>
            <h3 className="mt-4 font-semibold text-foreground">Deposez votre photo</h3>
            <p className="mt-1 text-sm text-muted-foreground">PNG, JPG jusqu&apos;a 10 MB</p>
            <Button className="mt-4 gap-2"><Camera className="h-4 w-4" /> Choisir une photo</Button>
          </div>
          <div className="mt-6">
            <label className="text-sm font-medium text-foreground">Type de piece</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {ROOM_TYPES.map(r => (
                <button
                  key={r}
                  onClick={() => setRoomType(r)}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-sm transition-all',
                    roomType === r ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-border text-muted-foreground hover:border-border/80'
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          <Button className="w-full mt-6" onClick={() => setStep(2)} disabled={!roomType}>
            Suivant <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )}

      {step === 2 && (
        <div className="max-w-2xl mx-auto space-y-6">
          <h2 className="font-semibold text-foreground text-center">Choisissez un style</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {STYLES.map(s => (
              <button
                key={s.id}
                onClick={() => setSelectedStyle(s.id)}
                className={cn(
                  'rounded-xl border-2 p-5 text-left transition-all',
                  selectedStyle === s.id ? 'border-primary bg-primary/5 shadow-md' : 'border-border hover:border-border/80'
                )}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                  <Paintbrush className="h-5 w-5 text-muted-foreground" />
                </div>
                <h3 className="mt-3 font-semibold text-sm text-foreground">{s.name}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{s.desc}</p>
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(1)}>Retour</Button>
            <Button className="flex-1" onClick={handleGenerate} disabled={!selectedStyle}>
              <Sparkles className="mr-2 h-4 w-4" /> Generer le rendu
            </Button>
          </div>
        </div>
      )}

      {step === 3 && generating && (
        <div className="max-w-lg mx-auto rounded-xl border border-border bg-card p-12 text-center">
          <div className="relative mx-auto w-20 h-20">
            <div className="absolute inset-0 rounded-full border-4 border-muted animate-spin border-t-primary" />
            <Sparkles className="absolute inset-0 m-auto h-8 w-8 text-primary" />
          </div>
          <h3 className="mt-6 font-semibold text-foreground">Generation en cours...</h3>
          <p className="mt-2 text-sm text-muted-foreground">L&apos;IA transforme votre photo en rendu {selectedStyle}</p>
          <div className="mt-6 space-y-2">
            {['Analyse de la photo...', 'Application du style...', 'Rendu final...'].map((t, i) => (
              <div key={t} className="flex items-center gap-2 justify-center text-sm text-muted-foreground">
                <div className={cn('h-2 w-2 rounded-full', i < 2 ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse')} />
                {t}
              </div>
            ))}
          </div>
        </div>
      )}

      {step === 4 && generated && (
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="bg-muted h-64 flex items-center justify-center">
                <div className="text-center">
                  <Image className="h-8 w-8 text-muted-foreground mx-auto" />
                  <p className="mt-2 text-sm text-muted-foreground">Photo originale</p>
                  <p className="text-xs text-muted-foreground">{roomType}</p>
                </div>
              </div>
              <div className="p-3 text-center text-sm font-medium text-muted-foreground">Avant</div>
            </div>
            <div className="rounded-xl border-2 border-primary bg-card overflow-hidden">
              <div className="bg-gradient-to-br from-primary/10 to-primary/5 h-64 flex items-center justify-center">
                <div className="text-center">
                  <Sparkles className="h-8 w-8 text-primary mx-auto" />
                  <p className="mt-2 text-sm font-medium text-foreground">Rendu IA genere</p>
                  <p className="text-xs text-muted-foreground">Style {selectedStyle}</p>
                </div>
              </div>
              <div className="p-3 text-center text-sm font-medium text-primary">Apres - Rendu IA</div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row justify-center gap-2 sm:gap-3">
            <Button variant="outline" className="gap-2"><Download className="h-4 w-4" /> Telecharger HD</Button>
            <Button variant="outline" className="gap-2" onClick={reset}>Nouveau rendu</Button>
            <Button className="gap-2"><Eye className="h-4 w-4" /> Partager au client</Button>
          </div>
        </div>
      )}
    </div>
  );
}
