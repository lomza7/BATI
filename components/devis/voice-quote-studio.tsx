'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  FileAudio,
  ImagePlus,
  Mic,
  Sparkles,
  Square,
  Wand2,
} from 'lucide-react';
import { formatCurrency } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';

interface VoicePhotoPreview {
  id: string;
  name: string;
  url: string;
  sizeLabel: string;
}

export interface VoiceQuoteDraft {
  title: string;
  clientName: string;
  description: string;
  transcript: string;
  confidence: number;
  assumptions: string[];
  lines: Array<{
    description: string;
    quantity: number;
    unit: string;
    unit_price: number;
  }>;
}

interface VoiceQuoteStudioProps {
  onUseDraft: (draft: VoiceQuoteDraft) => void;
}

const VOICE_PRESETS = [
  {
    label: 'Salle de bain',
    clientName: 'Mme Petit',
    transcript:
      "Bonjour, j'ai une salle de bain de 6 metres carres a renover completement. Il faut deposer l'existant, refaire la plomberie de la douche, poser un receveur extra plat, du carrelage mural, un meuble vasque et de la peinture plafond.",
  },
  {
    label: 'Peinture facade',
    clientName: 'SCI Verger',
    transcript:
      "Il faudrait refaire la facade avant de la maison, environ 90 metres carres. Il y a un nettoyage, quelques fissures a reprendre, une sous-couche puis deux couches de peinture facade ton pierre.",
  },
  {
    label: 'Fuite plomberie',
    clientName: 'M. Bernard',
    transcript:
      "J'ai une fuite dans la cuisine sous l'evier avec le meuble qui a gonfle. Il faut venir diagnostiquer, remplacer la partie cuivre ou multicouche abimee, remettre le siphon correctement et verifier qu'il n'y ait plus de fuite.",
  },
] as const;

function formatRecordTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function buildDraft(transcript: string, clientName: string, photoCount: number): VoiceQuoteDraft {
  const normalized = transcript.toLowerCase();
  const lines: VoiceQuoteDraft['lines'] = [];
  const assumptions: string[] = [];
  let title = 'Travaux a chiffrer';

  if (normalized.includes('salle de bain') || normalized.includes('douche')) {
    title = 'Renovation salle de bain';
    lines.push(
      { description: 'Depose des equipements existants', quantity: 1, unit: 'forfait', unit_price: 420 },
      { description: 'Reprise plomberie douche et alimentation', quantity: 1, unit: 'forfait', unit_price: 980 },
      { description: 'Pose receveur + paroi + meuble vasque', quantity: 1, unit: 'forfait', unit_price: 1640 },
      { description: 'Pose carrelage mural', quantity: 18, unit: 'm2', unit_price: 68 }
    );
    assumptions.push('Surface estimee a partir de votre description, a confirmer sur place.');
  }

  if (normalized.includes('peinture') || normalized.includes('facade') || normalized.includes('enduit')) {
    if (title === 'Travaux a chiffrer') title = 'Refection peinture / facade';
    lines.push(
      { description: 'Preparation des supports et protections', quantity: 1, unit: 'forfait', unit_price: 360 },
      { description: 'Traitement fissures et reprises localisees', quantity: 12, unit: 'ml', unit_price: 24 },
      { description: 'Application peinture facade 2 couches', quantity: 90, unit: 'm2', unit_price: 32 }
    );
    assumptions.push('Le chiffrage suppose un acces simple sans echafaudage lourd.');
  }

  if (normalized.includes('fuite') || normalized.includes('evier') || normalized.includes('plomberie')) {
    if (title === 'Travaux a chiffrer') title = 'Intervention plomberie';
    lines.push(
      { description: 'Diagnostic de fuite et recherche de cause', quantity: 2, unit: 'h', unit_price: 78 },
      { description: 'Remplacement raccords / siphon / section endommagee', quantity: 1, unit: 'forfait', unit_price: 210 },
      { description: 'Essais et remise en service', quantity: 1, unit: 'forfait', unit_price: 95 }
    );
    assumptions.push("Le prix pourra evoluer si l'acces au reseau est plus complexe que prevu.");
  }

  if (lines.length === 0) {
    lines.push(
      { description: 'Visite technique et prise de cotes', quantity: 1, unit: 'forfait', unit_price: 120 },
      { description: 'Fourniture et pose selon besoin confirme', quantity: 1, unit: 'forfait', unit_price: 1450 },
      { description: 'Nettoyage et fin de chantier', quantity: 1, unit: 'forfait', unit_price: 180 }
    );
    assumptions.push('Brouillon generaliste a affiner avec vos habitudes de chiffrage.');
  }

  if (photoCount > 0) {
    assumptions.push(`${photoCount} photo${photoCount > 1 ? 's' : ''} jointe${photoCount > 1 ? 's' : ''} pour aider la qualification.`);
  } else {
    assumptions.push('Ajoutez des photos pour fiabiliser le futur chiffrage IA.');
  }

  const confidence = Math.min(
    96,
    56 +
      (transcript.trim().length > 80 ? 12 : 0) +
      (transcript.trim().length > 180 ? 10 : 0) +
      (photoCount > 0 ? 10 : 0) +
      (lines.length >= 3 ? 8 : 0)
  );

  const description = [
    `Brouillon genere a partir d'une demande vocale${clientName.trim() ? ` pour ${clientName.trim()}` : ''}.`,
    'A confirmer avant envoi au client.',
  ].join(' ');

  return {
    title,
    clientName: clientName.trim(),
    description,
    transcript: transcript.trim(),
    confidence,
    assumptions,
    lines,
  };
}

