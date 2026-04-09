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

export const metadata: Metadata = {
  title: 'Hellobat — Logiciel du bâtiment tout-en-un, boosté par l\'IA',
  description:
    'Fini la paperasse. Devis IA vocal, facture électronique 2026, chantiers, planning, CRM, paiements — tout le bâtiment dans une seule app pensée pour les artisans. Essai 30 jours, sans carte bancaire.',
  alternates: {
    canonical: 'https://hellobat.app/',
  },
  openGraph: {
    type: 'website',
    url: 'https://hellobat.app/',
    siteName: 'Hellobat',
    title: 'Hellobat — Logiciel du bâtiment tout-en-un, boosté par l\'IA',
    description:
      'Fini la paperasse. Devis IA vocal, facture électronique 2026, chantiers, planning, CRM, paiements — tout le bâtiment dans une seule app pensée pour les artisans. Essai 30 jours, sans carte bancaire.',
    locale: 'fr_FR',
    // OG image inherited from app/opengraph-image.tsx
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hellobat — Logiciel du bâtiment tout-en-un, boosté par l\'IA',
    description:
      'Fini la paperasse. Devis IA vocal, facture électronique 2026, chantiers, planning, CRM, paiements — tout le bâtiment dans une seule app pensée pour les artisans. Essai 30 jours, sans carte bancaire.',
  },
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[var(--landing-off)]">
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
