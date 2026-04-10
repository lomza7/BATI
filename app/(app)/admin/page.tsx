'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Shield, Users, CreditCard, TrendingUp, FileText, HardHat,
  Receipt, Contact, Target, RefreshCw, Crown, Zap, ChevronDown,
  UserCheck, UserX, Clock, CalendarDays, BarChart3,
  Save, Check, AlertCircle, ExternalLink, Loader2, Globe,
  Brain, Ban, ShieldCheck, Wand2, Eye, EyeOff, Gift, Mail, Sparkles,
  Trash2, AlertTriangle, X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { formatCurrency } from '@/lib/constants';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  DEFAULT_PLAN_FEATURES,
  parsePlanFeatures,
  stringifyPlanFeatures,
  type PricingPlanKey,
} from '@/lib/pricing-plans';
import AdminAgentsSection from '@/components/admin/admin-agents-section';

const ADMIN_EMAIL = 'louis@maaza.pro';

type Period = 'day' | 'week' | 'month' | 'year';

interface Stats {
  total_users: number;
  users_today: number;
  users_this_week: number;
  users_this_month: number;
  users_this_year: number;
  onboarding_completed: number;
  plan_starter: number;
  plan_pro: number;
  plan_business: number;
  total_quotes: number;
  total_invoices: number;
  total_projects: number;
  total_clients: number;
  total_leads: number;
  total_revenue_quotes: number;
  total_revenue_invoices: number;
}

interface AdminUser {
  id: string;
  email: string;
  signed_up_at: string;
  last_sign_in_at: string | null;
  full_name: string | null;
  company_name: string | null;
  company_activity: string | null;
  company_city: string | null;
  team_size: string | null;
  plan: string;
  plan_started_at: string | null;
  onboarding_completed: boolean;
  quote_count: number;
  invoice_count: number;
  project_count: number;
  client_count: number;
}

interface AiUsageUser {
  user_id: string;
  company_name: string;
  full_name: string;
  plan: string;
  ai_blocked: boolean;
  ai_blocked_reason: string;
  calls: number;
  tokens: number;
  last_call: string | null;
  routes: Record<string, number>;
}

interface AiPlanLimit {
  plan: string;
  monthly_calls: number;
  monthly_tokens: number;
}

interface AdminSite {
  id: string;
  slug: string;
  status: string;
  theme: string;
  published_at: string | null;
  created_at: string;
  company_name: string;
  company_city: string;
  company_activity: string;
}

interface ChartPoint {
  label: string;
  value: number;
}

const periodLabels: Record<Period, string> = {
  day: "Aujourd'hui",
  week: 'Cette semaine',
  month: 'Ce mois',
  year: 'Cette année',
};

const planConfig = {
  starter: { label: 'Starter', color: 'bg-slate-100 text-slate-700', icon: Users },
  pro: { label: 'Pro', color: 'bg-blue-100 text-blue-700', icon: Zap },
  business: { label: 'Business', color: 'bg-amber-100 text-amber-700', icon: Crown },
};

