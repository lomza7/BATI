'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, CheckCircle2, Mic, Plus, Sparkles, Square, Trash2, Wand2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { formatCurrency, QUOTE_UNITS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ClientPicker } from '@/components/shared/client-picker';

interface PhotoPreview {
  id: string;
  name: string;
  url: string;
  file: File;
}

export interface AiQuoteDraftLine {
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  tva_rate?: number;
  service_id?: string;
}

export interface AiQuoteDraft {
  title: string;
  clientName: string;
  clientId: string | null;
  description: string;
  lines: AiQuoteDraftLine[];
}

interface QuoteAiAssistantProps {
  onUseDraft: (draft: AiQuoteDraft) => void;
  presetRequest?: {
    id: number;
    mode: 'empty' | 'example';
  } | null;
}

interface AiAnalysis {
  title: string;
  clientName: string;
  description: string;
  confidence: number;
  summary: string;
  assumptions: string[];
  lines: AiQuoteDraftLine[];
}

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionErrorEventLike {
  error?: string;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

const EXAMPLE_REQUEST =
  "Renovation d'une salle de bain de 6 m2 avec depose, plomberie douche, carrelage mural, meuble vasque et peinture plafond.";

export function QuoteAiAssistant({ onUseDraft, presetRequest = null }: QuoteAiAssistantProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const photosRef = useRef<PhotoPreview[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [clientId, setClientId] = useState<string | null>(null);
  const [clientName, setClientName] = useState('');
  const [transcript, setTranscript] = useState('');
  const [photos, setPhotos] = useState<PhotoPreview[]>([]);
  const [analysis, setAnalysis] = useState<AiAnalysis | null>(null);
  const [editedLines, setEditedLines] = useState<AiQuoteDraftLine[]>([]);
  const [editedTitle, setEditedTitle] = useState('');
  const [analysisError, setAnalysisError] = useState('');
  const [forceManualInput, setForceManualInput] = useState(false);

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      photosRef.current.forEach((photo) => window.URL.revokeObjectURL(photo.url));
    };
  }, []);

  useEffect(() => {
    if (!isRecording) return;

    const timer = window.setInterval(() => {
      setRecordSeconds((current) => current + 1);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isRecording]);

  useEffect(() => {
    if (!presetRequest) return;

    photosRef.current.forEach((photo) => window.URL.revokeObjectURL(photo.url));
    setPhotos([]);
    setAnalysis(null);
    setEditedLines([]);
    setEditedTitle('');
    setAnalysisError('');
    setIsRecording(false);
    recognitionRef.current?.abort();
    setRecordSeconds(0);
    setForceManualInput(false);
    setClientId(null);

    if (presetRequest.mode === 'example') {
      setClientName('Mme Petit');
      setTranscript(EXAMPLE_REQUEST);
      return;
    }

    setClientName('');
    setTranscript('');
  }, [presetRequest]);

  function triggerPhotoPicker() {
    fileInputRef.current?.click();
  }

  function handlePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    const next = files.map((file) => ({
      id: `${file.name}-${file.lastModified}`,
      name: file.name,
      url: window.URL.createObjectURL(file),
      file,
    }));

    setAnalysis(null);
    setEditedLines([]);
    setAnalysisError('');
    setPhotos((current) => [...current, ...next].slice(0, 4));
    event.target.value = '';
  }

  function removePhoto(id: string) {
    setPhotos((current) => {
      const photo = current.find((item) => item.id === id);
      if (photo) {
        window.URL.revokeObjectURL(photo.url);
      }
      return current.filter((item) => item.id !== id);
    });
    setAnalysis(null);
    setEditedLines([]);
    setAnalysisError('');
  }

  async function toggleRecording() {
    if (isRecording) {
      recognitionRef.current?.stop();
      return;
    }

    const SpeechRecognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setAnalysisError('La dictee vocale n est pas disponible sur ce navigateur. Essayez Edge ou Chrome.');
      setForceManualInput(true);
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setAnalysisError("Ce navigateur ne permet pas d'acceder au micro.");
      setForceManualInput(true);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
    } catch {
      setAnalysisError(
        "Le micro n'est pas autorise ou n'est pas disponible. Autorisez l'acces au micro dans le navigateur puis reessayez."
      );
      setForceManualInput(true);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'fr-FR';
    recognition.interimResults = true;
    recognition.continuous = true;

    recognition.onresult = (event) => {
      let nextTranscript = '';

      for (let i = 0; i < event.results.length; i += 1) {
        nextTranscript += `${event.results[i][0]?.transcript ?? ''} `;
      }

      setTranscript(nextTranscript.trim());
    };

    recognition.onerror = (event) => {
      const errorMap: Record<string, string> = {
        'audio-capture': "Aucun micro n'a ete detecte sur cet appareil.",
        'not-allowed': "L'acces au micro est bloque. Autorisez le micro dans votre navigateur.",
        'service-not-allowed': "La dictee vocale n'est pas autorisee sur ce navigateur.",
        'network': "La dictee vocale a rencontre un probleme reseau.",
        'no-speech': "Aucune voix n'a ete detectee. Reessayez en parlant plus pres du micro.",
        'aborted': '',
      };

      const message = event.error ? errorMap[event.error] : '';
      if (message) {
        setAnalysisError(message);
      }
      if (event.error && event.error !== 'aborted' && event.error !== 'no-speech') {
        setForceManualInput(true);
      }
      setIsRecording(false);
      recognitionRef.current = null;
    };

    recognition.onend = () => {
      setIsRecording(false);
      recognitionRef.current = null;
    };

    setAnalysis(null);
    setEditedLines([]);
    setAnalysisError('');
    setRecordSeconds(0);
    setTranscript('');
    setForceManualInput(false);
    recognitionRef.current = recognition;
    setIsRecording(true);
    recognition.start();
  }

  async function analyseRequest() {
    if (!transcript.trim()) return;

    try {
      setIsAnalysing(true);
      setAnalysisError('');
      setAnalysis(null);
      setEditedLines([]);

      // Load contextual data in parallel: services catalog, business profile, recent history, client history
      const servicesPromise = supabase
        .from('services')
        .select('id, name, description, unit, unit_price, category')
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('category')
        .order('name');

      const profilePromise = user
        ? supabase
            .from('profiles')
            .select('company_activity, company_city, naf_label')
            .eq('id', user.id)
            .maybeSingle()
        : Promise.resolve({ data: null });

      const recentLinesPromise = user
        ? supabase
            .from('quote_lines')
            .select('description, quantity, unit, unit_price, quotes!inner(status, user_id, created_at)')
            .eq('quotes.user_id', user.id)
            .eq('quotes.status', 'accepte')
            .order('created_at', { foreignTable: 'quotes', ascending: false })
            .limit(40)
        : Promise.resolve({ data: [] as Array<{ description: string; quantity: number; unit: string; unit_price: number }> });

      const clientHistoryPromise = clientId && user
        ? supabase
            .from('quote_lines')
            .select('description, quantity, unit, unit_price, quotes!inner(client_id, user_id, created_at)')
            .eq('quotes.user_id', user.id)
            .eq('quotes.client_id', clientId)
            .order('created_at', { foreignTable: 'quotes', ascending: false })
            .limit(20)
        : Promise.resolve({ data: [] as Array<{ description: string; quantity: number; unit: string; unit_price: number }> });

      const [servicesResult, profileResult, recentResult, clientResult] = await Promise.all([
        servicesPromise,
        profilePromise,
        recentLinesPromise,
        clientHistoryPromise,
      ]);

      const userServices = servicesResult.data ?? [];
      const profile = (profileResult.data ?? null) as
        | { company_activity?: string; company_city?: string; naf_label?: string }
        | null;

      // Aggregate recent lines by description+unit → average price, most frequent first
      const recentRaw = (recentResult.data ?? []) as Array<{
        description: string;
        quantity: number;
        unit: string;
        unit_price: number;
      }>;
      const aggregated = new Map<
        string,
        { description: string; quantity: number; unit: string; unit_price: number; count: number }
      >();
      for (const line of recentRaw) {
        const key = `${line.description.toLowerCase().trim()}|${line.unit}`;
        const existing = aggregated.get(key);
        if (existing) {
          existing.unit_price = (existing.unit_price * existing.count + line.unit_price) / (existing.count + 1);
          existing.count += 1;
        } else {
          aggregated.set(key, { ...line, count: 1 });
        }
      }
      const recentLines = Array.from(aggregated.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 20)
        .map(({ description, quantity, unit, unit_price }) => ({
          description,
          quantity,
          unit,
          unit_price: Math.round(unit_price),
        }));

      const clientHistoryRaw = (clientResult.data ?? []) as Array<{
        description: string;
        quantity: number;
        unit: string;
        unit_price: number;
      }>;
      const clientHistory = clientHistoryRaw.slice(0, 15).map(({ description, quantity, unit, unit_price }) => ({
        description,
        quantity,
        unit,
        unit_price,
      }));

      const formData = new FormData();
      formData.append('transcript', transcript.trim());
      if (userServices.length > 0) {
        formData.append('services_catalog', JSON.stringify(userServices));
      }
      if (profile && (profile.company_activity || profile.company_city || profile.naf_label)) {
        formData.append(
          'business_context',
          JSON.stringify({
            company_activity: profile.company_activity || '',
            company_city: profile.company_city || '',
            naf_label: profile.naf_label || '',
          })
        );
      }
      if (recentLines.length > 0) {
        formData.append('recent_quote_lines', JSON.stringify(recentLines));
      }
      if (clientHistory.length > 0) {
        formData.append('client_history', JSON.stringify(clientHistory));
      }
      photos.forEach((photo) => {
        formData.append('photos', photo.file);
      });

      // Attach auth token so the API route can enforce plan limits per user
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const response = await fetch('/api/ai/quote', {
        method: 'POST',
        body: formData,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      const payload = (await response.json()) as { analysis?: AiAnalysis; error?: string };

      if (!response.ok || !payload.analysis) {
        throw new Error(payload.error || "L'analyse IA a echoue.");
      }

      setAnalysis(payload.analysis);
      setEditedLines(payload.analysis.lines.map((line) => ({ ...line })));
      setEditedTitle(payload.analysis.title || '');
      if (payload.analysis.clientName && !clientName) {
        setClientName(payload.analysis.clientName);
      }
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : "L'analyse IA a echoue.");
    } finally {
      setIsAnalysing(false);
    }
  }

  function updateLine(index: number, patch: Partial<AiQuoteDraftLine>) {
    setEditedLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  function removeLine(index: number) {
    setEditedLines((current) => current.filter((_, i) => i !== index));
  }

  function addEmptyLine() {
    setEditedLines((current) => [
      ...current,
      { description: '', quantity: 1, unit: 'u', unit_price: 0 },
    ]);
  }

  function useInQuote() {
    if (!analysis || editedLines.length === 0) return;

    onUseDraft({
      title: editedTitle.trim() || analysis.title || 'Devis a completer',
      clientName: clientName.trim() || analysis.clientName || '',
      clientId,
      description:
        analysis.description ||
        `Brouillon prepare avec l assistant IA a partir d'une demande vocale/photo. ${analysis.summary}`,
      lines: editedLines.map((line) => ({ ...line })),
    });
  }

  const hasTranscript = transcript.trim().length > 0;
  const hasPhotos = photos.length > 0;
  const totalHt = editedLines.reduce(
    (sum, line) => sum + (Number(line.quantity) || 0) * (Number(line.unit_price) || 0),
    0
  );

  function getStepState(step: 1 | 2 | 3) {
    if (step === 1) return hasTranscript ? 'done' : 'active';
    if (step === 2) {
      if (hasPhotos) return 'done';
      if (hasTranscript) return 'active';
      return 'todo';
    }
    if (analysis) return 'done';
    return hasTranscript ? 'active' : 'todo';
  }

  function getStepClasses(step: 1 | 2 | 3) {
    const state = getStepState(step);

    if (state === 'done') {
      return 'border-emerald-200 bg-emerald-50 shadow-sm';
    }

    if (state === 'active') {
      return 'border-[#d35400]/35 bg-[#fff7f0] ring-2 ring-[#d35400]/10 shadow-sm';
    }

    return 'border-border bg-muted/20 opacity-70';
  }

  return (
    <Card className="border-border bg-card transition-all duration-300">
      <CardHeader className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-[#d35400] text-white hover:bg-[#d35400]">Assistant devis IA</Badge>
              <Badge variant="outline">Voix + photos (optionnelles)</Badge>
            </div>
            <CardTitle className="mt-3 text-xl">Parlez, ajoutez des photos si besoin, lancez la magie</CardTitle>
            <CardDescription className="mt-1 max-w-2xl">
              L&apos;IA utilise votre catalogue de prestations, votre historique et votre profil pour proposer un devis sur-mesure.
            </CardDescription>
          </div>
          <div className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            {isRecording ? `Ecoute en cours ${recordSeconds}s` : 'Pret a ecouter'}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-muted/20 p-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Client (optionnel)</p>
          <ClientPicker
            value={clientId}
            onChange={(id, client) => {
              setClientId(id);
              if (client?.name) setClientName(client.name);
              setAnalysis(null);
              setEditedLines([]);
            }}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Selectionnez un client pour que l&apos;IA tienne compte de son historique tarifaire.
          </p>
        </div>
      </CardHeader>

      <CardContent className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className={cn('rounded-2xl border p-4 transition-all duration-300', getStepClasses(1))}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#a34700]">1</p>
                {getStepState(1) === 'done' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-medium text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Termine
                  </span>
                )}
              </div>
              <p className="mt-2 text-sm font-medium text-foreground">Commencez a parler</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Decrivez le chantier comme vous le feriez au telephone ou sur place.
              </p>
              <button
                type="button"
                onClick={toggleRecording}
                className={cn(
                  'mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors',
                  isRecording
                    ? 'bg-[#d35400] text-white hover:bg-[#b94800]'
                    : 'bg-white text-[#a34700] border border-[#d35400]/20 hover:border-[#d35400]/35'
                )}
              >
                {isRecording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                {isRecording ? "J'ai fini de parler" : 'Commencer a parler'}
              </button>
              {!isRecording && (
                <button
                  type="button"
                  onClick={() => {
                    setForceManualInput(true);
                    setAnalysisError('');
                  }}
                  className="mt-2 text-xs font-medium text-[#a34700] underline-offset-4 hover:underline"
                >
                  Saisir a la main
                </button>
              )}
            </div>
            <div className={cn('rounded-2xl border p-4 transition-all duration-300', getStepClasses(2))}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#a34700]">2</p>
                <span className="text-[10px] font-medium text-muted-foreground">Optionnel</span>
              </div>
              <p className="mt-2 text-sm font-medium text-foreground">Ajoutez des photos</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Elles aident l&apos;IA a mieux cerner le chantier mais ne sont pas obligatoires.
              </p>
              <button
                type="button"
                onClick={triggerPhotoPicker}
                className="mt-4 flex w-full items-center justify-center gap-3 rounded-2xl border border-dashed border-[#d35400]/30 bg-white px-4 py-3 text-left transition-all hover:border-[#d35400]/45 hover:bg-[#fff7f0]"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fff1e8] text-[#d35400]">
                  <Camera className="h-4 w-4" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-medium text-foreground">Ajouter des photos</span>
                  <span className="text-xs text-muted-foreground">Facade, chantier, degats, zone a traiter (4 max)</span>
                </span>
              </button>
            </div>
            <div className={cn('rounded-2xl border p-4 transition-all duration-300', getStepClasses(3))}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#a34700]">3</p>
                {getStepState(3) === 'done' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-medium text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Termine
                  </span>
                )}
                {getStepState(3) === 'active' && (
                  <span className="inline-flex rounded-full bg-[#d35400]/10 px-2 py-1 text-[11px] font-medium text-[#a34700]">
                    Pret
                  </span>
                )}
              </div>
              <p className="mt-2 text-sm font-medium text-foreground">Lancez la magie</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                L&apos;IA propose une base de devis que vous relisez avant validation.
              </p>
              <Button
                onClick={analyseRequest}
                disabled={!hasTranscript || isRecording || isAnalysing}
                className="mt-4 w-full gap-2"
              >
                <Wand2 className={cn('h-4 w-4', isAnalysing && 'animate-spin')} />
                {isAnalysing ? 'Analyse en cours...' : 'Lancer la magie'}
              </Button>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handlePhotoChange}
          />

          <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-4 text-xs text-muted-foreground">
            {!hasTranscript
              ? "Parlez d'abord, ou cliquez sur 'Saisir a la main'. Les photos restent optionnelles."
              : isAnalysing
                ? "L'IA est en train d'analyser votre demande."
                : 'C est bon, vous pouvez lancer la magie.'}
          </div>

          {analysisError && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {analysisError}
            </div>
          )}

          {photos.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {photos.map((photo) => (
                <div key={photo.id} className="relative overflow-hidden rounded-xl border border-border bg-card">
                  <img src={photo.url} alt={photo.name} className="h-20 w-24 object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(photo.id)}
                    className="absolute right-1 top-1 rounded-full bg-black/65 px-2 py-0.5 text-[10px] text-white"
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
          )}

          {(transcript.trim() || forceManualInput) && (
            <div className="rounded-2xl border border-border bg-muted/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Ce que l&apos;IA a compris</p>
                  <p className="text-xs text-muted-foreground">
                    Vous pourrez toujours corriger ou saisir votre descriptif avant d&apos;aller plus loin.
                  </p>
                </div>
                {clientName && <Badge variant="outline">{clientName}</Badge>}
              </div>

              <Textarea
                className="mt-3 min-h-[118px] bg-white"
                placeholder="La transcription apparaitra ici."
                value={transcript}
                onChange={(event) => {
                  setTranscript(event.target.value);
                  setAnalysis(null);
                  setEditedLines([]);
                  setAnalysisError('');
                }}
              />
            </div>
          )}

        </div>

        <div className="rounded-2xl border border-border bg-muted/20 p-4">
          {!analysis ? (
            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">Le brouillon apparaitra ici</p>
              <div className="rounded-2xl border border-dashed border-border bg-background/80 p-4 text-sm text-muted-foreground">
                {!hasTranscript
                  ? 'Etape 1: commencez a parler ou saisissez a la main.'
                  : isAnalysing
                    ? 'Generation du brouillon en cours...'
                    : 'Etape 3: lancez la magie pour generer le brouillon.'}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">Analyse preliminaire</p>
                  <p className="mt-1 text-sm text-muted-foreground">{analysis.summary}</p>
                </div>
                <Badge variant="outline">{analysis.confidence}%</Badge>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Titre du devis</label>
                <Input
                  className="mt-1 bg-white"
                  value={editedTitle}
                  onChange={(event) => setEditedTitle(event.target.value)}
                  placeholder="Titre du devis"
                />
              </div>

              <div className="space-y-2">
                {editedLines.map((line, index) => (
                  <div key={index} className="rounded-xl border border-border bg-card p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 space-y-2">
                        <Textarea
                          className="min-h-[48px] bg-white text-sm"
                          value={line.description}
                          onChange={(event) => updateLine(index, { description: event.target.value })}
                          placeholder="Description"
                        />
                        <div className="flex flex-wrap items-center gap-2">
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            className="h-8 w-20 bg-white text-sm"
                            value={line.quantity}
                            onChange={(event) => updateLine(index, { quantity: Number(event.target.value) })}
                          />
                          <Select value={line.unit} onValueChange={(value) => updateLine(index, { unit: value })}>
                            <SelectTrigger className="h-8 w-28 bg-white text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {QUOTE_UNITS.map((u) => (
                                <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            className="h-8 w-24 bg-white text-sm"
                            value={line.unit_price}
                            onChange={(event) => updateLine(index, { unit_price: Number(event.target.value) })}
                          />
                          <span className="text-xs text-muted-foreground">=</span>
                          <span className="text-sm font-semibold text-foreground">
                            {formatCurrency((Number(line.quantity) || 0) * (Number(line.unit_price) || 0))}
                          </span>
                          {line.service_id && (
                            <Badge variant="outline" className="gap-1 text-[10px]">
                              <Sparkles className="h-2.5 w-2.5" /> catalogue
                            </Badge>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeLine(index)}
                        className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                        title="Supprimer la ligne"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <Button variant="outline" size="sm" onClick={addEmptyLine} className="gap-1">
                <Plus className="h-3.5 w-3.5" /> Ajouter une ligne
              </Button>

              {analysis.assumptions.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Hypotheses</p>
                  {analysis.assumptions.map((item) => (
                    <p key={item} className="text-xs text-muted-foreground">
                      • {item}
                    </p>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
                <div>
                  <p className="text-xs text-muted-foreground">Total estime HT</p>
                  <p className="text-xl font-semibold text-foreground">{formatCurrency(totalHt)}</p>
                </div>
                <Button onClick={useInQuote} disabled={editedLines.length === 0}>Pre-remplir le devis</Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
