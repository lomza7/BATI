type BreadcrumbItem = {
  name: string;
  url: string;
};

/**
 * Emits a Schema.org BreadcrumbList JSON-LD block for article/section pages.
 *
 * Usage:
 *   <BreadcrumbSchema
 *     items={[
 *       { name: 'Accueil', url: 'https://hellobat.app' },
 *       { name: 'Blog', url: 'https://hellobat.app/blog' },
 *       { name: 'Article', url: 'https://hellobat.app/blog/slug' },
 *     ]}
 *   />
 *
 * React Server Component — do not add 'use client'.
 */
export function BreadcrumbSchema({ items }: { items: BreadcrumbItem[] }) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
