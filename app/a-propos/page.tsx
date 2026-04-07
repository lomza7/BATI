import { Navbar } from '@/components/landing/navbar';
import { Footer } from '@/components/landing/footer';
import { CTA } from '@/components/landing/cta';
import Link from 'next/link';
import {
  Wrench,
  BookOpen,
  Calculator,
  Scale,
  Leaf,
  ArrowRight,
  Hexagon,
} from 'lucide-react';

export const metadata = {
  title: 'À propos — Hellobat',
  description: 'Découvrez l\'histoire d\'Hellobat, la plateforme tout-en-un pour les artisans du bâtiment.',
};

const VALUES = [
  {
    title: 'Terrain d\'abord',
    description: 'On construit Hellobat depuis les chantiers, pas depuis un bureau. Chaque fonctionnalité naît d\'un problème réel rencontré par un artisan.',
  },
  {
    title: 'Simplicité radicale',
    description: 'Un artisan doit pouvoir créer un devis en 30 secondes depuis son téléphone, entre deux coups de marteau. Si c\'est compliqué, c\'est qu\'on a raté.',
  },
  {
    title: 'L\'IA au service du métier',
    description: 'L\'intelligence artificielle ne remplace pas le savoir-faire. Elle élimine la paperasse pour que l\'artisan se concentre sur ce qu\'il fait de mieux : construire.',
  },
];

const TEAM = [
  {
    name: 'Louis Maaza',
    role: 'Fondateur & CEO',
    bio: 'Passionné par le bâtiment et la tech, Louis a créé Hellobat après avoir vu trop d\'artisans talentueux perdre leurs soirées sur de la paperasse. Son obsession : que chaque artisan puisse gérer son entreprise aussi facilement qu\'il manie ses outils.',
    initials: 'LM',
    color: 'bg-[var(--landing-accent)]',
  },
  {
    name: 'Marcel',
    role: 'Expert Diagnostic Pannes',
    bio: 'Marcel a 30 ans d\'expérience (virtuelle) dans le diagnostic de pannes sur chantier. Fuites, fissures, courts-circuits — il a tout vu. Il analyse vos problèmes et vous guide vers la solution, 24h/24.',
    initials: 'MC',
    color: 'bg-red-500',
    icon: Wrench,
    isAI: true,
  },
  {
    name: 'Norbert',
    role: 'Expert Réglementation DTU',
    bio: 'Norbert connaît les DTU sur le bout des doigts. Épaisseurs minimales, pentes réglementaires, tolérances — demandez-lui n\'importe quelle norme, il vous répond en 3 secondes. Le collègue que tout chef de chantier rêve d\'avoir.',
    initials: 'NB',
    color: 'bg-blue-600',
    icon: BookOpen,
    isAI: true,
  },
  {
    name: 'Simone',
    role: 'Chiffreuse Senior',
    bio: 'Simone transforme une description de travaux en estimation budgétaire en un clin d\'œil. Elle connaît les prix du marché, les marges habituelles et les pièges à éviter. Votre premier réflexe avant chaque devis.',
    initials: 'SM',
    color: 'bg-amber-500',
    icon: Calculator,
    isAI: true,
  },
  {
    name: 'Gérard',
    role: 'Juriste BTP',
    bio: 'Gérard veille sur vos droits et obligations. Garantie décennale, assurance, litiges, responsabilités — il vous oriente avec la rigueur d\'un juriste et la clarté d\'un ami qui vous explique les choses simplement.',
    initials: 'GR',
    color: 'bg-purple-600',
    icon: Scale,
    isAI: true,
  },
  {
    name: 'Colette',
    role: 'Consultante RGE & CEE',
    bio: 'Colette maîtrise les certifications RGE, les Certificats d\'Économies d\'Énergie et toutes les aides à la rénovation énergétique. Elle accompagne vos clients dans leurs démarches et vous aide à décrocher les bons labels.',
    initials: 'CL',
    color: 'bg-emerald-600',
    icon: Leaf,
    isAI: true,
  },
];

