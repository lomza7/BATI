'use client';

import {
  FileImage,
  Repeat,
  Bot,
  Check,
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
}

function FeatureSection({ id, badge, title, titleAccent, description, bulletPoints, reversed, visual }: FeatureSectionProps) {
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
      badge="Site Web"
      title="Votre vitrine en ligne,"
      titleAccent="sans effort"
      description="Un site professionnel genere automatiquement a partir de vos informations. Presentez vos realisations, recevez des demandes de devis et renforcez votre credibilite."
      bulletPoints={[
        'Mise en page professionnelle automatique',
        'Galerie de realisations avec photos',
        'Formulaire de contact integre',
        'Optimise pour le referencement (SEO)',
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
                <span className="text-xs text-[var(--landing-text)]">Nos realisations</span>
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
      badge="Prospection CRM"
      title="Convertissez vos prospects,"
      titleAccent="methodiquement"
      description="Un pipeline commercial visuel en kanban pour suivre chaque lead, du premier contact au chantier signe."
      bulletPoints={[
        'Pipeline drag & drop par etapes',
        'Fiches prospects detaillees',
        'Historique des echanges',
        'Relances automatiques',
      ]}
      reversed
      visual={
        <MockBrowser>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {['Nouveau', 'Contacte', 'Devis envoye', 'Gagne'].map((col) => (
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
      badge="Emails"
      title="Votre messagerie,"
      titleAccent="centralisee"
      description="Plus besoin de jongler entre votre boite mail et votre logiciel. Envoyez, recevez et suivez tous vos emails directement dans BatiFlow."
      bulletPoints={[
        'Boite de reception integree',
        'Envoi de devis et factures par email',
        'Historique complet par client',
        'Templates de reponses rapides',
      ]}
      visual={
        <MockBrowser>
          <div className="space-y-2">
            {[
              { from: 'M. Dupont', subject: 'Re: Devis salle de bain', time: '10:32' },
              { from: 'Mme Bernard', subject: 'Demande de devis toiture', time: '09:15' },
              { from: 'SAS Martin', subject: 'Commande materiaux', time: 'Hier' },
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
      badge="Comptabilite"
      title="Comptabilite simplifiee,"
      titleAccent="en un clin d'oeil"
      description="Suivez vos revenus, depenses et marges en temps reel. Exportez vos donnees pour votre comptable en un clic."
      bulletPoints={[
        'Tableau de bord financier en temps reel',
        'Suivi des depenses par categorie',
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
                <div className="text-[10px] text-red-600 font-medium">Depenses</div>
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
      badge="Avis Google"
      title="Des avis 5 etoiles,"
      titleAccent="automatiquement"
      description="Envoyez des demandes d'avis automatiques après chaque chantier et gérez votre e-reputation depuis BatiFlow."
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
              { name: 'Sophie M.', text: 'Tres professionnel et ponctuel.', stars: 5 },
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
      badge="Plans & Rendus"
      title="Vos documents,"
      titleAccent="toujours accessibles"
      description="Centralisez plans, photos de chantier, rendus 3D et documents techniques. Partagez-les avec vos clients en un lien."
      bulletPoints={[
        'Stockage illimite de fichiers',
        'Organisation par chantier',
        'Partage client par lien securise',
        'Visionneuse integree (PDF, images)',
      ]}
      reversed
      visual={
        <MockBrowser>
          <div className="grid grid-cols-3 gap-2">
            {['Plan RDC.pdf', 'Facade.jpg', 'Devis.pdf', 'Photo 1.jpg', 'Rendu 3D.png', 'Plan etage.pdf'].map((file) => (
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
      badge="Carte"
      title="Vos chantiers,"
      titleAccent="sur une carte"
      description="Visualisez l'ensemble de vos projets, prospects et interventions sur une carte interactive. Optimisez vos deplacements."
      bulletPoints={[
        'Vue carte de tous vos chantiers',
        'Filtrage par statut et type',
        'Itineraire optimise',
        'Geolocalisation des prospects',
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

export function PaiementSection() {
  return (
    <FeatureSection
      id="paiement"
      badge="Paiements"
      title="Encaissez facilement,"
      titleAccent="payez rapidement"
      description="Acceptez les paiements par carte bancaire directement depuis vos factures. Integration Stripe native pour des paiements securises."
      bulletPoints={[
        'Paiement par lien dans la facture',
        'Carte bancaire et virement',
        'Suivi des encaissements en temps reel',
        'Relances automatiques pour impayes',
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
              <span className="text-xs font-medium text-emerald-700">Paiement recu</span>
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
      badge="Contrats"
      title="Contrats de maintenance,"
      titleAccent="sous controle"
      description="Gerez vos contrats d'entretien recurrents : chaudieres, climatisations, piscines. Ne manquez plus aucune echeance."
      bulletPoints={[
        'Suivi des contrats par type',
        'Alertes avant echeance',
        'Facturation recurrente automatique',
        'Historique des interventions',
      ]}
      visual={
        <MockBrowser>
          <div className="space-y-2">
            {[
              { type: 'Chaudiere', client: 'M. Dupont', date: '15 Jan 2026', status: 'Actif' },
              { type: 'Climatisation', client: 'Mme Bernard', date: '28 Fev 2026', status: 'A renouveler' },
              { type: 'Piscine', client: 'SCI Martin', date: '10 Avr 2026', status: 'Actif' },
            ].map((contract) => (
              <div key={contract.client} className="flex items-center gap-3 p-3 rounded-lg bg-[var(--landing-off)] border border-[var(--landing-border)]">
                <Repeat className="w-4 h-4 text-[var(--landing-accent)]" />
                <div className="flex-1">
                  <div className="text-xs font-semibold text-[var(--landing-text)]">{contract.type} - {contract.client}</div>
                  <div className="text-[10px] text-[var(--landing-muted)]">Prochaine echeance : {contract.date}</div>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${contract.status === 'Actif' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
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
      badge="Agents IA"
      title="Des assistants IA,"
      titleAccent="a votre service"
      description="Configurez des agents intelligents qui repondent a vos clients, generent vos devis, et automatisent vos taches repetitives."
      bulletPoints={[
        'Agent de reponse client automatique',
        'Generation de devis par IA',
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
                Bonjour ! J&apos;ai analyse la demande de M. Dupont. Je vous propose un devis pour la renovation de sa salle de bain, budget estime a 8 500 EUR.
              </div>
            </div>
            <div className="flex items-start gap-2 flex-row-reverse">
              <div className="w-7 h-7 rounded-full bg-[var(--landing-accent-light)] flex items-center justify-center shrink-0">
                <span className="text-[10px] font-bold text-[var(--landing-accent)]">V</span>
              </div>
              <div className="p-3 rounded-xl rounded-tr-none bg-[var(--landing-accent)] text-white text-[11px]">
                Parfait, genere le devis et envoie-le.
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                <Bot className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <div className="p-3 rounded-xl rounded-tl-none bg-[var(--landing-off)] border border-[var(--landing-border)] text-[11px] text-[var(--landing-text)]">
                C&apos;est fait ! Le devis DEV-2026-047 a ete envoye a dupont@email.fr.
              </div>
            </div>
          </div>
        </MockBrowser>
      }
    />
  );
}
