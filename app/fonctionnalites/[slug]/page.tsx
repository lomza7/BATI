import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Check, Sparkles } from 'lucide-react';
import { Navbar } from '@/components/landing/navbar';
import { Footer } from '@/components/landing/footer';
import { CTA } from '@/components/landing/cta';
import { getFeatureBySlug, getAllFeatureSlugs } from '@/lib/feature-details';

export function generateStaticParams() {
  return getAllFeatureSlugs().map((slug) => ({ slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  const feature = getFeatureBySlug(params.slug);
  if (!feature) return {};
  return {
    title: `${feature.title} — Hellobat`,
    description: feature.heroDescription,
  };
}

const PLAN_LABELS: Record<string, { label: string; color: string }> = {
  starter: { label: 'Inclus dans Starter (gratuit)', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  pro: { label: 'Inclus des le plan Pro', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  business: { label: 'Inclus dans le plan Business', color: 'bg-purple-50 text-purple-700 border-purple-200' },
};

export default function FeatureDetailPage({ params }: { params: { slug: string } }) {
  const feature = getFeatureBySlug(params.slug);
  if (!feature) notFound();

  const planInfo = PLAN_LABELS[feature.plan];

  return (
    <div className="min-h-screen bg-[var(--landing-off)]">
      <Navbar />

      <section className="pt-28 pb-16 sm:pt-36 sm:pb-24 bg-[var(--landing-white)]">
        <div className="max-w-3xl mx-auto px-6">
          <Link
            href="/#features"
            className="inline-flex items-center gap-2 text-sm text-[var(--landing-muted)] hover:text-[var(--landing-accent)] transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            Toutes les fonctionnalites
          </Link>

          <div className="flex flex-wrap items-center gap-3 mb-4">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-medium ${planInfo.color}`}>
              <Sparkles className="w-3 h-3" />
              {planInfo.label}
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif text-[var(--landing-text)] mb-3">
            {feature.title}
          </h1>
          <p className="text-lg sm:text-xl text-[var(--landing-accent)] font-medium mb-6">
            {feature.subtitle}
          </p>
          <p className="text-[var(--landing-muted)] text-lg leading-relaxed">
            {feature.heroDescription}
          </p>
        </div>
      </section>

      <section className="py-12 sm:py-20 bg-[var(--landing-off)]">
        <div className="max-w-3xl mx-auto px-6">
          <div className="grid gap-3 sm:grid-cols-2 mb-16">
            {feature.highlights.map((h) => (
              <div key={h} className="flex items-start gap-3 rounded-xl border border-[var(--landing-border)] bg-white p-4">
                <Check className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <span className="text-sm text-[var(--landing-text)]">{h}</span>
              </div>
            ))}
          </div>

          <div className="space-y-12">
            {feature.sections.map((section, i) => (
              <div key={i}>
                <h2 className="text-xl sm:text-2xl font-serif text-[var(--landing-text)] mb-4">
                  {section.title}
                </h2>
                <p className="text-[var(--landing-muted)] leading-relaxed">
                  {section.content}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-12 bg-[var(--landing-white)]">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-2xl sm:text-3xl font-serif text-[var(--landing-text)] mb-4">
            Pret a essayer ?
          </h2>
          <p className="text-[var(--landing-muted)] mb-8">
            Creez votre compte gratuitement et testez toutes les fonctionnalites.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center px-6 py-3 rounded-full bg-[var(--landing-accent)] text-white font-medium hover:bg-[#b94800] transition-colors"
            >
              Commencer gratuitement
            </Link>
            <Link
              href="/#pricing"
              className="inline-flex items-center justify-center px-6 py-3 rounded-full bg-[var(--landing-stone)] text-[var(--landing-text)] font-medium hover:bg-[var(--landing-border)] transition-colors"
            >
              Voir les tarifs
            </Link>
          </div>
        </div>
      </section>

      <CTA />
      <Footer />
    </div>
  );
}
