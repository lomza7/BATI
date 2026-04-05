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
  Calendar,
  RefreshCw,
  Calculator,
  Package,
  PenLine,
  ShieldCheck,
} from 'lucide-react';

const featureCards = [
  {
    icon: Mic,
    title: 'Devis IA vocal',
    desc: 'Dictez votre devis, ajoutez des photos, et Claude Sonnet génère le chiffrage pour vous.',
    special: 'ai',
  },
  {
    icon: FileText,
    title: 'Devis & Factures',
    desc: 'Créez, envoyez et suivez vos devis et factures en quelques clics.',
  },
  {
    icon: ShieldCheck,
    title: 'Facture électronique',
    desc: 'Conforme à la réforme 2026 : format Factur-X, e-reporting et archivage légal.',
    special: 'compliance',
  },
  {
    icon: Package,
    title: 'Mes prestations',
    desc: 'Bibliothèque de services avec tarifs, unités et prestations récurrentes.',
  },
  {
    icon: Contact,
    title: 'Carnet de contacts',
    desc: 'Clients, prospects et prestataires réunis dans un seul répertoire filtré.',
  },
  {
    icon: PenLine,
    title: 'Signature électronique',
    desc: 'Faites signer vos devis en ligne, gratuitement et en illimité.',
    special: 'ai',
  },
  {
    icon: HardHat,
    title: 'Suivi chantiers',
    desc: 'Pilotez vos projets avec progression, budget et documents en temps réel.',
  },
  {
    icon: CalendarDays,
    title: 'Planning équipe',
    desc: 'Vue semaine et mois avec drag & drop pour planifier vos interventions.',
  },
  {
    icon: Calendar,
    title: 'Google Calendar',
    desc: 'Synchronisation bidirectionnelle de vos rendez-vous avec Google Calendar.',
    special: 'google',
  },
  {
    icon: UsersRound,
    title: 'Équipe & sous-traitants',
    desc: 'Gérez salariés, intérimaires et sous-traitants avec suivi des heures.',
  },
  {
    icon: MapPin,
    title: 'Carte interactive',
    desc: 'Visualisez tous vos chantiers et prospects sur une carte partageable.',
  },
  {
    icon: BookOpen,
    title: 'Catalogues produits',
    desc: 'Créez des catalogues visuels et partagez-les par lien magique à vos clients.',
  },
  {
    icon: Globe,
    title: 'Site vitrine',
    desc: 'Votre site web professionnel généré automatiquement.',
  },
  {
    icon: Target,
    title: 'Prospection CRM',
    desc: 'Pipeline commercial avec suivi des leads en kanban.',
  },
  {
    icon: Mail,
    title: 'Gmail intégré',
    desc: 'Votre boîte Gmail synchronisée : envoi, réception et réponse IA depuis Hellobat.',
    special: 'google',
  },
  {
    icon: Star,
    title: 'Avis Google',
    desc: 'Collectez et gérez vos avis clients automatiquement.',
  },
  {
    icon: CreditCard,
    title: 'Paiements Stripe',
    desc: 'Acceptez les paiements en ligne avec lien de paiement et suivi en temps réel.',
    special: 'stripe',
  },
  {
    icon: RefreshCw,
    title: 'Contrats récurrents',
    desc: 'Contrats d\'entretien avec facturation automatique et suivi MRR.',
    special: 'recurring',
  },
  {
    icon: Calculator,
    title: 'Comptabilité IA',
    desc: 'Suivi des revenus, dépenses et marges avec catégorisation automatique.',
    special: 'ai',
  },
  {
    icon: Bot,
    title: 'Agents IA',
    desc: 'Des assistants intelligents qui automatisent vos tâches.',
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
            Une seule plateforme pour piloter devis, chantiers, équipe, commercial, communication et finance sans changer d&apos;outil.
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
                  : card.special === 'google'
                  ? 'bg-gradient-to-br from-[#4285F4]/10 to-[#34A853]/5 border-[#4285F4]/20 hover:border-[#4285F4]/40'
                  : card.special === 'recurring'
                  ? 'bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/40'
                  : card.special === 'compliance'
                  ? 'bg-gradient-to-br from-blue-600/10 to-blue-600/5 border-blue-600/20 hover:border-blue-600/40'
                  : 'bg-[var(--landing-off)] border-[var(--landing-border)] hover:border-[var(--landing-accent)]/30'
              }`}
            >
              <div
                className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center mb-3 sm:mb-4 ${
                  card.special === 'stripe'
                    ? 'bg-[#635bff]/20'
                    : card.special === 'ai'
                    ? 'bg-[var(--landing-accent)]/20'
                    : card.special === 'google'
                    ? 'bg-[#4285F4]/20'
                    : card.special === 'recurring'
                    ? 'bg-emerald-500/20'
                    : card.special === 'compliance'
                    ? 'bg-blue-600/20'
                    : 'bg-[var(--landing-stone)]'
                }`}
              >
                <card.icon
                  className={`w-5 h-5 ${
                    card.special === 'stripe'
                      ? 'text-[#635bff]'
                      : card.special === 'ai'
                      ? 'text-[var(--landing-accent)]'
                      : card.special === 'google'
                      ? 'text-[#4285F4]'
                      : card.special === 'recurring'
                      ? 'text-emerald-600'
                      : card.special === 'compliance'
                      ? 'text-blue-600'
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
