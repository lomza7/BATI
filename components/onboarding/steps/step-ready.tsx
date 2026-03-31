'use client';

import { ArrowLeft, Rocket, Loader as Loader2, Check } from 'lucide-react';
import type { OnboardingData } from '../onboarding-modal';

interface Props {
  data: OnboardingData;
  onBack: () => void;
  onFinish: () => void;
  saving: boolean;
}

const summaryLabels: Record<string, string> = {
  google: 'Recherche Google',
  social: 'Reseaux sociaux',
  bouche_a_oreille: 'Bouche a oreille',
  pub: 'Publicite en ligne',
  salon: 'Salon / Evenement pro',
  youtube: 'YouTube',
  presse: 'Article / Blog',
  autre: 'Autre',
};

export function StepReady({ data, onBack, onFinish, saving }: Props) {
  const firstName = data.fullName.split(' ')[0] || 'vous';

  return (
    <div className="flex flex-col flex-1 animate-fade-up">
      <div className="flex items-center gap-3 mb-2">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Rocket className="h-5 w-5 text-primary" />
        </div>
      </div>

      <h2 className="text-xl font-semibold text-foreground mt-3">
        Tout est pret, {firstName} !
      </h2>
      <p className="text-sm text-muted-foreground mt-2">
        Voici un recapitulatif de vos informations.
      </p>

      <div className="mt-6 flex-1 space-y-3 max-h-[300px] overflow-y-auto pr-1">
        <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
          {data.fullName && <SummaryRow label="Nom" value={data.fullName} />}
          {data.companyName && <SummaryRow label="Entreprise" value={data.companyName} />}
          {data.siren && <SummaryRow label="SIREN" value={data.siren} />}
          {data.siret && <SummaryRow label="SIRET" value={data.siret} />}
          {data.legalForm && <SummaryRow label="Forme juridique" value={data.legalForm} />}
          {data.companyActivity && <SummaryRow label="Activite" value={data.companyActivity} />}
          {data.nafLabel && <SummaryRow label="Code NAF" value={`${data.nafCode} — ${data.nafLabel}`} />}
          {data.tvaNumber && <SummaryRow label="N° TVA" value={data.tvaNumber} />}
          {(data.companyAddress || data.companyCity) && (
            <SummaryRow label="Adresse" value={[data.companyAddress, data.companyPostalCode, data.companyCity].filter(Boolean).join(', ')} />
          )}
          {data.companyPhone && <SummaryRow label="Telephone" value={data.companyPhone} />}
          {data.companyWebsite && <SummaryRow label="Site web" value={data.companyWebsite} />}
          <SummaryRow label="Equipe" value={teamSizeLabel(data.teamSize)} />
          {data.teamMembers.filter((m) => m.name.trim()).length > 0 && (
            <SummaryRow
              label="Membres"
              value={data.teamMembers
                .filter((m) => m.name.trim())
                .map((m) => m.role ? `${m.name} (${m.role})` : m.name)
                .join(', ')}
            />
          )}
          {data.referralSource && (
            <SummaryRow
              label="Source"
              value={summaryLabels[data.referralSource] || data.referralSource}
            />
          )}
        </div>

        <div className="flex items-start gap-3 rounded-xl bg-primary/5 border border-primary/10 p-4">
          <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
          <p className="text-sm text-foreground leading-relaxed">
            Vous pourrez modifier toutes ces informations plus tard dans les parametres de votre compte.
          </p>
        </div>
      </div>

      <div className="flex justify-between mt-6">
        <button
          onClick={onBack}
          disabled={saving}
          className="h-11 px-5 rounded-xl border border-border bg-white text-sm font-medium text-foreground flex items-center gap-2 hover:bg-muted/50 disabled:opacity-50 transition-all"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour
        </button>
        <button
          onClick={onFinish}
          disabled={saving}
          className="h-11 px-7 rounded-xl bg-primary text-primary-foreground font-medium text-sm flex items-center gap-2 hover:bg-primary/90 disabled:opacity-70 disabled:cursor-not-allowed transition-all"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Sauvegarde...
            </>
          ) : (
            <>
              <Rocket className="h-4 w-4" />
              Acceder a mon espace
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-xs text-muted-foreground flex-shrink-0">{label}</span>
      <span className="text-sm text-foreground text-right font-medium">{value}</span>
    </div>
  );
}

function teamSizeLabel(size: string) {
  const labels: Record<string, string> = {
    seul: 'Travailleur independant',
    '2-5': '2 a 5 personnes',
    '6-10': '6 a 10 personnes',
    '10+': 'Plus de 10 personnes',
  };
  return labels[size] || size;
}