export default function AProposPage() {
  return (
    <div className="min-h-screen bg-[var(--landing-white)]">
      <Navbar />

      {/* Hero */}
      <section className="pt-28 pb-12 sm:pt-36 sm:pb-20 bg-[var(--landing-off)]">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 bg-[var(--landing-accent)] rounded-xl flex items-center justify-center">
              <Hexagon className="h-5 w-5 text-white" />
            </div>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif text-[var(--landing-text)] mb-6">
            On construit Hellobat comme vous construisez vos chantiers :{' '}
            <em className="text-[var(--landing-accent)]">avec passion</em>
          </h1>
          <p className="text-base sm:text-lg text-[var(--landing-muted)] leading-relaxed max-w-2xl mx-auto">
            Hellobat est né d&apos;un constat simple : les artisans du bâtiment sont
            excellents dans leur métier, mais passent trop de temps sur l&apos;administratif.
            On a décidé de changer ça.
          </p>
        </div>
      </section>

      {/* Story */}
      <section className="py-12 sm:py-20">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-2xl sm:text-3xl font-serif text-[var(--landing-text)] mb-8">
            Notre histoire
          </h2>
          <div className="text-sm sm:text-base text-[var(--landing-muted)] leading-relaxed space-y-5">
            <p>
              Tout a commencé par une frustration. En discutant avec des artisans —
              plombiers, électriciens, maçons, peintres — le même problème revenait sans
              cesse : <strong className="text-[var(--landing-text)]">« Je passe mes
              soirées à faire de la paperasse au lieu de profiter de ma famille. »</strong>
            </p>
            <p>
              Devis rédigés à la main sur des bouts de papier. Factures oubliées.
              Planning géré par SMS. Relances clients jamais faites. Des heures perdues
              chaque semaine sur des tâches qui n&apos;ont rien à voir avec le cœur de
              métier.
            </p>
            <p>
              Les outils existants ? Soit trop complexes (pensés pour des entreprises de
              50 personnes), soit trop limités (un simple tableur déguisé). Aucun ne
              parlait le langage des artisans.
            </p>
            <p>
              <strong className="text-[var(--landing-text)]">Hellobat est né en 2025</strong> avec
              une ambition : créer l&apos;outil que chaque artisan mérite. Simple comme un
              carnet de notes, puissant comme un ERP, et intelligent grâce à l&apos;IA.
            </p>
            <p>
              Aujourd&apos;hui, Hellobat gère tout : devis vocaux depuis le chantier,
              factures conformes 2026, signature électronique, planning d&apos;équipe, CRM,
              site web, comptabilité, paiements en ligne. Et notre équipe — mi-humaine,
              mi-IA — est disponible 24h/24 pour accompagner chaque artisan.
            </p>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-12 sm:py-20 bg-[var(--landing-off)]">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-2xl sm:text-3xl font-serif text-[var(--landing-text)] mb-10 text-center">
            Ce en quoi on croit
          </h2>
          <div className="grid gap-6 sm:grid-cols-3">
            {VALUES.map((v) => (
              <div key={v.title} className="bg-white rounded-2xl border border-[var(--landing-border)] p-6">
                <h3 className="text-base font-semibold text-[var(--landing-text)] mb-2">
                  {v.title}
                </h3>
                <p className="text-sm text-[var(--landing-muted)] leading-relaxed">
                  {v.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="py-12 sm:py-20">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-serif text-[var(--landing-text)] mb-3">
              L&apos;équipe
            </h2>
            <p className="text-sm sm:text-base text-[var(--landing-muted)]">
              Une équipe hybride, mi-humaine mi-IA, disponible 24h/24 pour les artisans.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {TEAM.map((member) => (
              <div
                key={member.name}
                className="rounded-2xl border border-[var(--landing-border)] bg-white p-6 relative overflow-hidden"
              >
                {member.isAI && (
                  <span className="absolute top-4 right-4 px-2 py-0.5 rounded-full bg-[var(--landing-accent-light)] text-[var(--landing-accent)] text-[10px] font-semibold">
                    Agent IA
                  </span>
                )}
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-12 h-12 rounded-full ${member.color} flex items-center justify-center text-white font-semibold text-sm`}>
                    {member.icon ? (
                      <member.icon className="w-5 h-5" />
                    ) : (
                      member.initials
                    )}
                  </div>
                  <div>
                    <div className="font-semibold text-sm text-[var(--landing-text)]">
                      {member.name}
                    </div>
                    <div className="text-xs text-[var(--landing-muted)]">
                      {member.role}
                    </div>
                  </div>
                </div>
                <p className="text-xs sm:text-sm text-[var(--landing-muted)] leading-relaxed">
                  {member.bio}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Numbers */}
      <section className="py-12 sm:py-20 bg-[var(--landing-off)]">
        <div className="max-w-4xl mx-auto px-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
            {[
              { value: '2 400+', label: 'Artisans inscrits' },
              { value: '6', label: 'Membres dans l\'équipe' },
              { value: '5', label: 'Agents IA spécialisés' },
              { value: '24/7', label: 'Disponibilité' },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="text-2xl sm:text-3xl font-semibold text-[var(--landing-accent)] mb-1">
                  {stat.value}
                </div>
                <div className="text-xs sm:text-sm text-[var(--landing-muted)]">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-12 sm:py-16 bg-[var(--landing-white)]">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-2xl sm:text-3xl font-serif text-[var(--landing-text)] mb-4">
            Envie de rejoindre l&apos;aventure ?
          </h2>
          <p className="text-[var(--landing-muted)] mb-8">
            Que vous soyez artisan ou que vous vouliez nous rejoindre, on a hâte de vous rencontrer.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-[var(--landing-accent)] text-white font-medium hover:bg-[#b94800] transition-colors"
            >
              Essayer gratuitement
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/carrieres"
              className="inline-flex items-center justify-center px-6 py-3 rounded-full bg-[var(--landing-stone)] text-[var(--landing-text)] font-medium hover:bg-[var(--landing-border)] transition-colors"
            >
              Voir les postes
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
