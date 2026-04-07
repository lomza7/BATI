import { Navbar } from '@/components/landing/navbar';
import { Footer } from '@/components/landing/footer';
import Link from 'next/link';
import {
  Wrench,
  BookOpen,
  Calculator,
  Scale,
  Leaf,
  CheckCircle2,
  Clock,
  MapPin,
  Briefcase,
  GraduationCap,
  ArrowRight,
  Bot,
  Mail,
} from 'lucide-react';

export const metadata = {
  title: 'Carrières — Hellobat',
  description: 'Rejoignez l\'équipe Hellobat. Postes ouverts et opportunités.',
};

const FILLED_POSITIONS = [
  {
    title: 'Expert Diagnostic Pannes',
    department: 'Équipe IA',
    location: 'Cloud (24/7)',
    hiredAs: 'Marcel',
    icon: Wrench,
    color: 'bg-red-500',
  },
  {
    title: 'Expert Réglementation DTU',
    department: 'Équipe IA',
    location: 'Cloud (24/7)',
    hiredAs: 'Norbert',
    icon: BookOpen,
    color: 'bg-blue-600',
  },
  {
    title: 'Chiffreur Senior',
    department: 'Équipe IA',
    location: 'Cloud (24/7)',
    hiredAs: 'Simone',
    icon: Calculator,
    color: 'bg-amber-500',
  },
  {
    title: 'Juriste BTP',
    department: 'Équipe IA',
    location: 'Cloud (24/7)',
    hiredAs: 'Gérard',
    icon: Scale,
    color: 'bg-purple-600',
  },
  {
    title: 'Consultant RGE & CEE',
    department: 'Équipe IA',
    location: 'Cloud (24/7)',
    hiredAs: 'Colette',
    icon: Leaf,
    color: 'bg-emerald-600',
  },
];

const OPEN_POSITIONS = [
  {
    title: 'Commercial BTP — Alternance',
    department: 'Commercial',
    location: 'Paris 15e (hybride)',
    type: 'Alternance — 12 à 24 mois',
    icon: Briefcase,
    description: 'Vous accompagnez les artisans dans la découverte d\'Hellobat. Démonstrations terrain, suivi d\'onboarding, remontées produit. Vous êtes le lien entre nos utilisateurs et notre équipe tech.',
    requirements: [
      'Formation Bac+3 à Bac+5 en commerce, marketing ou école de commerce',
      'Intérêt pour le secteur du bâtiment et les métiers manuels',
      'Aisance relationnelle et goût du terrain',
      'Permis B apprécié (déplacements ponctuels sur chantiers)',
    ],
  },
  {
    title: 'Analyste IA — Stage',
    department: 'Produit & IA',
    location: 'Paris 15e (hybride)',
    type: 'Stage — 4 à 6 mois',
    icon: GraduationCap,
    description: 'Vous analysez les performances de nos agents IA et proposez des améliorations. Prompt engineering, évaluation qualité, analyse des conversations utilisateurs. Vous contribuez à rendre nos agents toujours plus pertinents.',
    requirements: [
      'Formation Bac+4/5 en data science, IA, NLP ou informatique',
      'Connaissance des LLM (Claude, GPT) et du prompt engineering',
      'Capacité d\'analyse et rigueur méthodologique',
      'Curiosité pour le secteur du bâtiment (pas d\'expérience requise)',
    ],
  },
];

