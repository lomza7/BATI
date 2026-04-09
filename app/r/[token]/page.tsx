'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import {
  Hexagon,
  Loader as Loader2,
  TriangleAlert as AlertTriangle,
  Lock,
  Upload,
  Sparkles,
  ArrowRight,
  Camera,
  Heart,
  Download,
  Phone,
  RotateCcw,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const STYLES = [
  { id: 'moderne', name: 'Moderne', desc: 'Lignes épurées, matériaux contemporains' },
  { id: 'classique', name: 'Classique', desc: 'Élégance traditionnelle, moulures' },
  { id: 'industriel', name: 'Industriel', desc: 'Métal, brique, brut' },
  { id: 'scandinave', name: 'Scandinave', desc: 'Bois clair, minimaliste' },
  { id: 'mediterraneen', name: 'Méditerranéen', desc: 'Pierre, terre cuite, chaleur' },
  { id: 'zen', name: 'Zen / Japandi', desc: 'Équilibre, nature, sérénité' },
];

const ROOM_TYPES = ['Salon', 'Cuisine', 'Salle de bain', 'Chambre', 'Terrasse', 'Bureau', 'Entrée'];

interface Branding {
  artisan_name: string;
  logo_url: string;
  phone: string;
  city: string;
  accent_color: string;
}

interface CampaignInfo {
  id: string;
  project_type: string;
  prefilled_client_name: string;
  prefilled_client_email: string;
}

interface Generation {
  id: string;
  room_type: string;
  style: string;
  before_url: string;
  after_url: string;
  is_favorite: boolean;
  created_at: string;
}

type Phase = 'loading' | 'error' | 'capture' | 'wizard';

