'use client';

import { useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { StepWelcome } from './steps/step-welcome';
import { StepCompany } from './steps/step-company';
import { StepIdentite } from './steps/step-identite';
import { StepSiteWeb } from './steps/step-site-web';
import { StepFiscalite } from './steps/step-fiscalite';
import { StepComptaEquipe } from './steps/step-compta-equipe';
import { StepPrestations } from './steps/step-prestations';
import { StepReady } from './steps/step-ready';
import { BTP_CATEGORIES } from './steps/step-prestations';
import { supabase } from '@/lib/supabase';
import { slugify } from '@/lib/site-utils';

export interface OnboardingData {
  // Welcome
  fullName: string;
  // Company
  companyName: string;
  companyActivity: string;
  companyCity: string;
  companyPhone: string;
  teamSize: string;
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
  // Identite
  logoUrl: string;
  primaryColor: string;
  tagline: string;
  // Site web
  hasExistingWebsite: boolean | null;
  wantsHellobatSite: boolean;
  siteTheme: 'modern' | 'warm' | 'clean' | 'bold';
  // Fiscalite
  vatRegime: string;
  vatFrequency: string;
  vatReminderDay: number;
  fiscalYearEndDay: number;
  fiscalYearEndMonth: number;
  // Compta / Equipe
  hasAccountingSoftware: boolean | null;
  wantsMaurice: boolean;
  hasEmployees: boolean | null;
  invitedEmployees: { email: string; name: string; role: string }[];
  // Prestations
  serviceCategories: string[];
}

const TOTAL_STEPS = 8;

interface OnboardingModalProps {
  open: boolean;
  userId: string;
  onComplete: () => void;
}

export function OnboardingModal({ open, userId, onComplete }: OnboardingModalProps) {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<OnboardingData>({
    fullName: '',
    companyName: '',
    companyActivity: '',
    companyCity: '',
    companyPhone: '',
    teamSize: 'seul',
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
    logoUrl: '',
    primaryColor: '#d35400',
    tagline: '',
    hasExistingWebsite: null,
    wantsHellobatSite: false,
    siteTheme: 'clean',
    vatRegime: '',
    vatFrequency: '',
    vatReminderDay: 15,
    fiscalYearEndDay: 31,
    fiscalYearEndMonth: 12,
    hasAccountingSoftware: null,
    wantsMaurice: false,
    hasEmployees: null,
    invitedEmployees: [],
    serviceCategories: [],
  });

  const updateData = useCallback((partial: Partial<OnboardingData>) => {
    setData((prev) => ({ ...prev, ...partial }));
  }, []);

  const next = useCallback(() => {
    setDirection(1);
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  }, []);

  const back = useCallback(() => {
    setDirection(-1);
    setStep((s) => Math.max(s - 1, 0));
  }, []);

  const skip = useCallback(() => {
    setDirection(1);
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  }, []);

  async function triggerSiteGeneration(accessToken: string) {
    // Fire-and-forget: generate content + insert draft site
    try {
      const res = await fetch('/api/ai/site-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          company_name: data.companyName,
          activity: data.companyActivity || data.nafLabel,
          city: data.companyCity,
          slogan: data.tagline || undefined,
          theme: data.siteTheme,
          services: data.serviceCategories
            .map((c) => BTP_CATEGORIES.find((b) => b.value === c)?.label || '')
            .filter(Boolean)
            .map((name) => ({ name })),
        }),
      });
      if (!res.ok) return;
      const { site_content } = await res.json();

      const slug = slugify(`${data.companyName} ${data.companyCity}`.trim(), 60);
      await supabase.from('artisan_sites').insert({
        user_id: userId,
        slug,
        status: 'draft',
        theme: data.siteTheme,
        site_content,
        show_services: true,
        show_projects: true,
        show_reviews: true,
        show_contact: true,
        show_map: true,
        hero_image_url: '',
        legal_text: '',
        custom_slogan: data.tagline || '',
      });
    } catch {
      // Silent fail — user can retry from /site-web
    }
  }

  const finish = useCallback(async () => {
    setSaving(true);

    const { data: { session } } = await supabase.auth.getSession();
    const accessToken = session?.access_token;

    // 1. Profile update (identity + V2 flags + document_config)
    const documentConfig = {
      template: 'classique',
      primary_color: data.primaryColor || '#d35400',
      secondary_color: '#1a1a1a',
      font: 'inter',
      show_logo: true,
      logo_position: 'left',
      header_style: 'standard',
      show_watermark: false,
      footer_text: '',
      mentions_legales:
        'Devis valable 30 jours. En cas de litige, le tribunal competent sera celui du siege social du prestataire.',
    };

    const profileUpdate = supabase
      .from('profiles')
      .update({
        full_name: data.fullName,
        company_name: data.companyName,
        company_activity: data.companyActivity,
        company_city: data.companyCity,
        company_phone: data.companyPhone,
        team_size: data.teamSize,
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
        logo_url: data.logoUrl || null,
        document_config: documentConfig,
        has_existing_website: data.hasExistingWebsite ?? false,
        wants_hellobat_site: data.wantsHellobatSite,
        wants_maurice_accounting: data.wantsMaurice,
        onboarding_step: TOTAL_STEPS - 1,
        onboarding_completed: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    // 2. Business reminder settings (UPDATE — row already exists via trigger)
    const reminderUpdate = supabase
      .from('business_reminder_settings')
      .update({
        legal_form: data.legalForm || '',
        vat_regime: data.vatRegime || '',
        vat_frequency: data.vatFrequency || '',
        vat_reminder_day: data.vatRegime ? data.vatReminderDay : null,
        has_employees: data.hasEmployees === true,
        employee_count:
          data.hasEmployees === true ? data.invitedEmployees.length : null,
        fiscal_year_end_day: data.fiscalYearEndDay,
        fiscal_year_end_month: data.fiscalYearEndMonth,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    // 3. Workspace invitations (only for entries with valid email)
    const validEmails = data.invitedEmployees.filter((e) =>
      e.email.trim().includes('@')
    );
    const invitePromise =
      validEmails.length > 0
        ? supabase.from('workspace_memberships').insert(
            validEmails.map((e) => ({
              owner_user_id: userId,
              invited_email: e.email.trim().toLowerCase(),
              role: e.role || 'commercial',
              status: 'pending',
              invited_by: userId,
              note: e.name.trim() || '',
            }))
          )
        : Promise.resolve();

    // 4. Service categories → seed placeholders
    const servicesPromise =
      data.serviceCategories.length > 0
        ? supabase.from('services').insert(
            data.serviceCategories.map((cat) => {
              const label =
                BTP_CATEGORIES.find((b) => b.value === cat)?.label || cat;
              return {
                user_id: userId,
                name: label,
                description: '',
                unit: 'u',
                unit_price: 0,
                category: label,
                tva_rate: 20,
                is_active: true,
              };
            })
          )
        : Promise.resolve();

    await Promise.all([
      profileUpdate,
      reminderUpdate,
      invitePromise,
      servicesPromise,
    ]);

    // 5. Fire-and-forget site generation if opted-in
    if (data.wantsHellobatSite && accessToken) {
      void triggerSiteGeneration(accessToken);
    }

    setSaving(false);
    onComplete();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, userId, onComplete]);

  // The final step (Ready) is a celebration and fills the bar completely.
  const CONFIG_STEPS = TOTAL_STEPS - 1; // 7 visible configuration steps
  const isReadyStep = step === TOTAL_STEPS - 1;
  const displayStep = Math.min(step + 1, CONFIG_STEPS);
  const progress = isReadyStep ? 100 : ((step + 1) / CONFIG_STEPS) * 100;

  const slideVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 60 : -60,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (dir: number) => ({
      x: dir > 0 ? -60 : 60,
      opacity: 0,
    }),
  };

  return (
    <Dialog open={open} modal>
      <DialogContent
        className="w-[calc(100vw-2rem)] sm:max-w-[560px] max-h-[92vh] p-0 gap-0 border-0 shadow-2xl overflow-hidden bg-white rounded-2xl flex flex-col [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogTitle className="sr-only">Configuration de votre compte</DialogTitle>

        <div className="h-1 bg-muted">
          <motion.div
            className="h-full bg-primary"
            initial={false}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>

        {!isReadyStep && (
          <div className="px-6 sm:px-8 pt-6 pb-2">
            <div className="flex items-center gap-1.5">
              {Array.from({ length: CONFIG_STEPS }).map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                    i <= step ? 'bg-primary' : 'bg-muted'
                  }`}
                />
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Etape {displayStep} sur {CONFIG_STEPS}
            </p>
          </div>
        )}

        <div className={`px-6 sm:px-8 pb-6 sm:pb-8 min-h-0 flex-1 overflow-y-auto overscroll-contain relative ${isReadyStep ? 'pt-8' : ''}`}>
          <AnimatePresence mode="wait" custom={direction} initial={false}>
            <motion.div
              key={step}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="flex flex-col flex-1 min-h-full"
            >
              {step === 0 && (
                <StepWelcome data={data} onChange={updateData} onNext={next} onSkip={skip} />
              )}
              {step === 1 && (
                <StepCompany data={data} onChange={updateData} onNext={next} onBack={back} onSkip={skip} />
              )}
              {step === 2 && (
                <StepIdentite data={data} onChange={updateData} onNext={next} onBack={back} onSkip={skip} userId={userId} />
              )}
              {step === 3 && (
                <StepSiteWeb data={data} onChange={updateData} onNext={next} onBack={back} onSkip={skip} />
              )}
              {step === 4 && (
                <StepFiscalite data={data} onChange={updateData} onNext={next} onBack={back} onSkip={skip} />
              )}
              {step === 5 && (
                <StepComptaEquipe data={data} onChange={updateData} onNext={next} onBack={back} onSkip={skip} />
              )}
              {step === 6 && (
                <StepPrestations data={data} onChange={updateData} onNext={next} onBack={back} onSkip={skip} />
              )}
              {step === 7 && (
                <StepReady data={data} onBack={back} onFinish={finish} saving={saving} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}
