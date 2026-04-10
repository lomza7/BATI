'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BookmarkPlus,
  Calculator,
  Check,
  FileText,
  History,
  Loader2,
  Mic,
  Plus,
  RefreshCw,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Trash2,
  TrendingUp,
  Wand2,
} from 'lucide-react';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ClientPicker } from '@/components/shared/client-picker';
import type { ClarifyQuestion, QuoteTurn } from '@/lib/ai/quote-schema';

// ---------- Public types ------------------------------------------------

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
  onUseDraft: (draft: AiQuoteDraft) => void | Promise<void>;
  /** When true, the submit button shows a spinner and is disabled. */
  saving?: boolean;
  presetRequest?: {
    id: number;
    mode: 'empty' | 'example';
  } | null;
}

// ---------- Internal types ----------------------------------------------

interface AiAnalysis {
  title: string;
  clientName: string;
  description: string;
  confidence: number;
  summary: string;
  assumptions: string[];
  lines: AiQuoteDraftLine[];
}

type AssistantPhase = 'input' | 'analyzing' | 'clarifying' | 'ready';

// ---------- Constants ---------------------------------------------------

const BAR_COUNT = 30;
const MAX_DURATION_SEC = 120;

// Cosmetic "deep analysis" steps shown in a modal while the /api/ai/quote
// call is in flight. The real work is just one HTTP round-trip (~3-5s), but
// rolling through these steps reassures the artisan that we're actually
// weighing prices, history, etc. Interval below is tuned so the full sequence
// lasts ~4s — the typical API latency.
const ANALYSIS_STEPS: ReadonlyArray<{ label: string; icon: typeof FileText }> = [
  { label: 'Lecture attentive de ta demande', icon: FileText },
  { label: 'Identification des prestations BTP', icon: Sparkles },
  { label: 'Estimation des surfaces et quantités', icon: Calculator },
  { label: 'Consultation des prix du marché français', icon: TrendingUp },
  { label: 'Prise en compte de ton historique tarifaire', icon: History },
  { label: 'Rédaction des lignes de devis', icon: ScrollText },
  { label: 'Vérification finale et cohérence', icon: ShieldCheck },
];
const ANALYSIS_STEP_MS = 600;

const EXAMPLE_REQUEST =
  "Renovation d'une salle de bain de 6 m2 avec depose, plomberie douche, carrelage mural, meuble vasque et peinture plafond.";

// ---------- Voice recorder hook -----------------------------------------

type RecorderPhase = 'idle' | 'recording' | 'uploading' | 'error';

function pickMimeType(): string {
  if (typeof window === 'undefined' || typeof window.MediaRecorder === 'undefined') {
    return '';
  }
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4;codecs=mp4a.40.2',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ];
  for (const type of candidates) {
    if (window.MediaRecorder.isTypeSupported?.(type)) return type;
  }
  return '';
}

interface UseVoiceRecorderOptions {
  onTranscript: (text: string) => void;
  onError: (message: string) => void;
}

/**
 * MediaRecorder + Web Audio API wrapper tailored for mobile Safari.
 *
 * - Captures a single audio stream via getUserMedia with noise suppression
 * - Feeds an AnalyserNode into a RAF loop to produce 30-bar waveform values
 * - On stop, uploads the blob to /api/ai/transcribe and surfaces the text
 * - Always releases the mic via getTracks().stop() + AudioContext.close()
 *
 * The hook is intentionally instance-local: the parent component creates a
 * single instance and routes transcripts based on which button triggered
 * the recording (main mic vs. per-question mini mic). Only one recording
 * is ever in-flight because hold-to-record is a physical gesture.
 */
