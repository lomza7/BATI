'use client';

import { ArrowRight } from 'lucide-react';
import {
  FileText,
  HardHat,
  CalendarDays,
  MapPin,
  Globe,
  Target,
  Mail,
  CreditCard,
  Bot,
  Mic,
  Contact,
  BookOpen,
  Calculator,
  Package,
  PenLine,
  Zap,
} from 'lucide-react';

export interface FeatureCard {
  icon: React.ElementType;
  title: string;
  desc: string;
  special?: string;
  sectionId: string;
  slug: string;
}

export const featureCards: FeatureCard[] = [
  {
    icon: Mic,
    title: 'Devis IA vocal',
    desc: 'Dictez votre devis, ajoutez des photos, et Claude Sonnet génère le chiffrage pour vous.',
    special: 'ai',
    sectionId: 'devis',
    slug: 'devis-ia',
  },
  {
    icon: Zap,
    title: 'HelloPay',
    desc: 'Encaissez vos clients sur place : QR code, carte bancaire. Le paiement tombe en 10 secondes.',
    special: 'hellopay',
    sectionId: 'hellopay',
    slug: 'hellopay',
  },
  {
    icon: FileText,
    title: 'Factures',
    desc: 'Factures conformes à la réforme 2026, envoyées et suivies en quelques clics.',
    special: 'compliance',
    sectionId: 'devis',
    slug: 'factures',
  },
  {
    icon: Package,
    title: 'Mes prestations',
    desc: 'Bibliothèque de services avec tarifs, unités et prestations récurrentes.',
    sectionId: 'devis',
    slug: 'prestations',
  },
  {
    icon: Contact,
    title: 'Carnet de contacts',
    desc: 'Clients, prospects et prestataires réunis dans un seul répertoire filtré.',
    sectionId: 'contacts',
    slug: 'contacts',
  },
  {
    icon: PenLine,
    title: 'Signature électronique',
    desc: 'Faites signer vos devis en ligne, gratuitement et en illimité.',
    special: 'ai',
    sectionId: 'devis',
    slug: 'signature-electronique',
  },
  {
    icon: HardHat,
    title: 'Suivi chantiers',
    desc: 'Pilotez vos projets avec progression, budget et documents en temps réel.',
    sectionId: 'planning',
    slug: 'suivi-chantiers',
  },
  {
    icon: CalendarDays,
    title: 'Planning & équipe',
    desc: 'Planifiez vos interventions en drag & drop et gérez salariés, intérimaires et sous-traitants.',
    sectionId: 'planning',
    slug: 'planning-equipe',
  },
  {
    icon: MapPin,
    title: 'Carte interactive',
    desc: 'Visualisez tous vos chantiers et prospects sur une carte partageable.',
    sectionId: 'carte',
    slug: 'carte-interactive',
  },
  {
    icon: BookOpen,
    title: 'Catalogues produits',
    desc: 'Créez des catalogues visuels et partagez-les par lien magique à vos clients.',
    sectionId: 'catalogues',
    slug: 'catalogues',
  },
  {
    icon: Globe,
    title: 'Site vitrine',
    desc: 'Votre site web professionnel généré automatiquement.',
    sectionId: 'siteweb',
    slug: 'site-vitrine',
  },
  {
    icon: Target,
    title: 'Prospection CRM',
    desc: 'Pipeline commercial avec suivi des leads en kanban.',
    sectionId: 'prospection',
    slug: 'prospection-crm',
  },
  {
    icon: Mail,
    title: 'Assistant email IA & avis clients',
    desc: 'Rédigez vos réponses emails avec l\'IA et centralisez vos avis clients pour votre site vitrine.',
    sectionId: 'email',
    slug: 'assistant-email-ia',
  },
  {
    icon: CreditCard,
    title: 'Paiement en ligne & abonnements',
    desc: 'Faites-vous payer en ligne par vos clients et automatisez la facturation de vos contrats d\'entretien.',
    special: 'stripe',
    sectionId: 'paiement',
    slug: 'paiement-abonnements',
  },
  {
    icon: Calculator,
    title: 'Maurice — Comptable IA',
    desc: 'Scan de tickets, rapprochement bancaire, TVA et export comptable. Maurice gère, vous travaillez.',
    special: 'ai',
    sectionId: 'compta',
    slug: 'comptabilite-ia',
  },
  {
    icon: Bot,
    title: 'Agents IA',
    desc: 'Des assistants intelligents qui automatisent vos tâches.',
    special: 'ai',
    sectionId: 'agents',
    slug: 'agents-ia',
  },
];

