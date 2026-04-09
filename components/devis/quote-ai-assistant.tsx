'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { Camera, Loader2, Mic, Plus, Sparkles, Trash2, Wand2, X } from 'lucide-react';
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
  onUseDraft: (draft: AiQuoteDraft) => void;
  presetRequest?: {
    id: number;
    mode: 'empty' | 'example';
  } | null;
}

// ---------- Internal types ----------------------------------------------

interface PhotoPreview {
  id: string;
  name: string;
  url: string;
  file: File;
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

type AssistantPhase = 'input' | 'analyzing' | 'clarifying' | 'ready';

// ---------- Constants ---------------------------------------------------

const BAR_COUNT = 30;
const MAX_DURATION_SEC = 120;
// Ignore presses shorter than this — a tap is almost always accidental for
// hold-to-record gestures. The user gets a short "keep holding" hint.
const MIN_HOLD_MS = 350;
// Swipe-left distance (px) needed to cancel an in-progress recording.
const CANCEL_SWIPE_PX = 80;

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

export function QuoteAiAssistant({ onUseDraft, presetRequest = null }: QuoteAiAssistantProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photosRef = useRef<PhotoPreview[]>([]);

  const [clientId, setClientId] = useState<string | null>(null);
  const [clientName, setClientName] = useState('');
  const [transcript, setTranscript] = useState('');
  const [photos, setPhotos] = useState<PhotoPreview[]>([]);
  const [analysis, setAnalysis] = useState<AiAnalysis | null>(null);
  const [editedLines, setEditedLines] = useState<AiQuoteDraftLine[]>([]);
  const [editedTitle, setEditedTitle] = useState('');
  const [analysisError, setAnalysisError] = useState('');
  const [forceManualInput, setForceManualInput] = useState(false);

  const [phase, setPhase] = useState<AssistantPhase>('input');
  const [turns, setTurns] = useState<QuoteTurn[]>([]);
  const [currentQuestions, setCurrentQuestions] = useState<ClarifyQuestion[]>([]);
  const [pendingAnswers, setPendingAnswers] = useState<Record<string, string>>({});

  // Tracks which button triggered the active recording so we can route the
  // returned transcript: 'main' writes to the top transcript; 'answer:<id>'
  // writes into pendingAnswers for that question id.
  const [activeMic, setActiveMic] = useState<string | null>(null);
  const activeMicRef = useRef<string | null>(null);
  useEffect(() => {
    activeMicRef.current = activeMic;
  }, [activeMic]);

  // Hold gesture state — per-press, for the main mic only (answer mics are
  // auto-mode: press to start, release to stop without cancel thresholds).
  const pressStartRef = useRef<number>(0);
  const pressStartXRef = useRef<number>(0);
  const shouldCancelRef = useRef<boolean>(false);
  const [showCancelHint, setShowCancelHint] = useState(false);

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

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  useEffect(() => {
    return () => {
      photosRef.current.forEach((photo) => window.URL.revokeObjectURL(photo.url));
    };
  }, []);

  // Apply presets from the parent (e.g. "empty draft" or "example").
  useEffect(() => {
    if (!presetRequest) return;
    photosRef.current.forEach((photo) => window.URL.revokeObjectURL(photo.url));
    setPhotos([]);
    setAnalysis(null);
    setEditedLines([]);
    setEditedTitle('');
    setAnalysisError('');
    setForceManualInput(false);
    setClientId(null);
    setTurns([]);
    setCurrentQuestions([]);
    setPendingAnswers({});
    setPhase('input');

    if (presetRequest.mode === 'example') {
      setClientName('Mme Petit');
      setTranscript(EXAMPLE_REQUEST);
      return;
    }

    setClientName('');
    setTranscript('');
  }, [presetRequest]);

  // ---------- Photos ----------------------------------------------------

  function triggerPhotoPicker() {
    fileInputRef.current?.click();
  }

  function handlePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;
    const next = files.map((file) => ({
      id: `${file.name}-${file.lastModified}-${Math.random()}`,
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
      if (photo) window.URL.revokeObjectURL(photo.url);
      return current.filter((item) => item.id !== id);
    });
    setAnalysis(null);
    setEditedLines([]);
    setAnalysisError('');
  }

  // ---------- Mic gesture (hold-to-record on main + answer mics) -------

  async function startMic(target: string) {
    if (recorder.phase === 'recording' || recorder.phase === 'uploading') return;
    setAnalysisError('');
    activeMicRef.current = target;
    setActiveMic(target);
    await recorder.start();
  }

  function handleMainPointerDown(e: ReactPointerEvent<HTMLButtonElement>) {
    e.preventDefault();
    pressStartRef.current = performance.now();
    pressStartXRef.current = e.clientX;
    shouldCancelRef.current = false;
    setShowCancelHint(false);
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* noop */ }
    void startMic('main');
  }

