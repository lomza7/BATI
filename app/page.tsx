import type { Metadata } from 'next';
import { Navbar } from '@/components/landing/navbar';
import { Hero } from '@/components/landing/hero';
import { Marquee } from '@/components/landing/marquee';
import { FeaturesGrid } from '@/components/landing/features-grid';
import {
  DevisSection,
  FactureElectroniqueSection,
  ContactsSection,
  PlanningSection,
  EquipeSection,
  CataloguesSection,
  SiteWebSection,
  ProspectionSection,
  EmailSection,
  ComptaSection,
  AvisSection,
  PlansSection,
  CarteSection,
  PaiementSection,
  AbonnementsSection,
  AgentsSection,
} from '@/components/landing/feature-sections';
import { DemoApp } from '@/components/landing/demo-app';
import { Pricing } from '@/components/landing/pricing';
import { Testimonials } from '@/components/landing/testimonials';
import { FAQ } from '@/components/landing/faq';
import { CTA } from '@/components/landing/cta';
import { Footer } from '@/components/landing/footer';
import { StandaloneRedirect } from '@/components/landing/standalone-redirect';

export const metadata: Metadata = {
  title: 'Hellobat — Jusqu\'à 10h gagnées par semaine grâce à l\'IA | Logiciel bâtiment',
  description:
    'Jusqu\'à 10h gagnées chaque semaine. Site web offert, devis IA vocal, compta auto (facture 2026), paiement et signature en ligne, Gmail, CRM, planning et chantiers — tout le bâtiment dans une seule app. Essai 30 jours, sans carte.',
  alternates: {
    canonical: 'https://hellobat.app/',
  },
  openGraph: {
    type: 'website',
    url: 'https://hellobat.app/',
    siteName: 'Hellobat',
    title: 'Hellobat — Jusqu\'à 10h gagnées par semaine grâce à l\'IA',
    description:
      'Jusqu\'à 10h gagnées chaque semaine. Site web offert, devis IA vocal, compta auto (facture 2026), paiement et signature en ligne, Gmail, CRM, planning et chantiers — tout le bâtiment dans une seule app. Essai 30 jours, sans carte.',
    locale: 'fr_FR',
    // OG image inherited from app/opengraph-image.tsx
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hellobat — Jusqu\'à 10h gagnées par semaine grâce à l\'IA',
    description:
      'Jusqu\'à 10h gagnées chaque semaine. Site web offert, devis IA vocal, compta auto (facture 2026), paiement et signature en ligne, Gmail, CRM, planning et chantiers — tout le bâtiment dans une seule app. Essai 30 jours, sans carte.',
  },
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[var(--landing-off)]">
      <StandaloneRedirect />
      <Navbar />
      <Hero />
      <Marquee />
      <FeaturesGrid />
      <DemoApp />
      <DevisSection />
      <FactureElectroniqueSection />
      <ContactsSection />
      <PlanningSection />
      <EquipeSection />
      <CarteSection />
      <CataloguesSection />
      <SiteWebSection />
      <ProspectionSection />
      <EmailSection />
      <ComptaSection />
      <AvisSection />
      <PlansSection />
      <PaiementSection />
      <AbonnementsSection />
      <AgentsSection />
      <Pricing />
      <Testimonials />
      <FAQ />
      <CTA />
      <Footer />
    </div>
  );
}
