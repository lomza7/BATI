'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Shield, Users, CreditCard, TrendingUp, FileText, HardHat,
  Receipt, Contact, Target, RefreshCw, Crown, Zap, ChevronDown,
  UserCheck, UserX, Clock, CalendarDays, BarChart3,
  Save, Check, AlertCircle, ExternalLink, Loader2,
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

interface ChartPoint {
  label: string;
  value: number;
}

const periodLabels: Record<Period, string> = {
  day: "Aujourd'hui",
  week: 'Cette semaine',
  month: 'Ce mois',
  year: "Cette annee",
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
        error instanceof Error ? error.message : 'Impossible d enregistrer la configuration Stripe.'
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
  }, [authLoading, user, router, loadData, loadConfig]);

  if (authLoading || !isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center text-muted-foreground">
          <Shield className="h-10 w-10 mx-auto mb-3 animate-pulse" />
          <p className="text-sm">Verification des droits...</p>
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
            <RefreshCw className="h-3.5 w-3.5" /> Reessayer
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
      <PageHeader title="Administration" description="Vue d'ensemble de la plateforme Hellobat">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium">
            <Shield className="h-3.5 w-3.5" /> Admin
          </div>
          <Button size="sm" variant="outline" onClick={loadData} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" /> Rafraichir
          </Button>
        </div>
      </PageHeader>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4,5,6,7,8].map(i => <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />)}
        </div>
      ) : stats && (
        <>
          {/* Selecteur de periode */}
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
              label="MRR estime"
              value={formatCurrency(mrr)}
              sub={`${stats.plan_pro} Pro + ${stats.plan_business} Business`}
              accent
            />
            <KpiCard
              icon={UserCheck}
              label="Onboarding complete"
              value={stats.onboarding_completed}
              sub={`${stats.total_users > 0 ? Math.round((stats.onboarding_completed / stats.total_users) * 100) : 0}% des inscrits`}
            />
          </div>

          {/* Repartition par plan */}
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

          {/* Graphique inscriptions + KPIs activite */}
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
                  Aucune donnee pour cette periode
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

            {/* KPIs activite */}
            <div className="space-y-3">
              <MiniKpi icon={FileText} label="Devis crees" value={stats.total_quotes} />
              <MiniKpi icon={Receipt} label="Factures creees" value={stats.total_invoices} />
              <MiniKpi icon={HardHat} label="Chantiers" value={stats.total_projects} />
              <MiniKpi icon={Contact} label="Contacts" value={stats.total_clients} />
              <MiniKpi icon={Target} label="Leads CRM" value={stats.total_leads} />
              <MiniKpi icon={TrendingUp} label="CA devis acceptes" value={formatCurrency(stats.total_revenue_quotes)} accent />
              <MiniKpi icon={CreditCard} label="CA factures payees" value={formatCurrency(stats.total_revenue_invoices)} accent />
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
                  Modifiez ici les prix et les fonctionnalites affichees sur la landing pour chaque plan.
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
                {configSaved ? 'Enregistre !' : 'Enregistrer'}
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
                          Prix affiche : {stripeConfig[amountKey]} EUR/mois
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
                        <label className="text-xs font-medium text-muted-foreground">Prix affiche (EUR/mois)</label>
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
                        Fonctionnalites affichees sur la landing
                      </label>
                      <Textarea
                        className="mt-1 min-h-[160px] text-sm"
                        placeholder="Une fonctionnalite par ligne"
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
                        Le plan Starter reste gratuit. Aucun produit Stripe ni carte bancaire n est necessaire.
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
                  Pour creer ou modifier un prix, rendez-vous sur{' '}
                  <a href="https://dashboard.stripe.com/products" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                    dashboard.stripe.com/products
                  </a>
                  . Vous pouvez coller un Price ID (price_xxx) ou un Product ID (prod_xxx).
                </p>
              </div>
            </div>
          </div>

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
                  placeholder="Rechercher..."
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
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Derniere connexion</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs">Activite</th>
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
                      </tr>
                    );
                  })}
                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                        Aucun utilisateur trouve
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
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

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}
