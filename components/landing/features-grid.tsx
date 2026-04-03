'use client';

import {
  FileText,
  HardHat,
  CalendarDays,
  MapPin,
  Globe,
  Target,
  Mail,
  Star,
  FileImage,
  CreditCard,
  Bot,
  Mic,
  Contact,
  UsersRound,
  BookOpen,
} from 'lucide-react';

const featureCards = [
  {
    icon: Mic,
    title: 'Devis IA vocal',
    desc: 'Dictez votre devis, ajoutez des photos, et l IA genere le chiffrage pour vous.',
    special: 'ai',
  },
  {
    icon: FileText,
    title: 'Devis & Factures',
    desc: 'Creez, envoyez et suivez vos devis et factures en quelques clics.',
  },
  {
    icon: Contact,
    title: 'Carnet de contacts',
    desc: 'Clients, prospects et prestataires reunis dans un seul repertoire filtre.',
  },
  {
    icon: HardHat,
    title: 'Suivi chantiers',
    desc: 'Pilotez vos projets avec progression, budget et documents en temps reel.',
  },
  {
    icon: CalendarDays,
    title: 'Planning equipe',
    desc: 'Vue semaine et mois avec drag & drop pour planifier vos interventions.',
  },
  {
    icon: UsersRound,
    title: 'Equipe & sous-traitants',
    desc: 'Gerez salaries, interimaires et sous-traitants avec suivi des heures.',
  },
  {
    icon: MapPin,
    title: 'Carte interactive',
    desc: 'Visualisez tous vos chantiers et prospects sur une carte partageable.',
  },
  {
    icon: BookOpen,
    title: 'Catalogues produits',
    desc: 'Creez des catalogues visuels et partagez-les par lien magique a vos clients.',
  },
  {
    icon: Globe,
    title: 'Site vitrine',
    desc: 'Votre site web professionnel genere automatiquement.',
  },
  {
    icon: Target,
    title: 'Prospection CRM',
    desc: 'Pipeline commercial avec suivi des leads en kanban.',
  },
  {
    icon: Mail,
    title: 'Emails integres',
    desc: 'Envoyez et recevez vos emails directement dans Hellobat.',
  },
  {
    icon: Star,
    title: 'Avis Google',
    desc: 'Collectez et gerez vos avis clients automatiquement.',
  },
  {
    icon: FileImage,
    title: 'Plans & Rendus',
    desc: 'Stockez et partagez vos plans, photos et documents.',
  },
  {
    icon: CreditCard,
    title: 'Paiements Stripe',
    desc: 'Acceptez les paiements en ligne par carte bancaire.',
    special: 'stripe',
  },
  {
    icon: Bot,
    title: 'Agents IA',
    desc: 'Des assistants intelligents qui automatisent vos taches.',
    special: 'ai',
  },
];

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
            Une seule plateforme pour piloter devis, chantiers, equipe, commercial, communication et finance sans changer d outil.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          {featureCards.map((card) => (
            <div
              key={card.title}
              className={`group p-4 sm:p-6 rounded-xl sm:rounded-2xl border transition-all duration-200 hover:-translate-y-1 hover:shadow-lg ${
                card.special === 'stripe'
                  ? 'bg-gradient-to-br from-[#635bff]/10 to-[#635bff]/5 border-[#635bff]/20 hover:border-[#635bff]/40'
                  : card.special === 'ai'
                  ? 'bg-gradient-to-br from-[var(--landing-accent)]/10 to-[var(--landing-accent)]/5 border-[var(--landing-accent)]/20 hover:border-[var(--landing-accent)]/40'
                  : 'bg-[var(--landing-off)] border-[var(--landing-border)] hover:border-[var(--landing-accent)]/30'
              }`}
            >
              <div
                className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center mb-3 sm:mb-4 ${
                  card.special === 'stripe'
                    ? 'bg-[#635bff]/20'
                    : card.special === 'ai'
                    ? 'bg-[var(--landing-accent)]/20'
                    : 'bg-[var(--landing-stone)]'
                }`}
              >
                <card.icon
                  className={`w-5 h-5 ${
                    card.special === 'stripe'
                      ? 'text-[#635bff]'
                      : card.special === 'ai'
                      ? 'text-[var(--landing-accent)]'
                      : 'text-[var(--landing-muted)] group-hover:text-[var(--landing-accent)]'
                  } transition-colors`}
                />
              </div>
              <h3 className="font-semibold text-sm sm:text-base text-[var(--landing-text)] mb-1">{card.title}</h3>
              <p className="text-xs sm:text-sm text-[var(--landing-muted)] leading-relaxed">{card.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
