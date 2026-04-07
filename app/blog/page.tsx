import { Navbar } from '@/components/landing/navbar';
import { Footer } from '@/components/landing/footer';
import { PenLine, Clock, FileText, HardHat, Zap, Scale, BookOpen } from 'lucide-react';

export const metadata = {
  title: 'Blog — Hellobat',
  description: 'Conseils, guides et actualités pour les artisans du bâtiment.',
};

const UPCOMING_ARTICLES = [
  {
    title: 'Facture électronique 2026 : tout ce que les artisans doivent savoir',
    category: 'Réglementation',
    icon: FileText,
    color: 'bg-blue-50 text-blue-600',
  },
  {
    title: '5 erreurs fréquentes dans les devis BTP (et comment les éviter)',
    category: 'Guides pratiques',
    icon: HardHat,
    color: 'bg-amber-50 text-amber-600',
  },
  {
    title: 'Comment l\'IA peut faire gagner 5 heures par semaine à un artisan',
    category: 'Intelligence artificielle',
    icon: Zap,
    color: 'bg-purple-50 text-purple-600',
  },
  {
    title: 'Garantie décennale : droits et obligations en 2026',
    category: 'Juridique',
    icon: Scale,
    color: 'bg-emerald-50 text-emerald-600',
  },
  {
    title: 'Réussir sa prospection quand on est artisan : le guide complet',
    category: 'Commercial',
    icon: BookOpen,
    color: 'bg-red-50 text-red-600',
  },
];

export default function BlogPage() {
  return (
    <div className="min-h-screen bg-[var(--landing-white)]">
      <Navbar />

      <main className="pt-28 pb-16 sm:pt-36 sm:pb-24">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-12 sm:mb-16">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif text-[var(--landing-text)] mb-4">
              Le blog Hellobat
            </h1>
            <p className="text-base sm:text-lg text-[var(--landing-muted)] max-w-xl mx-auto">
              Conseils, guides et actualités pour les artisans du bâtiment.
            </p>
          </div>

          {/* Coming soon card */}
          <div className="rounded-2xl border border-[var(--landing-border)] bg-[var(--landing-off)] p-8 sm:p-10 text-center mb-12">
            <div className="w-14 h-14 rounded-full bg-[var(--landing-accent-light)] flex items-center justify-center mx-auto mb-5">
              <PenLine className="w-6 h-6 text-[var(--landing-accent)]" />
            </div>
            <h2 className="text-xl sm:text-2xl font-serif text-[var(--landing-text)] mb-3">
              Jules est sur le coup
            </h2>
            <p className="text-sm sm:text-base text-[var(--landing-muted)] leading-relaxed max-w-lg mx-auto mb-2">
              Notre rédacteur prépare les premiers articles du blog. Il travaille
              avec toute l&apos;équipe pour vous proposer des guides pratiques, des
              décryptages réglementaires et des conseils terrain.
            </p>
            <p className="text-xs text-[var(--landing-muted)]">
              Les premiers articles arrivent très bientôt.
            </p>
          </div>

          {/* Upcoming articles */}
          <div>
            <div className="flex items-center gap-2 mb-6">
              <Clock className="w-4 h-4 text-[var(--landing-muted)]" />
              <h3 className="text-sm font-semibold text-[var(--landing-text)] uppercase tracking-wider">
                En préparation
              </h3>
            </div>

            <div className="space-y-3">
              {UPCOMING_ARTICLES.map((article) => (
                <div
                  key={article.title}
                  className="flex items-center gap-4 rounded-xl border border-[var(--landing-border)] bg-white p-4"
                >
                  <div className={`w-10 h-10 rounded-lg ${article.color} flex items-center justify-center shrink-0`}>
                    <article.icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[var(--landing-text)]">
                      {article.title}
                    </div>
                    <div className="text-xs text-[var(--landing-muted)] mt-0.5">
                      {article.category}
                    </div>
                  </div>
                  <span className="hidden sm:inline-flex px-2.5 py-1 rounded-full bg-amber-50 text-amber-600 text-[10px] font-medium shrink-0">
                    Bientôt
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