function useVoiceRecorder({ onTranscript, onError }: UseVoiceRecorderOptions) {
  const [phase, setPhase] = useState<RecorderPhase>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [amplitudes, setAmplitudes] = useState<number[]>(() => new Array(BAR_COUNT).fill(0));

  const onTranscriptRef = useRef(onTranscript);
  const onErrorRef = useRef(onError);
  useEffect(() => { onTranscriptRef.current = onTranscript; }, [onTranscript]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const mimeTypeRef = useRef<string>('');
  const animFrameRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const startedAtRef = useRef<number>(0);
  const shouldUploadRef = useRef(true);

  const isSupported = useMemo(
    () =>
      typeof window !== 'undefined' &&
      typeof window.MediaRecorder !== 'undefined' &&
      typeof navigator !== 'undefined' &&
      !!navigator.mediaDevices?.getUserMedia,
    [],
  );

  const stopMeters = useCallback(() => {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const releaseMedia = useCallback(() => {
    stopMeters();
    try { sourceRef.current?.disconnect(); } catch { /* noop */ }
    try { analyserRef.current?.disconnect(); } catch { /* noop */ }
    sourceRef.current = null;
    analyserRef.current = null;
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    recorderRef.current = null;
    chunksRef.current = [];
  }, [stopMeters]);

  // Guaranteed cleanup on unmount — we never want a dangling mic indicator.
  useEffect(() => {
    return () => {
      releaseMedia();
    };
  }, [releaseMedia]);

  const uploadBlob = useCallback(async (blob: Blob) => {
    setPhase('uploading');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const form = new FormData();
      const ext = mimeTypeRef.current.includes('mp4')
        ? 'm4a'
        : mimeTypeRef.current.includes('ogg')
          ? 'ogg'
          : 'webm';
      form.append('file', blob, `recording.${ext}`);
      const res = await fetch('/api/ai/transcribe', {
        method: 'POST',
        body: form,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || 'La transcription a échoué.');
      }
      const { transcript } = (await res.json()) as { transcript?: string };
      if (!transcript || !transcript.trim()) {
        throw new Error('Aucune parole détectée.');
      }
      onTranscriptRef.current(transcript.trim());
      setPhase('idle');
    } catch (err) {
      setPhase('error');
      onErrorRef.current(err instanceof Error ? err.message : 'La transcription a échoué.');
      // Auto-return to idle after a short delay so the mic becomes usable again.
      window.setTimeout(() => setPhase('idle'), 200);
    }
  }, []);

  const stop = useCallback(
    async ({ cancel = false }: { cancel?: boolean } = {}) => {
      const recorder = recorderRef.current;
      shouldUploadRef.current = !cancel;

      if (!recorder || recorder.state === 'inactive') {
        releaseMedia();
        if (cancel) setPhase('idle');
        return;
      }

      // Hand off the rest of the work to the onstop handler. It runs after
      // the last ondataavailable fires, so we're guaranteed to have all the
      // chunks before building the Blob.
      try {
        recorder.stop();
      } catch {
        releaseMedia();
        setPhase('idle');
      }
    },
    [releaseMedia],
  );

  const start = useCallback(async () => {
    if (!isSupported) {
      onErrorRef.current("Ton navigateur ne supporte pas l'enregistrement audio. Tape ta demande à la main.");
      setPhase('error');
      return;
    }
    if (phase === 'recording' || phase === 'uploading') return;

    setElapsed(0);
    setAmplitudes(new Array(BAR_COUNT).fill(0));
    shouldUploadRef.current = true;
    chunksRef.current = [];

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (err) {
      const name = err instanceof Error ? err.name : '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        onErrorRef.current("L'accès au micro est bloqué. Autorise-le dans ton navigateur.");
      } else if (name === 'NotFoundError') {
        onErrorRef.current("Aucun micro détecté sur cet appareil.");
      } else {
        onErrorRef.current("Impossible d'accéder au micro. Réessaye.");
      }
      setPhase('error');
      window.setTimeout(() => setPhase('idle'), 200);
      return;
    }

    streamRef.current = stream;
    const mime = pickMimeType();
    mimeTypeRef.current = mime;

    let recorder: MediaRecorder;
    try {
      recorder = mime
        ? new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 64_000 })
        : new MediaRecorder(stream);
    } catch {
      onErrorRef.current("Ton navigateur n'a pas pu démarrer l'enregistrement.");
      setPhase('error');
      releaseMedia();
      return;
    }
    recorderRef.current = recorder;

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    recorder.onerror = () => {
      onErrorRef.current("L'enregistrement a été interrompu.");
      releaseMedia();
      setPhase('error');
      window.setTimeout(() => setPhase('idle'), 200);
    };

    recorder.onstop = () => {
      const chunks = chunksRef.current;
      const mimeType = mimeTypeRef.current || 'audio/webm';
      const shouldUpload = shouldUploadRef.current;
      // Flush the stream immediately so the mic indicator disappears.
      releaseMedia();
      if (!shouldUpload || chunks.length === 0) {
        setPhase('idle');
        return;
      }
      const blob = new Blob(chunks, { type: mimeType });
      if (blob.size < 400) {
        // Less than ~0.1s of audio — treat as accidental
        setPhase('idle');
        onErrorRef.current('Enregistrement trop court. Maintiens le micro plus longtemps.');
        return;
      }
      void uploadBlob(blob);
    };

    // Set up the AudioContext analyser for the waveform BEFORE starting the
    // recorder so the first frames already have real data to show.
    try {
      const AudioContextCtor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioContextCtor) {
        const ctx = new AudioContextCtor();
        // iOS Safari starts contexts in "suspended" — resume after gesture.
        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }
        audioCtxRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        sourceRef.current = source;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analyserRef.current = analyser;

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        const tick = () => {
          if (!analyserRef.current) return;
          analyserRef.current.getByteFrequencyData(dataArray);
          // Down-sample to BAR_COUNT values by averaging bins.
          const step = Math.floor(bufferLength / BAR_COUNT) || 1;
          const next: number[] = new Array(BAR_COUNT);
          for (let i = 0; i < BAR_COUNT; i += 1) {
            let sum = 0;
            const base = i * step;
            for (let j = 0; j < step; j += 1) {
              sum += dataArray[base + j] || 0;
            }
            const avg = sum / step;
            // Normalize to 0-100 with a slight boost so quiet speech is visible.
            next[i] = Math.min(100, Math.round((avg / 255) * 140));
          }
          setAmplitudes(next);
          animFrameRef.current = window.requestAnimationFrame(tick);
        };
        animFrameRef.current = window.requestAnimationFrame(tick);
      }
    } catch {
      // Waveform is cosmetic; if AudioContext fails we still record fine.
    }

    startedAtRef.current = performance.now();
    timerRef.current = window.setInterval(() => {
      const secs = Math.floor((performance.now() - startedAtRef.current) / 1000);
      setElapsed(secs);
      if (secs >= MAX_DURATION_SEC) {
        // Auto-stop at the limit — user gets a short notice via onError and
        // the normal stop path uploads the blob.
        onErrorRef.current(`Limite de ${MAX_DURATION_SEC}s atteinte, transcription en cours…`);
        void stop({ cancel: false });
      }
    }, 250) as unknown as number;

    try {
      recorder.start(250);
      setPhase('recording');
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(15);
      }
    } catch {
      onErrorRef.current("Impossible de démarrer l'enregistrement.");
      releaseMedia();
      setPhase('error');
      window.setTimeout(() => setPhase('idle'), 200);
    }
  }, [isSupported, phase, releaseMedia, stop, uploadBlob]);

  return { phase, elapsed, amplitudes, start, stop, isSupported };
}

