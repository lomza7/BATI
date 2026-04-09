type ArticleSchemaProps = {
  headline: string;
  description: string;
  datePublished: string; // ISO 8601
  dateModified?: string; // ISO 8601
  author: string;
  image: string;
  url: string;
};

const SITE_URL = 'https://hellobat.app';

/**
 * Emits a Schema.org BlogPosting JSON-LD block for blog article pages.
 *
 * The `publisher` is linked by `@id` to the Organization node declared in
 * <SchemaOrg /> at the root layout, so Google can consolidate the entity
 * graph without duplicating organization metadata on every article.
 *
 * React Server Component — do not add 'use client'.
 */
export function ArticleSchema({
  headline,
  description,
  datePublished,
  dateModified,
  author,
  image,
  url,
}: ArticleSchemaProps) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline,
    description,
    image,
    datePublished,
    dateModified: dateModified ?? datePublished,
    author: {
      '@type': 'Person',
      name: author,
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
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