function getCardClasses(special?: string) {
  switch (special) {
    case 'hellopay':
      return {
        card: 'bg-gradient-to-br from-amber-400/15 to-orange-500/10 border-amber-400/30 hover:border-amber-500/50 ring-1 ring-amber-300/20',
        iconBg: 'bg-gradient-to-br from-amber-400 to-orange-500',
        iconColor: 'text-white',
      };
    case 'stripe':
      return {
        card: 'bg-gradient-to-br from-[#635bff]/10 to-[#635bff]/5 border-[#635bff]/20 hover:border-[#635bff]/40',
        iconBg: 'bg-[#635bff]/20',
        iconColor: 'text-[#635bff]',
      };
    case 'ai':
      return {
        card: 'bg-gradient-to-br from-[var(--landing-accent)]/10 to-[var(--landing-accent)]/5 border-[var(--landing-accent)]/20 hover:border-[var(--landing-accent)]/40',
        iconBg: 'bg-[var(--landing-accent)]/20',
        iconColor: 'text-[var(--landing-accent)]',
      };
    case 'google':
      return {
        card: 'bg-gradient-to-br from-[#4285F4]/10 to-[#34A853]/5 border-[#4285F4]/20 hover:border-[#4285F4]/40',
        iconBg: 'bg-[#4285F4]/20',
        iconColor: 'text-[#4285F4]',
      };
    case 'recurring':
      return {
        card: 'bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/40',
        iconBg: 'bg-emerald-500/20',
        iconColor: 'text-emerald-600',
      };
    case 'compliance':
      return {
        card: 'bg-gradient-to-br from-blue-600/10 to-blue-600/5 border-blue-600/20 hover:border-blue-600/40',
        iconBg: 'bg-blue-600/20',
        iconColor: 'text-blue-600',
      };
    default:
      return {
        card: 'bg-[var(--landing-off)] border-[var(--landing-border)] hover:border-[var(--landing-accent)]/30',
        iconBg: 'bg-[var(--landing-stone)]',
        iconColor: 'text-[var(--landing-muted)] group-hover:text-[var(--landing-accent)]',
      };
  }
}

export function FeaturesGrid() {
  return (
    <section id="features" className="py-12 sm:py-24 bg-[var(--landing-white)]">
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="text-center mb-10 sm:mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif text-[var(--landing-text)] mb-4">
            Tout ce dont vous avez besoin,{' '}
            <em className="italic text-[var(--landing-accent)]">rien de plus</em>
          </h2>
          <p className="text-[var(--landing-muted)] text-lg max-w-xl mx-auto">
            Cliquez sur une fonctionnalité pour en savoir plus.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          {featureCards.map((card) => {
            const cls = getCardClasses(card.special);
            return (
              <a
                key={card.title}
                href={`#${card.sectionId}`}
                className={`group relative flex flex-col p-4 sm:p-6 rounded-xl sm:rounded-2xl border transition-all duration-200 hover:-translate-y-1 hover:shadow-lg cursor-pointer ${cls.card}`}
              >
                <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center mb-3 sm:mb-4 ${cls.iconBg}`}>
                  <card.icon className={`w-5 h-5 ${cls.iconColor} transition-colors`} />
                </div>
                <h3 className="font-semibold text-sm sm:text-base text-[var(--landing-text)] mb-1">{card.title}</h3>
                <p className="text-xs sm:text-sm text-[var(--landing-muted)] leading-relaxed mb-3 flex-1">{card.desc}</p>
                <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--landing-accent)] opacity-0 group-hover:opacity-100 transition-opacity">
                  En savoir plus <ArrowRight className="w-3 h-3" />
                </span>
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}
