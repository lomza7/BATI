'use client';

import Link from 'next/link';
import {
  ArrowRight,
  Camera,
  FileImage,
  FileText,
  Mic,
  Repeat,
  Bot,
  Check,
  Wand2,
  Contact,
  Phone,
  MapPin,
  UsersRound,
  Clock,
  CalendarDays,
  GripVertical,
  BookOpen,
  Link2,
  HardHat,
  ShieldCheck,
  FileCheck2,
  Archive,
} from 'lucide-react';

interface FeatureSectionProps {
  id: string;
  badge: string;
  title: string;
  titleAccent: string;
  description: string;
  bulletPoints: string[];
  reversed?: boolean;
  visual: React.ReactNode;
  slug?: string;
}

function FeatureSection({ id, badge, title, titleAccent, description, bulletPoints, reversed, visual, slug }: FeatureSectionProps) {
  return (
    <section id={id} className="py-12 sm:py-24 bg-[var(--landing-off)]">
      <div className="max-w-[1200px] mx-auto px-6">
        <div className={`flex flex-col ${reversed ? 'lg:flex-row-reverse' : 'lg:flex-row'} items-center gap-8 sm:gap-16`}>
          <div className="flex-1 space-y-4 sm:space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--landing-accent-light)] text-[var(--landing-accent)] text-xs font-medium">
              {badge}
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-serif text-[var(--landing-text)]">
              {title}{' '}
              <em className="italic text-[var(--landing-accent)]">{titleAccent}</em>
            </h2>
            <p className="text-[var(--landing-muted)] leading-relaxed">{description}</p>
            <ul className="space-y-3">
              {bulletPoints.map((point) => (
                <li key={point} className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <span className="text-sm text-[var(--landing-text)]">{point}</span>
                </li>
              ))}
            </ul>
            {slug && (
              <Link
                href={`/fonctionnalites/${slug}`}
                className="inline-flex items-center gap-2 mt-2 px-5 py-2.5 rounded-full bg-[var(--landing-accent)] text-white text-sm font-medium hover:bg-[#b94800] transition-colors"
              >
                En savoir plus <ArrowRight className="w-4 h-4" />
              </Link>
            )}
          </div>
          <div className="flex-1 w-full">{visual}</div>
        </div>
      </div>
    </section>
  );
}

