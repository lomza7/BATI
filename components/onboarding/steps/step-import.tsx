'use client';

/**
 * StepImport — onboarding step that asks the user whether they're migrating
 * from another software, and if so opens the ImportModal so they can transfer
 * their clients, devis and factures in one shot.
 *
 * The step is purely a launcher: all the heavy lifting (file parsing, preview,
 * commit) lives in `import-modal.tsx`. We display a small celebration card
 * once the import has succeeded so the user has visual confirmation before
 * moving on.
 */

import { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  SkipForward,
  Upload,
  CheckCircle2,
  Sparkles,
  Users,
  FileText,
  Receipt,
} from 'lucide-react';
import { ImportModal } from '../import-modal';
import type { OnboardingData } from '../onboarding-modal';

interface ImportedCounts {
  clients: number;
  quotes: number;
  invoices: number;
}

interface Props {
  data: OnboardingData;
  onChange: (d: Partial<OnboardingData>) => void;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

export function StepImport({ data, onChange, onNext, onBack, onSkip }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [imported, setImported] = useState<ImportedCounts | null>(
    data.importedCounts || null,
  );

  function handleComplete(counts: {
    clients: { inserted: number; skipped: number };
    quotes: { inserted: number; skipped: number };
    invoices: { inserted: number; skipped: number };
  }) {
    const summary = {
      clients: counts.clients.inserted,
      quotes: counts.quotes.inserted,
      invoices: counts.invoices.inserted,
    };
    setImported(summary);
    onChange({ importedCounts: summary });
  }

  return (
    <div className="flex flex-col flex-1 animate-fade-up">
      <div className="flex items-center gap-3 mb-2">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Upload className="h-5 w-5 text-primary" />
        </div>
      </div>

      <h2 className="text-xl font-semibold text-foreground mt-3">
        Vous venez d&apos;un autre logiciel ?
      </h2>
      <p className="text-sm text-muted-foreground mt-2">
        Importez vos clients, devis et factures en quelques clics — vos
        données sont prêtes en moins d&apos;une minute.
      </p>

      <div className="mt-6 space-y-3 flex-1">
        {!imported && (
          <>
            {/* Visual featuring Constructeur as the primary path */}
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-white border border-primary/20 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    Migrez sans rien perdre
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Constructeur, Excel, Obat, EBP, Sage, Henrri… tout ce qui
                    s&apos;exporte en CSV.
                  </p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <FeatureBadge icon={Users} label="Clients" />
                <FeatureBadge icon={FileText} label="Devis" />
                <FeatureBadge icon={Receipt} label="Factures" />
              </div>
            </div>

            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="w-full h-14 rounded-2xl bg-primary text-primary-foreground font-medium text-sm flex items-center justify-center gap-2 hover:bg-primary/90 transition-all shadow-sm"
            >
              <Upload className="h-4 w-4" />
              Importer mes données
            </button>

            <div className="rounded-xl border border-border bg-muted/20 p-3 flex items-start gap-2.5">
              <div className="h-6 w-6 rounded-full bg-white border border-border flex items-center justify-center flex-shrink-0 text-[10px] font-semibold text-muted-foreground">
                ?
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground">
                  Pas envie de migrer maintenant ?
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Vous pourrez le faire plus tard depuis vos paramètres.
                </p>
              </div>
            </div>
          </>
        )}

        {imported && (
          <div className="animate-fade-up space-y-3">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-white border border-emerald-200 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="h-5 w-5 text-emerald-700" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-emerald-900">
                    Import terminé
                  </p>
                  <p className="text-[11px] text-emerald-800 mt-0.5">
                    Vos données sont disponibles dans votre espace Hellobat.
                  </p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <ImportedStat
                  icon={Users}
                  label="Clients"
                  value={imported.clients}
                />
                <ImportedStat
                  icon={FileText}
                  label="Devis"
                  value={imported.quotes}
                />
                <ImportedStat
                  icon={Receipt}
                  label="Factures"
                  value={imported.invoices}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="w-full h-11 rounded-xl border border-border bg-white text-sm font-medium text-foreground flex items-center justify-center gap-2 hover:bg-muted/40 transition-all"
            >
              <Upload className="h-3.5 w-3.5" />
              Importer un autre fichier
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-6">
        <button
          onClick={onBack}
          className="h-11 px-5 rounded-xl border border-border bg-white text-sm font-medium text-foreground flex items-center gap-2 hover:bg-muted/50 transition-all"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour
        </button>
        <div className="flex items-center gap-2">
          {!imported && (
            <button
              onClick={onSkip}
              className="h-11 px-4 rounded-xl text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5 hover:bg-muted/30 transition-all"
            >
              Passer
              <SkipForward className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={onNext}
            className="h-11 px-6 rounded-xl bg-primary text-primary-foreground font-medium text-sm flex items-center gap-2 hover:bg-primary/90 transition-all"
          >
            Continuer
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <ImportModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onComplete={handleComplete}
      />
    </div>
  );
}

function FeatureBadge({
  icon: Icon,
  label,
}: {
  icon: typeof Users;
  label: string;
}) {
  return (
    <div className="rounded-lg bg-white border border-primary/15 p-2 flex flex-col items-center gap-1">
      <Icon className="h-3.5 w-3.5 text-primary" />
      <p className="text-[10px] font-medium text-foreground">{label}</p>
    </div>
  );
}

function ImportedStat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-lg bg-white border border-emerald-200 p-2 text-center">
      <Icon className="h-3.5 w-3.5 text-emerald-700 mx-auto" />
      <p className="text-base font-semibold text-foreground mt-0.5">{value}</p>
      <p className="text-[9px] text-emerald-800 uppercase tracking-wide">
        {label}
      </p>
    </div>
  );
}
