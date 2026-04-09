import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, Calendar, Clock, User, ArrowRight } from 'lucide-react';

import { Navbar } from '@/components/landing/navbar';
import { Footer } from '@/components/landing/footer';
import {
  getAllSlugs,
  getArticleBySlug,
  getRelatedArticles,
} from '@/lib/blog/articles';

type Params = { slug: string };
type PageProps = { params: Params };

const SITE_URL = 'https://hellobat.app';
const DEFAULT_OG = `${SITE_URL}/og-default.png`;

export function generateStaticParams(): Params[] {
  return getAllSlugs().map((slug) => ({ slug }));
}

export function generateMetadata({ params }: PageProps): Metadata {
  const article = getArticleBySlug(params.slug);
  if (!article) {
    return {
      title: 'Article introuvable — Hellobat',
      description: "Cet article n'existe pas ou a été déplacé.",
    };
  }

  const url = `${SITE_URL}/blog/${article.slug}`;
  const fullTitle = `${article.title} — Hellobat`;

  return {
    title: fullTitle,
    description: article.description,
    authors: [{ name: article.author }],
    alternates: {
      canonical: url,
    },
    openGraph: {
      type: 'article',
      title: article.title,
      description: article.description,
      url,
      siteName: 'Hellobat',
      locale: 'fr_FR',
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt ?? article.publishedAt,
      authors: [article.author],
      images: [
        {
          url: DEFAULT_OG,
          width: 1200,
          height: 630,
          alt: article.title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: article.title,
      description: article.description,
      images: [DEFAULT_OG],
    },
  };
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function BlogArticlePage({ params }: PageProps) {
  const article = getArticleBySlug(params.slug);
  if (!article) {
    notFound();
  }

  const url = `${SITE_URL}/blog/${article.slug}`;
  const related = getRelatedArticles(article.slug, 3);

  // BreadcrumbList JSON-LD
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE_URL}/blog` },
      { '@type': 'ListItem', position: 3, name: article.title, item: url },
    ],
  };

  // BlogPosting JSON-LD
  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: article.title,
    description: article.description,
    image: DEFAULT_OG,
    datePublished: article.publishedAt,
    dateModified: article.updatedAt ?? article.publishedAt,
    author: {
      '@type': 'Person',
      name: article.author,
    },
    publisher: {
      '@id': `${SITE_URL}/#organization`,
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': url,
    },
    url,
    inLanguage: 'fr-FR',
    articleSection: article.categoryLabel,
    keywords: article.tags.join(', '),
  };

  return (
    <div className="min-h-screen bg-[var(--landing-white)]">
      <Navbar />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />

      <main className="pt-24 pb-16 sm:pt-32 sm:pb-24">
        {/* Back link */}
        <div className="max-w-3xl mx-auto px-6 mb-6">
          <Link
            href="/blog"
            className="inline-flex items-center gap-1.5 text-sm text-[var(--landing-muted)] hover:text-[var(--landing-text)] transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Retour au blog
          </Link>
        </div>

        {/* Article hero */}
        <header
          className={`max-w-3xl mx-auto px-6 mb-10 sm:mb-14`}
        >
          <div
            className={`rounded-3xl bg-gradient-to-br ${article.gradient} border border-[var(--landing-border)] p-6 sm:p-10 mb-8`}
          >
            <span className="inline-flex items-center rounded-full bg-white/80 backdrop-blur-sm px-3 py-1 text-xs font-medium text-[var(--landing-text)] mb-4">
              {article.categoryLabel}
            </span>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif text-[var(--landing-text)] leading-tight mb-4">
              {article.title}
            </h1>
            <p className="text-base sm:text-lg text-[var(--landing-muted)] leading-relaxed">
              {article.description}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-[var(--landing-muted)]">
            <div className="flex items-center gap-1.5">
              <User className="w-4 h-4" />
              <span>{article.author}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              <time dateTime={article.publishedAt}>
                {formatDate(article.publishedAt)}
              </time>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              <span>{article.readingTime} de lecture</span>
            </div>
          </div>
        </header>

        {/* Article body */}
        <article className="max-w-3xl mx-auto px-6">
          {article.content()}
        </article>

        {/* Tags */}
        <div className="max-w-3xl mx-auto px-6 mt-12">
          <div className="flex flex-wrap gap-2">
            {article.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center rounded-full border border-[var(--landing-border)] bg-[var(--landing-off)] px-3 py-1 text-xs text-[var(--landing-muted)]"
              >
                #{tag}
              </span>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="max-w-3xl mx-auto px-6 mt-12">
          <div className="rounded-3xl border border-[var(--landing-border)] bg-[var(--landing-text)] text-white p-8 sm:p-10">
            <h2 className="text-2xl sm:text-3xl font-serif mb-3">
              Essayez Hellobat gratuitement pendant 30 jours
            </h2>
            <p className="text-base text-white/70 leading-relaxed mb-6 max-w-xl">
              Devis, factures, chantiers, CRM, application mobile et assistant
              IA — tout ce dont un artisan du bâtiment a besoin, dans un seul
              outil pensé pour 2026. Sans carte bancaire, sans engagement.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 rounded-full bg-[var(--landing-accent)] hover:bg-[#b94800] transition-colors px-6 py-3 text-sm font-medium"
              >
                Démarrer l&apos;essai gratuit
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/#pricing"
                className="inline-flex items-center rounded-full border border-white/20 bg-white/5 hover:bg-white/10 transition-colors px-6 py-3 text-sm font-medium"
              >
                Voir les tarifs
              </Link>
            </div>
          </div>
        </div>

        {/* Related articles */}
        {related.length > 0 && (
          <section className="max-w-5xl mx-auto px-6 mt-20">
            <h2 className="text-2xl sm:text-3xl font-serif text-[var(--landing-text)] mb-8">
              Articles liés
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {related.map((a) => (
                <Link
                  key={a.slug}
                  href={`/blog/${a.slug}`}
                  className="group flex flex-col rounded-2xl border border-[var(--landing-border)] bg-white overflow-hidden hover:border-[var(--landing-accent)] transition-colors"
                >
                  <div
                    className={`h-24 bg-gradient-to-br ${a.gradient} flex items-end p-4`}
                  >
                    <span className="inline-flex items-center rounded-full bg-white/90 backdrop-blur-sm px-2.5 py-0.5 text-[11px] font-medium text-[var(--landing-text)]">
                      {a.categoryLabel}
                    </span>
                  </div>
                  <div className="flex flex-col flex-1 p-5">
                    <h3 className="text-base font-semibold text-[var(--landing-text)] leading-snug mb-2 group-hover:text-[var(--landing-accent)] transition-colors">
                      {a.title}
                    </h3>
                    <p className="text-sm text-[var(--landing-muted)] line-clamp-3 mb-4">
                      {a.excerpt}
                    </p>
                    <div className="mt-auto text-xs text-[var(--landing-muted)]">
                      {formatDate(a.publishedAt)} · {a.readingTime}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
}