function parseMonthlyPrice(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [chart, setChart] = useState<ChartPoint[]>([]);
  const [period, setPeriod] = useState<Period>('month');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [adminSites, setAdminSites] = useState<AdminSite[]>([]);
  const [sitesLoading, setSitesLoading] = useState(false);
  const [aiUsageUsers, setAiUsageUsers] = useState<AiUsageUser[]>([]);
  const [aiLimits, setAiLimits] = useState<AiPlanLimit[]>([]);
  const [aiUsageLoading, setAiUsageLoading] = useState(false);
  const [blockingUser, setBlockingUser] = useState<string | null>(null);

  // Suppression utilisateur
  const [userToDelete, setUserToDelete] = useState<AdminUser | null>(null);
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState('');
  const [deletingUser, setDeletingUser] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Stripe / pricing config
  const [configLoading, setConfigLoading] = useState(true);
  const [configSaving, setConfigSaving] = useState(false);
  const [configSaved, setConfigSaved] = useState(false);
  const [configError, setConfigError] = useState('');
  const [stripeConfig, setStripeConfig] = useState({
    stripe_price_starter: '',
    stripe_price_pro: '',
    stripe_price_business: '',
    price_starter: '0',
    price_pro: '49',
    price_business: '89',
  });
  const [stripeInfo, setStripeInfo] = useState<Record<string, { product_name: string; amount: number; interval: string | null; active: boolean } | null>>({});
  const [stripeFetching, setStripeFetching] = useState<string | null>(null);
  const [planFeatures, setPlanFeatures] = useState<Record<PricingPlanKey, string>>({
    starter: DEFAULT_PLAN_FEATURES.starter.join('\n'),
    pro: DEFAULT_PLAN_FEATURES.pro.join('\n'),
    business: DEFAULT_PLAN_FEATURES.business.join('\n'),
  });

  // AI image generation secrets (admin-only)
  const [imageSecrets, setImageSecrets] = useState({
    image_provider: 'openai',
    openai_api_key: '',
    openai_image_model: 'gpt-image-1',
    gemini_api_key: '',
    gemini_image_model: 'gemini-2.5-flash-image',
    groq_api_key: '',
  });
  const [imageSecretsLoading, setImageSecretsLoading] = useState(true);
  const [imageSecretsSaving, setImageSecretsSaving] = useState(false);
  const [imageSecretsSaved, setImageSecretsSaved] = useState(false);
  const [imageSecretsError, setImageSecretsError] = useState('');
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showGroqKey, setShowGroqKey] = useState(false);

  // Referrals
  const [referralStats, setReferralStats] = useState<{
    codes_total: number;
    invites_total: number;
    invites_opened: number;
    signups_total: number;
    subscribed_total: number;
    months_credited: number;
  } | null>(null);
  const [referralUsers, setReferralUsers] = useState<Array<{
    user_id: string;
    email: string;
    full_name: string | null;
    company_name: string | null;
    code: string;
    invites_sent: number;
    invites_opened: number;
    signups: number;
    subscribed: number;
    months_earned: number;
  }>>([]);
  const [referralLoading, setReferralLoading] = useState(false);

  const isAdmin = user?.email === ADMIN_EMAIL;

  const loadConfig = useCallback(async () => {
    setConfigLoading(true);
    const { data } = await supabase.rpc('get_platform_config');
    if (data) {
      const cfg = data as Record<string, string>;
      setStripeConfig(prev => ({
        ...prev,
        stripe_price_starter: cfg.stripe_price_starter || '',
        stripe_price_pro: cfg.stripe_price_pro || '',
        stripe_price_business: cfg.stripe_price_business || '',
        price_starter: cfg.price_starter || '0',
        price_pro: cfg.price_pro || '49',
        price_business: cfg.price_business || '89',
      }));
      setPlanFeatures({
        starter: parsePlanFeatures(cfg.features_starter, DEFAULT_PLAN_FEATURES.starter).join('\n'),
        pro: parsePlanFeatures(cfg.features_pro, DEFAULT_PLAN_FEATURES.pro).join('\n'),
        business: parsePlanFeatures(cfg.features_business, DEFAULT_PLAN_FEATURES.business).join('\n'),
      });
    }
    setConfigLoading(false);
  }, []);

  async function saveConfig() {
    setConfigSaving(true);
    setConfigSaved(false);
    setConfigError('');
    try {
      const normalizedConfig = {
        ...stripeConfig,
        stripe_price_starter: '',
        price_starter: '0',
      };
      const featureConfig = {
        features_starter: stringifyPlanFeatures(parsePlanFeatures(planFeatures.starter, DEFAULT_PLAN_FEATURES.starter)),
        features_pro: stringifyPlanFeatures(parsePlanFeatures(planFeatures.pro, DEFAULT_PLAN_FEATURES.pro)),
        features_business: stringifyPlanFeatures(parsePlanFeatures(planFeatures.business, DEFAULT_PLAN_FEATURES.business)),
      };

      const results = await Promise.all(
        Object.entries({ ...normalizedConfig, ...featureConfig }).map(async ([key, value]) => {
          const result = await supabase.rpc('update_platform_config', {
            config_key: key,
            config_value: value,
          });

          return { key, error: result.error };
        })
      );

      const failed = results.find((result) => result.error);
      if (failed?.error) {
        throw new Error(failed.error.message);
      }

      setStripeConfig(normalizedConfig);
      await loadConfig();
      setConfigSaved(true);
      setTimeout(() => setConfigSaved(false), 3000);
    } catch (error) {
      setConfigError(
        error instanceof Error ? error.message : "Impossible d'enregistrer la configuration Stripe."
      );
    } finally {
      setConfigSaving(false);
    }
  }

  async function fetchStripePrice(plan: string) {
    if (plan === 'starter') {
      setStripeInfo(prev => ({ ...prev, starter: null }));
      setStripeConfig(prev => ({
        ...prev,
        stripe_price_starter: '',
        price_starter: '0',
      }));
      return;
    }

    const priceId = stripeConfig[`stripe_price_${plan}` as keyof typeof stripeConfig];
    const priceKey = `stripe_price_${plan}` as keyof typeof stripeConfig;
    if (!priceId) return;
    setStripeFetching(plan);
    try {
      const res = await fetch('/api/stripe/prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ price_id: priceId }),
      });
      const data = await res.json();
      if (data.error) {
        setStripeInfo(prev => ({ ...prev, [plan]: null }));
      } else {
        setStripeInfo(prev => ({ ...prev, [plan]: data }));
        // Auto-update displayed price from Stripe
        setStripeConfig(prev => ({
          ...prev,
          [priceKey]: data.price_id,
          [`price_${plan}`]: String(data.amount),
        }));
      }
    } catch {
      setStripeInfo(prev => ({ ...prev, [plan]: null }));
    } finally {
      setStripeFetching(null);
    }
  }

  const loadSites = useCallback(async () => {
    setSitesLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      const res = await fetch('/api/admin/sites', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAdminSites(data.sites || []);
      }
    } catch {
      // silent
    } finally {
      setSitesLoading(false);
    }
  }, []);

  const loadImageSecrets = useCallback(async () => {
    setImageSecretsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      const res = await fetch('/api/admin/secrets', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const json = await res.json() as { secrets?: Record<string, { value: string }> };
        const s = json.secrets || {};
        setImageSecrets({
          image_provider: s.image_provider?.value || 'openai',
          openai_api_key: s.openai_api_key?.value || '',
          openai_image_model: s.openai_image_model?.value || 'gpt-image-1',
          gemini_api_key: s.gemini_api_key?.value || '',
          gemini_image_model: s.gemini_image_model?.value || 'gemini-2.5-flash-image',
          groq_api_key: s.groq_api_key?.value || '',
        });
      }
    } catch {
      // silent
    } finally {
      setImageSecretsLoading(false);
    }
  }, []);

  async function saveImageSecrets() {
    setImageSecretsSaving(true);
    setImageSecretsSaved(false);
    setImageSecretsError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Session expiree');
      const res = await fetch('/api/admin/secrets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ updates: imageSecrets }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Erreur de sauvegarde');
      }
      setImageSecretsSaved(true);
      setTimeout(() => setImageSecretsSaved(false), 3000);
    } catch (e) {
      setImageSecretsError(e instanceof Error ? e.message : 'Erreur de sauvegarde');
    } finally {
      setImageSecretsSaving(false);
    }
  }

  const loadAiUsage = useCallback(async () => {
    setAiUsageLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      const res = await fetch('/api/admin/ai-usage', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAiUsageUsers(data.users || []);
        setAiLimits(data.limits || []);
      }
    } catch {
      // silent
    } finally {
      setAiUsageLoading(false);
    }
  }, []);

  const loadReferrals = useCallback(async () => {
    setReferralLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      const res = await fetch('/api/admin/referrals', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setReferralStats(data.stats || null);
        setReferralUsers(data.referrers || []);
      }
    } catch {
      // silent
    } finally {
      setReferralLoading(false);
    }
  }, []);

  async function toggleBlockUser(userId: string, currentlyBlocked: boolean) {
    setBlockingUser(userId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      const res = await fetch('/api/admin/ai-usage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: 'toggle_block',
          user_id: userId,
          blocked: !currentlyBlocked,
          reason: !currentlyBlocked ? 'Bloqué par l\u2019administrateur' : '',
        }),
      });
      if (res.ok) {
        setAiUsageUsers(prev =>
          prev.map(u =>
            u.user_id === userId
              ? { ...u, ai_blocked: !currentlyBlocked, ai_blocked_reason: !currentlyBlocked ? 'Bloqué par l\u2019administrateur' : '' }
              : u
          )
        );
      }
    } catch {
      // silent
    } finally {
      setBlockingUser(null);
    }
  }

  async function handleDeleteUser() {
    if (!userToDelete) return;
    setDeletingUser(true);
    setDeleteError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Session expiree');
      const res = await fetch('/api/admin/delete-user', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          user_id: userToDelete.id,
          confirm_email: deleteConfirmEmail.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Erreur lors de la suppression');
      }
      // Retirer de la liste locale
      setUsers(prev => prev.filter(u => u.id !== userToDelete.id));
      setUserToDelete(null);
      setDeleteConfirmEmail('');
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Erreur inconnue');
    } finally {
      setDeletingUser(false);
    }
  }

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [statsRes, usersRes, chartRes] = await Promise.all([
        supabase.rpc('get_admin_stats'),
        supabase.rpc('get_admin_users'),
        supabase.rpc('get_admin_signups_over_time', { period }),
      ]);

      if (statsRes.error) throw statsRes.error;
      if (usersRes.error) throw usersRes.error;

      setStats(statsRes.data as Stats);
      setUsers((usersRes.data as AdminUser[]) || []);
      setChart((chartRes.data as ChartPoint[]) || []);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.email !== ADMIN_EMAIL) {
      router.replace('/dashboard');
      return;
    }
    loadData();
    loadConfig();
    loadSites();
    loadAiUsage();
    loadImageSecrets();
    loadReferrals();
  }, [authLoading, user, router, loadData, loadConfig, loadSites, loadAiUsage, loadImageSecrets, loadReferrals]);

  if (authLoading || !isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center text-muted-foreground">
          <Shield className="h-10 w-10 mx-auto mb-3 animate-pulse" />
          <p className="text-sm">Vérification des droits…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Administration" description="Tableau de bord administrateur" />
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
          <Shield className="h-8 w-8 mx-auto mb-2 text-destructive" />
          <p className="text-sm text-destructive font-medium mb-1">Erreur de chargement</p>
          <p className="text-xs text-muted-foreground mb-4">{error}</p>
          <Button size="sm" onClick={loadData} className="gap-2">
            <RefreshCw className="h-3.5 w-3.5" /> Réessayer
          </Button>
        </div>
      </div>
    );
  }

  const filteredUsers = users.filter(u => {
    if (!userSearch) return true;
    const q = userSearch.toLowerCase();
    return (
      u.email.toLowerCase().includes(q) ||
      u.full_name?.toLowerCase().includes(q) ||
      u.company_name?.toLowerCase().includes(q) ||
      u.company_city?.toLowerCase().includes(q)
    );
  });

  const usersForPeriod = period === 'day' ? stats?.users_today :
    period === 'week' ? stats?.users_this_week :
    period === 'month' ? stats?.users_this_month :
    stats?.users_this_year;

  const maxChart = Math.max(...(chart.map(c => c.value) || [1]), 1);

  const monthlyPrices = {
    starter: 0,
    pro: parseMonthlyPrice(stripeConfig.price_pro, 49),
    business: parseMonthlyPrice(stripeConfig.price_business, 89),
  };
  const payingUsers = (stats?.plan_pro || 0) + (stats?.plan_business || 0);
  const mrr =
    (stats?.plan_pro || 0) * monthlyPrices.pro +
    (stats?.plan_business || 0) * monthlyPrices.business;

  return (
    <div className="space-y-6">
      <PageHeader title="Administration" description="Vue d&apos;ensemble de la plateforme Hellobat">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium">
            <Shield className="h-3.5 w-3.5" /> Admin
          </div>
          <Button size="sm" variant="outline" onClick={loadData} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" /> Rafraîchir
          </Button>
        </div>
      </PageHeader>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4,5,6,7,8].map(i => <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />)}
        </div>
      ) : stats && (
        <>
          {/* Sélecteur de période */}
          <div className="flex gap-2 flex-wrap">
            {(Object.entries(periodLabels) as [Period, string][]).map(([key, label]) => (
              <Button
                key={key}
                variant={period === key ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPeriod(key)}
              >
                {label}
              </Button>
            ))}
          </div>

          {/* KPIs principaux */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              icon={Users}
              label="Utilisateurs totaux"
              value={stats.total_users}
              sub={`+${usersForPeriod || 0} ${periodLabels[period].toLowerCase()}`}
              accent
            />
            <KpiCard
              icon={CreditCard}
              label="Utilisateurs payants"
              value={payingUsers}
              sub={`${stats.total_users > 0 ? Math.round((payingUsers / stats.total_users) * 100) : 0}% de conversion`}
            />
            <KpiCard
              icon={TrendingUp}
              label="MRR estimé"
              value={formatCurrency(mrr)}
              sub={`${stats.plan_pro} Pro + ${stats.plan_business} Business`}
              accent
            />
            <KpiCard
              icon={UserCheck}
              label="Onboarding complété"
              value={stats.onboarding_completed}
              sub={`${stats.total_users > 0 ? Math.round((stats.onboarding_completed / stats.total_users) * 100) : 0}% des inscrits`}
            />
          </div>

          {/* Répartition par plan */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {(Object.entries(planConfig) as [keyof typeof planConfig, typeof planConfig[keyof typeof planConfig]][]).map(([key, conf]) => {
              const count = key === 'starter' ? stats.plan_starter : key === 'pro' ? stats.plan_pro : stats.plan_business;
              const pct = stats.total_users > 0 ? Math.round((count / stats.total_users) * 100) : 0;
              const price = monthlyPrices[key];
              return (
                <div key={key} className="rounded-xl border border-border bg-card p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={cn('p-2 rounded-lg', conf.color.split(' ')[0])}>
                        <conf.icon className={cn('h-4 w-4', conf.color.split(' ')[1])} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{conf.label}</p>
                        <p className="text-xs text-muted-foreground">{price} EUR/mois</p>
                      </div>
                    </div>
                    <span className={cn('text-xs px-2.5 py-1 rounded-full font-medium', conf.color)}>
                      {count} utilisateur{count > 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all', key === 'starter' ? 'bg-slate-400' : key === 'pro' ? 'bg-blue-500' : 'bg-amber-500')}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">{pct}% des utilisateurs</p>
                </div>
              );
            })}
          </div>

          {/* Graphique inscriptions + KPIs activité */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Graphique */}
            <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-semibold">Inscriptions</h3>
                  <p className="text-xs text-muted-foreground">{periodLabels[period]}</p>
                </div>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </div>
              {chart.length === 0 ? (
                <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">
                  Aucune donnée pour cette période
                </div>
              ) : (
                <div className="flex items-end gap-1.5 h-40">
                  {chart.map((point, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[10px] font-medium text-foreground">{point.value}</span>
                      <div
                        className="w-full bg-primary/80 rounded-t-sm min-h-[4px] transition-all"
                        style={{ height: `${(point.value / maxChart) * 120}px` }}
                      />
                      <span className="text-[8px] text-muted-foreground truncate max-w-full">{point.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* KPIs activité */}
            <div className="space-y-3">
              <MiniKpi icon={FileText} label="Devis créés" value={stats.total_quotes} />
              <MiniKpi icon={Receipt} label="Factures créées" value={stats.total_invoices} />
              <MiniKpi icon={HardHat} label="Chantiers" value={stats.total_projects} />
              <MiniKpi icon={Contact} label="Contacts" value={stats.total_clients} />
              <MiniKpi icon={Target} label="Leads CRM" value={stats.total_leads} />
              <MiniKpi icon={TrendingUp} label="CA devis acceptés" value={formatCurrency(stats.total_revenue_quotes)} accent />
              <MiniKpi icon={CreditCard} label="CA factures payées" value={formatCurrency(stats.total_revenue_invoices)} accent />
            </div>
          </div>

          {/* Configuration Stripe & Tarifs */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-primary" /> Configuration Stripe & Tarifs
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Modifiez ici les prix et les fonctionnalités affichées sur la landing pour chaque plan.
                </p>
              </div>
              <Button
                size="sm"
                onClick={saveConfig}
                disabled={configSaving}
                className="gap-1.5"
              >
                {configSaving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : configSaved ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                {configSaved ? 'Enregistré !' : 'Enregistrer'}
              </Button>
            </div>

            <div className="p-4 sm:p-5 space-y-6">
              {configError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {configError}
                </div>
              )}

              {(['starter', 'pro', 'business'] as const).map((plan) => {
                const conf = planConfig[plan];
                const priceKey = `stripe_price_${plan}` as keyof typeof stripeConfig;
                const amountKey = `price_${plan}` as keyof typeof stripeConfig;
                const info = stripeInfo[plan];
                return (
                  <div key={plan} className="rounded-lg border border-border p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className={cn('p-2 rounded-lg', conf.color.split(' ')[0])}>
                        <conf.icon className={cn('h-4 w-4', conf.color.split(' ')[1])} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{conf.label}</p>
                        <p className="text-xs text-muted-foreground">
                          Prix affiché : {stripeConfig[amountKey]} EUR/mois
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Stripe Price ID ou Product ID</label>
                        <div className="flex gap-2 mt-1">
                          <Input
                            placeholder={plan === 'starter' ? 'Aucun ID Stripe requis pour Starter' : 'price_1Abc... ou prod_1Abc...'}
                            className="text-xs font-mono"
                            value={plan === 'starter' ? '' : stripeConfig[priceKey]}
                            onChange={e => setStripeConfig(prev => ({ ...prev, [priceKey]: e.target.value }))}
                            disabled={plan === 'starter'}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => fetchStripePrice(plan)}
                            disabled={plan === 'starter' || !stripeConfig[priceKey] || stripeFetching === plan}
                            className="shrink-0"
                          >
                            {stripeFetching === plan ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <RefreshCw className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Prix affiché (EUR/mois)</label>
                        <Input
                          type="number"
                          className="mt-1"
                          value={plan === 'starter' ? '0' : stripeConfig[amountKey]}
                          onChange={e => setStripeConfig(prev => ({ ...prev, [amountKey]: e.target.value }))}
                          disabled={plan === 'starter'}
                        />
                      </div>
                    </div>

                    <div className="mt-3">
                      <label className="text-xs font-medium text-muted-foreground">
                        Fonctionnalités affichées sur la landing
                      </label>
                      <Textarea
                        className="mt-1 min-h-[160px] text-sm"
                        placeholder="Une fonctionnalité par ligne"
                        value={planFeatures[plan]}
                        onChange={(event) =>
                          setPlanFeatures((prev) => ({
                            ...prev,
                            [plan]: event.target.value,
                          }))
                        }
                      />
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Une ligne = une puce visible sur la landing.
                      </p>
                    </div>

                    {plan === 'starter' && (
                      <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                        Le plan Starter reste gratuit. Aucun produit Stripe ni carte bancaire n&apos;est nécessaire.
                      </div>
                    )}

                    {info && (
                      <div className="mt-3 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 flex items-start gap-2">
                        <Check className="h-3.5 w-3.5 text-emerald-600 mt-0.5 shrink-0" />
                        <div className="text-xs text-emerald-700">
                          <span className="font-medium">{info.product_name}</span> — {info.amount} {info.interval ? `EUR/${info.interval}` : 'EUR'}
                          {!info.active && <span className="text-red-600 ml-2">(inactif)</span>}
                        </div>
                      </div>
                    )}
                    {info === null && stripeConfig[priceKey] && (
                      <div className="mt-3 p-2.5 rounded-lg bg-red-50 border border-red-200 flex items-center gap-2">
                        <AlertCircle className="h-3.5 w-3.5 text-red-600 shrink-0" />
                        <span className="text-xs text-red-700">ID Stripe invalide, produit sans prix actif ou erreur Stripe</span>
                      </div>
                    )}
                  </div>
                );
              })}

              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border">
                <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                <p className="text-xs text-muted-foreground">
                  Pour créer ou modifier un prix, rendez-vous sur{' '}
                  <a href="https://dashboard.stripe.com/products" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                    dashboard.stripe.com/products
                  </a>
                  . Vous pouvez coller un Price ID (price_xxx) ou un Product ID (prod_xxx).
                </p>
              </div>
            </div>
          </div>

          {/* Services IA externes */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between flex-wrap gap-3">
              <div>
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Wand2 className="h-4 w-4 text-primary" /> Services IA externes
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Clés API pour la génération Avant/Après (OpenAI/Gemini) et la dictée vocale de devis (Groq).
                </p>
              </div>
              <Button
                size="sm"
                onClick={saveImageSecrets}
                disabled={imageSecretsSaving || imageSecretsLoading}
                className="gap-1.5"
              >
                {imageSecretsSaving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : imageSecretsSaved ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                {imageSecretsSaved ? 'Enregistré !' : 'Enregistrer'}
              </Button>
            </div>

            <div className="p-4 sm:p-5 space-y-5">
              {imageSecretsError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {imageSecretsError}
                </div>
              )}

              {/* Provider selector */}
              <div>
                <label className="text-xs font-medium text-muted-foreground">Provider actif</label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {([
                    { key: 'openai', label: 'OpenAI', sub: 'gpt-image-1' },
                    { key: 'gemini', label: 'Google Gemini', sub: 'gemini image' },
                  ] as const).map((p) => {
                    const active = imageSecrets.image_provider === p.key;
                    return (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => setImageSecrets((prev) => ({ ...prev, image_provider: p.key }))}
                        className={cn(
                          'rounded-lg border p-3 text-left transition-colors',
                          active
                            ? 'border-primary bg-primary/5 ring-1 ring-primary'
                            : 'border-border hover:bg-muted/40'
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <Wand2 className={cn('h-4 w-4', active ? 'text-primary' : 'text-muted-foreground')} />
                          <span className="text-sm font-medium">{p.label}</span>
                          {active && <Check className="h-3.5 w-3.5 text-primary ml-auto" />}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1">{p.sub}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* OpenAI config */}
              <div className="rounded-lg border border-border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">OpenAI</p>
                  <a
                    href="https://platform.openai.com/api-keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-primary inline-flex items-center gap-1 hover:underline"
                  >
                    Obtenir une clé <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Clé API (sk-…)</label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      type={showOpenaiKey ? 'text' : 'password'}
                      placeholder="sk-..."
                      className="text-xs font-mono"
                      value={imageSecrets.openai_api_key}
                      onChange={(e) => setImageSecrets((prev) => ({ ...prev, openai_api_key: e.target.value }))}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowOpenaiKey((v) => !v)}
                      className="shrink-0"
                    >
                      {showOpenaiKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Modèle</label>
                  <Input
                    className="mt-1 text-xs font-mono"
                    value={imageSecrets.openai_image_model}
                    onChange={(e) => setImageSecrets((prev) => ({ ...prev, openai_image_model: e.target.value }))}
                    placeholder="gpt-image-1"
                  />
                </div>
              </div>

              {/* Gemini config */}
              <div className="rounded-lg border border-border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">Google Gemini</p>
                  <a
                    href="https://aistudio.google.com/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-primary inline-flex items-center gap-1 hover:underline"
                  >
                    Obtenir une clé <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Clé API</label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      type={showGeminiKey ? 'text' : 'password'}
                      placeholder="AIza..."
                      className="text-xs font-mono"
                      value={imageSecrets.gemini_api_key}
                      onChange={(e) => setImageSecrets((prev) => ({ ...prev, gemini_api_key: e.target.value }))}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowGeminiKey((v) => !v)}
                      className="shrink-0"
                    >
                      {showGeminiKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Modèle</label>
                  <Input
                    className="mt-1 text-xs font-mono"
                    value={imageSecrets.gemini_image_model}
                    onChange={(e) => setImageSecrets((prev) => ({ ...prev, gemini_image_model: e.target.value }))}
                    placeholder="gemini-2.5-flash-image"
                  />
                </div>
              </div>

              {/* Groq config (transcription vocale) */}
              <div className="rounded-lg border border-border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">Groq Whisper (dictée vocale)</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Utilisé pour transcrire la voix des artisans dans l&apos;assistant devis IA.
                    </p>
                  </div>
                  <a
                    href="https://console.groq.com/keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-primary inline-flex items-center gap-1 hover:underline shrink-0"
                  >
                    Obtenir une clé <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Clé API (gsk_…)</label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      type={showGroqKey ? 'text' : 'password'}
                      placeholder="gsk_..."
                      className="text-xs font-mono"
                      value={imageSecrets.groq_api_key}
                      onChange={(e) => setImageSecrets((prev) => ({ ...prev, groq_api_key: e.target.value }))}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowGroqKey((v) => !v)}
                      className="shrink-0"
                    >
                      {showGroqKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border border-border">
                <ShieldCheck className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground">
                  Les clés sont stockées dans une table protégée par RLS, accessible uniquement par toi.
                  Elles ne sont jamais exposées aux autres utilisateurs ni côté client.
                </p>
              </div>
            </div>
          </div>

          {/* Sites deployes */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Globe className="h-4 w-4 text-primary" /> Sites déployés
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {adminSites.length} site{adminSites.length > 1 ? 's' : ''} — {adminSites.filter(s => s.status === 'published').length} publié{adminSites.filter(s => s.status === 'published').length > 1 ? 's' : ''}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={loadSites} disabled={sitesLoading} className="gap-1.5">
                <RefreshCw className={cn('h-3.5 w-3.5', sitesLoading && 'animate-spin')} />
              </Button>
            </div>
            {adminSites.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                {sitesLoading ? 'Chargement…' : 'Aucun site créé pour le moment'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Entreprise</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Slug</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Thème</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Statut</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Publié le</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs">Lien</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminSites.map(site => (
                      <tr key={site.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium text-foreground text-xs">{site.company_name}</p>
                          <p className="text-[11px] text-muted-foreground">{[site.company_activity, site.company_city].filter(Boolean).join(' · ')}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-mono text-muted-foreground">{site.slug}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs capitalize">{site.theme}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn(
                            'text-[11px] px-2 py-0.5 rounded-full font-medium',
                            site.status === 'published' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                          )}>
                            {site.status === 'published' ? 'Publié' : 'Brouillon'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-muted-foreground">
                            {site.published_at ? formatShortDate(site.published_at) : '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {site.status === 'published' ? (
                            <a
                              href={`https://${site.slug}.hellobat.app`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                            >
                              Voir <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Utilisation IA */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Brain className="h-4 w-4 text-primary" /> Utilisation IA (ce mois)
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {aiUsageUsers.reduce((s, u) => s + u.calls, 0)} appels — {formatTokens(aiUsageUsers.reduce((s, u) => s + u.tokens, 0))} tokens
                </p>
              </div>
              <div className="flex items-center gap-2">
                {/* Limits display */}
                <div className="hidden sm:flex items-center gap-3 text-[11px] text-muted-foreground mr-2">
                  {aiLimits.map(l => (
                    <span key={l.plan} className="capitalize">
                      {l.plan}: {l.monthly_calls === -1 ? '∞' : l.monthly_calls} appels
                    </span>
                  ))}
                </div>
                <Button size="sm" variant="outline" onClick={loadAiUsage} disabled={aiUsageLoading} className="gap-1.5">
                  <RefreshCw className={cn('h-3.5 w-3.5', aiUsageLoading && 'animate-spin')} />
                </Button>
              </div>
            </div>
            {aiUsageUsers.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                {aiUsageLoading ? 'Chargement…' : 'Aucune utilisation IA ce mois'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Utilisateur</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Plan</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs">Appels</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs">Tokens</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Routes</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Dernier appel</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aiUsageUsers.map(u => {
                      const limit = aiLimits.find(l => l.plan === u.plan);
                      const overLimit = limit && limit.monthly_calls !== -1 && u.calls >= limit.monthly_calls;
                      return (
                        <tr key={u.user_id} className={cn('border-b border-border hover:bg-muted/20 transition-colors', u.ai_blocked && 'bg-red-50/50')}>
                          <td className="px-4 py-3">
                            <p className="font-medium text-foreground text-xs">{u.company_name}</p>
                            <p className="text-[11px] text-muted-foreground">{u.full_name}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className={cn(
                              'text-[11px] px-2 py-0.5 rounded-full font-medium capitalize',
                              u.plan === 'business' ? 'bg-amber-100 text-amber-700' :
                              u.plan === 'pro' ? 'bg-blue-100 text-blue-700' :
                              'bg-slate-100 text-slate-700'
                            )}>
                              {u.plan}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className={cn('text-xs font-semibold', overLimit ? 'text-red-600' : 'text-foreground')}>
                              {u.calls}
                              {limit && limit.monthly_calls !== -1 && (
                                <span className="text-muted-foreground font-normal">/{limit.monthly_calls}</span>
                              )}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-xs text-foreground">{formatTokens(u.tokens)}</span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1.5 flex-wrap">
                              {Object.entries(u.routes).map(([route, count]) => (
                                <span key={route} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                  {route.replace('ai/', '')} ({count})
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs text-muted-foreground">
                              {u.last_call ? formatShortDate(u.last_call) : '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              size="sm"
                              variant={u.ai_blocked ? 'outline' : 'destructive'}
                              className="h-7 text-xs gap-1"
                              onClick={() => toggleBlockUser(u.user_id, u.ai_blocked)}
                              disabled={blockingUser === u.user_id}
                            >
                              {blockingUser === u.user_id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : u.ai_blocked ? (
                                <><ShieldCheck className="h-3 w-3" /> Débloquer</>
                              ) : (
                                <><Ban className="h-3 w-3" /> Bloquer</>
                              )}
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Parrainages */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Gift className="h-4 w-4 text-primary" /> Parrainages
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Suivez l&apos;efficacité du programme de parrainage (2 mois offerts par filleul abonné).
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={loadReferrals} disabled={referralLoading} className="gap-1.5">
                <RefreshCw className={cn('h-3.5 w-3.5', referralLoading && 'animate-spin')} />
              </Button>
            </div>

            {/* KPIs parrainage */}
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 p-4 sm:p-5 border-b border-border bg-muted/20">
              <ReferralKpi label="Codes générés" value={referralStats?.codes_total || 0} icon={Gift} />
              <ReferralKpi label="Emails envoyés" value={referralStats?.invites_total || 0} icon={Mail} />
              <ReferralKpi label="Emails ouverts" value={referralStats?.invites_opened || 0} icon={Eye} />
              <ReferralKpi label="Inscriptions" value={referralStats?.signups_total || 0} icon={UserCheck} />
              <ReferralKpi label="Abonnés" value={referralStats?.subscribed_total || 0} icon={CreditCard} accent />
              <ReferralKpi label="Mois crédités" value={referralStats?.months_credited || 0} icon={Sparkles} accent />
            </div>

            {referralUsers.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                {referralLoading ? 'Chargement…' : 'Aucun parrain pour le moment'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Parrain</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Code</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs">Envoyés</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs">Ouverts</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs">Inscrits</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs">Abonnés</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs">Mois gagnés</th>
                    </tr>
                  </thead>
                  <tbody>
                    {referralUsers.map(r => (
                      <tr key={r.user_id} className="border-b border-border hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium text-foreground text-xs">{r.full_name || r.company_name || '—'}</p>
                          <p className="text-[11px] text-muted-foreground">{r.email}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-mono text-muted-foreground">{r.code}</span>
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-foreground">{r.invites_sent}</td>
                        <td className="px-4 py-3 text-right text-xs text-foreground">{r.invites_opened}</td>
                        <td className="px-4 py-3 text-right text-xs text-foreground">{r.signups}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={cn('text-xs font-semibold', r.subscribed > 0 ? 'text-emerald-600' : 'text-foreground')}>
                            {r.subscribed}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={cn('text-xs font-semibold', r.months_earned > 0 ? 'text-primary' : 'text-muted-foreground')}>
                            {r.months_earned}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Agents IA plateforme */}
          <AdminAgentsSection />

          {/* Tableau utilisateurs */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">Tous les utilisateurs</h3>
                <p className="text-xs text-muted-foreground">{users.length} utilisateur{users.length > 1 ? 's' : ''} inscrits</p>
              </div>
              <div className="relative w-full sm:w-64">
                <input
                  type="text"
                  placeholder="Rechercher…"
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Utilisateur</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Entreprise</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Plan</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Inscription</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Dernière connexion</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs">Activité</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(u => {
                    const plan = planConfig[u.plan as keyof typeof planConfig] || planConfig.starter;
                    return (
                      <tr key={u.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-foreground text-xs">{u.full_name || '—'}</p>
                            <p className="text-[11px] text-muted-foreground">{u.email}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="text-xs text-foreground">{u.company_name || '—'}</p>
                            <p className="text-[11px] text-muted-foreground">{[u.company_activity, u.company_city].filter(Boolean).join(' · ') || '—'}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn('text-[11px] px-2 py-0.5 rounded-full font-medium', plan.color)}>
                            {plan.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            {u.onboarding_completed ? (
                              <UserCheck className="h-3 w-3 text-emerald-500" />
                            ) : (
                              <UserX className="h-3 w-3 text-muted-foreground" />
                            )}
                            <span className="text-xs text-muted-foreground">{formatShortDate(u.signed_up_at)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <Clock className="h-3 w-3" />
                            {u.last_sign_in_at ? formatShortDate(u.last_sign_in_at) : 'Jamais'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-3 text-[11px] text-muted-foreground">
                            <span title="Devis">{u.quote_count} devis</span>
                            <span title="Factures">{u.invoice_count} fact.</span>
                            <span title="Chantiers">{u.project_count} chant.</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {u.email === ADMIN_EMAIL ? (
                            <span className="text-[10px] text-muted-foreground italic">admin</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setUserToDelete(u);
                                setDeleteConfirmEmail('');
                                setDeleteError('');
                              }}
                              title="Supprimer définitivement cet utilisateur"
                              className="inline-flex items-center justify-center h-7 w-7 rounded-lg border border-border bg-white text-muted-foreground hover:text-destructive hover:border-destructive/40 hover:bg-destructive/5 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">
                        Aucun utilisateur trouvé
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Modal de suppression utilisateur */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
            <div className="flex items-start justify-between p-5 border-b border-border bg-destructive/5">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-destructive/10 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Supprimer définitivement</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Cette action est irréversible.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (deletingUser) return;
                  setUserToDelete(null);
                  setDeleteConfirmEmail('');
                  setDeleteError('');
                }}
                className="h-7 w-7 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground"
                disabled={deletingUser}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Utilisateur ciblé</p>
                <p className="text-sm font-semibold text-foreground mt-0.5">
                  {userToDelete.full_name || userToDelete.company_name || '—'}
                </p>
                <p className="text-xs text-muted-foreground">{userToDelete.email}</p>
                <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                  <span>{userToDelete.quote_count} devis</span>
                  <span>·</span>
                  <span>{userToDelete.invoice_count} factures</span>
                  <span>·</span>
                  <span>{userToDelete.project_count} chantiers</span>
                  <span>·</span>
                  <span>{userToDelete.client_count} contacts</span>
                </div>
              </div>

              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs text-amber-900 leading-relaxed">
                  Toutes les données métier (devis, factures, chantiers, contacts, documents,
                  fichiers de stockage, abonnement, etc.) seront définitivement supprimées.
                  L&apos;adresse email sera libérée et pourra être réutilisée pour un nouveau compte.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">
                  Pour confirmer, retapez l&apos;email :{' '}
                  <span className="font-mono text-destructive">{userToDelete.email}</span>
                </label>
                <input
                  type="email"
                  value={deleteConfirmEmail}
                  onChange={e => setDeleteConfirmEmail(e.target.value)}
                  placeholder={userToDelete.email}
                  className="w-full h-10 px-3 rounded-lg border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-destructive/20 focus:border-destructive"
                  disabled={deletingUser}
                />
              </div>

              {deleteError && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-2.5 flex items-start gap-2">
                  <AlertCircle className="h-3.5 w-3.5 text-destructive flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-destructive">{deleteError}</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 p-4 border-t border-border bg-muted/20">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setUserToDelete(null);
                  setDeleteConfirmEmail('');
                  setDeleteError('');
                }}
                disabled={deletingUser}
              >
                Annuler
              </Button>
              <Button
                size="sm"
                onClick={handleDeleteUser}
                disabled={
                  deletingUser ||
                  deleteConfirmEmail.trim().toLowerCase() !==
                    userToDelete.email.toLowerCase()
                }
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-1.5"
              >
                {deletingUser ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Suppression…
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    Supprimer définitivement
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, sub, accent }: { icon: React.ElementType; label: string; value: string | number; sub: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
        <Icon className={cn('h-4 w-4', accent ? 'text-primary' : 'text-muted-foreground')} />
      </div>
      <p className="text-xl sm:text-2xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
    </div>
  );
}

function MiniKpi({ icon: Icon, label, value, accent }: { icon: React.ElementType; label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
      <Icon className={cn('h-4 w-4 shrink-0', accent ? 'text-primary' : 'text-muted-foreground')} />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
      <p className={cn('text-sm font-semibold', accent ? 'text-primary' : 'text-foreground')}>{value}</p>
    </div>
  );
}

function ReferralKpi({ icon: Icon, label, value, accent }: { icon: React.ElementType; label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
        <Icon className={cn('h-3.5 w-3.5', accent ? 'text-primary' : 'text-muted-foreground')} />
      </div>
      <p className={cn('text-lg font-bold', accent ? 'text-primary' : 'text-foreground')}>{value}</p>
    </div>
  );
}

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}k`;
  return String(tokens);
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}
