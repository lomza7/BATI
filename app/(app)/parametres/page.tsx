'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Building2,
  Check,
  CreditCard,
  ExternalLink,
  Gift,
  Handshake,
  Loader2,
  LogOut,
  Mail,
  MapPin,
  Phone,
  Plus,
  RefreshCw,
  Save,
  Settings2,
  Shield,
  Sparkles,
  Users,
  Zap,
  Crown,
  GripVertical,
  HardHat,
  Trash2,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { DEFAULT_PROJECT_PHASES, formatDate, type ProjectPhase } from '@/lib/constants';
import { PageHeader } from '@/components/shared/page-header';
import { DocumentTemplateSettings } from '@/components/parametres/document-template-settings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  DEFAULT_PLAN_FEATURES,
  parsePlanFeatures,
  PRICING_PLAN_DEFAULTS,
  type PricingPlanKey,
} from '@/lib/pricing-plans';
import {
  DEFAULT_LEAD_SOURCES,
  normalizeLeadSourceSlug,
  type LeadSource,
} from '@/lib/lead-sources';
import {
  CORE_LEAD_STAGE_SLUGS,
  DEFAULT_LEAD_STAGES,
  LEAD_STAGE_COLOR_PRESETS,
  normalizeLeadStageSlug,
  type LeadStageConfig,
} from '@/lib/lead-pipeline';

type SettingsTab = 'parametres' | 'documents' | 'chantier' | 'abonnement' | 'securite';

interface SettingsProfile {
  id: string;
  full_name: string;
  company_name: string;
  company_activity: string;
  company_city: string;
  company_phone: string;
  team_size: string;
  referral_source: string;
  siren: string;
  siret: string;
  legal_form: string;
  naf_code: string;
  naf_label: string;
  capital: number | null;
  tva_number: string;
  company_address: string;
  company_postal_code: string;
  company_website: string;
  rcs: string;
  onboarding_completed: boolean;
  plan: PricingPlanKey;
  plan_started_at: string | null;
  stripe_customer_id: string | null;
}

interface PlatformConfig {
  price_starter?: string;
  price_pro?: string;
  price_business?: string;
  stripe_price_starter?: string;
  stripe_price_pro?: string;
  stripe_price_business?: string;
  features_starter?: string;
  features_pro?: string;
  features_business?: string;
}

interface ReminderSettings {
  user_id: string;
  legal_form: string;
  benefit_tax_regime: string;
  vat_regime: string;
  vat_frequency: string;
  vat_reminder_day: number | null;
  has_employees: boolean;
  employee_count: number | null;
  payroll_day: number | null;
  dsn_due_day: number | null;
  fiscal_year_end_day: number;
  fiscal_year_end_month: number;
  social_contributions_day: number | null;
  cfe_applicable: boolean;
  apprenticeship_tax_applicable: boolean;
  accountant_notes: string;
}

interface PappersCompanyPayload {
  siren: string;
  siret: string;
  name: string;
  legal_form: string;
  naf_code: string;
  naf_label: string;
  capital: number | null;
  tva_number: string;
  address: string;
  postal_code: string;
  city: string;
  phone: string;
  website: string;
  rcs: string;
}

interface LeadSourceFormState {
  name: string;
  source_type: 'channel' | 'partner';
  contact_name: string;
  reward_note: string;
}

interface LeadStageFormState {
  label: string;
  color: string;
  position: number;
}

const planIcons = {
  starter: Users,
  pro: Zap,
  business: Crown,
} as const;

const planBadgeClasses = {
  starter: 'bg-slate-100 text-slate-700 border-slate-200',
  pro: 'bg-blue-100 text-blue-700 border-blue-200',
  business: 'bg-amber-100 text-amber-700 border-amber-200',
} as const;

const teamSizeOptions = [
  { value: 'seul', label: 'Solo' },
  { value: '2-5', label: '2 a 5 personnes' },
  { value: '6-10', label: '6 a 10 personnes' },
  { value: '10+', label: '10 personnes et +' },
];

const defaultReminderSettings: Omit<ReminderSettings, 'user_id'> = {
  legal_form: '',
  benefit_tax_regime: '',
  vat_regime: '',
  vat_frequency: '',
  vat_reminder_day: null,
  has_employees: false,
  employee_count: null,
  payroll_day: null,
  dsn_due_day: 15,
  fiscal_year_end_day: 31,
  fiscal_year_end_month: 12,
  social_contributions_day: null,
  cfe_applicable: true,
  apprenticeship_tax_applicable: false,
  accountant_notes: '',
};

const legalFormOptions = [
  { value: '', label: 'Choisir un statut' },
  { value: 'ei', label: 'Entreprise individuelle' },
  { value: 'micro', label: 'Micro-entreprise' },
  { value: 'eurl', label: 'EURL' },
  { value: 'sarl', label: 'SARL' },
  { value: 'sasu', label: 'SASU' },
  { value: 'sas', label: 'SAS' },
  { value: 'autre', label: 'Autre' },
];

const taxRegimeOptions = [
  { value: '', label: 'Choisir un regime' },
  { value: 'is', label: 'Impot sur les societes (IS)' },
  { value: 'ir', label: 'Impot sur le revenu (IR)' },
  { value: 'micro', label: 'Regime micro' },
];

const vatRegimeOptions = [
  { value: '', label: 'Choisir un regime TVA' },
  { value: 'franchise_en_base', label: 'Franchise en base' },
  { value: 'reel_normal', label: 'Reel normal' },
  { value: 'reel_simplifie', label: 'Reel simplifie' },
];

const vatFrequencyOptions = [
  { value: '', label: 'Frequence a definir' },
  { value: 'mensuelle', label: 'Mensuelle' },
  { value: 'trimestrielle', label: 'Trimestrielle' },
  { value: 'annuelle', label: 'Annuelle' },
];

const monthOptions = [
  { value: 1, label: 'Janvier' },
  { value: 2, label: 'Fevrier' },
  { value: 3, label: 'Mars' },
  { value: 4, label: 'Avril' },
  { value: 5, label: 'Mai' },
  { value: 6, label: 'Juin' },
  { value: 7, label: 'Juillet' },
  { value: 8, label: 'Aout' },
  { value: 9, label: 'Septembre' },
  { value: 10, label: 'Octobre' },
  { value: 11, label: 'Novembre' },
  { value: 12, label: 'Decembre' },
];

function mapPappersLegalFormToSetting(legalForm: string) {
  const value = legalForm.toLowerCase();
  if (value.includes('micro')) return 'micro';
  if (value.includes('sasu')) return 'sasu';
  if (value.includes('sas')) return 'sas';
  if (value.includes('eurl')) return 'eurl';
  if (value.includes('sarl')) return 'sarl';
  if (value.includes('entreprise individuelle')) return 'ei';
  return '';
}

function inferBenefitTaxRegime(profile: SettingsProfile | null, legalFormSetting: string) {
  if (legalFormSetting === 'micro') return 'micro';
  if (legalFormSetting === 'ei') return 'ir';
  if (legalFormSetting === 'sas' || legalFormSetting === 'sasu') return 'is';
  if (profile?.legal_form.toLowerCase().includes('micro')) return 'micro';
  return '';
}

function buildPrefilledReminderSettings(
  profile: SettingsProfile | null,
  storedSettings: Partial<ReminderSettings> | null
) {
  const legalForm = storedSettings?.legal_form || mapPappersLegalFormToSetting(profile?.legal_form || '');

  return {
    ...defaultReminderSettings,
    ...(storedSettings || {}),
    legal_form: legalForm,
    benefit_tax_regime:
      storedSettings?.benefit_tax_regime || inferBenefitTaxRegime(profile, legalForm),
  };
}

