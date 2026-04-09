import type { ReactNode } from 'react';

import { LogicielBatimentChoisirContent } from './content/logiciel-batiment-comment-choisir';
import { FactureElectronique2026Content } from './content/facture-electronique-2026-artisan-guide';
import { DevisBtpIaContent } from './content/devis-btp-ia-gagner-temps';

/**
 * Blog article registry — single source of truth for the Hellobat blog.
 *
 * Each article's body lives in its own .tsx file under lib/blog/content/
 * so prose can be authored with React components and Tailwind utility
 * classes while staying server-rendered (no 'use client').
 */

export type BlogCategory =
  | 'reglementation'
  | 'guides'
  | 'ia'
  | 'commercial'
  | 'juridique';

export type BlogArticle = {
  slug: string;
  title: string;
  /** ~155 char meta description used for SEO + cards */
  description: string;
  /** Short card excerpt, can be slightly longer than description */
  excerpt: string;
  publishedAt: string;
  updatedAt?: string;
  author: string;
  category: BlogCategory;
  categoryLabel: string;
  tags: string[];
  /** Human readable, e.g. "12 min" */
  readingTime: string;
  /** Primary target keyword — surfaced to humans in the editor, not rendered */
  targetKeyword: string;
  /** Category-linked gradient used in card + hero in lieu of hero images */
  gradient: string;
  content: () => ReactNode;
};

export const BLOG_CATEGORY_LABELS: Record<BlogCategory, string> = {
  reglementation: 'Réglementation',
  guides: 'Guides pratiques',
  ia: 'Intelligence artificielle',
  commercial: 'Commercial',
  juridique: 'Juridique',
};

const CATEGORY_GRADIENTS: Record<BlogCategory, string> = {
  reglementation: 'from-blue-100 via-blue-50 to-white',
  guides: 'from-amber-100 via-amber-50 to-white',
  ia: 'from-purple-100 via-purple-50 to-white',
  commercial: 'from-red-100 via-red-50 to-white',
  juridique: 'from-emerald-100 via-emerald-50 to-white',
};

export const BLOG_ARTICLES: BlogArticle[] = [
  {
    slug: 'logiciel-batiment-comment-choisir',
    title:
      "Logiciel du bâtiment : comment choisir le meilleur outil pour votre entreprise en 2026",
    description:
      "Guide 2026 pour choisir un logiciel du bâtiment adapté à votre entreprise : critères, comparatif des fonctionnalités et conseils d'artisans.",
    excerpt:
      "Quel logiciel du bâtiment choisir en 2026 ? Un guide pour comparer les solutions du marché, comprendre les critères qui comptent vraiment et éviter les pièges classiques.",
    publishedAt: '2026-04-09T10:00:00.000Z',
    updatedAt: '2026-04-09T10:00:00.000Z',
    author: "L'équipe Hellobat",
    category: 'guides',
    categoryLabel: BLOG_CATEGORY_LABELS.guides,
    tags: ['logiciel BTP', 'comparatif', 'artisan', 'gestion'],
    readingTime: '14 min',
    targetKeyword: 'logiciel du bâtiment',
    gradient: CATEGORY_GRADIENTS.guides,
    content: LogicielBatimentChoisirContent,
  },
  {
    slug: 'facture-electronique-2026-artisan-guide',
    title:
      'Facture électronique 2026 pour les artisans du bâtiment : le guide complet des obligations',
    description:
      "Dates, plateformes agréées, formats, pénalités : tout ce qu'un artisan du bâtiment doit savoir sur la facture électronique obligatoire en 2026.",
    excerpt:
      "La réforme de la facture électronique entre en vigueur au 1ᵉʳ septembre 2026. On fait le point sur le calendrier, les plateformes agréées (ex-PDP) et les formats à maîtriser.",
    publishedAt: '2026-04-09T10:00:00.000Z',
    updatedAt: '2026-04-09T10:00:00.000Z',
    author: "L'équipe Hellobat",
    category: 'reglementation',
    categoryLabel: BLOG_CATEGORY_LABELS.reglementation,
    tags: ['facture électronique', 'réforme 2026', 'Factur-X', 'PDP'],
    readingTime: '12 min',
    targetKeyword: 'facture électronique 2026 artisan',
    gradient: CATEGORY_GRADIENTS.reglementation,
    content: FactureElectronique2026Content,
  },
  {
    slug: 'devis-btp-ia-gagner-temps',
    title:
      "Devis BTP avec l'IA : comment gagner 5 heures par semaine et signer plus de chantiers",
    description:
      "Rédiger un devis BTP en moins de 3 minutes grâce à l'IA : méthode pas-à-pas, limites à connaître et bonnes pratiques pour rester compétitif en 2026.",
    excerpt:
      "L'intelligence artificielle change la façon dont les artisans rédigent leurs devis. Voici la méthode concrète pour réduire le temps de chiffrage sans sacrifier la précision.",
    publishedAt: '2026-04-09T10:00:00.000Z',
    updatedAt: '2026-04-09T10:00:00.000Z',
    author: "L'équipe Hellobat",
    category: 'ia',
    categoryLabel: BLOG_CATEGORY_LABELS.ia,
    tags: ['devis', 'IA', 'productivité', 'chiffrage'],
    readingTime: '11 min',
    targetKeyword: 'devis BTP IA',
    gradient: CATEGORY_GRADIENTS.ia,
    content: DevisBtpIaContent,
  },
];

export function getArticleBySlug(slug: string): BlogArticle | undefined {
  return BLOG_ARTICLES.find((article) => article.slug === slug);
}

export function getAllSlugs(): string[] {
  return BLOG_ARTICLES.map((article) => article.slug);
}

export function getRelatedArticles(
  currentSlug: string,
  limit = 3
): BlogArticle[] {
  const current = getArticleBySlug(currentSlug);
  if (!current) {
    return BLOG_ARTICLES.slice(0, limit);
  }

  // Rank by shared tags, then shared category, then recency.
  const others = BLOG_ARTICLES.filter((a) => a.slug !== currentSlug);
  const scored = others.map((article) => {
    const sharedTags = article.tags.filter((t) => current.tags.includes(t)).length;
    const sameCategory = article.category === current.category ? 1 : 0;
    return { article, score: sharedTags * 2 + sameCategory };
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (
      new Date(b.article.publishedAt).getTime() -
      new Date(a.article.publishedAt).getTime()
    );
  });

  return scored.slice(0, limit).map((s) => s.article);
}

export function getSortedArticles(): BlogArticle[] {
  return BLOG_ARTICLES.slice().sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
}