  function handleMainPointerMove(e: ReactPointerEvent<HTMLButtonElement>) {
    if (recorder.phase !== 'recording' || activeMicRef.current !== 'main') return;
    const deltaX = e.clientX - pressStartXRef.current;
    const wantCancel = deltaX < -CANCEL_SWIPE_PX;
    if (wantCancel !== shouldCancelRef.current) {
      shouldCancelRef.current = wantCancel;
      setShowCancelHint(wantCancel);
    }
  }

  async function handleMainPointerUp(e: ReactPointerEvent<HTMLButtonElement>) {
    if (activeMicRef.current !== 'main') return;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* noop */ }
    const held = performance.now() - pressStartRef.current;
    const cancel = shouldCancelRef.current || held < MIN_HOLD_MS;
    setShowCancelHint(false);
    if (held < MIN_HOLD_MS) {
      setAnalysisError('Maintiens le micro appuyé pour parler.');
    }
    await recorder.stop({ cancel });
    if (cancel) setActiveMic(null);
  }

  function handleMainPointerCancel() {
    if (activeMicRef.current !== 'main') return;
    setShowCancelHint(false);
    void recorder.stop({ cancel: true });
    setActiveMic(null);
  }

  // ---------- Answer mini-mic handlers ---------------------------------

  function handleAnswerPointerDown(e: ReactPointerEvent<HTMLButtonElement>, qId: string) {
    e.preventDefault();
    pressStartRef.current = performance.now();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* noop */ }
    void startMic(`answer:${qId}`);
  }

  async function handleAnswerPointerUp(e: ReactPointerEvent<HTMLButtonElement>, qId: string) {
    if (activeMicRef.current !== `answer:${qId}`) return;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* noop */ }
    const held = performance.now() - pressStartRef.current;
    const cancel = held < MIN_HOLD_MS;
    if (cancel) setAnalysisError('Maintiens le micro pour répondre.');
    await recorder.stop({ cancel });
    if (cancel) setActiveMic(null);
  }

  function handleAnswerPointerCancel(qId: string) {
    if (activeMicRef.current !== `answer:${qId}`) return;
    void recorder.stop({ cancel: true });
    setActiveMic(null);
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
      photos.forEach((photo) => {
        formData.append('photos', photo.file);
      });

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
      title: editedTitle.trim() || analysis.title || 'Devis à compléter',
      clientName: clientName.trim() || analysis.clientName || '',
      clientId,
      description:
        analysis.description ||
        `Brouillon préparé avec l'assistant IA à partir d'une demande vocale/photo. ${analysis.summary}`,
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
    <Card className="border-border bg-card">
      <CardHeader className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-[#d35400] text-white hover:bg-[#d35400]">Assistant devis IA</Badge>
              <Badge variant="outline">Voix + photos</Badge>
            </div>
            <CardTitle className="mt-3 text-xl">Décris ton chantier à voix haute</CardTitle>
            <CardDescription className="mt-1 max-w-2xl">
              Maintiens le micro pour parler. L&apos;IA te pose des questions si besoin, puis prépare un brouillon de devis basé sur ton catalogue et ton historique.
            </CardDescription>
          </div>
          {isRecordingMain && (
            <div className="flex items-center gap-2 rounded-full bg-[#d35400]/10 px-3 py-1 text-xs font-medium text-[#a34700]">
              <span className="h-2 w-2 animate-pulse rounded-full bg-[#d35400]" />
              Enregistrement {elapsedLabel}
            </div>
          )}
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
            Sélectionne un client pour que l&apos;IA tienne compte de son historique tarifaire.
          </p>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {/* ---------- Mic + photos + manual input ---------- */}
        <div className="rounded-2xl border border-[#d35400]/20 bg-gradient-to-b from-[#fff7f0] to-white p-5">
          <div className="flex flex-col items-center gap-3">
            {recorderUnsupported ? (
              <div className="w-full rounded-xl border border-dashed border-border bg-white p-4 text-sm text-muted-foreground">
                Ton navigateur ne supporte pas l&apos;enregistrement audio. Saisis ta demande dans la zone de texte ci-dessous.
              </div>
            ) : (
              <>
                <div className="relative">
                  <button
                    type="button"
                    onPointerDown={handleMainPointerDown}
                    onPointerMove={handleMainPointerMove}
                    onPointerUp={handleMainPointerUp}
                    onPointerLeave={handleMainPointerUp}
                    onPointerCancel={handleMainPointerCancel}
                    onContextMenu={(e) => e.preventDefault()}
                    disabled={isUploading || isAnalysing}
                    aria-label={isRecordingMain ? 'Relâche pour envoyer' : 'Maintiens pour parler'}
                    aria-pressed={isRecordingMain}
                    className={cn(
                      'relative flex h-20 w-20 touch-none select-none items-center justify-center rounded-full shadow-lg transition-all duration-150',
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
                  {isRecordingMain && showCancelHint && (
                    <div className="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-full bg-destructive px-3 py-1 text-xs font-semibold text-white shadow-md">
                      ← Relâche pour annuler
                    </div>
                  )}
                </div>

                <p className="text-center text-sm font-medium text-[#a34700]">
                  {isRecordingMain
                    ? showCancelHint
                      ? 'Relâche ici pour annuler'
                      : 'Parle maintenant, relâche quand tu as fini'
                    : isUploading
                      ? 'Transcription en cours…'
                      : 'Maintiens pour parler'}
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
                    Glisse vers la gauche pour annuler · {elapsedLabel} / {Math.floor(MAX_DURATION_SEC / 60)}:{String(MAX_DURATION_SEC % 60).padStart(2, '0')}
                  </p>
                )}
              </>
            )}

            <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={triggerPhotoPicker}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-[#d35400]/40 hover:text-[#a34700]"
              >
                <Camera className="h-3.5 w-3.5" />
                Photos {photos.length > 0 ? `(${photos.length}/4)` : '(optionnel)'}
              </button>
              {!recorderUnsupported && (
                <button
                  type="button"
                  onClick={() => {
                    setForceManualInput(true);
                    setAnalysisError('');
                  }}
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-[#d35400]/40 hover:text-[#a34700]"
                >
                  Saisir à la main
                </button>
              )}
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
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.url} alt={photo.name} className="h-20 w-24 object-cover" />
                <button
                  type="button"
                  onClick={() => removePhoto(photo.id)}
                  className="absolute right-1 top-1 rounded-full bg-black/65 p-1 text-white"
                  aria-label={`Retirer ${photo.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ---------- Transcript editor ---------- */}
        {(hasTranscript || forceManualInput || recorderUnsupported) && (
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
              disabled={!hasTranscript || isAnalysing || isRecordingMain || isUploading}
              className="mt-3 w-full gap-2 bg-[#d35400] text-white hover:bg-[#b94800]"
            >
              <Wand2 className={cn('h-4 w-4', isAnalysing && 'animate-spin')} />
              {isAnalysing ? 'Analyse en cours…' : 'Lancer la magie'}
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
                          onPointerDown={(e) => handleAnswerPointerDown(e, q.id)}
                          onPointerUp={(e) => handleAnswerPointerUp(e, q.id)}
                          onPointerLeave={(e) => handleAnswerPointerUp(e, q.id)}
                          onPointerCancel={() => handleAnswerPointerCancel(q.id)}
                          onContextMenu={(e) => e.preventDefault()}
                          disabled={
                            (recorder.phase !== 'idle' && !isAnswerMicActive) || isAnalysing
                          }
                          aria-label={isAnswerMicActive ? 'Relâche pour envoyer' : 'Maintiens pour répondre'}
                          aria-pressed={isAnswerMicActive}
                          className={cn(
                            'flex h-10 w-10 shrink-0 touch-none select-none items-center justify-center rounded-full shadow-sm transition-all duration-150',
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
                disabled={editedLines.length === 0}
                className="bg-[#d35400] text-white hover:bg-[#b94800]"
              >
                Pré-remplir le devis
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
