import { Fragment } from 'react';
import Link from 'next/link';
import { Check, X, ArrowRight } from 'lucide-react';
import { Navbar } from '@/components/landing/navbar';
import { Footer } from '@/components/landing/footer';
import { Pricing } from '@/components/landing/pricing';
import { CTA } from '@/components/landing/cta';

export const metadata = {
  title: 'Tarifs — Hellobat, logiciel de gestion pour les artisans du bâtiment',
  description:
    'Découvrez les tarifs Hellobat : plan Gratuit à vie et plan Pro à 16,25 € HT/mois. Essai 30 jours sans engagement. Comparatif complet des fonctionnalités : devis IA, facturation, chantiers, comptabilité automatisée.',
  alternates: { canonical: 'https://hellobat.app/tarifs' },
  openGraph: {
    title: 'Tarifs Hellobat — Gratuit ou Pro à 16,25 € HT / mois',
    description:
      'Comparez nos deux formules pour les artisans du bâtiment. Essai gratuit 30 jours, sans engagement, résiliable à tout moment.',
    url: 'https://hellobat.app/tarifs',
    type: 'website',
  },
};

type Row = {
  label: string;
  free: boolean | string;
  pro: boolean | string;
};

type Section = {
  title: string;
  rows: Row[];
};

const SECTIONS: Section[] = [
  {
    title: 'Devis, factures & documents',
    rows: [
      { label: 'Devis illimités', free: '5 / mois', pro: true },
      { label: 'Factures illimitées', free: '5 / mois', pro: true },
      { label: 'Conformité facture électronique 2026', free: true, pro: true },
      { label: 'Signature électronique des devis', free: true, pro: true },
      { label: 'Drive documents — tous vos papiers au même endroit', free: true, pro: true },
      { label: 'Bibliothèque de prestations et prix', free: true, pro: true },
    ],
  },
  {
    title: 'Paiements & encaissement',
    rows: [
      { label: 'Paiement en ligne des devis et factures par vos clients', free: true, pro: true },
      { label: 'HelloPay — encaissement sur chantier (QR + carte bancaire)', free: true, pro: true },
      { label: 'Relances automatiques des impayés', free: false, pro: true },
    ],
  },
  {
    title: 'Intelligence artificielle',
    rows: [
      { label: 'Devis dictés à la voix, rédigés par l’IA', free: '3 / mois', pro: true },
      { label: 'Comptabilité automatisée : scan des factures fournisseurs', free: false, pro: true },
      {
        label: 'Assistants IA experts du bâtiment (DTU, chiffrage, juridique, RGE/CEE)',
        free: false,
        pro: true,
      },
      { label: 'Photos avant/après générées par l’IA', free: false, pro: true },
      { label: 'Réponses aux emails clients assistées par IA', free: false, pro: true },
      { label: 'Site web professionnel généré par l’IA', free: false, pro: true },
    ],
  },
  {
    title: 'Chantiers & terrain',
    rows: [
      { label: 'Chantiers illimités avec photos et géolocalisation', free: true, pro: true },
      { label: 'Carte interactive de tous vos chantiers', free: false, pro: true },
      { label: 'Planning équipe (drag & drop, vue semaine/mois)', free: false, pro: true },
      { label: 'Gestion des équipes et sous-traitants', free: false, pro: true },
    ],
  },
  {
    title: 'Commercial & clients',
    rows: [
      { label: 'Contacts clients, prospects et prestataires', free: true, pro: true },
      { label: 'Catalogues produits à partager avec vos clients', free: false, pro: true },
      { label: 'Prospection et pipeline commercial (CRM)', free: false, pro: true },
      { label: 'Contrats d’entretien récurrents', free: false, pro: true },
    ],
  },
  {
    title: 'Communication & visibilité',
    rows: [
      { label: 'Connexion à votre Gmail — gérez vos emails dans Hellobat', free: true, pro: true },
      { label: 'Demandes d’avis Google My Business', free: true, pro: true },
      { label: 'Synchronisation Google Calendar', free: true, pro: true },
    ],
  },
  {
    title: 'Support',
    rows: [
      { label: 'Support par email', free: true, pro: true },
      { label: 'Support prioritaire', free: false, pro: true },
      { label: 'Essai gratuit 30 jours sans carte bancaire', free: true, pro: true },
    ],
  },
];

const FAQ_ITEMS = [
  {
    q: 'Comment fonctionne l’essai gratuit de 30 jours ?',
    a: 'À l’inscription, vous accédez immédiatement à toutes les fonctionnalités du plan Pro pendant 30 jours, sans carte bancaire. À la fin de l’essai, si vous ne passez pas au plan Pro, vous basculez automatiquement sur le plan Gratuit à vie.',
  },
  {
    q: 'Puis-je annuler mon abonnement Pro à tout moment ?',
    a: 'Oui. L’abonnement Pro est sans engagement. Vous pouvez le résilier en un clic depuis votre espace. Vos données restent accessibles sur le plan Gratuit.',
  },
  {
    q: 'Les prix affichés sont-ils HT ou TTC ?',
    a: 'Par défaut les prix sont affichés HT (hors TVA 20 %). Vous pouvez basculer l’affichage en TTC à tout moment sur la page de tarification.',
  },
  {
    q: 'Existe-t-il une réduction pour le paiement à l’année ?',
    a: 'Oui. Le plan Pro annuel est à 162,50 € HT au lieu de 195 € HT — soit 2 mois offerts par rapport au mensuel.',
  },
  {
    q: 'Hellobat est-il conforme à la facturation électronique 2026 ?',
    a: 'Oui. Hellobat est conçu pour respecter les obligations de facturation électronique qui entrent en vigueur en France en 2026.',
  },
];

