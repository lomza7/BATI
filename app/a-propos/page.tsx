import { Navbar } from '@/components/landing/navbar';
import { Footer } from '@/components/landing/footer';
import { CTA } from '@/components/landing/cta';
import Link from 'next/link';
import { ArrowRight, Hexagon } from 'lucide-react';

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

/* ── Leadership ── */
const LEADERSHIP = [
  {
    name: 'Louis Maaza',
    role: 'Fondateur & CEO',
    bio: 'Passionné par le bâtiment et la tech, Louis a créé Hellobat après avoir vu trop d\'artisans talentueux perdre leurs soirées sur de la paperasse.',
    initials: 'LM',
    color: 'bg-[var(--landing-accent)]',
  },
  {
    name: 'Hector',
    role: 'CTO',
    bio: 'Architecture technique, supervision des développeurs et vision technologique long terme. Le gardien de la qualité du code.',
    initials: 'HC',
    color: 'bg-slate-800',
  },
  {
    name: 'Myriam',
    role: 'CPO',
    bio: 'Stratégie produit et roadmap. Elle s\'assure que chaque fonctionnalité répond à un vrai besoin terrain des artisans.',
    initials: 'MY',
    color: 'bg-violet-600',
  },
  {
    name: 'Amine',
    role: 'CRO',
    bio: 'Revenue et stratégie commerciale. Il structure la croissance et pilote l\'acquisition de nouveaux artisans.',
    initials: 'AM',
    color: 'bg-blue-700',
  },
  {
    name: 'Sophie',
    role: 'CMO',
    bio: 'Marketing et acquisition. Elle fait connaître Hellobat aux artisans qui en ont besoin, avec les bons mots et les bons canaux.',
    initials: 'SP',
    color: 'bg-pink-600',
  },
  {
    name: 'Kenza',
    role: 'Responsable Sécurité',
    bio: 'Cybersécurité et audits. Elle veille sur la protection des données de chaque artisan comme si c\'étaient les siennes.',
    initials: 'KZ',
    color: 'bg-red-700',
  },
];

/* ── Departments ── */
interface TeamMember {
  name: string;
  role: string;
  initials: string;
  color: string;
}

interface Department {
  name: string;
  lead: string | null;
  members: TeamMember[];
}