export default function PublicRenduPage() {
  const params = useParams();
  const token = params.token as string;

  const [phase, setPhase] = useState<Phase>('loading');
  const [error, setError] = useState('');

  const [campaign, setCampaign] = useState<CampaignInfo | null>(null);
  const [branding, setBranding] = useState<Branding | null>(null);

  // Lead capture
  const [leadName, setLeadName] = useState('');
  const [leadEmail, setLeadEmail] = useState('');
  const [submittingLead, setSubmittingLead] = useState(false);

  // Session state (after capture)
  const [sessionToken, setSessionToken] = useState('');
  const [generations, setGenerations] = useState<Generation[]>([]);

  // Wizard state
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [roomType, setRoomType] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('');
  const [imageBase64, setImageBase64] = useState('');
  const [imageMime, setImageMime] = useState('image/jpeg');
  const [imagePreview, setImagePreview] = useState('');
  const [generating, setGenerating] = useState(false);
  const [latestGeneration, setLatestGeneration] = useState<Generation | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const accent = branding?.accent_color || '#d35400';

  const fetchCampaign = useCallback(async () => {
    try {
      const res = await fetch(`/api/rendus/public/${encodeURIComponent(token)}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Lien invalide');
        setPhase('error');
        return;
      }
      setCampaign(data.campaign);
      setBranding(data.branding);
      setLeadName(data.campaign.prefilled_client_name || '');
      setLeadEmail(data.campaign.prefilled_client_email || '');

      // Restore session from localStorage if it matches this token
      try {
        const stored = localStorage.getItem(`rendu_session_${token}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.session_token) {
            setSessionToken(parsed.session_token);
            setPhase('wizard');
            return;
          }
        }
      } catch {
        // ignore
      }

      setPhase('capture');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur réseau');
      setPhase('error');
    }
  }, [token]);

  useEffect(() => {
    fetchCampaign();
  }, [fetchCampaign]);

  // Load gallery when sessionToken becomes available
  useEffect(() => {
    if (!sessionToken) return;
    fetch(`/api/rendus/public/${encodeURIComponent(token)}/generate?session_token=${encodeURIComponent(sessionToken)}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.generations)) setGenerations(data.generations);
      })
      .catch(() => null);
  }, [sessionToken, token]);

  async function handleSubmitLead(e: React.FormEvent) {
    e.preventDefault();
    if (!leadEmail.includes('@')) return;
    setSubmittingLead(true);
    try {
      const res = await fetch(`/api/rendus/public/${encodeURIComponent(token)}/lead`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_name: leadName, lead_email: leadEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Erreur');
        setSubmittingLead(false);
        return;
      }
      setSessionToken(data.session_token);
      try {
        localStorage.setItem(
          `rendu_session_${token}`,
          JSON.stringify({ session_token: data.session_token }),
        );
      } catch {
        // ignore
      }
      setPhase('wizard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur réseau');
    } finally {
      setSubmittingLead(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert('Photo trop volumineuse (max 10 Mo).');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const [meta, b64] = result.split(',');
      setImagePreview(result);
      setImageBase64(b64);
      const mimeMatch = meta.match(/data:(.*?);/);
      setImageMime(mimeMatch?.[1] || 'image/jpeg');
    };
    reader.readAsDataURL(file);
  }

  async function handleGenerate() {
    if (!imageBase64 || !selectedStyle || !roomType) return;
    setStep(3);
    setGenerating(true);
    try {
      const res = await fetch(`/api/rendus/public/${encodeURIComponent(token)}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_token: sessionToken,
          room_type: roomType,
          style: selectedStyle,
          image_base64: imageBase64,
          image_mime: imageMime,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Erreur génération');
        setStep(2);
        return;
      }
      setLatestGeneration(data.generation);
      setGenerations((prev) => [data.generation, ...prev]);
      setStep(4);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erreur réseau');
      setStep(2);
    } finally {
      setGenerating(false);
    }
  }

  async function toggleFavorite(generationId: string, current: boolean) {
    const next = !current;
    setGenerations((prev) =>
      prev.map((g) => (g.id === generationId ? { ...g, is_favorite: next } : g)),
    );
    if (latestGeneration?.id === generationId) {
      setLatestGeneration({ ...latestGeneration, is_favorite: next });
    }
    await fetch(`/api/rendus/public/${encodeURIComponent(token)}/favorite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_token: sessionToken,
        generation_id: generationId,
        is_favorite: next,
      }),
    });
  }

  function resetWizard() {
    setStep(1);
    setRoomType('');
    setSelectedStyle('');
    setImageBase64('');
    setImagePreview('');
    setLatestGeneration(null);
  }

  if (phase === 'loading') {
    return (
      <div className="min-h-screen bg-[#faf9f7] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: accent }} />
          <p className="text-sm text-[#6b6560]">Chargement...</p>
        </div>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="min-h-screen bg-[#faf9f7] flex items-center justify-center px-6">
        <div className="max-w-md w-full text-center">
          <div className="h-16 w-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="h-8 w-8 text-red-500" />
          </div>
          <h1 className="text-xl font-semibold text-[#1a1a1a]">Lien invalide</h1>
          <p className="text-sm text-[#6b6560] mt-2">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      {/* Header — white-label */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-[#e5e1da]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {branding?.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={branding.logo_url}
                alt={branding.artisan_name}
                className="h-9 w-9 rounded-lg object-cover"
              />
            ) : (
              <div
                className="h-9 w-9 rounded-lg flex items-center justify-center text-white font-bold"
                style={{ backgroundColor: accent }}
              >
                {branding?.artisan_name?.charAt(0).toUpperCase() || 'H'}
              </div>
            )}
            <div className="min-w-0">
              <div className="text-sm font-semibold text-[#1a1a1a] truncate">
                {branding?.artisan_name}
              </div>
              {branding?.city && (
                <div className="text-[11px] text-[#6b6560] truncate">{branding.city}</div>
              )}
            </div>
          </div>
          {branding?.phone && (
            <a
              href={`tel:${branding.phone}`}
              className="hidden sm:flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full"
              style={{ backgroundColor: `${accent}15`, color: accent }}
            >
              <Phone className="w-3 h-3" />
              {branding.phone}
            </a>
          )}
        </div>
      </header>

      {phase === 'capture' && (
        <div className="max-w-md mx-auto px-4 sm:px-6 py-12">
          <div className="text-center mb-8">
            <div
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-4"
              style={{ backgroundColor: `${accent}15`, color: accent }}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Outil exclusif {branding?.artisan_name}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#1a1a1a] leading-tight">
              Visualisez vos travaux
              <br />
              <span style={{ color: accent }}>avant même de signer</span>
            </h1>
            <p className="text-sm text-[#6b6560] mt-3 leading-relaxed">
              Envoyez une photo de votre pièce ou façade. Notre IA vous montre en quelques secondes
              à quoi ressemblera votre projet après rénovation, dans le style de votre choix.
            </p>
          </div>

          <form
            onSubmit={handleSubmitLead}
            className="rounded-2xl border border-[#e5e1da] bg-white p-6 shadow-sm"
          >
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#1a1a1a] mb-4">
              <Lock className="w-3.5 h-3.5" style={{ color: accent }} />
              Pour démarrer, dites-nous qui vous êtes
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-medium text-[#6b6560] uppercase tracking-wider">
                  Votre prénom et nom
                </label>
                <input
                  type="text"
                  value={leadName}
                  onChange={(e) => setLeadName(e.target.value)}
                  placeholder="Mme Petit"
                  className="mt-1 w-full rounded-lg border border-[#e5e1da] px-3 py-2.5 text-sm outline-none focus:ring-2"
                  style={{ '--tw-ring-color': `${accent}30` } as React.CSSProperties}
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-[#6b6560] uppercase tracking-wider">
                  Votre adresse email *
                </label>
                <input
                  type="email"
                  required
                  value={leadEmail}
                  onChange={(e) => setLeadEmail(e.target.value)}
                  placeholder="petit@email.com"
                  className="mt-1 w-full rounded-lg border border-[#e5e1da] px-3 py-2.5 text-sm outline-none focus:ring-2"
                  style={{ '--tw-ring-color': `${accent}30` } as React.CSSProperties}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submittingLead || !leadEmail.includes('@')}
              className="mt-5 w-full rounded-xl py-3 text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50 transition-opacity"
              style={{ backgroundColor: accent }}
            >
              {submittingLead ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  Commencer mes avant/après
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <p className="text-[10px] text-[#9a9590] text-center mt-3 leading-relaxed">
              Vos avant/après vous seront envoyés par email · Aucune carte requise
            </p>
          </form>
        </div>
      )}

      {phase === 'wizard' && (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
          {/* Progress */}
          <div className="flex items-center justify-center gap-1 sm:gap-2 mb-8">
            {[
              { n: 1, label: 'Photo' },
              { n: 2, label: 'Style' },
              { n: 3, label: 'Génération' },
              { n: 4, label: 'Résultat' },
            ].map((s, i, arr) => (
              <div key={s.n} className="flex items-center">
                <div
                  className={cn(
                    'flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-all',
                    step === s.n
                      ? 'text-white shadow-md'
                      : step > s.n
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-[#f3f1ed] text-[#6b6560]',
                  )}
                  style={step === s.n ? { backgroundColor: accent } : {}}
                >
                  <span className="font-semibold">{s.n}</span>
                  <span className="hidden sm:inline">{s.label}</span>
                </div>
                {i < arr.length - 1 && <ArrowRight className="h-3.5 w-3.5 mx-1 text-[#6b6560]" />}
              </div>
            ))}
          </div>

          {/* Step 1 — Photo + room type */}
          {step === 1 && (
            <div className="space-y-5">
              <div className="rounded-2xl border-2 border-dashed border-[#e5e1da] bg-white p-8 text-center">
                {imagePreview ? (
                  <div className="space-y-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imagePreview}
                      alt="Aperçu"
                      className="max-h-64 mx-auto rounded-xl object-contain"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs font-medium underline"
                      style={{ color: accent }}
                    >
                      Changer la photo
                    </button>
                  </div>
                ) : (
                  <>
                    <div
                      className="h-16 w-16 rounded-full flex items-center justify-center mx-auto"
                      style={{ backgroundColor: `${accent}15` }}
                    >
                      <Upload className="h-7 w-7" style={{ color: accent }} />
                    </div>
                    <h3 className="mt-4 text-base font-semibold text-[#1a1a1a]">
                      Déposez votre photo
                    </h3>
                    <p className="mt-1 text-xs text-[#6b6560]">PNG, JPG jusqu&apos;à 10 Mo</p>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium"
                      style={{ backgroundColor: accent }}
                    >
                      <Camera className="h-4 w-4" />
                      Choisir une photo
                    </button>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#1a1a1a] uppercase tracking-wider">
                  Type de pièce
                </label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {ROOM_TYPES.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRoomType(r)}
                      className={cn(
                        'rounded-full border px-3 py-1.5 text-sm transition-all',
                        roomType === r
                          ? 'text-white border-transparent font-medium'
                          : 'border-[#e5e1da] text-[#6b6560] hover:border-[#d35400]/40 bg-white',
                      )}
                      style={roomType === r ? { backgroundColor: accent } : {}}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                disabled={!imageBase64 || !roomType}
                onClick={() => setStep(2)}
                className="w-full rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ backgroundColor: accent }}
              >
                Choisir le style
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Step 2 — Style picker */}
          {step === 2 && (
            <div className="space-y-5">
              <h2 className="text-base font-semibold text-[#1a1a1a] text-center">
                Choisissez un style
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {STYLES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedStyle(s.id)}
                    className={cn(
                      'rounded-xl border-2 p-4 text-left transition-all bg-white',
                      selectedStyle === s.id
                        ? 'shadow-md'
                        : 'border-[#e5e1da] hover:border-[#d35400]/40',
                    )}
                    style={
                      selectedStyle === s.id
                        ? { borderColor: accent, backgroundColor: `${accent}08` }
                        : {}
                    }
                  >
                    <h3 className="text-sm font-semibold text-[#1a1a1a]">{s.name}</h3>
                    <p className="mt-1 text-[11px] text-[#6b6560] leading-relaxed">{s.desc}</p>
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="rounded-xl border border-[#e5e1da] px-4 py-3 text-sm text-[#6b6560] hover:bg-white"
                >
                  Retour
                </button>
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={!selectedStyle}
                  className="flex-1 rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ backgroundColor: accent }}
                >
                  <Sparkles className="w-4 h-4" />
                  Générer mon avant/après
                </button>
              </div>
            </div>
          )}

          {/* Step 3 — Generating */}
          {step === 3 && generating && (
            <div className="rounded-2xl border border-[#e5e1da] bg-white p-12 text-center">
              <div className="relative mx-auto w-20 h-20">
                <div
                  className="absolute inset-0 rounded-full border-4 animate-spin"
                  style={{ borderColor: '#f3f1ed', borderTopColor: accent }}
                />
                <Sparkles className="absolute inset-0 m-auto h-8 w-8" style={{ color: accent }} />
              </div>
              <h3 className="mt-6 font-semibold text-[#1a1a1a]">Génération en cours...</h3>
              <p className="mt-2 text-sm text-[#6b6560]">
                L&apos;IA transforme votre photo. Cela peut prendre 30 à 60 secondes.
              </p>
            </div>
          )}

          {/* Step 4 — Result */}
          {step === 4 && latestGeneration && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-xl border border-[#e5e1da] bg-white overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={latestGeneration.before_url}
                    alt="Avant"
                    className="w-full aspect-square object-cover"
                  />
                  <div className="p-3 text-center text-xs font-medium text-[#6b6560]">Avant</div>
                </div>
                <div
                  className="rounded-xl border-2 bg-white overflow-hidden"
                  style={{ borderColor: accent }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={latestGeneration.after_url}
                    alt="Après"
                    className="w-full aspect-square object-cover"
                  />
                  <div
                    className="p-3 text-center text-xs font-semibold"
                    style={{ color: accent }}
                  >
                    Après — style {latestGeneration.style}
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                <button
                  type="button"
                  onClick={() => toggleFavorite(latestGeneration.id, latestGeneration.is_favorite)}
                  className={cn(
                    'rounded-xl px-4 py-2.5 text-sm font-medium border-2 flex items-center justify-center gap-2 transition-all',
                    latestGeneration.is_favorite
                      ? 'text-white border-transparent'
                      : 'bg-white border-[#e5e1da] text-[#1a1a1a]',
                  )}
                  style={
                    latestGeneration.is_favorite ? { backgroundColor: accent } : {}
                  }
                >
                  <Heart
                    className="w-4 h-4"
                    fill={latestGeneration.is_favorite ? 'currentColor' : 'none'}
                  />
                  {latestGeneration.is_favorite ? 'Marqué favori' : 'Marquer favori'}
                </button>
                <a
                  href={latestGeneration.after_url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl px-4 py-2.5 text-sm font-medium border-2 border-[#e5e1da] bg-white text-[#1a1a1a] flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Télécharger
                </a>
                <button
                  type="button"
                  onClick={resetWizard}
                  className="rounded-xl px-4 py-2.5 text-sm font-medium text-white flex items-center justify-center gap-2"
                  style={{ backgroundColor: accent }}
                >
                  <RotateCcw className="w-4 h-4" />
                  Nouvel avant/après
                </button>
              </div>
            </div>
          )}

          {/* Gallery of previous generations */}
          {step !== 3 && generations.length > 0 && (
            <div className="mt-12 pt-8 border-t border-[#e5e1da]">
              <h3 className="text-sm font-semibold text-[#1a1a1a] mb-4">
                Vos avant/après ({generations.length})
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {generations.map((g) => (
                  <div
                    key={g.id}
                    className="rounded-xl border border-[#e5e1da] bg-white overflow-hidden group relative"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={g.after_url}
                      alt={g.style}
                      className="w-full aspect-square object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => toggleFavorite(g.id, g.is_favorite)}
                      className="absolute top-2 right-2 h-8 w-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-sm hover:scale-110 transition-transform"
                    >
                      <Heart
                        className={cn('w-4 h-4', g.is_favorite ? 'text-rose-500' : 'text-[#6b6560]')}
                        fill={g.is_favorite ? 'currentColor' : 'none'}
                      />
                    </button>
                    <div className="p-2 text-[11px] text-[#6b6560] truncate">
                      {g.room_type} · {g.style}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <footer className="border-t border-[#e5e1da] py-6 mt-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="h-6 w-6 rounded flex items-center justify-center"
              style={{ backgroundColor: accent }}
            >
              <Hexagon className="h-3 w-3 text-white" />
            </div>
            <span className="text-xs font-medium text-[#6b6560]">
              Propulsé par Hellobat
            </span>
          </div>
          <p className="text-[10px] text-[#6b6560]/60">
            Outil exclusif {branding?.artisan_name}
          </p>
        </div>
      </footer>
    </div>
  );
}
