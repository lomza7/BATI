import type { SiteContentFaq } from '@/lib/site-utils';

interface SiteFaqProps {
  faq: SiteContentFaq[];
}

export function SiteFaq({ faq }: SiteFaqProps) {
  if (faq.length === 0) return null;

  return (
    <section id="faq" className="py-12 sm:py-20 px-4 sm:px-6" style={{ backgroundColor: 'var(--site-bg-alt)' }}>
      <div className="max-w-3xl mx-auto">
        <h2
          className="text-2xl sm:text-3xl font-bold text-center mb-8 sm:mb-12"
          style={{ color: 'var(--site-heading)', fontFamily: 'var(--site-font)' }}
        >
          Questions fréquentes
        </h2>

        <div className="space-y-3 sm:space-y-4">
          {faq.map((item, i) => (
            <details
              key={i}
              className="group border overflow-hidden"
              style={{
                backgroundColor: 'var(--site-card-bg)',
                borderColor: 'var(--site-card-border)',
                borderRadius: 'var(--site-radius)',
              }}
            >
              <summary
                className="flex items-center justify-between cursor-pointer p-4 sm:p-5 text-left font-medium gap-3"
                style={{ color: 'var(--site-heading)' }}
              >
                <span className="text-sm sm:text-base">{item.question}</span>
                <svg
                  className="w-5 h-5 flex-shrink-0 transition-transform group-open:rotate-180"
                  style={{ color: 'var(--site-accent)' }}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              <div className="px-4 sm:px-5 pb-4 sm:pb-5">
                <p className="text-sm leading-relaxed" style={{ color: 'var(--site-text)' }}>
                  {item.answer}
                </p>
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
