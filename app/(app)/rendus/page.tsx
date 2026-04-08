'use client';

import { useState } from 'react';
import {
  Paintbrush,
  Upload,
  Sparkles,
  ArrowRight,
  Check,
  Eye,
  Download,
  Image as ImageIcon,
  Camera,
  Send,
  Link2,
  Mail,
  Users,
  Lock,
  TrendingUp,
  Copy,
  Wand2,
  Hexagon,
  ArrowLeft,
  Activity,
  Target,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useAuth } from '@/lib/auth-context';
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

type Mode = 'hub' | 'self';

export default function RendusPage() {
  const { profile } = useAuth();
  const companyName = profile?.company_name || 'Votre entreprise';

  const [mode, setMode] = useState<Mode>('hub');
  const [showCampaignDialog, setShowCampaignDialog] = useState(false);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rendus IA"
        description="Le lead magnet qui transforme vos prospects en clients signés"
      >
        {mode === 'self' && (
          <Button variant="outline" onClick={() => setMode('hub')} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Retour
          </Button>
        )}
      </PageHeader>

      {mode === 'hub' && (
        <HubView
          companyName={companyName}
          onStartSelf={() => setMode('self')}
          onCreateCampaign={() => setShowCampaignDialog(true)}
        />
      )}

      {mode === 'self' && <SelfRenderingWizard />}

      <CampaignDialog
        open={showCampaignDialog}
        onOpenChange={setShowCampaignDialog}
        companyName={companyName}
      />
    </div>
  );
}

/* ─────────────── HUB VIEW (lead magnet pitch + actions) ─────────────── */

