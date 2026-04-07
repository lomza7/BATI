import { Navbar } from '@/components/landing/navbar';
import { Footer } from '@/components/landing/footer';
import Link from 'next/link';
import { Newspaper, HardHat, ArrowRight } from 'lucide-react';

export const metadata = {
  title: 'Presse — Hellobat',
};

export default function PressePage() {
  return (
    <div className="min-h-screen bg-[var(--landing-white)]">
      <Navbar />

      <main className="pt-28 pb-16 sm:pt-36 sm:pb-24">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[var(--landing-off)] flex items-center justify-center mx-auto mb-6">
            <Newspaper className="w-7 h-7 text-[var(--landing-muted)]" />
          </div>

          <h1 className="text-3xl sm:text-4xl font-serif text-[var(--landing-text)] mb-4">
            Espace presse
          </h1>

          <div className="rounded-2xl border border-[var(--landing-border)] bg-[var(--landing-off)] p-8 sm:p-12 mb-8">
            <div className="w-14 h-14 rounded-full bg-[var(--landing-accent-light)] flex items-center justify-center mx-auto mb-5">
              <HardHat className="w-6 h-6 text-[var(--landing-accent)]" />
            </div>
            <h2 className="text-xl sm:text-2xl font-serif text-[var(--landing-text)] mb-3">
              Pas encore d&apos;articles dans la presse
            </h2>
            <p className="text-sm sm:text-base text-[var(--landing-muted)] leading-relaxed max-w-md mx-auto mb-2">
              On n&apos;est pas très papier chez Hellobat — on préfère la réalité
              terrain, les chantiers et le béton frais.
            </p>
            <p className="text-sm text-[var(--landing-muted)] leading-relaxed max-w-md mx-auto">
              Mais si vous êtes journaliste et que le monde du bâtiment et de
              l&apos;IA vous intéresse, on adore raconter notre histoire autour d&apos;un café.
            </p>
          </div>

          <div className="space-y-3 text-sm text-[var(--landing-muted)]">
            <p>
              <strong className="text-[var(--landing-text)]">Contact presse :</strong>{' '}
              <a href="mailto:contact@hellobat.app" className="text-[var(--landing-accent)] hover:underline">
                contact@hellobat.app
              </a>
            </p>
            <p>
              Kit média (logo, captures d&apos;écran, informations) disponible sur demande.
            </p>
          </div>

          <div className="mt-10 flex flex-col sm:flex-row justify-center gap-4">
            <Link
              href="/a-propos"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-[var(--landing-accent)] text-white font-medium hover:bg-[#b94800] transition-colors"
            >
              Découvrir notre histoire
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center px-6 py-3 rounded-full bg-[var(--landing-stone)] text-[var(--landing-text)] font-medium hover:bg-[var(--landing-border)] transition-colors"
            >
              Nous contacter
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