// ---------- Main component ----------------------------------------------

export function QuoteAiAssistant({ onUseDraft, saving = false, presetRequest = null }: QuoteAiAssistantProps) {
  const { user } = useAuth();

  const [clientId, setClientId] = useState<string | null>(null);
  const [clientName, setClientName] = useState('');
  const [transcript, setTranscript] = useState('');
  const [analysis, setAnalysis] = useState<AiAnalysis | null>(null);
  const [editedLines, setEditedLines] = useState<AiQuoteDraftLine[]>([]);
  const [editedTitle, setEditedTitle] = useState('');
  const [analysisError, setAnalysisError] = useState('');
  // Tracks which lines the artisan has saved into their services catalog
  // during this session — keyed by the ready-state line index.
  const [savedLines, setSavedLines] = useState<Record<number, 'saving' | 'saved'>>({});

  const [phase, setPhase] = useState<AssistantPhase>('input');
  const [turns, setTurns] = useState<QuoteTurn[]>([]);
  const [currentQuestions, setCurrentQuestions] = useState<ClarifyQuestion[]>([]);
  const [pendingAnswers, setPendingAnswers] = useState<Record<string, string>>({});

  // Cosmetic step index shown in the analyzing overlay — see ANALYSIS_STEPS.
  const [analyzingStep, setAnalyzingStep] = useState(0);

  // Tracks which button triggered the active recording so we can route the
  // returned transcript: 'main' writes to the top transcript; 'answer:<id>'
  // writes into pendingAnswers for that question id.
  const [activeMic, setActiveMic] = useState<string | null>(null);
  const activeMicRef = useRef<string | null>(null);
  useEffect(() => {
    activeMicRef.current = activeMic;
  }, [activeMic]);

  const recorder = useVoiceRecorder({
    onTranscript: (text) => {
      const target = activeMicRef.current;
      if (!target) return;
      if (target === 'main') {
        setTranscript(text);
        setAnalysis(null);
        setEditedLines([]);
        setAnalysisError('');
      } else if (target.startsWith('answer:')) {
        const qId = target.slice('answer:'.length);
        setPendingAnswers((prev) => ({ ...prev, [qId]: text }));
      }
      setActiveMic(null);
    },
    onError: (msg) => {
      setAnalysisError(msg);
      setActiveMic(null);
    },
  });

  // Apply presets from the parent (e.g. "empty draft" or "example").
  useEffect(() => {
    if (!presetRequest) return;
    setAnalysis(null);
    setEditedLines([]);
    setEditedTitle('');
    setAnalysisError('');
    setClientId(null);
    setTurns([]);
    setCurrentQuestions([]);
    setPendingAnswers({});
    setSavedLines({});
    setPhase('input');

    if (presetRequest.mode === 'example') {
      setClientName('Mme Petit');
      setTranscript(EXAMPLE_REQUEST);
      return;
    }

    setClientName('');
    setTranscript('');
  }, [presetRequest]);

  // Drive the cosmetic analysis step counter while the API call is in
  // flight. Resets to 0 on entry and ticks through ANALYSIS_STEPS until the
  // last one, then stops. When the phase leaves 'analyzing' the overlay
  // unmounts anyway.
  useEffect(() => {
    if (phase !== 'analyzing') {
      setAnalyzingStep(0);
      return;
    }
    setAnalyzingStep(0);
    let current = 0;
    const id = window.setInterval(() => {
      current += 1;
      if (current >= ANALYSIS_STEPS.length - 1) {
        // Stay on the last step (not past it) so the final spinner keeps
        // pulsing if the API is slower than our animation.
        setAnalyzingStep(ANALYSIS_STEPS.length - 1);
        window.clearInterval(id);
        return;
      }
      setAnalyzingStep(current);
    }, ANALYSIS_STEP_MS);
    return () => window.clearInterval(id);
  }, [phase]);

  // ---------- Photos ----------------------------------------------------

  // ---------- Mic toggle (tap to start, tap to stop) -------------------

  async function startMic(target: string) {
    if (recorder.phase === 'recording' || recorder.phase === 'uploading') return;
    setAnalysisError('');
    activeMicRef.current = target;
    setActiveMic(target);
    await recorder.start();
  }

  async function toggleMic(target: string) {
    // If that exact mic is already recording, the tap stops it and sends.
    if (recorder.phase === 'recording' && activeMicRef.current === target) {
      await recorder.stop({ cancel: false });
      return;
    }
    // If a different mic is busy (recording or uploading), ignore the tap —
    // we never want two recordings racing or a click during upload.
    if (recorder.phase === 'recording' || recorder.phase === 'uploading') return;
    await startMic(target);
  }

  // ---------- Analyze call (shared between first run and follow-ups) ---

  async function callAnalyze(currentTurns: QuoteTurn[]) {
    setPhase('analyzing');
    setAnalysisError('');

    try {
      // Load contextual data in parallel (services catalog, profile, recent
      // lines, client history) — same set as the legacy implementation.
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

      // Aggregate recent lines: group by description+unit, average price,
      // sort by frequency. Matches the legacy logic byte-for-byte.
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
          existing.unit_price =
            (existing.unit_price * existing.count + line.unit_price) / (existing.count + 1);
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
      formData.append('previous_turns', JSON.stringify(currentTurns));
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
          }),
        );
      }
      if (recentLines.length > 0) {
        formData.append('recent_quote_lines', JSON.stringify(recentLines));
      }
      if (clientHistory.length > 0) {
        formData.append('client_history', JSON.stringify(clientHistory));
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const response = await fetch('/api/ai/quote', {
        method: 'POST',
        body: formData,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      const payload = (await response.json()) as
        | { status: 'ready'; analysis: AiAnalysis }
        | { status: 'clarify'; questions: ClarifyQuestion[] }
        | { error?: string };

      if (!response.ok) {
        throw new Error(('error' in payload && payload.error) || "L'analyse IA a échoué.");
      }

      if ('status' in payload && payload.status === 'clarify') {
        const questions = payload.questions;
        setCurrentQuestions(questions);
        setPendingAnswers({});
        setTurns((prev) => [
          ...prev,
          { role: 'assistant', kind: 'questions', questions },
        ]);
        setPhase('clarifying');
        return;
      }

      if ('status' in payload && payload.status === 'ready') {
        const result = payload.analysis;
        setAnalysis(result);
        setEditedLines(result.lines.map((line) => ({ ...line })));
        setEditedTitle(result.title || '');
        if (result.clientName && !clientName) {
          setClientName(result.clientName);
        }
        setCurrentQuestions([]);
        setPhase('ready');
        return;
      }

      throw new Error("Réponse IA inattendue.");
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : "L'analyse IA a échoué.");
      setPhase(turns.length > 0 ? 'clarifying' : 'input');
    }
  }

  async function launchMagic() {
    if (!transcript.trim()) return;
    if (!clientId) {
      setAnalysisError('Sélectionne ou crée un client avant de lancer l\'analyse.');
      // Scroll the client picker into view so the artisan sees where to act.
      if (typeof window !== 'undefined') {
        const picker = document.getElementById('ai-quote-client-picker');
        picker?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }
    const initialTurn: QuoteTurn = {
      role: 'user',
      kind: 'transcript',
      text: transcript.trim(),
    };
    setTurns([initialTurn]);
    setCurrentQuestions([]);
    setPendingAnswers({});
    setAnalysis(null);
    setEditedLines([]);
    await callAnalyze([initialTurn]);
  }

  async function submitAnswers() {
    const answers = currentQuestions
      .map((q) => ({
        question_id: q.id,
        question_text: q.text,
        text: (pendingAnswers[q.id] || '').trim(),
      }))
      .filter((a) => a.text.length > 0);
    if (answers.length === 0) return;
    const nextTurn: QuoteTurn = { role: 'user', kind: 'answers', answers };
    const nextTurns = [...turns, nextTurn];
    setTurns(nextTurns);
    await callAnalyze(nextTurns);
  }

  // ---------- Edit helpers ---------------------------------------------

  function updateLine(index: number, patch: Partial<AiQuoteDraftLine>) {
    setEditedLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  function removeLine(index: number) {
    setEditedLines((current) => current.filter((_, i) => i !== index));
    // Shift the savedLines map so entries stay aligned with the new indices.
    setSavedLines((current) => {
      const next: Record<number, 'saving' | 'saved'> = {};
      for (const [key, state] of Object.entries(current)) {
        const k = Number(key);
        if (k === index) continue;
        next[k > index ? k - 1 : k] = state;
      }
      return next;
    });
  }

  function addEmptyLine() {
    setEditedLines((current) => [
      ...current,
      { description: '', quantity: 1, unit: 'u', unit_price: 0 },
    ]);
  }

  // Persist a line that the IA flagged as a new proposition (no service_id)
  // into the artisan's services catalog so it shows up on future quotes.
  // Matches the shape used by app/(app)/devis/page.tsx:saveLineAsPrestation.
  async function saveLineAsPrestation(index: number) {
    if (!user) return;
    const line = editedLines[index];
    if (!line) return;
    const description = line.description.trim();
    if (!description || line.unit_price <= 0) return;
    if (savedLines[index]) return;

    setSavedLines((prev) => ({ ...prev, [index]: 'saving' }));
    const name = description.length > 80 ? description.slice(0, 80) : description;
    const longDescription = description.length > 80 ? description : '';

    const { error } = await supabase.from('services').insert({
      user_id: user.id,
      name,
      description: longDescription,
      unit: line.unit || 'u',
      unit_price: line.unit_price,
      category: '',
      tva_rate: line.tva_rate ?? 20,
      is_recurring: false,
      is_active: true,
    });

    if (error) {
      setSavedLines((prev) => {
        const { [index]: _removed, ...rest } = prev;
        return rest;
      });
      setAnalysisError("Impossible d'enregistrer la prestation. Réessaye.");
      return;
    }

    setSavedLines((prev) => ({ ...prev, [index]: 'saved' }));
  }

  async function useInQuote() {
    if (!analysis || editedLines.length === 0 || saving) return;
    await onUseDraft({
      title: editedTitle.trim() || analysis.title || 'Devis à compléter',
      clientName: clientName.trim() || analysis.clientName || '',
      clientId,
      description:
        analysis.description ||
        analysis.summary ||
        '',
      lines: editedLines.map((line) => ({ ...line })),
    });
  }

  const hasTranscript = transcript.trim().length > 0;
  const isRecordingMain = recorder.phase === 'recording' && activeMic === 'main';
  const isUploading = recorder.phase === 'uploading';
  const isAnalysing = phase === 'analyzing';
  const totalHt = editedLines.reduce(
    (sum, line) => sum + (Number(line.quantity) || 0) * (Number(line.unit_price) || 0),
    0,
  );
  const answeredCount = currentQuestions.filter(
    (q) => (pendingAnswers[q.id] || '').trim().length > 0,
  ).length;
  const allAnswered = currentQuestions.length > 0 && answeredCount === currentQuestions.length;
  const clarifyRoundsUsed = turns.filter((t) => t.role === 'user' && t.kind === 'answers').length;
  const recorderUnsupported = !recorder.isSupported;

  // Format elapsed as m:ss for the recording indicator
  const elapsedLabel = useMemo(() => {
    const m = Math.floor(recorder.elapsed / 60);
    const s = recorder.elapsed % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }, [recorder.elapsed]);

  // ---------- Render ---------------------------------------------------

  return (
    <>
    <Card className="border-border bg-card">
      <CardHeader className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-[#d35400] text-white hover:bg-[#d35400]">Assistant devis IA</Badge>
              <Badge variant="outline">Dictée vocale</Badge>
            </div>
            <CardTitle className="mt-3 text-xl">Décris ton chantier à voix haute</CardTitle>
            <CardDescription className="mt-1 max-w-2xl">
              Appuie sur le micro pour parler. L&apos;IA te pose des questions si besoin, puis prépare un brouillon de devis basé sur ton catalogue et ton historique.
            </CardDescription>
          </div>
          {isRecordingMain && (
            <div className="flex items-center gap-2 rounded-full bg-[#d35400]/10 px-3 py-1 text-xs font-medium text-[#a34700]">
              <span className="h-2 w-2 animate-pulse rounded-full bg-[#d35400]" />
              Enregistrement {elapsedLabel}
            </div>
          )}
        </div>

        <div
          id="ai-quote-client-picker"
          className={cn(
            'rounded-2xl border p-3 transition-colors',
            clientId
              ? 'border-border bg-muted/20'
              : 'border-[#d35400]/40 bg-[#fff7f0]',
          )}
        >
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Client
            <span className="text-[#d35400]" aria-hidden="true">*</span>
            <span className="normal-case tracking-normal text-[11px] text-muted-foreground/70">(requis)</span>
          </p>
          <ClientPicker
            value={clientId}
            onChange={(id, client) => {
              setClientId(id);
              if (client?.name) setClientName(client.name);
              setAnalysis(null);
              setEditedLines([]);
              if (id) setAnalysisError('');
            }}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Sélectionne ou crée le client du chantier — l&apos;IA s&apos;appuie sur son historique pour ajuster les prix.
          </p>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {/* ---------- Mic (voice-only) ---------- */}
        <div className="rounded-2xl border border-[#d35400]/20 bg-gradient-to-b from-[#fff7f0] to-white p-5">
          <div className="flex flex-col items-center gap-3">
            {recorderUnsupported ? (
              <div className="w-full rounded-xl border border-dashed border-border bg-white p-4 text-sm text-muted-foreground">
                Ton navigateur ne supporte pas l&apos;enregistrement audio. Saisis ta demande dans la zone de texte ci-dessous.
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => { void toggleMic('main'); }}
                  onContextMenu={(e) => e.preventDefault()}
                  disabled={isUploading || isAnalysing}
                  aria-label={isRecordingMain ? 'Appuie pour arrêter' : 'Appuie pour parler'}
                  aria-pressed={isRecordingMain}
                  className={cn(
                    'relative flex h-20 w-20 select-none items-center justify-center rounded-full shadow-lg transition-all duration-150',
                    isRecordingMain
                      ? 'scale-110 bg-[#d35400] text-white ring-8 ring-[#d35400]/20'
                      : 'bg-white text-[#d35400] ring-2 ring-[#d35400]/20 hover:ring-[#d35400]/35 active:scale-95',
                    (isUploading || isAnalysing) && 'opacity-50',
                  )}
                  style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none' }}
                >
                  {isUploading ? (
                    <Loader2 className="h-9 w-9 animate-spin" />
                  ) : (
                    <Mic className="h-9 w-9" />
                  )}
                </button>

                <p className="text-center text-sm font-medium text-[#a34700]">
                  {isRecordingMain
                    ? 'Enregistrement… appuie pour arrêter'
                    : isUploading
                      ? 'Transcription en cours…'
                      : 'Appuie pour parler'}
                </p>

                {isRecordingMain && (
                  <div className="flex w-full items-end justify-center gap-[2px]" style={{ height: 48 }}>
                    {recorder.amplitudes.map((a, i) => (
                      <div
                        key={i}
                        className="w-1 rounded-full bg-[#d35400] transition-[height] duration-75 ease-out"
                        style={{ height: `${Math.max(6, Math.min(100, a))}%` }}
                      />
                    ))}
                  </div>
                )}
                {isRecordingMain && (
                  <p className="text-xs text-muted-foreground">
                    {elapsedLabel} / {Math.floor(MAX_DURATION_SEC / 60)}:{String(MAX_DURATION_SEC % 60).padStart(2, '0')}
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        {analysisError && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {analysisError}
          </div>
        )}

        {/* ---------- Transcript editor ---------- */}
        {(hasTranscript || recorderUnsupported) && (
          <div className="rounded-2xl border border-border bg-muted/20 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">Ce que j&apos;ai compris</p>
                <p className="text-xs text-muted-foreground">
                  Corrige si besoin avant de lancer la magie.
                </p>
              </div>
              {clientName && <Badge variant="outline">{clientName}</Badge>}
            </div>

            <Textarea
              className="mt-3 min-h-[118px] bg-white"
              placeholder="Décris le chantier : surface, état existant, prestations…"
              value={transcript}
              onChange={(event) => {
                setTranscript(event.target.value);
                setAnalysis(null);
                setEditedLines([]);
                setAnalysisError('');
              }}
            />

            <Button
              onClick={launchMagic}
              disabled={!hasTranscript || !clientId || isAnalysing || isRecordingMain || isUploading}
              className="mt-3 w-full gap-2 bg-[#d35400] text-white hover:bg-[#b94800]"
            >
              <Wand2 className={cn('h-4 w-4', isAnalysing && 'animate-spin')} />
              {isAnalysing
                ? 'Analyse en cours…'
                : !clientId
                  ? 'Sélectionne un client pour continuer'
                  : 'Lancer la magie'}
            </Button>
          </div>
        )}

        {/* ---------- Clarification questions ---------- */}
        {phase === 'clarifying' && currentQuestions.length > 0 && (
          <Card className="border-[#d35400]/30 bg-[#fff7f0]">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Badge className="bg-[#d35400] text-white hover:bg-[#d35400]">
                  {currentQuestions.length === 1
                    ? '1 question'
                    : `${currentQuestions.length} questions`}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Tour {clarifyRoundsUsed + 1} / 3
                </span>
              </div>
              <CardDescription>
                Quelques précisions pour préparer un devis précis. Tu peux répondre à voix haute ou taper.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {currentQuestions.map((q, idx) => {
                const isAnswerMicActive = activeMic === `answer:${q.id}`;
                return (
                  <div key={q.id} className="space-y-2 rounded-xl border border-border bg-white p-3">
                    <p className="text-sm font-medium text-foreground">
                      {idx + 1}. {q.text}
                    </p>
                    <p className="text-xs text-muted-foreground">💡 {q.reason}</p>
                    <div className="flex items-start gap-2">
                      {!recorderUnsupported && (
                        <button
                          type="button"
                          onClick={() => { void toggleMic(`answer:${q.id}`); }}
                          onContextMenu={(e) => e.preventDefault()}
                          disabled={
                            (recorder.phase !== 'idle' && !isAnswerMicActive) || isAnalysing
                          }
                          aria-label={isAnswerMicActive ? 'Appuie pour arrêter' : 'Appuie pour répondre'}
                          aria-pressed={isAnswerMicActive}
                          className={cn(
                            'flex h-10 w-10 shrink-0 select-none items-center justify-center rounded-full shadow-sm transition-all duration-150',
                            isAnswerMicActive
                              ? 'scale-110 bg-[#d35400] text-white ring-4 ring-[#d35400]/25'
                              : 'bg-white text-[#d35400] ring-2 ring-[#d35400]/20 hover:ring-[#d35400]/35',
                            recorder.phase !== 'idle' && !isAnswerMicActive && 'opacity-40',
                          )}
                          style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none' }}
                        >
                          <Mic className="h-4 w-4" />
                        </button>
                      )}
                      <Textarea
                        value={pendingAnswers[q.id] || ''}
                        onChange={(e) =>
                          setPendingAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                        }
                        placeholder="Réponse…"
                        className="min-h-[60px] flex-1 bg-white"
                      />
                    </div>
                  </div>
                );
              })}
              <Button
                onClick={submitAnswers}
                disabled={!allAnswered || isAnalysing}
                className="w-full gap-2 bg-[#d35400] text-white hover:bg-[#b94800]"
              >
                <Wand2 className={cn('h-4 w-4', isAnalysing && 'animate-spin')} />
                {isAnalysing
                  ? 'Analyse en cours…'
                  : allAnswered
                    ? 'Envoyer mes réponses'
                    : `Réponds à ${currentQuestions.length - answeredCount} question${currentQuestions.length - answeredCount > 1 ? 's' : ''} restante${currentQuestions.length - answeredCount > 1 ? 's' : ''}`}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ---------- Draft preview (ready) ---------- */}
        {phase === 'ready' && analysis && (
          <div className="rounded-2xl border border-border bg-muted/20 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">Brouillon préparé</p>
                <p className="mt-1 text-sm text-muted-foreground">{analysis.summary}</p>
              </div>
              <Badge variant="outline">{analysis.confidence}%</Badge>
            </div>

            <div className="mt-4">
              <label className="text-xs font-medium text-muted-foreground">Titre du devis</label>
              <Input
                className="mt-1 bg-white"
                value={editedTitle}
                onChange={(event) => setEditedTitle(event.target.value)}
                placeholder="Titre du devis"
              />
            </div>

            <div className="mt-3 space-y-2">
              {editedLines.map((line, index) => {
                const isFromCatalog = Boolean(line.service_id);
                const saveState = savedLines[index];
                const canSave =
                  !isFromCatalog &&
                  line.description.trim().length > 0 &&
                  line.unit_price > 0;
                return (
                  <div
                    key={index}
                    className={cn(
                      'rounded-xl border bg-card p-3',
                      isFromCatalog ? 'border-[#d35400]/25' : 'border-border',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {isFromCatalog ? (
                            <Badge variant="outline" className="gap-1 border-[#d35400]/40 text-[10px] text-[#a34700]">
                              <Sparkles className="h-2.5 w-2.5" /> De ton catalogue
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1 text-[10px] text-muted-foreground">
                              <Plus className="h-2.5 w-2.5" /> Nouvelle prestation
                            </Badge>
                          )}
                        </div>
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
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {saveState === 'saved' ? (
                          <span
                            title="Enregistrée dans tes prestations"
                            className="flex h-7 w-7 items-center justify-center rounded-md text-emerald-600"
                          >
                            <Check className="h-4 w-4" />
                          </span>
                        ) : canSave ? (
                          <button
                            type="button"
                            onClick={() => { void saveLineAsPrestation(index); }}
                            disabled={saveState === 'saving'}
                            title="Enregistrer dans mes prestations"
                            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-[#d35400] disabled:opacity-50"
                          >
                            {saveState === 'saving' ? (
                              <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : (
                              <BookmarkPlus className="h-4 w-4" />
                            )}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => removeLine(index)}
                          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-destructive"
                          title="Supprimer la ligne"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <Button variant="outline" size="sm" onClick={addEmptyLine} className="mt-2 gap-1">
              <Plus className="h-3.5 w-3.5" /> Ajouter une ligne
            </Button>

            {analysis.assumptions.length > 0 && (
              <div className="mt-4 space-y-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Hypothèses</p>
                {analysis.assumptions.map((item, i) => (
                  <p key={`${i}-${item.slice(0, 12)}`} className="text-xs text-muted-foreground">
                    • {item}
                  </p>
                ))}
              </div>
            )}

            <div className="mt-4 flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
              <div>
                <p className="text-xs text-muted-foreground">Total estimé HT</p>
                <p className="text-xl font-semibold text-foreground">{formatCurrency(totalHt)}</p>
              </div>
              <Button
                onClick={useInQuote}
                disabled={editedLines.length === 0 || saving}
                className="bg-[#d35400] text-white hover:bg-[#b94800]"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Création en cours…
                  </>
                ) : (
                  'Créer le devis'
                )}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>

    {/* ---------- Deep analysis overlay ---------- */}
    <Dialog open={phase === 'analyzing'}>
      <DialogContent
        // [&>button]:hidden removes the built-in X close button — this
        // overlay must stay up until the API call settles.
        className="max-w-md border-[#d35400]/20 bg-gradient-to-b from-[#fff7f0] to-white sm:max-w-md [&>button]:hidden"
        // Force-block closing while the API is working — the user shouldn't
        // be able to dismiss with Escape or outside click either.
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-[#d35400]/10 ring-4 ring-[#d35400]/10">
            <Wand2 className="h-7 w-7 animate-pulse text-[#d35400]" />
          </div>
          <DialogTitle className="text-center text-lg">Analyse approfondie en cours</DialogTitle>
          <DialogDescription className="text-center">
            L&apos;IA croise ta demande, ton catalogue de prestations et ton historique tarifaire pour rédiger le meilleur devis possible.
          </DialogDescription>
        </DialogHeader>
        <ol className="mt-3 space-y-2.5">
          {ANALYSIS_STEPS.map((step, idx) => {
            const isDone = idx < analyzingStep;
            const isCurrent = idx === analyzingStep;
            const Icon = step.icon;
            return (
              <li
                key={step.label}
                className={cn(
                  'flex items-center gap-3 rounded-xl border px-3 py-2 transition-all duration-300',
                  isDone && 'border-[#d35400]/25 bg-white/70 opacity-80',
                  isCurrent && 'border-[#d35400]/40 bg-white shadow-sm',
                  !isDone && !isCurrent && 'border-border bg-white/40 opacity-40',
                )}
              >
                <div
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors',
                    isDone && 'bg-[#d35400] text-white',
                    isCurrent && 'bg-[#d35400]/10 text-[#d35400]',
                    !isDone && !isCurrent && 'bg-muted text-muted-foreground',
                  )}
                >
                  {isDone ? (
                    <Check className="h-4 w-4" />
                  ) : isCurrent ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </div>
                <span
                  className={cn(
                    'text-sm',
                    isCurrent && 'font-medium text-foreground',
                    isDone && 'text-muted-foreground line-through decoration-[#d35400]/40',
                    !isDone && !isCurrent && 'text-muted-foreground',
                  )}
                >
                  {step.label}
                </span>
              </li>
            );
          })}
        </ol>
      </DialogContent>
    </Dialog>
    </>
  );
}