function HubView({
  companyName,
  onStartSelf,
  onCreateCampaign,
}: {
  companyName: string;
  onStartSelf: () => void;
  onCreateCampaign: () => void;
}) {
  return (
    <div className="space-y-6">
      {/* Hero — value proposition */}
      <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/5 via-primary/[0.02] to-transparent p-5 sm:p-8 overflow-hidden relative">
        <div className="absolute top-4 right-4 hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-[11px] font-semibold">
          <Sparkles className="h-3 w-3" />
          Nouveau lead magnet
        </div>
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] items-center">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
              <Wand2 className="h-3.5 w-3.5" /> Rendus IA personnalisés à votre marque
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground leading-tight">
              Vos prospects projettent leurs travaux,
              <br />
              <span className="text-primary">vous récupérez leurs coordonnées.</span>
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
              Envoyez un lien <strong className="text-foreground">personnalisé à votre nom et logo</strong> à
              vos prospects. Ils uploadent une photo de leur pièce, génèrent plusieurs styles de rendus IA, marquent
              leurs préférés — et vous voyez tout. Ils doivent laisser leur nom et email pour recevoir le résultat
              par mail : <strong className="text-foreground">vous capturez un lead qualifié à chaque essai.</strong>
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
              {[
                { icon: Lock, label: 'Email obligatoire', sub: 'Lead capturé' },
                { icon: Wand2, label: 'White-label', sub: 'À votre marque' },
                { icon: Activity, label: 'Tracking', sub: 'Vous voyez tout' },
                { icon: Mail, label: 'Email auto', sub: 'Résultat livré' },
              ].map((b) => (
                <div key={b.label} className="flex items-center gap-2 p-2 rounded-lg border border-border bg-card">
                  <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                    <b.icon className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] font-semibold text-foreground truncate">{b.label}</div>
                    <div className="text-[9px] text-muted-foreground truncate">{b.sub}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* White-label preview mockup */}
          <WhiteLabelPreview companyName={companyName} />
        </div>
      </div>

      {/* Two main actions */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Send to client */}
        <button
          onClick={onCreateCampaign}
          className="group text-left rounded-2xl border-2 border-primary bg-card p-5 sm:p-6 hover:shadow-lg hover:shadow-primary/10 transition-all"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary text-white flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Send className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-base sm:text-lg font-bold text-foreground">Envoyer à un client</h3>
                <span className="text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                  Lead magnet
                </span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Créez un lien personnalisé <strong className="text-foreground">{companyName}</strong> à envoyer
                à un prospect. Il génère ses rendus, vous récupérez son email, vous voyez ses choix, vous
                relancez avec un devis.
              </p>
              <div className="mt-3 flex items-center gap-1.5 text-xs text-primary font-medium">
                Créer une campagne <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
        </button>

        {/* Use yourself */}
        <button
          onClick={onStartSelf}
          className="group text-left rounded-2xl border border-border bg-card p-5 sm:p-6 hover:border-primary/50 hover:shadow-md transition-all"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-muted text-foreground flex items-center justify-center shrink-0 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
              <Paintbrush className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base sm:text-lg font-bold text-foreground mb-1">L'utiliser moi-même</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Générez des rendus pour vos propres présentations commerciales. Idéal pour préparer un
                rendez-vous client ou enrichir un devis avec un visuel projeté.
              </p>
              <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground font-medium group-hover:text-primary">
                Lancer un rendu <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: Send, label: 'Campagnes envoyées', value: '0', sub: 'Aucune pour le moment' },
          { icon: Users, label: 'Leads capturés', value: '0', sub: 'Email + nom' },
          { icon: Eye, label: 'Rendus générés', value: '0', sub: 'Par vos prospects' },
          { icon: TrendingUp, label: 'Taux de conversion', value: '—', sub: 'Lead → devis' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
              <s.icon className="w-3.5 h-3.5" /> {s.label}
            </div>
            <div className="text-2xl font-bold text-foreground mt-1">{s.value}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* How it works */}
      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <Target className="w-4 h-4 text-primary" />
          <h3 className="text-base font-semibold text-foreground">Comment ça marche</h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          {[
            {
              n: 1,
              title: 'Vous créez le lien',
              desc: 'Personnalisé à votre nom, logo et couleurs. Un lien unique par prospect ou un lien partageable.',
            },
            {
              n: 2,
              title: 'Le client donne son email',
              desc: 'Avant d\'utiliser l\'outil, il doit laisser nom + email pour recevoir les résultats.',
            },
            {
              n: 3,
              title: 'Il génère ses rendus',
              desc: 'Photo de sa pièce + style choisi. Il peut tester plusieurs combinaisons et marquer ses favoris.',
            },
            {
              n: 4,
              title: 'Vous voyez tout, vous relancez',
              desc: 'Email, photos, styles préférés, durée de session — tout est dans votre dashboard. Devis sur mesure prêt.',
            },
          ].map((step) => (
            <div key={step.n} className="rounded-xl bg-muted/40 p-4">
              <div className="w-7 h-7 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center mb-2">
                {step.n}
              </div>
              <h4 className="text-sm font-semibold text-foreground mb-1">{step.title}</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Empty state for campaigns */}
      <div className="rounded-2xl border-2 border-dashed border-border bg-card/50 p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-muted mx-auto flex items-center justify-center">
          <Send className="w-5 h-5 text-muted-foreground" />
        </div>
        <h3 className="mt-3 text-sm font-semibold text-foreground">Aucune campagne envoyée pour l'instant</h3>
        <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
          Créez votre premier lien personnalisé à envoyer à un prospect. C'est gratuit et ça démarre votre
          machine à leads.
        </p>
        <Button onClick={onCreateCampaign} className="mt-4 gap-2">
          <Send className="w-3.5 h-3.5" /> Créer ma première campagne
        </Button>
      </div>
    </div>
  );
}

/* ─────────────── WHITE-LABEL PREVIEW MOCKUP ─────────────── */

function WhiteLabelPreview({ companyName }: { companyName: string }) {
  const initial = companyName.charAt(0).toUpperCase() || 'H';
  return (
    <div className="rounded-xl border border-border bg-white shadow-2xl shadow-black/5 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/40">
        <div className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
        </div>
        <span className="text-[10px] text-muted-foreground ml-2 font-mono truncate">
          hellobat.app/r/x7k9p
        </span>
      </div>
      <div className="p-4 space-y-3">
        {/* Brand header */}
        <div className="flex items-center gap-2 pb-3 border-b border-border">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white font-bold text-sm">
            {initial}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-foreground truncate">{companyName}</div>
            <div className="text-[9px] text-muted-foreground">Visualisez vos travaux avant de signer</div>
          </div>
        </div>

        {/* Lead capture form */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-foreground">
            <Lock className="w-3 h-3 text-primary" />
            Pour démarrer, dites-nous qui vous êtes
          </div>
          <div className="space-y-1.5">
            <div className="rounded-md border border-border px-2 py-1.5 text-[10px] text-muted-foreground bg-muted/30">
              Votre prénom et nom
            </div>
            <div className="rounded-md border border-border px-2 py-1.5 text-[10px] text-muted-foreground bg-muted/30">
              Votre adresse email
            </div>
            <div className="rounded-md bg-primary text-white text-center text-[10px] font-semibold py-1.5">
              Commencer mes rendus
            </div>
          </div>
          <p className="text-[8px] text-muted-foreground">
            Vos rendus vous seront envoyés par email · Aucune carte requise
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─────────────── CAMPAIGN DIALOG (create personalized link) ─────────────── */

function CampaignDialog({
  open,
  onOpenChange,
  companyName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyName: string;
}) {
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [projectType, setProjectType] = useState('');
  const [copied, setCopied] = useState(false);

  // Mock generated link — in V2 this will be a real session token from DB
  const fakeToken = 'x7k9p3m';
  const link = `https://hellobat.app/r/${fakeToken}`;

  function handleCopy() {
    navigator.clipboard.writeText(link).catch(() => null);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleReset() {
    setClientName('');
    setClientEmail('');
    setProjectType('');
    setCopied(false);
  }

  function handleClose(next: boolean) {
    if (!next) handleReset();
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="w-4 h-4 text-primary" />
            Créer une campagne Rendus IA
          </DialogTitle>
          <DialogDescription>
            Générez un lien personnalisé <strong>{companyName}</strong> à envoyer à votre prospect. Il devra
            laisser son email pour accéder à l'outil — vous capturez le lead automatiquement.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Client info (optional pre-fill for tracking) */}
          <div className="space-y-3">
            <div className="text-xs font-semibold text-foreground uppercase tracking-wider">
              Pré-remplir (optionnel)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="client-name" className="text-xs">Nom du prospect</Label>
                <Input
                  id="client-name"
                  placeholder="Mme Petit"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="client-email" className="text-xs">Email du prospect</Label>
                <Input
                  id="client-email"
                  type="email"
                  placeholder="petit@email.com"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="project-type" className="text-xs">Type de projet (optionnel)</Label>
              <Input
                id="project-type"
                placeholder="Ex : Rénovation salle de bain"
                value={projectType}
                onChange={(e) => setProjectType(e.target.value)}
                className="mt-1"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Si vous laissez vide, le prospect renseignera lui-même ces infos avant d'utiliser l'outil
              (capture lead).
            </p>
          </div>

          {/* Link preview */}
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-primary mb-2">
              <Link2 className="w-3.5 h-3.5" />
              Votre lien personnalisé {companyName}
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-white border border-border p-2">
              <Hexagon className="w-3.5 h-3.5 text-primary shrink-0" />
              <code className="text-xs font-mono text-foreground flex-1 truncate">{link}</code>
              <Button size="sm" variant="ghost" onClick={handleCopy} className="gap-1.5 h-7">
                {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                {copied ? 'Copié' : 'Copier'}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              Aperçu : page white-label à votre nom, formulaire email obligatoire, multiples rendus possibles,
              tracking activité.
            </p>
          </div>

          {/* Delivery options */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-foreground uppercase tracking-wider">
              Comment l'envoyer ?
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                disabled={!clientEmail}
                className={cn(
                  'rounded-xl border-2 p-3 text-left transition-all',
                  clientEmail
                    ? 'border-primary bg-primary/5 hover:shadow-md cursor-pointer'
                    : 'border-border bg-muted/30 cursor-not-allowed opacity-60'
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Mail className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold text-foreground">Envoyer par email</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Hellobat envoie un email pré-rempli au prospect avec le lien et un message personnalisé.
                </p>
                {!clientEmail && (
                  <p className="text-[10px] text-amber-700 mt-1.5">⚠ Email du prospect requis</p>
                )}
              </button>

              <button type="button" onClick={handleCopy} className="rounded-xl border-2 border-border bg-card p-3 text-left hover:border-primary/50 transition-all">
                <div className="flex items-center gap-2 mb-1">
                  <Copy className="w-4 h-4 text-foreground" />
                  <span className="text-sm font-semibold text-foreground">Copier le lien</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Vous l'envoyez vous-même par WhatsApp, SMS, etc. Le tracking fonctionne quand même.
                </p>
              </button>
            </div>
          </div>

          {/* Footer actions */}
          <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-border">
            <Button variant="outline" onClick={() => handleClose(false)} className="sm:flex-1">
              Annuler
            </Button>
            <Button disabled={!clientEmail} className="sm:flex-1 gap-2">
              <Send className="w-3.5 h-3.5" />
              Créer et envoyer
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground text-center">
            En V1, l'envoi par email arrive bientôt. Pour l'instant, copiez le lien et partagez-le manuellement —
            le tracking fonctionne dès que le prospect ouvre le lien.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─────────────── SELF-USE WIZARD (artisan personal use) ─────────────── */

function SelfRenderingWizard() {
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

  const STEPS = [
    { id: 1, label: 'Photo', icon: Camera },
    { id: 2, label: 'Style', icon: Paintbrush },
    { id: 3, label: 'Génération', icon: Sparkles },
    { id: 4, label: 'Résultat', icon: Eye },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-center gap-1 sm:gap-2">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center">
            <div
              className={cn(
                'flex items-center gap-2 rounded-full px-2 py-1.5 sm:px-4 sm:py-2 text-sm font-medium transition-all',
                step === s.id
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : step > s.id
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-muted text-muted-foreground'
              )}
            >
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
            <h3 className="mt-4 font-semibold text-foreground">Déposez votre photo</h3>
            <p className="mt-1 text-sm text-muted-foreground">PNG, JPG jusqu&apos;à 10 MB</p>
            <Button className="mt-4 gap-2">
              <Camera className="h-4 w-4" /> Choisir une photo
            </Button>
          </div>
          <div className="mt-6">
            <label className="text-sm font-medium text-foreground">Type de pièce</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {ROOM_TYPES.map((r) => (
                <button
                  key={r}
                  onClick={() => setRoomType(r)}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-sm transition-all',
                    roomType === r
                      ? 'border-primary bg-primary/10 text-primary font-medium'
                      : 'border-border text-muted-foreground hover:border-border/80'
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
            {STYLES.map((s) => (
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
            <Button variant="outline" onClick={() => setStep(1)}>
              Retour
            </Button>
            <Button className="flex-1" onClick={handleGenerate} disabled={!selectedStyle}>
              <Sparkles className="mr-2 h-4 w-4" /> Générer le rendu
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
          <h3 className="mt-6 font-semibold text-foreground">Génération en cours...</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            L&apos;IA transforme votre photo en rendu {selectedStyle}
          </p>
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
                  <ImageIcon className="h-8 w-8 text-muted-foreground mx-auto" />
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
                  <p className="mt-2 text-sm font-medium text-foreground">Rendu IA généré</p>
                  <p className="text-xs text-muted-foreground">Style {selectedStyle}</p>
                </div>
              </div>
              <div className="p-3 text-center text-sm font-medium text-primary">Après - Rendu IA</div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row justify-center gap-2 sm:gap-3">
            <Button variant="outline" className="gap-2">
              <Download className="h-4 w-4" /> Télécharger HD
            </Button>
            <Button variant="outline" className="gap-2" onClick={reset}>
              Nouveau rendu
            </Button>
            <Button className="gap-2">
              <Eye className="h-4 w-4" /> Partager au client
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