export function VoiceQuoteStudio({ onUseDraft }: VoiceQuoteStudioProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photosRef = useRef<VoicePhotoPreview[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [clientName, setClientName] = useState('');
  const [transcript, setTranscript] = useState('');
  const [photos, setPhotos] = useState<VoicePhotoPreview[]>([]);
  const [draft, setDraft] = useState<VoiceQuoteDraft | null>(null);

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  useEffect(() => {
    if (!isRecording) return;

    const timer = window.setInterval(() => {
      setRecordSeconds((current) => current + 1);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isRecording]);

  useEffect(() => {
    return () => {
      photosRef.current.forEach((photo) => window.URL.revokeObjectURL(photo.url));
    };
  }, []);

  const totals = useMemo(() => {
    const totalHt = draft?.lines.reduce((sum, line) => sum + line.quantity * line.unit_price, 0) ?? 0;
    return {
      totalHt,
      totalTtc: totalHt * 1.2,
    };
  }, [draft]);

  function toggleRecording() {
    if (isRecording) {
      setIsRecording(false);
      if (!transcript.trim()) {
        const starter = VOICE_PRESETS[0];
        setClientName((current) => current || starter.clientName);
        setTranscript(starter.transcript);
      }
      return;
    }

    setRecordSeconds(0);
    setIsRecording(true);
  }

  function loadPreset(index: number) {
    const preset = VOICE_PRESETS[index];
    setClientName(preset.clientName);
    setTranscript(preset.transcript);
    setDraft(null);
    setIsRecording(false);
    setRecordSeconds(0);
  }

  function triggerPhotoPicker() {
    fileInputRef.current?.click();
  }

  function handlePhotosSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    const nextPhotos = files.map((file) => ({
      id: `${file.name}-${file.lastModified}`,
      name: file.name,
      url: window.URL.createObjectURL(file),
      sizeLabel: formatFileSize(file.size),
    }));

    setPhotos((current) => [...current, ...nextPhotos].slice(0, 6));
    event.target.value = '';
  }

  function removePhoto(id: string) {
    setPhotos((current) => {
      const target = current.find((photo) => photo.id === id);
      if (target) {
        window.URL.revokeObjectURL(target.url);
      }
      return current.filter((photo) => photo.id !== id);
    });
  }

  function generateDraft() {
    const transcriptValue = transcript.trim();
    if (!transcriptValue) return;
    setDraft(buildDraft(transcriptValue, clientName, photos.length));
  }

  return (
    <div className="relative overflow-hidden rounded-[28px] border border-[#d35400]/15 bg-gradient-to-br from-[#fff7f0] via-white to-[#fff1e6] p-4 sm:p-6">
      <div className="absolute -left-16 top-0 h-40 w-40 rounded-full bg-[#ffd8bf] blur-3xl" />
      <div className="absolute right-0 top-10 h-48 w-48 rounded-full bg-[#ffe7d6] blur-3xl" />

      <div className="relative space-y-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-[#d35400] text-white hover:bg-[#d35400]">Nouveau</Badge>
              <Badge variant="outline" className="border-[#d35400]/20 bg-white/80 text-[#a34700]">
                Devis vocal IA
              </Badge>
            </div>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Dites le chantier, joignez des photos, obtenez un brouillon de devis en quelques secondes
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Cette maquette simule le parcours que vous brancherez ensuite sur votre LLM :
              transcription vocale, qualification automatique, suggestions de lignes et injection directe dans le devis.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div className="rounded-2xl border border-white/80 bg-white/80 px-3 py-3 shadow-sm">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <FileAudio className="h-3.5 w-3.5 text-[#d35400]" />
                Voix
              </div>
              <p className="mt-2 text-lg font-semibold text-foreground">1 min</p>
            </div>
            <div className="rounded-2xl border border-white/80 bg-white/80 px-3 py-3 shadow-sm">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Camera className="h-3.5 w-3.5 text-[#d35400]" />
                Photos
              </div>
              <p className="mt-2 text-lg font-semibold text-foreground">Jusqu&apos;a 6</p>
            </div>
            <div className="rounded-2xl border border-white/80 bg-white/80 px-3 py-3 shadow-sm">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-[#d35400]" />
                Sortie
              </div>
              <p className="mt-2 text-lg font-semibold text-foreground">Pret a relire</p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <Card className="rounded-[24px] border-white/80 bg-white/85 shadow-lg shadow-[#d35400]/5">
            <CardHeader className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-lg">Studio de capture</CardTitle>
                  <CardDescription>
                    Voix + contexte chantier + photos d&apos;appui.
                  </CardDescription>
                </div>
                <div className="rounded-full bg-[#fff4eb] px-3 py-1 text-xs font-medium text-[#a34700]">
                  {isRecording ? `En cours ${formatRecordTime(recordSeconds)}` : 'Pret a enregistrer'}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
                <button
                  type="button"
                  onClick={toggleRecording}
                  className={cn(
                    'flex h-20 w-20 items-center justify-center rounded-full border transition-all',
                    isRecording
                      ? 'border-[#d35400] bg-[#d35400] text-white shadow-lg shadow-[#d35400]/25'
                      : 'border-[#d35400]/20 bg-[#fff4eb] text-[#d35400] hover:border-[#d35400]/40'
                  )}
                >
                  {isRecording ? <Square className="h-7 w-7" /> : <Mic className="h-7 w-7" />}
                </button>

                <div className="rounded-2xl border border-dashed border-[#d35400]/20 bg-[#fffaf6] p-4">
                  <p className="text-sm font-medium text-foreground">
                    {isRecording ? 'Parlez comme si vous etiez avec votre client.' : 'Appuyez pour simuler une prise de parole.'}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Exemple: “Renovation salle de bain, depose, plomberie, carrelage mural, meuble vasque, environ 6 m2”.
                  </p>
                  <div className="mt-4 grid grid-cols-8 gap-1.5">
                    {Array.from({ length: 8 }).map((_, index) => (
                      <div
                        key={index}
                        className={cn(
                          'h-10 rounded-full bg-[#ffd2b8] transition-all duration-300',
                          isRecording ? `animate-pulse ${index % 2 === 0 ? 'mt-1' : 'mt-4'}` : 'opacity-40'
                        )}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-[0.9fr_1.1fr]">
                <div>
                  <label className="text-sm font-medium text-foreground">Client ou chantier</label>
                  <Input
                    className="mt-1 bg-white"
                    placeholder="Ex: Mme Petit, salle de bain"
                    value={clientName}
                    onChange={(event) => setClientName(event.target.value)}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground">Demande vocale retranscrite</label>
                  <Textarea
                    className="mt-1 min-h-[118px] bg-white"
                    placeholder="La transcription apparaitra ici, puis pourra etre corrigee avant envoi au LLM."
                    value={transcript}
                    onChange={(event) => setTranscript(event.target.value)}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between gap-3">
                  <label className="text-sm font-medium text-foreground">Photos du chantier</label>
                  <Button type="button" variant="outline" size="sm" onClick={triggerPhotoPicker} className="gap-2">
                    <ImagePlus className="h-4 w-4" />
                    Ajouter des photos
                  </Button>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handlePhotosSelected}
                />

                {photos.length === 0 ? (
                  <div className="mt-3 rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
                    Ajoutez quelques vues du chantier pour aider le futur moteur IA a qualifier les travaux.
                  </div>
                ) : (
                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {photos.map((photo) => (
                      <div key={photo.id} className="overflow-hidden rounded-2xl border border-border bg-card">
                        <div className="aspect-[4/3] overflow-hidden bg-muted">
                          <img src={photo.url} alt={photo.name} className="h-full w-full object-cover" />
                        </div>
                        <div className="p-3">
                          <p className="truncate text-xs font-medium text-foreground">{photo.name}</p>
                          <div className="mt-2 flex items-center justify-between gap-2">
                            <span className="text-[11px] text-muted-foreground">{photo.sizeLabel}</span>
                            <button
                              type="button"
                              onClick={() => removePhoto(photo.id)}
                              className="text-[11px] font-medium text-[#a34700] hover:text-[#d35400]"
                            >
                              Retirer
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-[#d35400]/15 bg-[#fff8f3] p-4">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#a34700]">
                  Exemples de demandes
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {VOICE_PRESETS.map((preset, index) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => loadPreset(index)}
                      className="rounded-full border border-[#d35400]/15 bg-white px-3 py-2 text-xs font-medium text-foreground transition-colors hover:border-[#d35400]/35 hover:text-[#a34700]"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-muted-foreground">
                  La prochaine etape branchera ce formulaire sur votre API LLM pour produire un vrai devis assiste.
                </div>
                <Button
                  type="button"
                  onClick={generateDraft}
                  disabled={!transcript.trim()}
                  className="gap-2 bg-[#d35400] text-white hover:bg-[#b94800]"
                >
                  <Wand2 className="h-4 w-4" />
                  Generer un brouillon
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[24px] border-[#d35400]/10 bg-[#1b140d] text-white shadow-lg shadow-black/10">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-lg text-white">Brouillon de devis</CardTitle>
                  <CardDescription className="text-white/65">
                    A relire avant injection dans le devis final.
                  </CardDescription>
                </div>
                <Badge className="bg-white/10 text-white hover:bg-white/10">IA ready</Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {!draft ? (
                <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                  <p className="text-sm font-medium text-white">Ce que la maquette va produire</p>
                  <div className="mt-4 space-y-3 text-sm text-white/70">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-[#ffb27a]" />
                      <p>Un titre de devis clair et un resume client.</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-[#ffb27a]" />
                      <p>Des lignes pre-remplies a partir de la voix et des photos.</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-[#ffb27a]" />
                      <p>Des hypotheses a confirmer avant envoi au client.</p>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-white/45">Titre propose</p>
                        <h3 className="mt-2 text-2xl font-semibold text-white">{draft.title}</h3>
                        <p className="mt-2 text-sm text-white/70">
                          {draft.clientName || 'Client a preciser'} · {photos.length} photo{photos.length > 1 ? 's' : ''}
                        </p>
                      </div>
                      <div className="min-w-[120px]">
                        <div className="flex items-center justify-between text-xs text-white/60">
                          <span>Confiance</span>
                          <span>{draft.confidence}%</span>
                        </div>
                        <Progress value={draft.confidence} className="mt-2 h-2 bg-white/10" />
                      </div>
                    </div>
                    <p className="mt-4 text-sm leading-relaxed text-white/70">{draft.description}</p>
                  </div>

                  <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-white">Lignes suggerees</p>
                      <span className="text-xs text-white/50">{draft.lines.length} ligne{draft.lines.length > 1 ? 's' : ''}</span>
                    </div>
                    <div className="mt-4 space-y-3">
                      {draft.lines.map((line, index) => (
                        <div key={`${line.description}-${index}`} className="rounded-2xl border border-white/10 bg-black/10 p-3">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="text-sm font-medium text-white">{line.description}</p>
                              <p className="mt-1 text-xs text-white/50">
                                {line.quantity} {line.unit} x {formatCurrency(line.unit_price)}
                              </p>
                            </div>
                            <p className="text-sm font-semibold text-[#ffcfaa]">
                              {formatCurrency(line.quantity * line.unit_price)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                    <p className="text-sm font-medium text-white">Points a confirmer</p>
                    <div className="mt-3 space-y-2">
                      {draft.assumptions.map((assumption) => (
                        <div key={assumption} className="flex items-start gap-3 text-sm text-white/70">
                          <span className="mt-1 h-2 w-2 rounded-full bg-[#ffb27a]" />
                          <p>{assumption}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-white/10 bg-[#251b13] p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-white/45">Estimation maquette</p>
                        <p className="mt-2 text-3xl font-semibold text-white">{formatCurrency(totals.totalTtc)}</p>
                      </div>
                      <div className="text-right text-sm text-white/65">
                        <p>HT {formatCurrency(totals.totalHt)}</p>
                        <p>TVA 20% {formatCurrency(totals.totalTtc - totals.totalHt)}</p>
                      </div>
                    </div>
                  </div>
                </>
              )}

              <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                <div className="flex items-center gap-2 text-xs text-white/50">
                  <Sparkles className="h-3.5 w-3.5 text-[#ffb27a]" />
                  Scenario local de demonstration, sans appel API pour l&apos;instant.
                </div>
                <Button
                  type="button"
                  onClick={() => draft && onUseDraft(draft)}
                  disabled={!draft}
                  className="gap-2 bg-white text-[#1b140d] hover:bg-[#fff0e4]"
                >
                  Utiliser ce brouillon dans le devis
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
