'use client';

import { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { StepWelcome } from './steps/step-welcome';
import { StepCompany } from './steps/step-company';
import { StepTeam } from './steps/step-team';
import { StepReferral } from './steps/step-referral';
import { StepReady } from './steps/step-ready';
import { supabase } from '@/lib/supabase';

export interface OnboardingData {
  fullName: string;
  companyName: string;
  companyActivity: string;
  companyCity: string;
  companyPhone: string;
  teamSize: string;
  teamMembers: { name: string; role: string }[];
  referralSource: string;
  // Pappers data
  siren: string;
  siret: string;
  legalForm: string;
  nafCode: string;
  nafLabel: string;
  capital: number | null;
  tvaNumber: string;
  companyAddress: string;
  companyPostalCode: string;
  companyWebsite: string;
  rcs: string;
}

const TOTAL_STEPS = 5;

interface OnboardingModalProps {
  open: boolean;
  userId: string;
  onComplete: () => void;
}

export function OnboardingModal({ open, userId, onComplete }: OnboardingModalProps) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<OnboardingData>({
    fullName: '',
    companyName: '',
    companyActivity: '',
    companyCity: '',
    companyPhone: '',
    teamSize: 'seul',
    teamMembers: [],
    referralSource: '',
    siren: '',
    siret: '',
    legalForm: '',
    nafCode: '',
    nafLabel: '',
    capital: null,
    tvaNumber: '',
    companyAddress: '',
    companyPostalCode: '',
    companyWebsite: '',
    rcs: '',
  });

  const updateData = useCallback((partial: Partial<OnboardingData>) => {
    setData((prev) => ({ ...prev, ...partial }));
  }, []);

  const next = useCallback(() => {
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  }, []);

  const back = useCallback(() => {
    setStep((s) => Math.max(s - 1, 0));
  }, []);

  const skip = useCallback(() => {
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  }, []);

  const finish = useCallback(async () => {
    setSaving(true);

    await supabase
      .from('profiles')
      .update({
        full_name: data.fullName,
        company_name: data.companyName,
        company_activity: data.companyActivity,
        company_city: data.companyCity,
        company_phone: data.companyPhone,
        team_size: data.teamSize,
        referral_source: data.referralSource,
        siren: data.siren,
        siret: data.siret,
        legal_form: data.legalForm,
        naf_code: data.nafCode,
        naf_label: data.nafLabel,
        capital: data.capital,
        tva_number: data.tvaNumber,
        company_address: data.companyAddress,
        company_postal_code: data.companyPostalCode,
        company_website: data.companyWebsite,
        rcs: data.rcs,
        onboarding_completed: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (data.teamMembers.length > 0) {
      const members = data.teamMembers
        .filter((m) => m.name.trim())
        .map((m) => ({
          profile_id: userId,
          name: m.name,
          role: m.role,
        }));

      if (members.length > 0) {
        await supabase.from('onboarding_team_members').insert(members);
      }
    }

    setSaving(false);
    onComplete();
  }, [data, userId, onComplete]);

  const progress = ((step + 1) / TOTAL_STEPS) * 100;

  return (
    <Dialog open={open} modal>
      <DialogContent
        className="sm:max-w-[540px] p-0 gap-0 border-0 shadow-2xl overflow-hidden bg-white rounded-2xl [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogTitle className="sr-only">Configuration de votre compte</DialogTitle>

        <div className="h-1 bg-muted">
          <div
            className="h-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="px-8 pt-8 pb-2">
          <div className="flex items-center gap-2">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                  i <= step ? 'bg-primary' : 'bg-muted'
                }`}
              />
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Etape {step + 1} sur {TOTAL_STEPS}
          </p>
        </div>

        <div className="px-8 pb-8 min-h-[380px] flex flex-col">
          {step === 0 && (
            <StepWelcome data={data} onChange={updateData} onNext={next} onSkip={skip} />
          )}
          {step === 1 && (
            <StepCompany data={data} onChange={updateData} onNext={next} onBack={back} onSkip={skip} />
          )}
          {step === 2 && (
            <StepTeam data={data} onChange={updateData} onNext={next} onBack={back} onSkip={skip} />
          )}
          {step === 3 && (
            <StepReferral data={data} onChange={updateData} onNext={next} onBack={back} onSkip={skip} />
          )}
          {step === 4 && (
            <StepReady data={data} onBack={back} onFinish={finish} saving={saving} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
