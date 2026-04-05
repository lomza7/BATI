'use client';

import Link from 'next/link';
import { ArrowRight, TrendingUp, FileText, HardHat, CreditCard, RefreshCw, Calendar, Mail, BarChart3, CheckCircle2, ShieldCheck } from 'lucide-react';

export function Hero() {
  return (
    <section className="pt-24 sm:pt-32 pb-12 sm:pb-20 bg-[var(--landing-off)]">
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="text-center max-w-3xl mx-auto mb-16 animate-fade-up">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--landing-accent-light)] text-[var(--landing-accent)] text-sm font-medium mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--landing-accent)] animate-pulse" />
            Prêt pour la facture électronique 2026 — Signature illimitée, contrats récurrents
          </div>

          <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-serif leading-[1.1] mb-6 text-[var(--landing-text)]">
            Gérez votre activité BTP,{' '}
            <em className="font-serif italic text-[var(--landing-accent)]">simplement</em>
          </h1>

          <p className="text-base sm:text-lg text-[var(--landing-muted)] mb-8 sm:mb-10 max-w-xl mx-auto leading-relaxed">
            Devis IA vocal, signature électronique, factures, paiements Stripe, contrats récurrents, chantiers, planning, CRM, Gmail, Google Calendar
            &mdash; tout est réuni dans une seule plateforme pensée pour les artisans.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-[var(--landing-accent)] text-white rounded-full font-medium text-sm hover:bg-[#b94800] transition-colors"
            >
              Commencer gratuitement
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="#demo"
              className="inline-flex items-center gap-2 px-8 py-3.5 border border-[var(--landing-border)] text-[var(--landing-text)] rounded-full text-sm hover:bg-[var(--landing-stone)] transition-colors"
            >
              Voir la démo
            </Link>
          </div>

          <p className="text-xs text-[var(--landing-muted)] mt-4">
            Gratuit 30 jours &middot; Sans carte bancaire &middot; Annulation libre
          </p>
        </div>

        <div className="animate-fade-up" style={{ animationDelay: '0.2s' }}>
          <div className="bg-white rounded-2xl border border-[var(--landing-border)] shadow-2xl shadow-black/5 overflow-hidden">
            {/* Browser chrome */}
            <div className="flex items-center gap-2 px-5 py-3 border-b border-[var(--landing-border)] bg-[var(--landing-off)]">
              <div className="flex gap-1.5">
                <span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
                <span className="w-3 h-3 rounded-full bg-[#febc2e]" />
                <span className="w-3 h-3 rounded-full bg-[#28c840]" />
              </div>
              <span className="text-xs text-[var(--landing-muted)] ml-3 font-mono">hellobat.app</span>
              <div className="ml-auto flex items-center gap-2 sm:gap-3">
                <span className="hidden sm:flex items-center gap-1 text-[10px] text-blue-700 font-medium px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200">
                  <ShieldCheck className="w-3 h-3" />
                  Facture électronique 2026
                </span>
                <span className="hidden sm:flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Google connecté
                </span>
              </div>
            </div>

            <div className="p-4 sm:p-6">
              {/* KPI row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
                <KpiCard
                  label="CA encaissé"
                  value="38 400 €"
                  change="+18% vs mois dernier"
                  icon={TrendingUp}
                  positive
                />
                <KpiCard
                  label="MRR Contrats"
                  value="4 200 €"
                  change="12 contrats actifs"
                  icon={RefreshCw}
                  positive
                />
                <KpiCard
                  label="Devis en cours"
                  value="9"
                  change="5 envoyés · 4 brouillons"
                  icon={FileText}
                />
                <KpiCard
                  label="Paiements Stripe"
                  value="26 800 €"
                  change="96% encaissé"
                  icon={CreditCard}
                  positive
                />
              </div>

              {/* Dashboard content grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
                {/* Mini chart */}
                <div className="md:col-span-2 rounded-xl bg-[var(--landing-off)] border border-[var(--landing-border)] p-3 sm:p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-xs font-semibold text-[var(--landing-text)]">Dynamique business</p>
                      <p className="text-[10px] text-[var(--landing-muted)]">Devis, factures et encaissements — cette année</p>
                    </div>
                    <BarChart3 className="w-4 h-4 text-[var(--landing-muted)]" />
                  </div>
                  <div className="flex items-end gap-[3px] h-[60px] sm:h-[80px]">
                    {[28, 35, 42, 38, 55, 48, 62, 58, 72, 68, 85, 92].map((h, i) => (
                      <div key={i} className="flex-1 flex flex-col gap-[2px] items-stretch justify-end h-full">
                        <div className="rounded-sm bg-[var(--landing-accent)]/20" style={{ height: `${h * 0.4}%` }} />
                        <div className="rounded-sm bg-[var(--landing-accent)]/50" style={{ height: `${h * 0.3}%` }} />
                        <div className="rounded-sm bg-[var(--landing-accent)]" style={{ height: `${h}%` }} />
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between mt-2">
                    {['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'].map(m => (
                      <span key={m} className="text-[8px] text-[var(--landing-muted)] flex-1 text-center">{m}</span>
                    ))}
                  </div>
                </div>

                {/* Right column: Integrations + Activity */}
                <div className="space-y-3 sm:space-y-4">
                  {/* Google integrations */}
                  <div className="rounded-xl bg-[var(--landing-off)] border border-[var(--landing-border)] p-3 sm:p-4">
                    <p className="text-xs font-semibold text-[var(--landing-text)] mb-2">Connecté à Google</p>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-md bg-blue-50 flex items-center justify-center">
                          <Calendar className="w-3 h-3 text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-medium text-[var(--landing-text)]">Google Calendar</p>
                          <p className="text-[9px] text-[var(--landing-muted)]">3 RDV aujourd&apos;hui</p>
                        </div>
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-md bg-red-50 flex items-center justify-center">
                          <Mail className="w-3 h-3 text-red-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-medium text-[var(--landing-text)]">Gmail</p>
                          <p className="text-[9px] text-[var(--landing-muted)]">2 non lus</p>
                        </div>
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                      </div>
                    </div>
                  </div>

                  {/* Rappels */}
                  <div className="rounded-xl bg-[var(--landing-off)] border border-[var(--landing-border)] p-3 sm:p-4">
                    <p className="text-xs font-semibold text-[var(--landing-text)] mb-2">Rappels</p>
                    <div className="space-y-1.5">
                      <RappelItem icon={RefreshCw} label="Contrat Dupont — facturation" badge="Demain" color="text-amber-600" />
                      <RappelItem icon={FileText} label="Devis D-2026-042 à relancer" badge="3 jours" color="text-blue-600" />
                      <RappelItem icon={HardHat} label="Chantier Moreau — démarrage" badge="Lundi" color="text-emerald-600" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-8 mt-8 sm:mt-12 text-sm text-[var(--landing-muted)]">
          <span>Utilisé par <strong className="text-[var(--landing-text)]">2 400+</strong> artisans</span>
          <span className="hidden sm:block w-1 h-1 rounded-full bg-[var(--landing-border)]" />
          <span className="flex items-center gap-1">
            <span className="text-amber-500">&#9733;&#9733;&#9733;&#9733;&#9733;</span>
            <strong className="text-[var(--landing-text)]">4.9/5</strong>
          </span>
          <span className="hidden sm:block w-1 h-1 rounded-full bg-[var(--landing-border)]" />
          <span className="flex items-center gap-1.5">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            <strong className="text-[var(--landing-text)]">Google</strong> intégré
          </span>
          <span className="hidden sm:block w-1 h-1 rounded-full bg-[var(--landing-border)]" />
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-blue-600" />
            <strong className="text-[var(--landing-text)]">Facture électronique 2026</strong> prêt
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
    <div className="p-3 sm:p-4 rounded-xl bg-[var(--landing-off)] border border-[var(--landing-border)]">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] sm:text-xs font-medium text-[var(--landing-muted)] uppercase tracking-wide">{label}</span>
        <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[var(--landing-muted)]" />
      </div>
      <div className="text-lg sm:text-2xl font-semibold text-[var(--landing-text)] mb-0.5">{value}</div>
      <div className={`text-[10px] sm:text-xs font-medium ${positive ? 'text-emerald-600' : 'text-[var(--landing-muted)]'}`}>
        {change}
      </div>
    </div>
  );
}

function RappelItem({
  icon: Icon,
  label,
  badge,
  color,
}: {
  icon: React.ElementType;
  label: string;
  badge: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className={`w-3 h-3 ${color} shrink-0`} />
      <span className="text-[10px] text-[var(--landing-text)] truncate flex-1">{label}</span>
      <span className="text-[9px] text-[var(--landing-muted)] shrink-0">{badge}</span>
    </div>
  );
}