export default function ParametresPage() {
  const searchParams = useSearchParams();
  const { user, signOut, loading: authLoading } = useAuth();

  const [activeTab, setActiveTab] = useState<SettingsTab>('parametres');
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<SettingsProfile | null>(null);
  const [form, setForm] = useState({
    full_name: '',
    company_name: '',
    company_activity: '',
    company_address: '',
    company_postal_code: '',
    company_city: '',
    company_phone: '',
    company_website: '',
    tva_number: '',
    team_size: 'seul',
    referral_source: '',
  });
  const [platformConfig, setPlatformConfig] = useState<PlatformConfig>({});
  const [reminderSettings, setReminderSettings] = useState(defaultReminderSettings);
  const [leadSources, setLeadSources] = useState<LeadSource[]>([]);
  const [leadStages, setLeadStages] = useState<LeadStageConfig[]>([]);
  const [saving, setSaving] = useState(false);
  const [savingReminders, setSavingReminders] = useState(false);
  const [savingSourceId, setSavingSourceId] = useState<string | null>(null);
  const [savingStageId, setSavingStageId] = useState<string | null>(null);
  const [creatingSource, setCreatingSource] = useState(false);
  const [creatingStage, setCreatingStage] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveReminderSuccess, setSaveReminderSuccess] = useState(false);
  const [saveSourceSuccess, setSaveSourceSuccess] = useState(false);
  const [error, setError] = useState('');
  const [billingLoading, setBillingLoading] = useState<string | null>(null);
  const [pappersRefreshing, setPappersRefreshing] = useState(false);
  const [newLeadSource, setNewLeadSource] = useState<LeadSourceFormState>({
    name: '',
    source_type: 'channel',
    contact_name: '',
    reward_note: '',
  });
  const [newLeadStage, setNewLeadStage] = useState<LeadStageFormState>({
    label: '',
    color: DEFAULT_LEAD_STAGES[1]?.color || 'bg-blue-50 text-blue-700',
    position: DEFAULT_LEAD_STAGES.length,
  });

  // Phases chantier
  const [phases, setPhases] = useState<ProjectPhase[]>(DEFAULT_PROJECT_PHASES);
  const [savingPhases, setSavingPhases] = useState(false);
  const [savePhasesSuccess, setSavePhasesSuccess] = useState(false);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'abonnement' || tab === 'securite' || tab === 'parametres' || tab === 'chantier') {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError('');

    const [profileRes, configRes, reminderSettingsRes, leadSourcesRes, leadStagesRes] = await Promise.all([
      supabase
        .from('profiles')
        .select(
          'id, full_name, company_name, company_activity, company_city, company_phone, team_size, referral_source, siren, siret, legal_form, naf_code, naf_label, capital, tva_number, company_address, company_postal_code, company_website, rcs, onboarding_completed, plan, plan_started_at, stripe_customer_id, project_phases_config'
        )
        .eq('id', user.id)
        .maybeSingle(),
      supabase.rpc('get_platform_config'),
      supabase
        .from('business_reminder_settings')
        .select(
          'user_id, legal_form, benefit_tax_regime, vat_regime, vat_frequency, vat_reminder_day, has_employees, employee_count, payroll_day, dsn_due_day, fiscal_year_end_day, fiscal_year_end_month, social_contributions_day, cfe_applicable, apprenticeship_tax_applicable, accountant_notes'
        )
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('lead_sources')
        .select('*')
        .order('position', { ascending: true }),
      supabase
        .from('lead_stages')
        .select('*')
        .order('position', { ascending: true }),
    ]);

    if (profileRes.error) {
      setError(profileRes.error.message);
      setLoading(false);
      return;
    }

    const nextProfile = profileRes.data as SettingsProfile | null;
    setProfile(nextProfile);
    setForm({
      full_name: nextProfile?.full_name || '',
      company_name: nextProfile?.company_name || '',
      company_activity: nextProfile?.company_activity || '',
      company_address: nextProfile?.company_address || '',
      company_postal_code: nextProfile?.company_postal_code || '',
      company_city: nextProfile?.company_city || '',
      company_phone: nextProfile?.company_phone || '',
      company_website: nextProfile?.company_website || '',
      tva_number: nextProfile?.tva_number || '',
      team_size: nextProfile?.team_size || 'seul',
      referral_source: nextProfile?.referral_source || '',
    });
    // Charger la config des phases personnalisées
    const savedPhases = (nextProfile as any)?.project_phases_config;
    if (Array.isArray(savedPhases) && savedPhases.length > 0) {
      setPhases(savedPhases as ProjectPhase[]);
    }

    setPlatformConfig((configRes.data as PlatformConfig) || {});
    setReminderSettings(buildPrefilledReminderSettings(nextProfile, reminderSettingsRes.data));
    setLeadSources(
      (((leadSourcesRes.data as LeadSource[]) || []).length > 0
        ? (leadSourcesRes.data as LeadSource[])
        : DEFAULT_LEAD_SOURCES.map((source, index) => ({
            id: `default-${source.slug}`,
            user_id: user.id,
            name: source.name,
            slug: source.slug,
            source_type: source.source_type,
            contact_name: '',
            reward_note: '',
            is_active: true,
            position: source.position ?? index,
          }))) as LeadSource[]
    );
    setLeadStages(
      (((leadStagesRes.data as LeadStageConfig[]) || []).length > 0
        ? (leadStagesRes.data as LeadStageConfig[])
        : DEFAULT_LEAD_STAGES.map((stage, index) => ({
            id: `default-${stage.slug}`,
            user_id: user.id,
            slug: stage.slug,
            label: stage.label,
            color: stage.color,
            position: stage.position ?? index,
            is_terminal: stage.is_terminal,
          }))) as LeadStageConfig[]
    );
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }

    void loadData();
  }, [authLoading, user, loadData]);

  async function saveProfile() {
    if (!user) return;
    setSaving(true);
    setSaveSuccess(false);
    setError('');

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        ...form,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    setProfile((prev) => (prev ? { ...prev, ...form } : prev));
    setSaveSuccess(true);
    setSaving(false);
    window.setTimeout(() => setSaveSuccess(false), 2500);
  }

  async function savePhases() {
    if (!user) return;
    setSavingPhases(true);
    setSavePhasesSuccess(false);
    setError('');

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ project_phases_config: phases, updated_at: new Date().toISOString() })
      .eq('id', user.id);

    if (updateError) {
      setError(updateError.message);
      setSavingPhases(false);
      return;
    }

    setSavePhasesSuccess(true);
    setSavingPhases(false);
    window.setTimeout(() => setSavePhasesSuccess(false), 2500);
  }

  async function saveReminderPreferences() {
    if (!user) return;

    setSavingReminders(true);
    setSaveReminderSuccess(false);
    setError('');

    const payload = {
      user_id: user.id,
      ...reminderSettings,
      updated_at: new Date().toISOString(),
    };

    const { error: upsertError } = await supabase
      .from('business_reminder_settings')
      .upsert(payload, { onConflict: 'user_id' });

    if (upsertError) {
      setError(upsertError.message);
      setSavingReminders(false);
      return;
    }

    setSaveReminderSuccess(true);
    setSavingReminders(false);
    window.setTimeout(() => setSaveReminderSuccess(false), 2500);
  }

  async function refreshFromPappers() {
    if (!user || !profile?.siren) {
      setError('Aucun SIREN disponible pour relancer Pappers.');
      return;
    }

    setPappersRefreshing(true);
    setError('');

    try {
      const response = await fetch(`/api/pappers/company?siren=${encodeURIComponent(profile.siren)}`);
      const company: PappersCompanyPayload & { error?: string } = await response.json();

      if (!response.ok || company.error || !company.siren) {
        throw new Error(company.error || 'Impossible de recuperer les donnees Pappers.');
      }

      const nextCompanyActivity = form.company_activity || company.naf_label || '';
      const updates = {
        company_name: company.name || form.company_name,
        company_activity: nextCompanyActivity,
        company_city: company.city || form.company_city,
        company_phone: company.phone || form.company_phone,
        company_address: company.address || form.company_address,
        company_postal_code: company.postal_code || form.company_postal_code,
        company_website: company.website || form.company_website,
        tva_number: company.tva_number || form.tva_number,
        siren: company.siren || profile.siren,
        siret: company.siret || profile.siret,
        legal_form: company.legal_form || profile.legal_form,
        naf_code: company.naf_code || profile.naf_code,
        naf_label: company.naf_label || profile.naf_label,
        capital: company.capital ?? profile.capital,
        rcs: company.rcs || profile.rcs,
        updated_at: new Date().toISOString(),
      };

      const { error: updateError } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      setForm((prev) => ({
        ...prev,
        company_name: updates.company_name,
        company_activity: updates.company_activity,
        company_city: updates.company_city,
        company_phone: updates.company_phone,
        company_address: updates.company_address,
        company_postal_code: updates.company_postal_code,
        company_website: updates.company_website,
        tva_number: updates.tva_number,
      }));

      setProfile((prev) =>
        prev
          ? {
              ...prev,
              ...updates,
            }
          : prev
      );

      setReminderSettings((prev) => {
        const legalForm = prev.legal_form || mapPappersLegalFormToSetting(updates.legal_form || '');
        return {
          ...prev,
          legal_form: legalForm,
          benefit_tax_regime: prev.benefit_tax_regime || inferBenefitTaxRegime(
            { ...profile, legal_form: updates.legal_form } as SettingsProfile,
            legalForm
          ),
        };
      });
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Erreur Pappers');
    } finally {
      setPappersRefreshing(false);
    }
  }

  function updateLeadSource(id: string, patch: Partial<LeadSource>) {
    setLeadSources((prev) => prev.map((source) => (source.id === id ? { ...source, ...patch } : source)));
  }

  async function saveLeadSource(source: LeadSource) {
    if (!user || !source.name.trim()) return;

    setSavingSourceId(source.id);
    setSaveSourceSuccess(false);
    setError('');
    const isTempSource = source.id.startsWith('default-');

    const payload = {
      user_id: user.id,
      name: source.name.trim(),
      slug: isTempSource ? normalizeLeadSourceSlug(source.name) : source.slug,
      source_type: source.source_type,
      contact_name: source.contact_name.trim(),
      reward_note: source.reward_note.trim(),
      is_active: source.is_active,
      position: source.position,
      updated_at: new Date().toISOString(),
    };

    const query = isTempSource
      ? supabase.from('lead_sources').insert(payload).select('*').single()
      : supabase.from('lead_sources').update(payload).eq('id', source.id).select('*').single();

    const { data, error: sourceError } = await query;

    if (sourceError) {
      setError(sourceError.message);
      setSavingSourceId(null);
      return;
    }

    setLeadSources((prev) => {
      const rest = prev.filter((item) => item.id !== source.id);
      return [...rest, data as LeadSource].sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
    });
    setSavingSourceId(null);
    setSaveSourceSuccess(true);
    window.setTimeout(() => setSaveSourceSuccess(false), 2500);
  }

  async function createLeadSource() {
    if (!user || !newLeadSource.name.trim()) return;

    setCreatingSource(true);
    setSaveSourceSuccess(false);
    setError('');

    const slug = normalizeLeadSourceSlug(newLeadSource.name);
    if (!slug) {
      setError('Le nom de la source est invalide.');
      setCreatingSource(false);
      return;
    }

    const payload = {
      user_id: user.id,
      name: newLeadSource.name.trim(),
      slug,
      source_type: newLeadSource.source_type,
      contact_name: newLeadSource.contact_name.trim(),
      reward_note: newLeadSource.reward_note.trim(),
      is_active: true,
      position: leadSources.length,
    };

    const { data, error: sourceError } = await supabase
      .from('lead_sources')
      .upsert(payload, { onConflict: 'user_id,slug' })
      .select('*')
      .single();

    if (sourceError) {
      setError(sourceError.message);
      setCreatingSource(false);
      return;
    }

    setLeadSources((prev) => {
      const filtered = prev.filter((source) => source.slug !== slug);
      return [...filtered, data as LeadSource].sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
    });
    setNewLeadSource({
      name: '',
      source_type: 'channel',
      contact_name: '',
      reward_note: '',
    });
    setCreatingSource(false);
    setSaveSourceSuccess(true);
    window.setTimeout(() => setSaveSourceSuccess(false), 2500);
  }

  function updateLeadStage(id: string, patch: Partial<LeadStageConfig>) {
    setLeadStages((prev) =>
      prev.map((stage) => (stage.id === id ? { ...stage, ...patch } : stage)).sort((a, b) => a.position - b.position)
    );
  }

  async function saveLeadStage(stage: LeadStageConfig) {
    if (!user || !stage.label.trim()) return;

    setSavingStageId(stage.id);
    setError('');
    const isTempStage = stage.id.startsWith('default-');
    const payload = {
      user_id: user.id,
      slug: stage.slug,
      label: stage.label.trim(),
      color: stage.color,
      position: stage.position,
      is_terminal: stage.is_terminal,
      updated_at: new Date().toISOString(),
    };

    const query = isTempStage
      ? supabase.from('lead_stages').insert(payload).select('*').single()
      : supabase.from('lead_stages').update(payload).eq('id', stage.id).select('*').single();

    const { data, error: stageError } = await query;

    if (stageError) {
      setError(stageError.message);
      setSavingStageId(null);
      return;
    }

    setLeadStages((prev) => {
      const rest = prev.filter((item) => item.id !== stage.id);
      return [...rest, data as LeadStageConfig].sort((a, b) => a.position - b.position);
    });
    setSavingStageId(null);
  }

  async function createLeadStage() {
    if (!user || !newLeadStage.label.trim()) return;

    setCreatingStage(true);
    setError('');

    const slug = normalizeLeadStageSlug(newLeadStage.label);
    if (!slug) {
      setError("Le nom de l'etape est invalide.");
      setCreatingStage(false);
      return;
    }

    if (leadStages.some((stage) => stage.slug === slug)) {
      setError('Une etape avec ce nom existe deja.');
      setCreatingStage(false);
      return;
    }

    const payload = {
      user_id: user.id,
      slug,
      label: newLeadStage.label.trim(),
      color: newLeadStage.color,
      position: newLeadStage.position,
      is_terminal: false,
    };

    const { data, error: stageError } = await supabase
      .from('lead_stages')
      .insert(payload)
      .select('*')
      .single();

    if (stageError) {
      setError(stageError.message);
      setCreatingStage(false);
      return;
    }

    setLeadStages((prev) => [...prev, data as LeadStageConfig].sort((a, b) => a.position - b.position));
    setNewLeadStage({
      label: '',
      color: newLeadStage.color,
      position: leadStages.length + 1,
    });
    setCreatingStage(false);
  }

  async function launchCheckout(planKey: PricingPlanKey) {
    if (!user?.email) return;

    const priceId = platformConfig[`stripe_price_${planKey}` as keyof PlatformConfig];
    if (!priceId || typeof priceId !== 'string') {
      setError(`Le prix Stripe du plan ${planKey} n'est pas configure.`);
      return;
    }

    setBillingLoading(planKey);
    setError('');

    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          price_id: priceId,
          user_email: user.email,
          user_id: user.id,
          success_url: `${window.location.origin}/parametres?tab=abonnement&checkout=success`,
          cancel_url: `${window.location.origin}/parametres?tab=abonnement&checkout=cancel`,
        }),
      });

      const data = await response.json();
      if (!response.ok || data.error || !data.url) {
        throw new Error(data.error || 'Impossible de demarrer Checkout Stripe.');
      }

      window.location.href = data.url;
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : 'Erreur Stripe');
      setBillingLoading(null);
    }
  }

  async function openBillingPortal() {
    if (!user) return;

    setBillingLoading('portal');
    setError('');

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const accessToken = session?.access_token;
      if (!accessToken) {
        throw new Error('Session utilisateur introuvable.');
      }

      const response = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          return_url: `${window.location.origin}/parametres?tab=abonnement`,
        }),
      });

      const data = await response.json();
      if (!response.ok || data.error || !data.url) {
        throw new Error(data.error || 'Impossible d ouvrir le portail Stripe.');
      }

      window.location.href = data.url;
    } catch (portalError) {
      setError(portalError instanceof Error ? portalError.message : 'Erreur Stripe');
      setBillingLoading(null);
    }
  }

  const plans = useMemo(() => {
    return PRICING_PLAN_DEFAULTS.map((plan) => ({
      ...plan,
      price:
        platformConfig[`price_${plan.key}` as keyof PlatformConfig] ||
        plan.defaultPrice,
      stripePriceId:
        platformConfig[`stripe_price_${plan.key}` as keyof PlatformConfig] || '',
      features: parsePlanFeatures(
        platformConfig[`features_${plan.key}` as keyof PlatformConfig],
        DEFAULT_PLAN_FEATURES[plan.key]
      ),
    }));
  }, [platformConfig]);

  const currentPlan = plans.find((plan) => plan.key === (profile?.plan || 'starter')) || plans[0];
  const checkoutStatus = searchParams.get('checkout');
  const reminderCompletionScore = [
    reminderSettings.legal_form,
    reminderSettings.benefit_tax_regime,
    reminderSettings.vat_regime,
    reminderSettings.fiscal_year_end_month,
    reminderSettings.fiscal_year_end_day,
    reminderSettings.has_employees ? reminderSettings.payroll_day : 1,
    reminderSettings.has_employees ? reminderSettings.dsn_due_day : 1,
  ].filter(Boolean).length;
  const reminderCompletionPercent = Math.round((reminderCompletionScore / 7) * 100);
  const partnerSourcesCount = leadSources.filter((source) => source.source_type === 'partner' && source.is_active).length;

  if (authLoading || loading) {
    return (
      <div className="space-y-6">
        <div className="h-12 w-64 animate-pulse rounded-xl bg-muted" />
        <div className="h-96 animate-pulse rounded-2xl bg-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Parametres"
        description="Mettez a jour votre profil, votre entreprise et votre abonnement depuis un seul endroit."
      />

      {checkoutStatus === 'success' && (
        <Alert className="border-emerald-200 bg-emerald-50 text-emerald-800 [&>svg]:text-emerald-700">
          <Check className="h-4 w-4" />
          <AlertTitle>Abonnement mis a jour</AlertTitle>
          <AlertDescription>
            Stripe a bien confirme votre passage de plan. Les informations peuvent prendre quelques instants a se synchroniser.
          </AlertDescription>
        </Alert>
      )}

      {checkoutStatus === 'cancel' && (
        <Alert>
          <CreditCard className="h-4 w-4" />
          <AlertTitle>Modification annulee</AlertTitle>
          <AlertDescription>
            Aucun changement n a ete applique a votre abonnement.
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <Shield className="h-4 w-4" />
          <AlertTitle>Un point bloque</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as SettingsTab)} className="space-y-6">
        <TabsList className="grid h-auto grid-cols-3 sm:grid-cols-5 rounded-xl bg-muted/60 p-1">
          <TabsTrigger value="parametres" className="rounded-lg py-2.5 text-xs sm:text-sm">Parametres</TabsTrigger>
          <TabsTrigger value="documents" className="rounded-lg py-2.5 text-xs sm:text-sm">Documents</TabsTrigger>
          <TabsTrigger value="chantier" className="rounded-lg py-2.5 text-xs sm:text-sm">Chantier</TabsTrigger>
          <TabsTrigger value="abonnement" className="rounded-lg py-2.5 text-xs sm:text-sm">Abonnement</TabsTrigger>
          <TabsTrigger value="securite" className="rounded-lg py-2.5 text-xs sm:text-sm">Securite</TabsTrigger>
        </TabsList>

        <TabsContent value="parametres" className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="text-xl">Profil et entreprise</CardTitle>
                <CardDescription>
                  Les informations ici sont celles que Hellobat utilisera dans votre compte et vos futurs automatisations.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="full_name">Nom complet</Label>
                    <Input
                      id="full_name"
                      value={form.full_name}
                      onChange={(e) => setForm((prev) => ({ ...prev, full_name: e.target.value }))}
                      placeholder="Louis Maaza"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email du compte</Label>
                    <Input
                      id="email"
                      value={user?.email || ''}
                      disabled
                    />
                  </div>
                </div>

                <Separator />

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="company_name">Nom de l entreprise</Label>
                    <Input
                      id="company_name"
                      value={form.company_name}
                      onChange={(e) => setForm((prev) => ({ ...prev, company_name: e.target.value }))}
                      placeholder="ADGS Batiment"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company_activity">Activite</Label>
                    <Input
                      id="company_activity"
                      value={form.company_activity}
                      onChange={(e) => setForm((prev) => ({ ...prev, company_activity: e.target.value }))}
                      placeholder="Plomberie, renovation, electricite..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company_address">Adresse</Label>
                    <Input
                      id="company_address"
                      value={form.company_address}
                      onChange={(e) => setForm((prev) => ({ ...prev, company_address: e.target.value }))}
                      placeholder="12 rue de la Republique"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company_postal_code">Code postal</Label>
                    <Input
                      id="company_postal_code"
                      value={form.company_postal_code}
                      onChange={(e) => setForm((prev) => ({ ...prev, company_postal_code: e.target.value }))}
                      placeholder="75011"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company_city">Ville</Label>
                    <Input
                      id="company_city"
                      value={form.company_city}
                      onChange={(e) => setForm((prev) => ({ ...prev, company_city: e.target.value }))}
                      placeholder="Paris"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company_website">Site web</Label>
                    <Input
                      id="company_website"
                      value={form.company_website}
                      onChange={(e) => setForm((prev) => ({ ...prev, company_website: e.target.value }))}
                      placeholder="https://www.monentreprise.fr"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company_phone">Telephone</Label>
                    <Input
                      id="company_phone"
                      value={form.company_phone}
                      onChange={(e) => setForm((prev) => ({ ...prev, company_phone: e.target.value }))}
                      placeholder="06 00 00 00 00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tva_number">Numero de TVA</Label>
                    <Input
                      id="tva_number"
                      value={form.tva_number}
                      onChange={(e) => setForm((prev) => ({ ...prev, tva_number: e.target.value }))}
                      placeholder="FRXX123456789"
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="team_size">Taille d equipe</Label>
                    <select
                      id="team_size"
                      value={form.team_size}
                      onChange={(e) => setForm((prev) => ({ ...prev, team_size: e.target.value }))}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      {teamSizeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="referral_source">Comment vous nous avez connus</Label>
                    <Input
                      id="referral_source"
                      value={form.referral_source}
                      onChange={(e) => setForm((prev) => ({ ...prev, referral_source: e.target.value }))}
                      placeholder="Google, bouche a oreille, partenaire..."
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Button onClick={saveProfile} disabled={saving}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Enregistrer
                  </Button>
                  {saveSuccess && (
                    <span className="inline-flex items-center gap-2 text-sm text-emerald-700">
                      <Check className="h-4 w-4" />
                      Modifications enregistrees
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card className="rounded-2xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <Settings2 className="h-5 w-5 text-primary" />
                    Vue rapide du compte
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="flex items-start gap-3">
                    <Building2 className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-foreground">{form.company_name || 'Entreprise non renseignee'}</p>
                      <p className="text-muted-foreground">{form.company_activity || 'Activite a definir'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Mail className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-foreground">{user?.email || 'Email indisponible'}</p>
                      <p className="text-muted-foreground">Compte principal Hellobat</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Phone className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-foreground">{form.company_phone || 'Telephone non renseigne'}</p>
                      <p className="text-muted-foreground">Numero de contact entreprise</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-foreground">
                        {[form.company_address, form.company_postal_code, form.company_city].filter(Boolean).join(', ') || 'Adresse non renseignee'}
                      </p>
                      <p className="text-muted-foreground">Adresse principale de l entreprise</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Building2 className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-foreground">{profile?.siren || 'SIREN non renseigne'}</p>
                      <p className="text-muted-foreground">
                        {form.tva_number || 'Numero de TVA non renseigne'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-primary/20 bg-primary/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <Sparkles className="h-5 w-5 text-primary" />
                    Votre abonnement
                  </CardTitle>
                  <CardDescription>
                    Suivez votre plan actuel et ouvrez les options de changement en un clic.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className={`inline-flex rounded-full border px-3 py-1 text-sm font-medium ${planBadgeClasses[currentPlan.key]}`}>
                    Plan {currentPlan.name}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {currentPlan.key === 'starter'
                      ? 'Vous etes actuellement sur le plan gratuit.'
                      : `Plan actif depuis ${profile?.plan_started_at ? formatDate(profile.plan_started_at) : 'peu'}.`}
                  </p>
                  <Button variant="outline" onClick={() => setActiveTab('abonnement')}>
                    Gerer mon abonnement
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>

          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-xl">Rappels chef d entreprise</CardTitle>
              <CardDescription>
                Personnalisez ici les informations qui permettent a Hellobat de vous rappeler la TVA, la paie, la DSN, la cloture comptable et les grandes echeances.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">Configuration des rappels administratifs</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Plus ces informations sont precises, plus le dashboard pourra vous remonter les bonnes alertes au bon moment.
                    </p>
                  </div>
                  <div className="min-w-40">
                    <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">
                      <span>Configuration</span>
                      <span>{reminderCompletionPercent}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-primary/10">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${reminderCompletionPercent}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-6 xl:grid-cols-3">
                <div className="space-y-4 rounded-2xl border border-border bg-muted/10 p-4">
                  <div>
                    <h3 className="font-semibold text-foreground">TVA et fiscalite</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Pour afficher les bons rappels de TVA, d IS ou de regime micro.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="legal_form">Forme juridique</Label>
                    <select
                      id="legal_form"
                      value={reminderSettings.legal_form}
                      onChange={(e) => setReminderSettings((prev) => ({ ...prev, legal_form: e.target.value }))}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      {legalFormOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="benefit_tax_regime">Regime d imposition</Label>
                    <select
                      id="benefit_tax_regime"
                      value={reminderSettings.benefit_tax_regime}
                      onChange={(e) =>
                        setReminderSettings((prev) => ({ ...prev, benefit_tax_regime: e.target.value }))
                      }
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      {taxRegimeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="vat_regime">Regime de TVA</Label>
                    <select
                      id="vat_regime"
                      value={reminderSettings.vat_regime}
                      onChange={(e) => setReminderSettings((prev) => ({ ...prev, vat_regime: e.target.value }))}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      {vatRegimeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="vat_frequency">Frequence de declaration TVA</Label>
                    <select
                      id="vat_frequency"
                      value={reminderSettings.vat_frequency}
                      onChange={(e) => setReminderSettings((prev) => ({ ...prev, vat_frequency: e.target.value }))}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      {vatFrequencyOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="vat_reminder_day">Jour de rappel TVA</Label>
                    <Input
                      id="vat_reminder_day"
                      type="number"
                      min={1}
                      max={31}
                      value={reminderSettings.vat_reminder_day ?? ''}
                      onChange={(e) =>
                        setReminderSettings((prev) => ({
                          ...prev,
                          vat_reminder_day: e.target.value ? Number(e.target.value) : null,
                        }))
                      }
                      placeholder="Ex: 19"
                    />
                    <p className="text-xs text-muted-foreground">
                      Si votre expert-comptable vous donne une date fixe, notez-la ici.
                    </p>
                  </div>
                </div>

                <div className="space-y-4 rounded-2xl border border-border bg-muted/10 p-4">
                  <div>
                    <h3 className="font-semibold text-foreground">Paie et equipe</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Pour les rappels salaires, DSN et autres obligations employeur.
                    </p>
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-border bg-background px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">J ai des salaries</p>
                      <p className="text-xs text-muted-foreground">
                        Activez cette option si vous gerez de la paie dans l entreprise.
                      </p>
                    </div>
                    <Switch
                      checked={reminderSettings.has_employees}
                      onCheckedChange={(checked) =>
                        setReminderSettings((prev) => ({
                          ...prev,
                          has_employees: checked,
                          payroll_day: checked ? prev.payroll_day : null,
                          dsn_due_day: checked ? prev.dsn_due_day || 15 : null,
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="employee_count">Nombre de salaries</Label>
                    <Input
                      id="employee_count"
                      type="number"
                      min={0}
                      value={reminderSettings.employee_count ?? ''}
                      onChange={(e) =>
                        setReminderSettings((prev) => ({
                          ...prev,
                          employee_count: e.target.value ? Number(e.target.value) : null,
                        }))
                      }
                      placeholder="Ex: 4"
                      disabled={!reminderSettings.has_employees}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="payroll_day">Jour habituel de paie</Label>
                    <Input
                      id="payroll_day"
                      type="number"
                      min={1}
                      max={31}
                      value={reminderSettings.payroll_day ?? ''}
                      onChange={(e) =>
                        setReminderSettings((prev) => ({
                          ...prev,
                          payroll_day: e.target.value ? Number(e.target.value) : null,
                        }))
                      }
                      placeholder="Ex: 28"
                      disabled={!reminderSettings.has_employees}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="dsn_due_day">Jour limite DSN</Label>
                    <Input
                      id="dsn_due_day"
                      type="number"
                      min={1}
                      max={31}
                      value={reminderSettings.dsn_due_day ?? ''}
                      onChange={(e) =>
                        setReminderSettings((prev) => ({
                          ...prev,
                          dsn_due_day: e.target.value ? Number(e.target.value) : null,
                        }))
                      }
                      placeholder="5 ou 15"
                      disabled={!reminderSettings.has_employees}
                    />
                    <p className="text-xs text-muted-foreground">
                      En general 5 ou 15 selon votre situation.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="social_contributions_day">Jour de cotisations dirigeant</Label>
                    <Input
                      id="social_contributions_day"
                      type="number"
                      min={1}
                      max={31}
                      value={reminderSettings.social_contributions_day ?? ''}
                      onChange={(e) =>
                        setReminderSettings((prev) => ({
                          ...prev,
                          social_contributions_day: e.target.value ? Number(e.target.value) : null,
                        }))
                      }
                      placeholder="Ex: 5 ou 20"
                    />
                  </div>
                </div>

                <div className="space-y-4 rounded-2xl border border-border bg-muted/10 p-4">
                  <div>
                    <h3 className="font-semibold text-foreground">Cloture et obligations</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Pour la cloture comptable, la liasse fiscale, la CFE et les rappels annuels.
                    </p>
                  </div>

                  <div className="grid grid-cols-[1fr_1fr] gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="fiscal_year_end_day">Jour de cloture</Label>
                      <Input
                        id="fiscal_year_end_day"
                        type="number"
                        min={1}
                        max={31}
                        value={reminderSettings.fiscal_year_end_day}
                        onChange={(e) =>
                          setReminderSettings((prev) => ({
                            ...prev,
                            fiscal_year_end_day: e.target.value ? Number(e.target.value) : 31,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fiscal_year_end_month">Mois de cloture</Label>
                      <select
                        id="fiscal_year_end_month"
                        value={reminderSettings.fiscal_year_end_month}
                        onChange={(e) =>
                          setReminderSettings((prev) => ({
                            ...prev,
                            fiscal_year_end_month: Number(e.target.value),
                          }))
                        }
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        {monthOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-border bg-background px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">Soumis a la CFE</p>
                      <p className="text-xs text-muted-foreground">
                        Activez si vous souhaitez des rappels CFE en juin et en decembre.
                      </p>
                    </div>
                    <Switch
                      checked={reminderSettings.cfe_applicable}
                      onCheckedChange={(checked) =>
                        setReminderSettings((prev) => ({ ...prev, cfe_applicable: checked }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-border bg-background px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">Taxe d apprentissage</p>
                      <p className="text-xs text-muted-foreground">
                        Utile si vous avez des salaries et souhaitez etre rappele pour la DSN d avril/mai.
                      </p>
                    </div>
                    <Switch
                      checked={reminderSettings.apprenticeship_tax_applicable}
                      onCheckedChange={(checked) =>
                        setReminderSettings((prev) => ({
                          ...prev,
                          apprenticeship_tax_applicable: checked,
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="accountant_notes">Notes ou consignes de l expert-comptable</Label>
                    <Textarea
                      id="accountant_notes"
                      value={reminderSettings.accountant_notes}
                      onChange={(e) =>
                        setReminderSettings((prev) => ({ ...prev, accountant_notes: e.target.value }))
                      }
                      placeholder="Ex: TVA le 19, cloture au 30/06, paie le 27..."
                    />
                  </div>
                </div>
              </div>

              {(profile?.siren || profile?.siret || profile?.tva_number || profile?.naf_label || profile?.company_address) && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
                  <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-emerald-600" />
                      <p className="text-sm font-semibold text-emerald-800">Informations detectees via Pappers</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={refreshFromPappers}
                      disabled={!profile?.siren || pappersRefreshing}
                      className="border-emerald-200 bg-white/80 text-emerald-800 hover:bg-white"
                    >
                      {pappersRefreshing ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="mr-2 h-4 w-4" />
                      )}
                      Rafraichir depuis Pappers
                    </Button>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {profile?.siren && (
                      <InfoTile label="SIREN" value={profile.siren} />
                    )}
                    {profile?.siret && (
                      <InfoTile label="SIRET" value={profile.siret} />
                    )}
                    {profile?.legal_form && (
                      <InfoTile label="Forme juridique" value={profile.legal_form} />
                    )}
                    {profile?.naf_label && (
                      <InfoTile
                        label="Activite detectee"
                        value={profile.naf_code ? `${profile.naf_code} - ${profile.naf_label}` : profile.naf_label}
                      />
                    )}
                    {profile?.tva_number && (
                      <InfoTile label="Numero de TVA" value={profile.tva_number} />
                    )}
                    {profile?.company_address && (
                      <InfoTile
                        label="Adresse"
                        value={[profile.company_address, profile.company_postal_code, profile.company_city].filter(Boolean).join(', ')}
                      />
                    )}
                    {profile?.company_website && (
                      <InfoTile label="Site web" value={profile.company_website} />
                    )}
                    {profile?.rcs && (
                      <InfoTile label="RCS" value={profile.rcs} />
                    )}
                    {profile?.capital && (
                      <InfoTile label="Capital" value={`${profile.capital.toLocaleString('fr-FR')} EUR`} />
                    )}
                  </div>
                  <p className="mt-3 text-xs text-emerald-700">
                    Ces informations sont reutilisees pour pre-remplir les rappels chef d entreprise quand elles sont fiables.
                  </p>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={saveReminderPreferences} disabled={savingReminders}>
                  {savingReminders ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Enregistrer mes rappels
                </Button>
                {saveReminderSuccess && (
                  <span className="inline-flex items-center gap-2 text-sm text-emerald-700">
                    <Check className="h-4 w-4" />
                    Reglages des rappels enregistres
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-xl">Sources de leads et partenaires</CardTitle>
              <CardDescription>
                Creez ici vos canaux d acquisition et vos apporteurs d affaires pour les reutiliser dans le CRM et mesurer leur performance dans le dashboard.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 rounded-2xl border border-primary/15 bg-primary/5 p-4 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Handshake className="h-4 w-4 text-primary" />
                    <p className="text-sm font-semibold text-foreground">Nouvelle source</p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="lead-source-name">Nom de la source</Label>
                      <Input
                        id="lead-source-name"
                        value={newLeadSource.name}
                        onChange={(e) => setNewLeadSource((prev) => ({ ...prev, name: e.target.value }))}
                        placeholder="Ex: Architecte Martin, Google Ads, Salon local"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lead-source-type">Type</Label>
                      <select
                        id="lead-source-type"
                        value={newLeadSource.source_type}
                        onChange={(e) =>
                          setNewLeadSource((prev) => ({
                            ...prev,
                            source_type: e.target.value as LeadSourceFormState['source_type'],
                          }))
                        }
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        <option value="channel">Canal d acquisition</option>
                        <option value="partner">Apporteur d affaires</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lead-source-contact">Contact</Label>
                      <Input
                        id="lead-source-contact"
                        value={newLeadSource.contact_name}
                        onChange={(e) => setNewLeadSource((prev) => ({ ...prev, contact_name: e.target.value }))}
                        placeholder="Nom du partenaire ou referent"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lead-source-reward">Idee de recompense</Label>
                      <Input
                        id="lead-source-reward"
                        value={newLeadSource.reward_note}
                        onChange={(e) => setNewLeadSource((prev) => ({ ...prev, reward_note: e.target.value }))}
                        placeholder="Ex: cadeau de fin d annee, commission, dejeuner"
                      />
                    </div>
                  </div>
                  <Button onClick={createLeadSource} disabled={creatingSource || !newLeadSource.name.trim()}>
                    {creatingSource ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                    Ajouter la source
                  </Button>
                </div>

                <div className="rounded-2xl border border-white/40 bg-background/70 p-4">
                  <p className="text-sm font-semibold text-foreground">Lecture rapide</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                    <div className="rounded-xl border border-border bg-card p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Sources actives</p>
                      <p className="mt-2 text-2xl font-semibold text-foreground">
                        {leadSources.filter((source) => source.is_active).length}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border bg-card p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Apporteurs actifs</p>
                      <p className="mt-2 text-2xl font-semibold text-foreground">{partnerSourcesCount}</p>
                    </div>
                    <div className="rounded-xl border border-border bg-card p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Usage CRM</p>
                      <p className="mt-2 text-sm font-medium text-foreground">
                        Chaque lead pourra etre rattache a la bonne source pour mesurer vos canaux qui signent vraiment.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {leadSources.map((source) => (
                  <div key={source.id} className="rounded-2xl border border-border bg-card p-4">
                    <div className="grid gap-4 lg:grid-cols-[1.1fr_0.7fr_0.8fr_0.9fr_auto] lg:items-end">
                      <div className="space-y-2">
                        <Label>Nom</Label>
                        <Input
                          value={source.name}
                          onChange={(e) => updateLeadSource(source.id, { name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Type</Label>
                        <select
                          value={source.source_type}
                          onChange={(e) => updateLeadSource(source.id, { source_type: e.target.value as LeadSource['source_type'] })}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                          <option value="channel">Canal</option>
                          <option value="partner">Partenaire</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label>Contact</Label>
                        <Input
                          value={source.contact_name}
                          onChange={(e) => updateLeadSource(source.id, { contact_name: e.target.value })}
                          placeholder="Nom du contact"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Recompense / geste</Label>
                        <Input
                          value={source.reward_note}
                          onChange={(e) => updateLeadSource(source.id, { reward_note: e.target.value })}
                          placeholder="Bon cadeau, commission, dejeuner..."
                        />
                      </div>
                      <div className="flex items-center gap-3 pb-2 lg:justify-end">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={source.is_active}
                            onCheckedChange={(checked) => updateLeadSource(source.id, { is_active: checked })}
                          />
                          <span className="text-sm text-muted-foreground">Actif</span>
                        </div>
                        <Button onClick={() => void saveLeadSource(source)} disabled={savingSourceId === source.id}>
                          {savingSourceId === source.id ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : source.source_type === 'partner' ? (
                            <Gift className="mr-2 h-4 w-4" />
                          ) : (
                            <Save className="mr-2 h-4 w-4" />
                          )}
                          Enregistrer
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {saveSourceSuccess && (
                <span className="inline-flex items-center gap-2 text-sm text-emerald-700">
                  <Check className="h-4 w-4" />
                  Sources mises a jour
                </span>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-xl">Etapes de votre pipe CRM</CardTitle>
              <CardDescription>
                Renommez les etapes de votre pipeline, changez leur ordre et donnez-leur une couleur. Les slugs metier restent stables pour ne pas casser les automatisations de devis et de chantiers.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-white/40 bg-background/70 p-4">
                <div className="grid gap-4 lg:grid-cols-[1fr_180px_120px_auto] lg:items-end">
                  <div className="space-y-2">
                    <Label>Nouvelle etape intermediaire</Label>
                    <Input
                      value={newLeadStage.label}
                      onChange={(e) => setNewLeadStage((prev) => ({ ...prev, label: e.target.value }))}
                      placeholder="Ex: Visite technique, Relance chaude, Accord oral"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Couleur</Label>
                    <select
                      value={newLeadStage.color}
                      onChange={(e) => setNewLeadStage((prev) => ({ ...prev, color: e.target.value }))}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      {LEAD_STAGE_COLOR_PRESETS.map((preset) => (
                        <option key={preset.value} value={preset.value}>
                          {preset.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Position</Label>
                    <Input
                      type="number"
                      min={0}
                      value={newLeadStage.position}
                      onChange={(e) =>
                        setNewLeadStage((prev) => ({ ...prev, position: Number(e.target.value || 0) }))
                      }
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button onClick={() => void createLeadStage()} disabled={creatingStage || !newLeadStage.label.trim()}>
                      {creatingStage ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                      Ajouter l etape
                    </Button>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {LEAD_STAGE_COLOR_PRESETS.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => setNewLeadStage((prev) => ({ ...prev, color: preset.value }))}
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition-colors ${
                        newLeadStage.color === preset.value
                          ? 'border-primary bg-primary/5 text-foreground'
                          : 'border-border bg-card text-muted-foreground'
                      }`}
                    >
                      <span className={`h-2.5 w-2.5 rounded-full ${preset.preview}`} />
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {leadStages
                .sort((a, b) => a.position - b.position)
                .map((stage) => (
                  <div key={stage.id} className="grid gap-4 rounded-2xl border border-border bg-card p-4 lg:grid-cols-[1fr_180px_120px_220px_auto] lg:items-end">
                    <div className="space-y-2">
                      <Label>Nom affiche</Label>
                      <Input
                        value={stage.label}
                        onChange={(e) => updateLeadStage(stage.id, { label: e.target.value })}
                        placeholder="Nom de l etape"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Couleur</Label>
                      <select
                        value={stage.color}
                        onChange={(e) => updateLeadStage(stage.id, { color: e.target.value })}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        {LEAD_STAGE_COLOR_PRESETS.map((preset) => (
                          <option key={preset.value} value={preset.value}>
                            {preset.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Position</Label>
                      <Input
                        type="number"
                        min={0}
                        value={stage.position}
                        onChange={(e) => updateLeadStage(stage.id, { position: Number(e.target.value || 0) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Role</Label>
                      <div className="flex h-10 items-center rounded-md border border-input bg-muted/30 px-3 text-sm text-muted-foreground">
                        {stage.is_terminal
                          ? 'Etape terminale'
                          : CORE_LEAD_STAGE_SLUGS.has(stage.slug)
                            ? 'Etape active du pipe'
                            : 'Etape intermediaire personnalisee'}
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button onClick={() => void saveLeadStage(stage)} disabled={savingStageId === stage.id}>
                        {savingStageId === stage.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Enregistrer
                      </Button>
                    </div>
                    <div className="lg:col-span-5">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="text-xs text-muted-foreground">Apercu :</span>
                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${stage.color}`}>
                          {stage.label}
                        </span>
                        {!CORE_LEAD_STAGE_SLUGS.has(stage.slug) && !stage.is_terminal && (
                          <span className="text-xs text-muted-foreground">
                            Cette etape sert de palier personnalise dans votre pipe.
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="space-y-6">
          <DocumentTemplateSettings />
        </TabsContent>

        <TabsContent value="abonnement" className="space-y-6">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-xl">Mon abonnement</CardTitle>
              <CardDescription>
                Retrouvez votre plan actuel, comparez les offres et gerez votre abonnement Stripe.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex flex-col gap-3 rounded-2xl border border-border bg-muted/20 p-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Plan actuel</p>
                  <div className="mt-1 flex items-center gap-3">
                    <span className={`inline-flex rounded-full border px-3 py-1 text-sm font-medium ${planBadgeClasses[currentPlan.key]}`}>
                      {currentPlan.name}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {currentPlan.key === 'starter' ? 'Gratuit' : `${currentPlan.price} EUR / mois`}
                    </span>
                  </div>
                  {profile?.plan_started_at && (
                    <p className="mt-2 text-sm text-muted-foreground">
                      Active depuis le {formatDate(profile.plan_started_at)}
                    </p>
                  )}
                </div>

                {profile?.plan !== 'starter' ? (
                  <div className="flex flex-wrap gap-3">
                    <Button
                      variant="outline"
                      onClick={openBillingPortal}
                      disabled={billingLoading === 'portal' || !profile?.stripe_customer_id}
                    >
                      {billingLoading === 'portal' ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <ExternalLink className="mr-2 h-4 w-4" />
                      )}
                      Gerer ou resilier dans Stripe
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Vous pouvez passer a un plan payant quand vous voulez.
                  </p>
                )}
              </div>

              {profile?.plan !== 'starter' && !profile?.stripe_customer_id && (
                <Alert>
                  <CreditCard className="h-4 w-4" />
                  <AlertTitle>Gestion automatique bientot disponible</AlertTitle>
                  <AlertDescription>
                    Votre plan est actif, mais nous n avons pas encore de client Stripe relie a ce compte. Le portail de gestion sera disponible des que la liaison Stripe sera terminee.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-5 xl:grid-cols-3">
            {plans.map((plan) => {
              const Icon = planIcons[plan.key];
              const isCurrent = profile?.plan === plan.key;
              const isPaidPlan = plan.key !== 'starter';
              const canCheckout = Boolean(plan.stripePriceId);

              return (
                <Card
                  key={plan.key}
                  className={`rounded-2xl transition-all ${plan.popular ? 'border-primary/30 shadow-md' : ''} ${isCurrent ? 'ring-2 ring-primary/20' : ''}`}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className="flex items-center gap-2 text-xl">
                          <Icon className="h-5 w-5 text-primary" />
                          {plan.name}
                        </CardTitle>
                        <CardDescription className="mt-2">{plan.description}</CardDescription>
                      </div>
                      {isCurrent && (
                        <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${planBadgeClasses[plan.key]}`}>
                          Plan actuel
                        </span>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div>
                      <p className="text-3xl font-semibold text-foreground">
                        {plan.key === 'starter' ? 'Gratuit' : `${plan.price} EUR`}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {plan.key === 'starter' ? 'Sans carte bancaire' : 'par mois'}
                      </p>
                    </div>

                    <ul className="space-y-2">
                      {plan.features.slice(0, 7).map((feature) => (
                        <li key={feature} className="flex items-start gap-2 text-sm text-foreground">
                          <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="pt-2">
                      {isCurrent ? (
                        <Button disabled className="w-full">
                          Plan actuel
                        </Button>
                      ) : plan.key === 'starter' ? (
                        <Button disabled variant="outline" className="w-full">
                          Plan gratuit
                        </Button>
                      ) : (
                        <Button
                          className="w-full"
                          onClick={() => launchCheckout(plan.key)}
                          disabled={billingLoading === plan.key || !canCheckout}
                        >
                          {billingLoading === plan.key ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <CreditCard className="mr-2 h-4 w-4" />
                          )}
                          Passer au plan {plan.name}
                        </Button>
                      )}
                    </div>

                    {isPaidPlan && !canCheckout && (
                      <p className="text-xs text-muted-foreground">
                        Ce plan n est pas encore configure dans Stripe.
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="securite" className="space-y-6">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-xl">Securite du compte</CardTitle>
              <CardDescription>
                Gardez une vue simple sur votre acces et deconnectez-vous proprement si besoin.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-border bg-muted/20 p-4">
                  <p className="text-sm text-muted-foreground">Email de connexion</p>
                  <p className="mt-1 font-medium text-foreground">{user?.email || 'Indisponible'}</p>
                </div>
                <div className="rounded-xl border border-border bg-muted/20 p-4">
                  <p className="text-sm text-muted-foreground">Onboarding</p>
                  <p className="mt-1 font-medium text-foreground">
                    {profile?.onboarding_completed ? 'Termine' : 'Encore en cours'}
                  </p>
                </div>
              </div>

              <Separator />

              <div className="flex flex-wrap items-center gap-3">
                <Button variant="outline" asChild>
                  <Link href="/aide">Ouvrir l aide</Link>
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    void signOut();
                  }}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Se deconnecter
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="chantier" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HardHat className="h-5 w-5" />
                Étapes d&apos;avancement
              </CardTitle>
              <CardDescription>
                Personnalisez les étapes de suivi de vos chantiers. Le poids détermine le pourcentage de progression associé à chaque étape (total = 100 %).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {phases.map((phase, index) => (
                <div key={phase.key} className="rounded-lg border border-border p-3 space-y-2 sm:border-0 sm:p-0 sm:space-y-0 sm:flex sm:items-center sm:gap-2">
                  <div className="flex items-center gap-2 sm:hidden">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">{index + 1}</span>
                    <Input
                      value={phase.label}
                      onChange={(e) => {
                        const updated = [...phases];
                        updated[index] = { ...phase, label: e.target.value };
                        setPhases(updated);
                      }}
                      className="flex-1 h-9"
                      placeholder="Nom de l'étape"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2 sm:hidden">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">Poids :</span>
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        value={phase.weight}
                        onChange={(e) => {
                          const updated = [...phases];
                          updated[index] = { ...phase, weight: parseInt(e.target.value) || 0 };
                          setPhases(updated);
                        }}
                        className="w-16 h-9 text-center"
                      />
                      <span className="text-sm text-muted-foreground">%</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-700 h-8 px-2"
                      onClick={() => setPhases(phases.filter((_, i) => i !== index))}
                      disabled={phases.length <= 1}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      <span className="text-xs">Supprimer</span>
                    </Button>
                  </div>
                  {/* Desktop layout */}
                  <GripVertical className="h-4 w-4 shrink-0 text-slate-400 hidden sm:block" />
                  <span className="hidden sm:block w-6 text-center text-xs font-medium text-slate-500">{index + 1}</span>
                  <Input
                    value={phase.label}
                    onChange={(e) => {
                      const updated = [...phases];
                      updated[index] = { ...phase, label: e.target.value };
                      setPhases(updated);
                    }}
                    className="hidden sm:block flex-1"
                    placeholder="Nom de l'étape"
                  />
                  <div className="hidden sm:flex items-center gap-1">
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      value={phase.weight}
                      onChange={(e) => {
                        const updated = [...phases];
                        updated[index] = { ...phase, weight: parseInt(e.target.value) || 0 };
                        setPhases(updated);
                      }}
                      className="w-20 text-center"
                    />
                    <span className="text-sm text-slate-500">%</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="hidden sm:flex shrink-0 text-red-500 hover:text-red-700"
                    onClick={() => setPhases(phases.filter((_, i) => i !== index))}
                    disabled={phases.length <= 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              {/* Total poids */}
              {(() => {
                const total = phases.reduce((s, p) => s + p.weight, 0);
                return (
                  <div className={`flex items-center justify-between rounded-lg border px-4 py-2 text-sm font-medium ${total === 100 ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
                    <span>Total des poids</span>
                    <span>{total} %{total !== 100 && ' — doit être égal à 100 %'}</span>
                  </div>
                );
              })()}

              {/* Ajouter une étape */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const key = `etape_${Date.now()}`;
                  setPhases([...phases, { key, label: '', weight: 5 }]);
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Ajouter une étape
              </Button>

              <Separator />

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  onClick={savePhases}
                  disabled={savingPhases || phases.reduce((s, p) => s + p.weight, 0) !== 100 || phases.some(p => !p.label.trim())}
                >
                  {savingPhases ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : savePhasesSuccess ? (
                    <Check className="mr-2 h-4 w-4" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  {savePhasesSuccess ? 'Enregistré !' : 'Enregistrer'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setPhases(DEFAULT_PROJECT_PHASES)}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Réinitialiser par défaut
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-emerald-200/70 bg-white/70 p-3">
      <p className="text-xs uppercase tracking-wide text-emerald-700/80">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-900">{value}</p>
    </div>
  );
}
