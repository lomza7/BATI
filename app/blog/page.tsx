import type { Metadata } from 'next';
import Link from 'next/link';
import { Clock, FileText, HardHat, Zap, Scale, BookOpen } from 'lucide-react';

import { Navbar } from '@/components/landing/navbar';
import { Footer } from '@/components/landing/footer';
import { getSortedArticles } from '@/lib/blog/articles';

const SITE_URL = 'https://hellobat.app';

export const metadata: Metadata = {
  title:
    'Blog — Logiciel du bâtiment, IA & conseils pour artisans | Hellobat',
  description:
    "Guides, comparatifs et décryptages réglementaires pour les artisans du bâtiment : logiciel BTP, facture électronique 2026, devis IA et bonnes pratiques.",
  alternates: {
    canonical: `${SITE_URL}/blog`,
  },
  openGraph: {
    type: 'website',
    title: 'Blog Hellobat — Conseils pour artisans du bâtiment',
    description:
      'Guides pratiques, comparatifs de logiciels BTP, actualités réglementaires et usages concrets de l’IA pour les artisans du bâtiment.',
    url: `${SITE_URL}/blog`,
    siteName: 'Hellobat',
    locale: 'fr_FR',
  },
};

const UPCOMING_ARTICLES = [
  {
    title:
      '5 erreurs fréquentes dans les devis BTP (et comment les éviter)',
    category: 'Guides pratiques',
    icon: HardHat,
    color: 'bg-amber-50 text-amber-600',
  },
  {
    title: 'Garantie décennale : droits et obligations en 2026',
    category: 'Juridique',
    icon: Scale,
    color: 'bg-emerald-50 text-emerald-600',
  },
  {
    title: "Réussir sa prospection quand on est artisan : le guide complet",
    category: 'Commercial',
    icon: BookOpen,
    color: 'bg-red-50 text-red-600',
  },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function BlogPage() {
  const articles = getSortedArticles();

  return (
    <div className="min-h-screen bg-[var(--landing-white)]">
      <Navbar />

      <main className="pt-28 pb-16 sm:pt-36 sm:pb-24">
        <div className="max-w-5xl mx-auto px-6">
          {/* Hero */}
          <div className="text-center mb-12 sm:mb-16">
            <span className="inline-flex items-center rounded-full border border-[var(--landing-border)] bg-[var(--landing-off)] px-3 py-1 text-xs font-medium text-[var(--landing-muted)] mb-4">
              <FileText className="w-3 h-3 mr-1.5" />
              Blog Hellobat
            </span>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif text-[var(--landing-text)] mb-4">
              Guides, conseils et actualités pour les artisans du bâtiment
            </h1>
            <p className="text-base sm:text-lg text-[var(--landing-muted)] max-w-2xl mx-auto">
              Choisir son logiciel du bâtiment, comprendre la facture
              électronique 2026, gagner du temps avec l&apos;IA, mieux chiffrer
              ses chantiers : on partage tout ce qu&apos;on apprend sur le
              terrain avec les artisans.
            </p>
          </div>

          {/* Articles grid */}
          {articles.length > 0 && (
            <section className="mb-16">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {articles.map((article) => (
                  <Link
                    key={article.slug}
                    href={`/blog/${article.slug}`}
                    className="group flex flex-col rounded-2xl border border-[var(--landing-border)] bg-white overflow-hidden hover:border-[var(--landing-accent)] hover:shadow-sm transition-all"
                  >
                    <div
                      className={`h-32 bg-gradient-to-br ${article.gradient} flex items-end p-5`}
                    >
                      <span className="inline-flex items-center rounded-full bg-white/90 backdrop-blur-sm px-2.5 py-1 text-[11px] font-medium text-[var(--landing-text)]">
                        {article.categoryLabel}
                      </span>
                    </div>
                    <div className="flex flex-col flex-1 p-5 sm:p-6">
                      <h2 className="text-lg sm:text-xl font-semibold text-[var(--landing-text)] leading-snug mb-3 group-hover:text-[var(--landing-accent)] transition-colors">
                        {article.title}
                      </h2>
                      <p className="text-sm text-[var(--landing-muted)] leading-relaxed line-clamp-3 mb-5">
                        {article.excerpt}
                      </p>
                      <div className="mt-auto flex items-center justify-between text-xs text-[var(--landing-muted)]">
                        <span>
                          {formatDate(article.publishedAt)} ·{' '}
                          {article.readingTime}
                        </span>
                        <span className="font-medium text-[var(--landing-accent)] group-hover:underline">
                          Lire l&apos;article
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Upcoming */}
          <section>
            <div className="flex items-center gap-2 mb-6">
              <Clock className="w-4 h-4 text-[var(--landing-muted)]" />
              <h2 className="text-sm font-semibold text-[var(--landing-text)] uppercase tracking-wider">
                En préparation
              </h2>
            </div>

            <div className="space-y-3">
              {UPCOMING_ARTICLES.map((article) => (
                <div
                  key={article.title}
                  className="flex items-center gap-4 rounded-xl border border-[var(--landing-border)] bg-white p-4"
                >
                  <div
                    className={`w-10 h-10 rounded-lg ${article.color} flex items-center justify-center shrink-0`}
                  >
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
          </section>

          {/* CTA */}
          <section className="mt-16">
            <div className="rounded-3xl border border-[var(--landing-border)] bg-[var(--landing-text)] text-white p-8 sm:p-12 text-center">
              <Zap className="w-10 h-10 text-[var(--landing-accent)] mx-auto mb-4" />
              <h2 className="text-2xl sm:text-3xl font-serif mb-3">
                Le logiciel du bâtiment qui fait gagner du temps
              </h2>
              <p className="text-base text-white/70 max-w-xl mx-auto mb-6">
                Devis IA, facture électronique 2026, suivi chantier, CRM et
                application mobile. Tout ce dont un artisan a besoin, dans un
                seul outil simple.
              </p>
              <Link
                href="/signup"
                className="inline-flex items-center rounded-full bg-[var(--landing-accent)] hover:bg-[#b94800] transition-colors px-6 py-3 text-sm font-medium"
              >
                Essayer Hellobat gratuitement
              </Link>
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
