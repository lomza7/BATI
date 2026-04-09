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
  title: 'Logiciel du bâtiment tout-en-un pour artisans — Hellobat',
  description:
    'Hellobat réunit devis IA vocal, facture électronique 2026, gestion chantiers, planning et CRM. Plus de 2 400 artisans nous font confiance, noté 4.9/5. Essai gratuit 30 jours.',
  alternates: {
    canonical: 'https://hellobat.app/',
  },
  openGraph: {
    type: 'website',
    url: 'https://hellobat.app/',
    siteName: 'Hellobat',
    title: 'Logiciel du bâtiment tout-en-un pour artisans — Hellobat',
    description:
      'Hellobat réunit devis IA vocal, facture électronique 2026, gestion chantiers, planning et CRM. Plus de 2 400 artisans nous font confiance, noté 4.9/5. Essai gratuit 30 jours.',
    locale: 'fr_FR',
    // OG image inherited from app/opengraph-image.tsx
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
