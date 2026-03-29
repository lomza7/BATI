'use client';

import { Euro, FileText, TrendingUp } from 'lucide-react';
import { KpiCard } from '@/components/dashboard/kpi-card';

export default function DashboardPage() {
  return (
    <div className="space-y-5 sm:space-y-8">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
          Tableau de bord
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Vue d&apos;ensemble de votre activite
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          title="CA ce mois"
          value="42 800 €"
          subtitle="vs 38 200 € le mois dernier"
          trend={{ value: '+12%', positive: true }}
          icon={Euro}
        />
        <KpiCard
          title="Devis en attente"
          value="8"
          subtitle="3 a relancer"
          icon={FileText}
        />
        <KpiCard
          title="Taux d'acceptation"
          value="74%"
          subtitle="Sur les 30 derniers jours"
          trend={{ value: '+5 pts', positive: true }}
          icon={TrendingUp}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
          <h2 className="text-base font-semibold text-foreground">Activite recente</h2>
          <p className="mt-1 text-sm text-muted-foreground">Derniers evenements</p>
          <div className="mt-6 space-y-4">
            {[
              { label: 'Devis #D-2024-042 envoye', time: 'Il y a 2h', color: 'bg-blue-500' },
              { label: 'Facture #F-2024-018 payee', time: 'Il y a 5h', color: 'bg-emerald-500' },
              { label: 'Nouveau chantier cree', time: 'Hier', color: 'bg-primary' },
              { label: 'Devis #D-2024-041 accepte', time: 'Hier', color: 'bg-emerald-500' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className={`h-2 w-2 rounded-full ${item.color}`} />
                <p className="flex-1 text-sm text-foreground">{item.label}</p>
                <span className="text-xs text-muted-foreground">{item.time}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
          <h2 className="text-base font-semibold text-foreground">Prochaines echeances</h2>
          <p className="mt-1 text-sm text-muted-foreground">Cette semaine</p>
          <div className="mt-6 space-y-4">
            {[
              { label: 'Renovation Dupont', date: 'Lun 1 Avr', status: 'En cours' },
              { label: 'Cuisine Martin', date: 'Mar 2 Avr', status: 'A planifier' },
              { label: 'SdB Leroy', date: 'Jeu 4 Avr', status: 'En cours' },
              { label: 'Terrasse Bernard', date: 'Ven 5 Avr', status: 'Devis envoye' },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-xs font-medium text-muted-foreground">
                    {item.date.split(' ')[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.date}</p>
                  </div>
                </div>
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