export default function TarifsPage() {
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_ITEMS.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };

  return (
    <div className="min-h-screen bg-[var(--landing-bg)] text-[var(--landing-text)]">
      <Navbar />

      <main>
        {/* Hero */}
        <section className="pt-28 pb-8 sm:pt-32 sm:pb-12">
          <div className="max-w-[1100px] mx-auto px-6 text-center">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-serif leading-tight">
              Des tarifs{' '}
              <em className="italic text-[var(--landing-accent)]">simples</em> et transparents
            </h1>
            <p className="mt-5 text-lg text-[var(--landing-muted)] max-w-2xl mx-auto">
              Un plan Gratuit à vie pour démarrer, un plan Pro à 16,25 € HT par mois pour tout
              débloquer. Essai gratuit 30 jours, sans carte bancaire, sans engagement.
            </p>
          </div>
        </section>

        {/* Pricing cards (composant existant avec toggles mensuel/annuel + TTC/HT) */}
        <Pricing />

        {/* Tableau comparatif */}
        <section className="py-16 sm:py-20 bg-white">
          <div className="max-w-[1100px] mx-auto px-6">
            <div className="text-center mb-10">
              <h2 className="text-3xl sm:text-4xl font-serif">
                Comparatif <em className="italic text-[var(--landing-accent)]">détaillé</em>
              </h2>
              <p className="mt-3 text-[var(--landing-muted)]">
                Toutes les fonctionnalités, plan par plan.
              </p>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-[var(--landing-border)]">
              <table className="w-full text-sm">
                <thead className="bg-[var(--landing-off)]">
                  <tr>
                    <th className="text-left p-4 font-medium">Fonctionnalité</th>
                    <th className="p-4 font-medium text-center w-32">Gratuit</th>
                    <th className="p-4 font-medium text-center w-32 bg-[var(--landing-accent)]/5 text-[var(--landing-accent)]">
                      Pro
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {SECTIONS.map((section) => (
                    <Fragment key={section.title}>
                      <tr className="bg-[var(--landing-stone)]/50">
                        <td colSpan={3} className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--landing-muted)]">
                          {section.title}
                        </td>
                      </tr>
                      {section.rows.map((row) => (
                        <tr
                          key={`${section.title}-${row.label}`}
                          className="border-t border-[var(--landing-border)]"
                        >
                          <td className="p-4">{row.label}</td>
                          <td className="p-4 text-center">
                            {typeof row.free === 'boolean' ? (
                              row.free ? (
                                <Check className="w-5 h-5 text-emerald-600 mx-auto" aria-label="Inclus" />
                              ) : (
                                <X className="w-5 h-5 text-[var(--landing-muted)]/50 mx-auto" aria-label="Non inclus" />
                              )
                            ) : (
                              <span className="text-xs text-[var(--landing-muted)]">{row.free}</span>
                            )}
                          </td>
                          <td className="p-4 text-center bg-[var(--landing-accent)]/5">
                            {typeof row.pro === 'boolean' ? (
                              row.pro ? (
                                <Check className="w-5 h-5 text-[var(--landing-accent)] mx-auto" aria-label="Inclus" />
                              ) : (
                                <X className="w-5 h-5 text-[var(--landing-muted)]/50 mx-auto" aria-label="Non inclus" />
                              )
                            ) : (
                              <span className="text-xs text-[var(--landing-accent)] font-medium">
                                {row.pro}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-10 text-center">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 bg-[var(--landing-accent)] text-white px-6 py-3 rounded-full font-medium hover:bg-[#b94800] transition-colors"
              >
                Commencer mon essai gratuit 30 jours <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-16 sm:py-20 bg-[var(--landing-off)]">
          <div className="max-w-[800px] mx-auto px-6">
            <h2 className="text-3xl sm:text-4xl font-serif text-center mb-10">
              Questions <em className="italic text-[var(--landing-accent)]">fréquentes</em>
            </h2>
            <div className="space-y-4">
              {FAQ_ITEMS.map((item) => (
                <details
                  key={item.q}
                  className="group rounded-xl border border-[var(--landing-border)] bg-white p-5"
                >
                  <summary className="cursor-pointer font-medium text-[var(--landing-text)] list-none flex items-start justify-between gap-4">
                    <span>{item.q}</span>
                    <span className="text-[var(--landing-accent)] transition-transform group-open:rotate-45 shrink-0">
                      +
                    </span>
                  </summary>
                  <p className="mt-3 text-sm text-[var(--landing-muted)] leading-relaxed">
                    {item.a}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <CTA />
      </main>

      <Footer />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
    </div>
  );
}