function MockBrowser({ children, url }: { children: React.ReactNode; url?: string }) {
  return (
    <div className="rounded-xl sm:rounded-2xl border border-[var(--landing-border)] bg-white shadow-xl overflow-hidden">
      <div className="flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 border-b border-[var(--landing-border)] bg-[var(--landing-off)]">
        <div className="flex gap-1.5">
          <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-[#ff5f57]" />
          <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-[#febc2e]" />
          <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-[#28c840]" />
        </div>
        {url && <span className="text-[9px] sm:text-[10px] text-[var(--landing-muted)] font-mono ml-2">{url}</span>}
      </div>
      <div className="p-3 sm:p-6">{children}</div>
    </div>
  );
}

export function SiteWebSection() {
  return (
    <FeatureSection
      id="siteweb"
      slug="site-vitrine"
      badge="Site Web"
      title="Votre vitrine en ligne,"
      titleAccent="sans effort"
      description="Un site professionnel généré automatiquement à partir de vos informations. Présentez vos réalisations, recevez des demandes de devis et renforcez votre crédibilité."
      bulletPoints={[
        'Mise en page professionnelle automatique',
        'Galerie de réalisations avec photos',
        'Formulaire de contact intégré',
        'Optimisé pour le référencement (SEO)',
      ]}
      visual={
        <MockBrowser url="www.martin-plomberie.fr">
          <div className="space-y-4">
            <div className="h-32 rounded-xl bg-gradient-to-br from-[var(--landing-stone)] to-[var(--landing-border)] flex items-center justify-center">
              <span className="text-2xl font-serif text-[var(--landing-text)]">Martin Plomberie</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="h-20 rounded-lg bg-[var(--landing-stone)]" />
              <div className="h-20 rounded-lg bg-[var(--landing-stone)]" />
              <div className="h-20 rounded-lg bg-[var(--landing-stone)]" />
            </div>
            <div className="flex gap-3">
              <div className="h-8 flex-1 rounded-lg bg-[var(--landing-accent)] flex items-center justify-center">
                <span className="text-xs text-white font-medium">Demander un devis</span>
              </div>
              <div className="h-8 flex-1 rounded-lg border border-[var(--landing-border)] flex items-center justify-center">
                <span className="text-xs text-[var(--landing-text)]">Nos réalisations</span>
              </div>
            </div>
          </div>
        </MockBrowser>
      }
    />
  );
}

export function DevisSection() {
  return (
    <FeatureSection
      id="devis"
      slug="devis-factures"
      badge="Devis IA · Claude Sonnet"
      title="Vos devis,"
      titleAccent="pas comme tout le monde"
      description="Hellobat vous aide à préparer vos devis à partir de la voix et des photos du chantier. Propulsé par Claude Sonnet d'Anthropic, l'IA analyse votre demande vocale et vos photos pour proposer un chiffrage précis. Envoyez et faites signer électroniquement en illimité."
      bulletPoints={[
        'Description du besoin en parlant, comme sur chantier',
        'Ajout de photos pour enrichir le contexte',
        'Analyse IA par Claude Sonnet — suggestions de lignes et hypothèses',
        'Signature électronique illimitée intégrée (DocuSeal)',
      ]}
      visual={
        <MockBrowser url="hellobat.app/devis">
          <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-xl border border-[var(--landing-border)] bg-[var(--landing-off)] p-4">
              <div className="flex items-center gap-2 text-xs font-medium text-[var(--landing-accent)]">
                <Mic className="h-3.5 w-3.5" />
                Demande vocale
              </div>
              <div className="mt-3 rounded-lg bg-white p-3 text-xs text-[var(--landing-text)] shadow-sm">
                Bonjour, salle de bain à refaire complètement, environ 6 m2, dépose, plomberie douche, carrelage mural et meuble vasque.
              </div>

              <div className="mt-4 flex items-center gap-2 text-xs font-medium text-[var(--landing-accent)]">
                <Camera className="h-3.5 w-3.5" />
                Photos du chantier
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {[1, 2, 3].map((photo) => (
                  <div key={photo} className="aspect-[4/3] rounded-lg bg-[var(--landing-stone)] border border-[var(--landing-border)]" />
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-[var(--landing-border)] bg-white p-4">
              <div className="flex items-center gap-2 text-xs font-medium text-[var(--landing-accent)]">
                <Wand2 className="h-3.5 w-3.5" />
                Analyse IA
                <span className="ml-auto text-[9px] font-medium text-[#D97706] bg-[#D97706]/10 px-1.5 py-0.5 rounded-full">Claude Sonnet</span>
              </div>
              <div className="mt-3 rounded-lg bg-[var(--landing-off)] border border-[var(--landing-border)] p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold text-[var(--landing-text)]">Rénovation salle de bain</div>
                    <div className="text-[10px] text-[var(--landing-muted)]">Mme Petit</div>
                  </div>
                  <span className="rounded-full bg-[var(--landing-accent-light)] px-2 py-0.5 text-[10px] font-medium text-[var(--landing-accent)]">
                    86%
                  </span>
                </div>
                <div className="mt-3 space-y-2">
                  {[
                    'Dépose des équipements existants',
                    'Reprise plomberie douche / vasque',
                    'Pose receveur, paroi et meuble vasque',
                  ].map((line) => (
                    <div key={line} className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2">
                      <span className="text-[11px] text-[var(--landing-text)]">{line}</span>
                      <FileText className="h-3.5 w-3.5 text-[var(--landing-muted)]" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </MockBrowser>
      }
    />
  );
}

export function FactureElectroniqueSection() {
  return (
    <FeatureSection
      id="facture-electronique"
      slug="facture-electronique"
      badge="Réforme 2026"
      title="Facture électronique,"
      titleAccent="vous êtes prêt"
      description="La réforme de la facturation électronique entre en vigueur en 2026. Hellobat intègre dès aujourd'hui le format Factur-X, l'e-reporting et l'archivage légal pour que vous soyez conforme sans effort."
      bulletPoints={[
        'Format Factur-X (PDF/A-3 + XML) conforme aux normes EN 16931',
        'E-reporting automatique vers la plateforme publique de facturation',
        'Archivage légal 10 ans avec horodatage et intégrité garantie',
        'Numérotation séquentielle et mentions obligatoires vérifiées',
      ]}
      reversed
      visual={
        <MockBrowser url="hellobat.app/factures">
          <div className="space-y-4">
            {/* Compliance banner */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-50 border border-blue-200">
              <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <div className="text-xs font-semibold text-blue-900">Conforme facture électronique 2026</div>
                <div className="text-[10px] text-blue-700">Factur-X · E-reporting · Archivage légal</div>
              </div>
              <span className="text-[9px] font-medium text-white bg-blue-600 px-2 py-1 rounded-full shrink-0">Actif</span>
            </div>

            {/* Sample invoice */}
            <div className="p-4 rounded-xl border border-[var(--landing-border)] bg-[var(--landing-off)]">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-xs font-semibold text-[var(--landing-text)]">Facture F-2026-089</div>
                  <div className="text-[10px] text-[var(--landing-muted)]">M. Dupont · 3 200 EUR TTC</div>
                </div>
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Payée</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[10px]">
                  <FileCheck2 className="w-3.5 h-3.5 text-blue-600" />
                  <span className="text-[var(--landing-text)] font-medium">Factur-X</span>
                  <span className="text-[var(--landing-muted)]">PDF/A-3 + données XML</span>
                  <span className="ml-auto text-emerald-600 font-medium">Valide</span>
                </div>
                <div className="flex items-center gap-2 text-[10px]">
                  <FileText className="w-3.5 h-3.5 text-blue-600" />
                  <span className="text-[var(--landing-text)] font-medium">E-reporting</span>
                  <span className="text-[var(--landing-muted)]">Transmis PPF</span>
                  <span className="ml-auto text-emerald-600 font-medium">Envoyé</span>
                </div>
                <div className="flex items-center gap-2 text-[10px]">
                  <Archive className="w-3.5 h-3.5 text-blue-600" />
                  <span className="text-[var(--landing-text)] font-medium">Archivage</span>
                  <span className="text-[var(--landing-muted)]">10 ans · horodaté</span>
                  <span className="ml-auto text-emerald-600 font-medium">Archivé</span>
                </div>
              </div>
            </div>
          </div>
        </MockBrowser>
      }
    />
  );
}

export function ProspectionSection() {
  return (
    <FeatureSection
      id="prospection"
      slug="prospection-crm"
      badge="Prospection CRM"
      title="Convertissez vos prospects,"
      titleAccent="méthodiquement"
      description="Un pipeline commercial visuel en kanban pour suivre chaque lead, du premier contact au chantier signé."
      bulletPoints={[
        'Pipeline drag & drop par étapes',
        'Fiches prospects détaillées',
        'Historique des échanges',
        'Relances automatiques',
      ]}
      reversed
      visual={
        <MockBrowser>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {['Nouveau', 'Contacté', 'Devis envoyé', 'Gagné'].map((col) => (
              <div key={col} className="min-w-[100px] flex-1 space-y-2">
                <div className="text-[10px] font-medium text-[var(--landing-muted)] uppercase tracking-wider whitespace-nowrap">{col}</div>
                {[1, 2].map((i) => (
                  <div key={i} className="p-2 sm:p-2.5 rounded-lg bg-[var(--landing-off)] border border-[var(--landing-border)]">
                    <div className="h-2 w-12 sm:w-16 rounded bg-[var(--landing-border)] mb-1.5" />
                    <div className="h-1.5 w-8 sm:w-10 rounded bg-[var(--landing-stone)]" />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </MockBrowser>
      }
    />
  );
}

export function EmailSection() {
  return (
    <FeatureSection
      id="email"
      slug="gmail-integre"
      badge="Gmail intégré"
      title="Votre Gmail,"
      titleAccent="dans Hellobat"
      description="Connectez votre compte Gmail en un clic via OAuth. Envoyez, recevez et répondez à vos emails directement dans Hellobat, avec réponse IA contextuelle."
      bulletPoints={[
        'Synchronisation Gmail bidirectionnelle (OAuth sécurisé)',
        'Réponse IA avec contexte client : devis, factures, chantiers',
        'Envoi de devis et factures par email en un clic',
        'Historique complet par client et recherche rapide',
      ]}
      visual={
        <MockBrowser>
          <div className="space-y-2">
            {[
              { from: 'M. Dupont', subject: 'Re: Devis salle de bain', time: '10:32' },
              { from: 'Mme Bernard', subject: 'Demande de devis toiture', time: '09:15' },
              { from: 'SAS Martin', subject: 'Commande matériaux', time: 'Hier' },
            ].map((email) => (
              <div key={email.subject} className="flex items-center gap-3 p-3 rounded-lg hover:bg-[var(--landing-off)] border border-transparent hover:border-[var(--landing-border)] transition-colors">
                <div className="w-8 h-8 rounded-full bg-[var(--landing-stone)] flex items-center justify-center">
                  <span className="text-[10px] font-bold text-[var(--landing-muted)]">{email.from[0]}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-[var(--landing-text)] truncate">{email.from}</div>
                  <div className="text-[11px] text-[var(--landing-muted)] truncate">{email.subject}</div>
                </div>
                <span className="text-[10px] text-[var(--landing-muted)] shrink-0">{email.time}</span>
              </div>
            ))}
          </div>
        </MockBrowser>
      }
    />
  );
}

export function ComptaSection() {
  return (
    <FeatureSection
      id="compta"
      slug="comptabilite-ia"
      badge="Comptabilité"
      title="Comptabilité simplifiée,"
      titleAccent="en un clin d'œil"
      description="Suivez vos revenus, dépenses et marges en temps réel. Exportez vos données pour votre comptable en un clic."
      bulletPoints={[
        'Tableau de bord financier en temps réel',
        'Suivi des dépenses par catégorie',
        'Rapprochement bancaire automatique',
        'Export comptable (PDF, CSV)',
      ]}
      reversed
      visual={
        <MockBrowser>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                <div className="text-[10px] text-emerald-600 font-medium">Revenus</div>
                <div className="text-lg font-bold text-emerald-700">124 800 EUR</div>
              </div>
              <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                <div className="text-[10px] text-red-600 font-medium">Dépenses</div>
                <div className="text-lg font-bold text-red-700">43 200 EUR</div>
              </div>
            </div>
            <div className="flex items-end gap-1 h-20">
              {[40, 65, 50, 80, 70, 90, 60, 85, 75, 95, 70, 88].map((h, i) => (
                <div key={i} className="flex-1 bg-[var(--landing-accent)]/20 rounded-sm" style={{ height: `${h}%` }}>
                  <div className="w-full bg-[var(--landing-accent)] rounded-sm" style={{ height: '60%' }} />
                </div>
              ))}
            </div>
          </div>
        </MockBrowser>
      }
    />
  );
}

export function AvisSection() {
  return (
    <FeatureSection
      id="avis"
      slug="avis-google"
      badge="Avis Google"
      title="Des avis 5 étoiles,"
      titleAccent="automatiquement"
      description="Envoyez des demandes d'avis automatiques après chaque chantier et gérez votre e-réputation depuis Hellobat."
      bulletPoints={[
        'Envoi automatique post-chantier',
        'Suivi de votre note Google',
        'Réponses aux avis en un clic',
        'Widget avis pour votre site',
      ]}
      visual={
        <MockBrowser>
          <div className="space-y-3">
            <div className="text-center p-4">
              <div className="text-3xl font-bold text-[var(--landing-text)]">4.9</div>
              <div className="text-amber-500 text-sm">&#9733;&#9733;&#9733;&#9733;&#9733;</div>
              <div className="text-[10px] text-[var(--landing-muted)]">127 avis Google</div>
            </div>
            {[
              { name: 'Pierre L.', text: 'Travail impeccable, je recommande !', stars: 5 },
              { name: 'Sophie M.', text: 'Très professionnel et ponctuel.', stars: 5 },
            ].map((review) => (
              <div key={review.name} className="p-3 rounded-lg bg-[var(--landing-off)] border border-[var(--landing-border)]">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-6 h-6 rounded-full bg-[var(--landing-stone)] flex items-center justify-center">
                    <span className="text-[8px] font-bold text-[var(--landing-muted)]">{review.name[0]}</span>
                  </div>
                  <span className="text-[11px] font-semibold text-[var(--landing-text)]">{review.name}</span>
                  <span className="text-amber-500 text-[10px]">{'&#9733;'.repeat(review.stars)}</span>
                </div>
                <p className="text-[11px] text-[var(--landing-muted)]">{review.text}</p>
              </div>
            ))}
          </div>
        </MockBrowser>
      }
    />
  );
}

export function PlansSection() {
  return (
    <FeatureSection
      id="plans"
      slug="plans-rendus-ia"
      badge="Plans & Rendus"
      title="Vos documents,"
      titleAccent="toujours accessibles"
      description="Centralisez plans, photos de chantier, rendus 3D et documents techniques. Partagez-les avec vos clients en un lien."
      bulletPoints={[
        'Stockage illimité de fichiers',
        'Organisation par chantier',
        'Partage client par lien sécurisé',
        'Visionneuse intégrée (PDF, images)',
      ]}
      reversed
      visual={
        <MockBrowser>
          <div className="grid grid-cols-3 gap-2">
            {['Plan RDC.pdf', 'Facade.jpg', 'Devis.pdf', 'Photo 1.jpg', 'Rendu 3D.png', 'Plan étage.pdf'].map((file) => (
              <div key={file} className="aspect-square rounded-lg bg-[var(--landing-stone)] border border-[var(--landing-border)] flex items-center justify-center p-2">
                <div className="text-center">
                  <FileImage className="w-5 h-5 text-[var(--landing-muted)] mx-auto mb-1" />
                  <span className="text-[8px] text-[var(--landing-muted)] leading-tight block">{file}</span>
                </div>
              </div>
            ))}
          </div>
        </MockBrowser>
      }
    />
  );
}

export function CarteSection() {
  return (
    <FeatureSection
      id="carte"
      slug="carte-interactive"
      badge="Carte"
      title="Vos chantiers,"
      titleAccent="sur une carte"
      description="Visualisez l'ensemble de vos projets, prospects et interventions sur une carte interactive. Optimisez vos déplacements."
      bulletPoints={[
        'Vue carte de tous vos chantiers',
        'Filtrage par statut et type',
        'Itinéraire optimisé',
        'Géolocalisation des prospects',
      ]}
      visual={
        <MockBrowser>
          <div className="h-48 rounded-lg bg-[#e8e4da] relative overflow-hidden">
            <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 20px, #ccc 20px, #ccc 21px), repeating-linear-gradient(90deg, transparent, transparent 20px, #ccc 20px, #ccc 21px)' }} />
            {[
              { top: '20%', left: '30%', color: 'bg-emerald-500' },
              { top: '40%', left: '60%', color: 'bg-[var(--landing-accent)]' },
              { top: '60%', left: '25%', color: 'bg-blue-500' },
              { top: '35%', left: '75%', color: 'bg-amber-500' },
            ].map((pin, i) => (
              <div key={i} className="absolute" style={{ top: pin.top, left: pin.left }}>
                <div className={`w-4 h-4 rounded-full ${pin.color} border-2 border-white shadow-md`} />
              </div>
            ))}
          </div>
        </MockBrowser>
      }
    />
  );
}

export function ContactsSection() {
  return (
    <FeatureSection
      id="contacts"
      slug="contacts"
      badge="Contacts"
      title="Votre carnet d'adresses,"
      titleAccent="toujours à jour"
      description="Clients, prospects et prestataires réunis dans un seul répertoire. Filtrez par type, consultez l'historique des devis, factures et chantiers liés en un clic."
      bulletPoints={[
        'Fiches contacts détaillées (téléphone, email, adresse, notes)',
        'Filtrage par type : client, prospect, prestataire',
        'Historique complet : devis, factures et chantiers liés',
        'KPI par contact : CA généré, factures payées',
      ]}
      reversed
      visual={
        <MockBrowser url="hellobat.app/clients">
          <div className="space-y-3">
            <div className="flex gap-2 mb-3">
              {['Tous', 'Clients', 'Prospects', 'Prestataires'].map((f, i) => (
                <div key={f} className={`px-3 py-1 rounded-full text-[10px] font-medium ${i === 0 ? 'bg-[var(--landing-accent)] text-white' : 'bg-[var(--landing-off)] border border-[var(--landing-border)] text-[var(--landing-muted)]'}`}>
                  {f}
                </div>
              ))}
            </div>
            {[
              { name: 'M. Dupont', type: 'Client', color: 'bg-blue-100 text-blue-700', phone: '06 12 34 56 78', city: 'Lyon' },
              { name: 'Mme Bernard', type: 'Prospect', color: 'bg-amber-100 text-amber-700', phone: '06 98 76 54 32', city: 'Paris' },
              { name: 'SAS Martin', type: 'Prestataire', color: 'bg-purple-100 text-purple-700', phone: '01 23 45 67 89', city: 'Marseille' },
            ].map((c) => (
              <div key={c.name} className="flex items-center gap-3 p-3 rounded-lg bg-[var(--landing-off)] border border-[var(--landing-border)]">
                <div className="w-9 h-9 rounded-full bg-[var(--landing-stone)] flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-[var(--landing-muted)]">{c.name.split(' ').map(n => n[0]).join('')}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-[var(--landing-text)]">{c.name}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${c.color}`}>{c.type}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-[10px] text-[var(--landing-muted)]">
                    <span className="flex items-center gap-1"><Phone className="w-2.5 h-2.5" />{c.phone}</span>
                    <span className="flex items-center gap-1"><MapPin className="w-2.5 h-2.5" />{c.city}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </MockBrowser>
      }
    />
  );
}

export function EquipeSection() {
  return (
    <FeatureSection
      id="equipe"
      slug="equipe"
      badge="Équipe"
      title="Votre équipe,"
      titleAccent="bien gérée"
      description="Salariés, sous-traitants, intérimaires : gérez toute votre équipe au même endroit. Suivi des heures, spécialités, taux horaire et notes internes."
      bulletPoints={[
        'Profils avec photo, spécialité et type de contrat',
        'Calcul automatique du taux horaire',
        'Suivi des heures par chantier',
        'Notes internes et historique',
      ]}
      visual={
        <MockBrowser url="hellobat.app/equipe">
          <div className="space-y-3">
            {[
              { name: 'Jean Martin', role: 'Salarié', specialty: 'Plomberie', hours: '142h', rate: '28 EUR/h' },
              { name: 'Ahmed Benali', role: 'Sous-traitant', specialty: 'Électricité', hours: '86h', rate: '35 EUR/h' },
              { name: 'Lucas Petit', role: 'Intérimaire', specialty: 'Maçonnerie', hours: '64h', rate: '22 EUR/h' },
            ].map((m) => (
              <div key={m.name} className="flex items-center gap-3 p-3 rounded-lg bg-[var(--landing-off)] border border-[var(--landing-border)]">
                <div className="w-9 h-9 rounded-full bg-[var(--landing-accent)]/10 flex items-center justify-center shrink-0">
                  <UsersRound className="w-4 h-4 text-[var(--landing-accent)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-[var(--landing-text)]">{m.name}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">{m.role}</span>
                  </div>
                  <div className="text-[10px] text-[var(--landing-muted)]">{m.specialty}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="flex items-center gap-1 text-[10px] text-[var(--landing-text)] font-medium"><Clock className="w-2.5 h-2.5" />{m.hours}</div>
                  <div className="text-[9px] text-[var(--landing-muted)]">{m.rate}</div>
                </div>
              </div>
            ))}
          </div>
        </MockBrowser>
      }
    />
  );
}

export function PlanningSection() {
  return (
    <FeatureSection
      id="planning"
      slug="planning-equipe"
      badge="Planning"
      title="Un planning visuel,"
      titleAccent="drag & drop"
      description="Planifiez vos interventions avec un planning semaine ou mois interactif. Glissez-déposez les événements, assignez votre équipe et visualisez la charge de travail."
      bulletPoints={[
        'Vue semaine avec colonnes par jour',
        'Vue mois avec calendrier complet',
        'Drag & drop pour déplacer les interventions',
        'Code couleur par type : chantier, congé, réunion',
      ]}
      reversed
      visual={
        <MockBrowser url="hellobat.app/planning">
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-3">
              <div className="px-3 py-1 rounded-full bg-[var(--landing-accent)] text-white text-[10px] font-medium">Semaine</div>
              <div className="px-3 py-1 rounded-full bg-[var(--landing-off)] border border-[var(--landing-border)] text-[10px] text-[var(--landing-muted)]">Mois</div>
            </div>
            <div className="grid grid-cols-5 gap-1.5 text-center">
              {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven'].map((d) => (
                <div key={d} className="text-[9px] font-medium text-[var(--landing-muted)] uppercase tracking-wider pb-1">{d}</div>
              ))}
              {/* Row 1 - Jean */}
              <div className="col-span-3 p-1.5 rounded bg-blue-100 border border-blue-200">
                <div className="flex items-center gap-1">
                  <GripVertical className="w-2.5 h-2.5 text-blue-400" />
                  <span className="text-[9px] font-medium text-blue-700 truncate">Rénov. Dupont</span>
                </div>
              </div>
              <div className="col-span-1 p-1.5 rounded bg-amber-100 border border-amber-200">
                <span className="text-[9px] font-medium text-amber-700">Congé</span>
              </div>
              <div className="col-span-1 p-1.5 rounded bg-[var(--landing-off)] border border-[var(--landing-border)]" />
              {/* Row 2 - Ahmed */}
              <div className="col-span-2 p-1.5 rounded bg-emerald-100 border border-emerald-200">
                <div className="flex items-center gap-1">
                  <GripVertical className="w-2.5 h-2.5 text-emerald-400" />
                  <span className="text-[9px] font-medium text-emerald-700 truncate">SDB Bernard</span>
                </div>
              </div>
              <div className="col-span-1 p-1.5 rounded bg-purple-100 border border-purple-200">
                <span className="text-[9px] font-medium text-purple-700">Réunion</span>
              </div>
              <div className="col-span-2 p-1.5 rounded bg-blue-100 border border-blue-200">
                <div className="flex items-center gap-1">
                  <GripVertical className="w-2.5 h-2.5 text-blue-400" />
                  <span className="text-[9px] font-medium text-blue-700 truncate">Toiture Martin</span>
                </div>
              </div>
            </div>
          </div>
        </MockBrowser>
      }
    />
  );
}

export function CataloguesSection() {
  return (
    <FeatureSection
      id="catalogues"
      slug="catalogues"
      badge="Catalogues"
      title="Vos catalogues produits,"
      titleAccent="partagés en un lien"
      description="Créez des catalogues visuels avec vos produits et collections. Partagez-les à vos clients via un lien magique sans qu'ils aient besoin de compte."
      bulletPoints={[
        'Builder visuel drag & drop',
        'Organisation par collections',
        'Partage par lien magique (sans compte client)',
        'Suivi des consultations et sélections',
      ]}
      visual={
        <MockBrowser url="hellobat.app/catalogues">
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {['Robinetterie', 'Carrelage', 'Sanitaires'].map((cat) => (
                <div key={cat} className="aspect-[4/3] rounded-lg bg-[var(--landing-stone)] border border-[var(--landing-border)] flex flex-col items-center justify-center p-2">
                  <BookOpen className="w-5 h-5 text-[var(--landing-muted)] mb-1" />
                  <span className="text-[9px] font-medium text-[var(--landing-text)]">{cat}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-[var(--landing-accent)]/5 border border-[var(--landing-accent)]/20">
              <Link2 className="w-4 h-4 text-[var(--landing-accent)]" />
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-medium text-[var(--landing-text)]">Lien magique</div>
                <div className="text-[9px] text-[var(--landing-muted)] truncate">hellobat.app/c/abc123...</div>
              </div>
              <div className="text-[9px] text-[var(--landing-accent)] font-medium shrink-0">Copier</div>
            </div>
          </div>
        </MockBrowser>
      }
    />
  );
}

export function PaiementSection() {
  return (
    <FeatureSection
      id="paiement"
      slug="paiements-stripe"
      badge="Stripe Connect"
      title="Encaissez facilement,"
      titleAccent="directement sur votre compte"
      description="Vos clients paient par lien de paiement sécurisé, l'argent arrive directement sur votre compte Stripe. Commission plateforme à seulement 1%."
      bulletPoints={[
        'Lien de paiement envoyé avec chaque facture',
        'Paiement carte bancaire sécurisé via Stripe',
        'Encaissement direct sur votre compte (Stripe Connect)',
        'Commission plateforme réduite à 1%',
      ]}
      reversed
      visual={
        <MockBrowser>
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-gradient-to-r from-[#1a1a2e] to-[#16213e] text-white">
              <div className="text-[10px] opacity-60 mb-4">CARTE DE PAIEMENT</div>
              <div className="text-sm font-mono tracking-widest mb-4">**** **** **** 4242</div>
              <div className="flex justify-between text-[10px]">
                <span>MARTIN DUPONT</span>
                <span>12/27</span>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-50 border border-emerald-200">
              <span className="text-xs font-medium text-emerald-700">Paiement reçu</span>
              <span className="text-sm font-bold text-emerald-700">3 200 EUR</span>
            </div>
          </div>
        </MockBrowser>
      }
    />
  );
}

export function AbonnementsSection() {
  return (
    <FeatureSection
      id="abonnements"
      slug="contrats-recurrents"
      badge="Contrats récurrents"
      title="Revenus récurrents,"
      titleAccent="en pilote automatique"
      description="Créez des contrats d'entretien depuis vos devis, choisissez la TVA et la fréquence. La facturation se déclenche automatiquement à chaque échéance avec envoi du lien de paiement Stripe."
      bulletPoints={[
        'Facturation automatique (cron quotidien à 9h)',
        'Devis lié au contrat — signature requise avant activation',
        'TVA configurable par contrat (0%, 5.5%, 10%, 20%)',
        "Suivi MRR / ARR et taux d'encaissement en temps réel",
      ]}
      visual={
        <MockBrowser>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200">
                <div className="text-[9px] text-emerald-600 font-medium">MRR</div>
                <div className="text-sm font-bold text-emerald-700">4 200 EUR</div>
              </div>
              <div className="p-2 rounded-lg bg-blue-50 border border-blue-200">
                <div className="text-[9px] text-blue-600 font-medium">ARR</div>
                <div className="text-sm font-bold text-blue-700">50 400 EUR</div>
              </div>
            </div>
            {[
              { type: 'Chaudière', client: 'M. Dupont', montant: '420 EUR/an', date: '15 Jun 2026', status: 'Actif', tva: '10%' },
              { type: 'Clim', client: 'Mme Petit', montant: '350 EUR/trim.', date: '1 Jul 2026', status: 'Actif', tva: '20%' },
              { type: 'Piscine', client: 'SCI Martin', montant: '250 EUR/mois', date: '1 Mai 2026', status: 'Actif', tva: '20%' },
            ].map((contract) => (
              <div key={contract.client} className="flex items-center gap-3 p-3 rounded-lg bg-[var(--landing-off)] border border-[var(--landing-border)]">
                <Repeat className="w-4 h-4 text-[var(--landing-accent)] shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-[var(--landing-text)]">{contract.type} — {contract.client}</div>
                  <div className="text-[10px] text-[var(--landing-muted)]">{contract.montant} · TVA {contract.tva} · {contract.date}</div>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 shrink-0">
                  {contract.status}
                </span>
              </div>
            ))}
          </div>
        </MockBrowser>
      }
    />
  );
}

export function AgentsSection() {
  return (
    <FeatureSection
      id="agents"
      slug="agents-ia"
      badge="Agents IA"
      title="Des assistants IA,"
      titleAccent="à votre service"
      description="Configurez des agents intelligents qui répondent à vos clients, génèrent vos devis, et automatisent vos tâches répétitives."
      bulletPoints={[
        'Agent de réponse client automatique',
        'Génération de devis par IA',
        'Personnalisation du ton et du style',
        'Supervision et validation humaine',
      ]}
      reversed
      visual={
        <MockBrowser>
          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                <Bot className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <div className="p-3 rounded-xl rounded-tl-none bg-[var(--landing-off)] border border-[var(--landing-border)] text-[11px] text-[var(--landing-text)]">
                Bonjour ! J&apos;ai analysé la demande de M. Dupont. Je vous propose un devis pour la rénovation de sa salle de bain, budget estimé à 8 500 EUR.
              </div>
            </div>
            <div className="flex items-start gap-2 flex-row-reverse">
              <div className="w-7 h-7 rounded-full bg-[var(--landing-accent-light)] flex items-center justify-center shrink-0">
                <span className="text-[10px] font-bold text-[var(--landing-accent)]">V</span>
              </div>
              <div className="p-3 rounded-xl rounded-tr-none bg-[var(--landing-accent)] text-white text-[11px]">
                Parfait, génère le devis et envoie-le.
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                <Bot className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <div className="p-3 rounded-xl rounded-tl-none bg-[var(--landing-off)] border border-[var(--landing-border)] text-[11px] text-[var(--landing-text)]">
                C&apos;est fait ! Le devis DEV-2026-047 a été envoyé à dupont@email.fr.
              </div>
            </div>
          </div>
        </MockBrowser>
      }
    />
  );
}
