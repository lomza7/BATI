import { Navbar } from '@/components/landing/navbar';
import { Hero } from '@/components/landing/hero';
import { Marquee } from '@/components/landing/marquee';
import { FeaturesGrid } from '@/components/landing/features-grid';
import {
  DevisSection,
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

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[var(--landing-off)]">
      <Navbar />
      <Hero />
      <Marquee />
      <FeaturesGrid />
      <DemoApp />
      <DevisSection />
      <SiteWebSection />
      <ProspectionSection />
      <EmailSection />
      <ComptaSection />
      <AvisSection />
      <PlansSection />
      <CarteSection />
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