const DEPARTMENTS: Department[] = [
  {
    name: 'Tech',
    lead: 'Hector',
    members: [
      { name: 'Max', role: 'Fullstack Engineer', initials: 'MX', color: 'bg-slate-600' },
      { name: 'Thomas', role: 'QA Engineer', initials: 'TH', color: 'bg-slate-500' },
      { name: 'Romain', role: 'DevOps', initials: 'RM', color: 'bg-slate-700' },
      { name: 'Omar', role: 'Scraper Grand Public', initials: 'OM', color: 'bg-gray-600' },
      { name: 'Lina', role: 'Scraper Négoce Pro', initials: 'LN', color: 'bg-gray-500' },
      { name: 'Sami', role: 'Normaliseur prix', initials: 'SM', color: 'bg-slate-500' },
    ],
  },
  {
    name: 'Produit',
    lead: 'Myriam',
    members: [
      { name: 'Théo', role: 'Product Manager', initials: 'TH', color: 'bg-violet-500' },
      { name: 'Camille', role: 'Technical Writer', initials: 'CM', color: 'bg-violet-400' },
    ],
  },
  {
    name: 'Revenue',
    lead: 'Amine',
    members: [
      { name: 'Yasmine', role: 'SDR', initials: 'YS', color: 'bg-blue-500' },
      { name: 'Farid', role: 'Inbox Analyst', initials: 'FR', color: 'bg-blue-400' },
      { name: 'Lucas', role: 'Account Executive', initials: 'LC', color: 'bg-blue-600' },
    ],
  },
  {
    name: 'Marketing',
    lead: 'Sophie',
    members: [
      { name: 'Jules', role: 'Blog Writer', initials: 'JL', color: 'bg-pink-500' },
      { name: 'Nabil', role: 'SEO Specialist', initials: 'NB', color: 'bg-pink-400' },
      { name: 'Inaya', role: 'GEO/AIO Specialist', initials: 'IN', color: 'bg-pink-500' },
      { name: 'Aya', role: 'Community Manager', initials: 'AY', color: 'bg-pink-400' },
      { name: 'Karim', role: 'Growth Analyst', initials: 'KR', color: 'bg-pink-600' },
    ],
  },
  {
    name: 'Opérations transverses',
    lead: null,
    members: [
      { name: 'Saïd', role: 'Automation Architect', initials: 'SD', color: 'bg-amber-600' },
      { name: 'Nora', role: 'Data Analyst', initials: 'NR', color: 'bg-teal-600' },
      { name: 'Rayan', role: 'Competitive Analyst', initials: 'RY', color: 'bg-indigo-500' },
      { name: 'Sentinel', role: 'Cohérence organisationnelle', initials: 'SN', color: 'bg-gray-700' },
      { name: 'Inès', role: 'Support Client', initials: 'IS', color: 'bg-emerald-600' },
    ],
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
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif leading-[1.1] text-[var(--landing-text)] mb-6">
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
              site web, comptabilité, paiements en ligne. Et notre équipe de 30 personnes
              travaille chaque jour pour que les artisans n&apos;aient plus jamais à
              choisir entre bien travailler et bien gérer.
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

      {/* Leadership */}
      <section className="py-12 sm:py-20">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-serif text-[var(--landing-text)] mb-3">
              L&apos;équipe dirigeante
            </h2>
            <p className="text-sm sm:text-base text-[var(--landing-muted)]">
              Les personnes qui définissent la vision et pilotent Hellobat au quotidien.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {LEADERSHIP.map((member) => (
              <div
                key={member.name}
                className="rounded-2xl border border-[var(--landing-border)] bg-white p-6"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-12 h-12 rounded-full ${member.color} flex items-center justify-center text-white font-semibold text-sm`}>
                    {member.initials}
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

      {/* Departments */}
      <section className="py-12 sm:py-20 bg-[var(--landing-off)]">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-serif text-[var(--landing-text)] mb-3">
              Nos équipes
            </h2>
            <p className="text-sm sm:text-base text-[var(--landing-muted)]">
              30 personnes réparties en 5 pôles qui font tourner Hellobat.
            </p>
          </div>

          <div className="space-y-8">
            {DEPARTMENTS.map((dept) => (
              <div key={dept.name}>
                <div className="flex items-center gap-2 mb-4">
                  <h3 className="text-sm font-semibold text-[var(--landing-text)] uppercase tracking-wider">
                    {dept.name}
                  </h3>
                  {dept.lead && (
                    <span className="text-xs text-[var(--landing-muted)]">
                      — dirigé par {dept.lead}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {dept.members.map((m) => (
                    <div
                      key={m.name}
                      className="flex items-center gap-2.5 rounded-xl border border-[var(--landing-border)] bg-white p-3"
                    >
                      <div className={`w-8 h-8 rounded-full ${m.color} flex items-center justify-center text-white text-[10px] font-semibold shrink-0`}>
                        {m.initials}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-[var(--landing-text)] truncate">
                          {m.name}
                        </div>
                        <div className="text-[10px] text-[var(--landing-muted)] truncate">
                          {m.role}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Numbers */}
      <section className="py-12 sm:py-20">
        <div className="max-w-4xl mx-auto px-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
            {[
              { value: '2 400+', label: 'Artisans inscrits' },
              { value: '30', label: 'Membres dans l\'équipe' },
              { value: '5', label: 'Pôles métier' },
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
      <section className="py-12 sm:py-16 bg-[var(--landing-off)]">
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
              className="inline-flex items-center justify-center px-6 py-3 rounded-full bg-white border border-[var(--landing-border)] text-[var(--landing-text)] font-medium hover:bg-[var(--landing-stone)] transition-colors"
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
