import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export function CTA() {
  return (
    <section className="py-20 bg-[var(--landing-text)]">
      <div className="max-w-[800px] mx-auto px-6 text-center">
        <h2 className="text-3xl md:text-4xl font-serif text-white mb-4">
          Pret a simplifier votre gestion ?
        </h2>
        <p className="text-[#a0a0a0] mb-8 max-w-md mx-auto">
          Rejoignez 2 400+ artisans qui gerent leur activite plus efficacement avec BatiFlow.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-[var(--landing-accent)] text-white rounded-full font-medium text-sm hover:bg-[#b94800] transition-colors"
          >
            Essai gratuit 30 jours
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="#demo"
            className="inline-flex items-center gap-2 px-8 py-3.5 border border-[#333] text-white rounded-full text-sm hover:bg-white/5 transition-colors"
          >
            Voir la demo
          </Link>
        </div>
      </div>
    </section>
  );
}