export default function CarrieresPage() {
  return (
    <div className="min-h-screen bg-[var(--landing-white)]">
      <Navbar />

      {/* Hero */}
      <section className="pt-28 pb-12 sm:pt-36 sm:pb-16 bg-[var(--landing-off)]">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif text-[var(--landing-text)] mb-4">
            Rejoignez l&apos;aventure Hellobat
          </h1>
          <p className="text-base sm:text-lg text-[var(--landing-muted)] max-w-xl mx-auto">
            On construit l&apos;outil que les artisans méritent. Et on cherche des
            personnes (humaines, cette fois) pour nous aider.
          </p>
        </div>
      </section>

      {/* Open positions */}
      <section className="py-12 sm:py-20">
        <div className="max-w-4xl mx-auto px-6">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h2 className="text-xl sm:text-2xl font-serif text-[var(--landing-text)]">
              Postes ouverts
            </h2>
          </div>

          <div className="space-y-6">
            {OPEN_POSITIONS.map((job) => (
              <div
                key={job.title}
                className="rounded-2xl border border-[var(--landing-border)] bg-white p-6 sm:p-8"
              >
                <div className="flex flex-wrap items-start gap-4 mb-4">
                  <div className="w-11 h-11 rounded-xl bg-[var(--landing-accent-light)] flex items-center justify-center">
                    <job.icon className="w-5 h-5 text-[var(--landing-accent)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base sm:text-lg font-semibold text-[var(--landing-text)]">
                      {job.title}
                    </h3>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                      <span className="flex items-center gap-1 text-xs text-[var(--landing-muted)]">
                        <Briefcase className="w-3 h-3" /> {job.department}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-[var(--landing-muted)]">
                        <MapPin className="w-3 h-3" /> {job.location}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-[var(--landing-muted)]">
                        <Clock className="w-3 h-3" /> {job.type}
                      </span>
                    </div>
                  </div>
                </div>

                <p className="text-sm text-[var(--landing-muted)] leading-relaxed mb-4">
                  {job.description}
                </p>

                <div className="mb-5">
                  <div className="text-xs font-semibold text-[var(--landing-text)] mb-2">
                    Profil recherché
                  </div>
                  <ul className="space-y-1.5">
                    {job.requirements.map((req) => (
                      <li key={req} className="flex items-start gap-2 text-xs sm:text-sm text-[var(--landing-muted)]">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                        {req}
                      </li>
                    ))}
                  </ul>
                </div>

                <a
                  href="mailto:contact@hellobat.app?subject=Candidature — {job.title}"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[var(--landing-accent)] text-white text-sm font-medium hover:bg-[#b94800] transition-colors"
                >
                  Postuler
                  <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Filled positions */}
      <section className="py-12 sm:py-20 bg-[var(--landing-off)]">
        <div className="max-w-4xl mx-auto px-6">
          <div className="flex items-center gap-3 mb-3">
            <Bot className="w-5 h-5 text-[var(--landing-muted)]" />
            <h2 className="text-xl sm:text-2xl font-serif text-[var(--landing-text)]">
              Postes pourvus
            </h2>
          </div>
          <p className="text-sm text-[var(--landing-muted)] mb-8">
            Ces postes ont été pourvus par nos agents IA. Ils travaillent 24h/24,
            ne prennent jamais de congés, et ne se plaignent jamais de la machine à café.
          </p>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FILLED_POSITIONS.map((job) => (
              <div
                key={job.title}
                className="rounded-xl border border-[var(--landing-border)] bg-white p-4 opacity-75"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-9 h-9 rounded-full ${job.color} flex items-center justify-center`}>
                    <job.icon className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[var(--landing-text)] truncate">
                      {job.title}
                    </div>
                    <div className="text-[10px] text-[var(--landing-muted)]">
                      {job.location}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-xs text-emerald-600 font-medium">
                    Recruté — {job.hiredAs}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-12 sm:py-16">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-2xl sm:text-3xl font-serif text-[var(--landing-text)] mb-4">
            Aucun poste ne vous correspond ?
          </h2>
          <p className="text-sm sm:text-base text-[var(--landing-muted)] mb-8">
            Envoyez-nous une candidature spontanée. Si vous êtes passionné par
            le bâtiment et la tech, on trouvera une place pour vous.
          </p>
          <a
            href="mailto:contact@hellobat.app?subject=Candidature spontanée"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[var(--landing-stone)] text-[var(--landing-text)] font-medium hover:bg-[var(--landing-border)] transition-colors"
          >
            <Mail className="w-4 h-4" />
            Candidature spontanée
          </a>
        </div>
      </section>

      <Footer />
    </div>
  );
}
