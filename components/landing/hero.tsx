'use client';

import Link from 'next/link';
import { ArrowRight, TrendingUp, FileText, HardHat, CreditCard } from 'lucide-react';

export function Hero() {
  return (
    <section className="pt-32 pb-20 bg-[var(--landing-off)]">
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="text-center max-w-3xl mx-auto mb-16 animate-fade-up">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--landing-accent-light)] text-[var(--landing-accent)] text-sm font-medium mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--landing-accent)]" />
            Nouveau : Agents IA integres
          </div>

          <h1 className="text-5xl md:text-6xl lg:text-7xl font-serif leading-[1.1] mb-6 text-[var(--landing-text)]">
            Gerez votre activite BTP,{' '}
            <em className="font-serif italic text-[var(--landing-accent)]">simplement</em>
          </h1>

          <p className="text-lg text-[var(--landing-muted)] mb-10 max-w-xl mx-auto leading-relaxed">
            Devis, factures, chantiers, planning, prospection, site web, comptabilite
            &mdash; tout est reuni dans une seule plateforme pensee pour les artisans.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-[var(--landing-accent)] text-white rounded-full font-medium text-sm hover:bg-[#b94800] transition-colors"
            >
              Commencer gratuitement
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="#demo"
              className="inline-flex items-center gap-2 px-8 py-3.5 border border-[var(--landing-border)] text-[var(--landing-text)] rounded-full text-sm hover:bg-[var(--landing-stone)] transition-colors"
            >
              Voir la demo
            </Link>
          </div>

          <p className="text-xs text-[var(--landing-muted)] mt-4">
            Gratuit 30 jours &middot; Sans carte bancaire &middot; Annulation libre
          </p>
        </div>

        <div className="animate-fade-up" style={{ animationDelay: '0.2s' }}>
          <div className="bg-white rounded-2xl border border-[var(--landing-border)] shadow-2xl shadow-black/5 overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-[var(--landing-border)] bg-[var(--landing-off)]">
              <div className="flex gap-1.5">
                <span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
                <span className="w-3 h-3 rounded-full bg-[#febc2e]" />
                <span className="w-3 h-3 rounded-full bg-[#28c840]" />
              </div>
              <span className="text-xs text-[var(--landing-muted)] ml-3 font-mono">app.batiflow.fr</span>
            </div>

            <div className="p-8 grid grid-cols-1 md:grid-cols-4 gap-6">
              <KpiCard
                label="CA ce mois"
                value="24 800 EUR"
                change="+12%"
                icon={TrendingUp}
                positive
              />
              <KpiCard
                label="Devis en cours"
                value="7"
                change="3 a signer"
                icon={FileText}
              />
              <KpiCard
                label="Chantiers actifs"
                value="4"
                change="2 cette semaine"
                icon={HardHat}
              />
              <KpiCard
                label="Paiements"
                value="18 200 EUR"
                change="92% encaisse"
                icon={CreditCard}
                positive
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-8 mt-12 text-sm text-[var(--landing-muted)]">
          <span>Utilise par <strong className="text-[var(--landing-text)]">2 400+</strong> artisans</span>
          <span className="w-1 h-1 rounded-full bg-[var(--landing-border)]" />
          <span className="flex items-center gap-1">
            <span className="text-amber-500">&#9733;&#9733;&#9733;&#9733;&#9733;</span>
            <strong className="text-[var(--landing-text)]">4.9/5</strong>
          </span>
        </div>
      </div>
    </section>
  );
}

function KpiCard({
  label,
  value,
  change,
  icon: Icon,
  positive,
}: {
  label: string;
  value: string;
  change: string;
  icon: React.ElementType;
  positive?: boolean;
}) {
  return (
    <div className="p-5 rounded-xl bg-[var(--landing-off)] border border-[var(--landing-border)]">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-[var(--landing-muted)] uppercase tracking-wide">{label}</span>
        <Icon className="w-4 h-4 text-[var(--landing-muted)]" />
      </div>
      <div className="text-2xl font-semibold text-[var(--landing-text)] mb-1">{value}</div>
      <div className={`text-xs font-medium ${positive ? 'text-emerald-600' : 'text-[var(--landing-muted)]'}`}>
        {change}
      </div>
    </div>
  );
}
