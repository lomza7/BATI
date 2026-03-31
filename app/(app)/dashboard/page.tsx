'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowRight,
  BellRing,
  CalendarClock,
  CircleAlert,
  Euro,
  FileText,
  FolderKanban,
  TrendingUp,
  Users,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import {
  INVOICE_STATUSES,
  MEMBER_TYPES,
  PROJECT_STATUSES,
  QUOTE_STATUSES,
  formatCurrency,
  formatDate,
} from '@/lib/constants';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';

interface QuoteRow {
  id: string;
  quote_number: string;
  title: string;
  status: keyof typeof QUOTE_STATUSES;
  total_ttc: number;
  valid_until: string | null;
  created_at: string;
  updated_at: string;
  clients: { name: string } | null;
}

interface InvoiceRow {
  id: string;
  invoice_number: string;
  title: string;
  status: keyof typeof INVOICE_STATUSES;
  total_ttc: number;
  due_date: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
  clients: { name: string } | null;
}

interface ProjectRow {
  id: string;
  name: string;
  status: keyof typeof PROJECT_STATUSES;
  budget: number;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
  clients: { name: string } | null;
}

interface TeamMemberRow {
  id: string;
  name: string;
  type: keyof typeof MEMBER_TYPES;
  status: string;
  color: string | null;
}

interface PlanningEventRow {
  id: string;
  title: string;
  event_type: string;
  start_date: string;
  end_date: string;
  team_member_id: string | null;
  team_members: { name: string; color: string | null } | null;
}

type ActivityItem = {
  id: string;
  label: string;
  time: string;
  color: string;
  href: string;
};

type DeadlineItem = {
  id: string;
  label: string;
  date: string;
  badgeLabel: string;
  badgeColor: string;
  href: string;
};

type ReminderItem = {
  id: string;
  title: string;
  description: string;
  dueLabel: string;
  priority: 'high' | 'medium' | 'low';
  href: string;
  actionLabel: string;
  kind: 'commercial' | 'facturation' | 'chantier' | 'administratif';
};

type RevenuePoint = {
  month: string;
  encaisse: number;
  devis: number;
};

type FunnelPoint = {
  label: string;
  value: number;
  fill: string;
};

const revenueChartConfig = {
  encaisse: {
    label: 'Encaisse',
    color: 'hsl(var(--chart-1))',
  },
  devis: {
    label: 'Devis crees',
    color: 'hsl(var(--chart-3))',
  },
} satisfies ChartConfig;

const funnelChartConfig = {
  value: {
    label: 'Volume',
    color: 'hsl(var(--chart-2))',
  },
} satisfies ChartConfig;

function differenceInDays(targetDate: string, now = new Date()) {
  const target = new Date(targetDate);
  target.setHours(0, 0, 0, 0);
  const current = new Date(now);
  current.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - current.getTime()) / (1000 * 60 * 60 * 24));
}

function getReminderPriorityClasses(priority: ReminderItem['priority']) {
  if (priority === 'high') {
    return 'border-red-200 bg-red-50 text-red-700';
  }

  if (priority === 'medium') {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }

  return 'border-blue-200 bg-blue-50 text-blue-700';
}

function getReminderKindLabel(kind: ReminderItem['kind']) {
  switch (kind) {
    case 'commercial':
      return 'Commercial';
    case 'facturation':
      return 'Facturation';
    case 'chantier':
      return 'Chantier';
    case 'administratif':
      return 'Administratif';
    default:
      return 'Rappel';
  }
}

function getMonthRange(baseDate = new Date()) {
  const start = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
  const end = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

function isBetween(dateValue: string | null, start: Date, end: Date) {
  if (!dateValue) return false;
  const date = new Date(dateValue);
  return date >= start && date <= end;
}

function getRelativeTimeLabel(dateValue: string) {
  const now = new Date();
  const target = new Date(dateValue);
  const diffMs = target.getTime() - now.getTime();
  const diffMinutes = Math.round(diffMs / (1000 * 60));
  const rtf = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' });

  if (Math.abs(diffMinutes) < 60) {
    return rtf.format(diffMinutes, 'minute');
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) {
    return rtf.format(diffHours, 'hour');
  }

  const diffDays = Math.round(diffHours / 24);
  if (Math.abs(diffDays) < 30) {
    return rtf.format(diffDays, 'day');
  }

  const diffMonths = Math.round(diffDays / 30);
  return rtf.format(diffMonths, 'month');
}

function toNumber(value: number | string | null | undefined) {
  return Number(value || 0);
}

function buildMonthlySeries(quotes: QuoteRow[], invoices: InvoiceRow[]) {
  const now = new Date();
  const points: RevenuePoint[] = [];

  for (let offset = 5; offset >= 0; offset -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const monthLabel = date.toLocaleDateString('fr-FR', { month: 'short' });
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);

    points.push({
      month: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
      encaisse: invoices
        .filter((invoice) => invoice.status === 'payee' && isBetween(invoice.paid_at, start, end))
        .reduce((sum, invoice) => sum + invoice.total_ttc, 0),
      devis: quotes
        .filter((quote) => isBetween(quote.created_at, start, end))
        .reduce((sum, quote) => sum + quote.total_ttc, 0),
    });
  }

  return points;
}

export default function DashboardPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMemberRow[]>([]);
  const [planningEvents, setPlanningEvents] = useState<PlanningEventRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }

    void loadDashboard();
  }, [authLoading, user]);

  async function loadDashboard() {
    setLoading(true);

    const [quotesRes, invoicesRes, projectsRes, teamMembersRes, planningEventsRes] = await Promise.all([
      supabase
        .from('quotes')
        .select('id, quote_number, title, status, total_ttc, valid_until, created_at, updated_at, clients(name)')
        .order('created_at', { ascending: false }),
      supabase
        .from('invoices')
        .select('id, invoice_number, title, status, total_ttc, due_date, paid_at, created_at, updated_at, clients(name)')
        .order('created_at', { ascending: false }),
      supabase
        .from('projects')
        .select('id, name, status, budget, start_date, end_date, created_at, updated_at, clients(name)')
        .order('created_at', { ascending: false }),
      supabase
        .from('team_members')
        .select('id, name, type, status, color')
        .order('name'),
      supabase
        .from('planning_events')
        .select('id, title, event_type, start_date, end_date, team_member_id, team_members(name, color)')
        .order('start_date'),
    ]);

    setQuotes(((quotesRes.data as unknown as QuoteRow[]) || []).map((quote) => ({
      ...quote,
      total_ttc: toNumber(quote.total_ttc),
    })));
    setInvoices(((invoicesRes.data as unknown as InvoiceRow[]) || []).map((invoice) => ({
      ...invoice,
      total_ttc: toNumber(invoice.total_ttc),
    })));
    setProjects(((projectsRes.data as unknown as ProjectRow[]) || []).map((project) => ({
      ...project,
      budget: toNumber(project.budget),
    })));
    setTeamMembers((teamMembersRes.data as TeamMemberRow[]) || []);
    setPlanningEvents((planningEventsRes.data as unknown as PlanningEventRow[]) || []);
    setLoading(false);
  }

  const dashboardData = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const currentMonth = getMonthRange(now);
    const previousMonth = getMonthRange(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    const last30Days = new Date(now);
    last30Days.setDate(last30Days.getDate() - 30);
    const previous30Days = new Date(last30Days);
    previous30Days.setDate(previous30Days.getDate() - 30);
    const nextWeek = new Date(now);
    nextWeek.setDate(nextWeek.getDate() + 7);

    const paidThisMonth = invoices.filter(
      (invoice) => invoice.status === 'payee' && isBetween(invoice.paid_at, currentMonth.start, currentMonth.end)
    );
    const paidPreviousMonth = invoices.filter(
      (invoice) => invoice.status === 'payee' && isBetween(invoice.paid_at, previousMonth.start, previousMonth.end)
    );
    const revenueThisMonth = paidThisMonth.reduce((sum, invoice) => sum + invoice.total_ttc, 0);
    const revenuePreviousMonth = paidPreviousMonth.reduce((sum, invoice) => sum + invoice.total_ttc, 0);
    const revenueDelta = revenuePreviousMonth > 0
      ? Math.round(((revenueThisMonth - revenuePreviousMonth) / revenuePreviousMonth) * 100)
      : revenueThisMonth > 0
        ? 100
        : 0;

    const pendingQuotes = quotes.filter((quote) => quote.status === 'envoye');
    const quotesToRelaunch = pendingQuotes.filter((quote) => {
      if (!quote.valid_until) return false;
      const validUntil = new Date(quote.valid_until);
      const daysLeft = Math.ceil((validUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return daysLeft <= 7;
    });

    const acceptedWindow = quotes.filter((quote) => {
      const updated = new Date(quote.updated_at || quote.created_at);
      return updated >= last30Days && quote.status === 'accepte';
    }).length;
    const decidedWindow = quotes.filter((quote) => {
      const updated = new Date(quote.updated_at || quote.created_at);
      return updated >= last30Days && ['accepte', 'refuse', 'expire'].includes(quote.status);
    }).length;
    const acceptanceRate = decidedWindow > 0 ? Math.round((acceptedWindow / decidedWindow) * 100) : 0;

    const acceptedPreviousWindow = quotes.filter((quote) => {
      const updated = new Date(quote.updated_at || quote.created_at);
      return updated >= previous30Days && updated < last30Days && quote.status === 'accepte';
    }).length;
    const decidedPreviousWindow = quotes.filter((quote) => {
      const updated = new Date(quote.updated_at || quote.created_at);
      return updated >= previous30Days && updated < last30Days && ['accepte', 'refuse', 'expire'].includes(quote.status);
    }).length;
    const previousAcceptanceRate = decidedPreviousWindow > 0
      ? Math.round((acceptedPreviousWindow / decidedPreviousWindow) * 100)
      : 0;
    const acceptanceDelta = acceptanceRate - previousAcceptanceRate;

    const activityItems: ActivityItem[] = [
      ...quotes.slice(0, 4).map((quote) => ({
        id: `quote-${quote.id}`,
        label: `${quote.quote_number} • ${QUOTE_STATUSES[quote.status]?.label || 'Devis'}${quote.clients?.name ? ` • ${quote.clients.name}` : ''}`,
        time: getRelativeTimeLabel(quote.updated_at || quote.created_at),
        color: quote.status === 'accepte'
          ? 'bg-emerald-500'
          : quote.status === 'refuse'
            ? 'bg-red-500'
            : 'bg-blue-500',
        href: '/devis',
      })),
      ...invoices.slice(0, 4).map((invoice) => ({
        id: `invoice-${invoice.id}`,
        label: `${invoice.invoice_number} • ${INVOICE_STATUSES[invoice.status]?.label || 'Facture'}${invoice.clients?.name ? ` • ${invoice.clients.name}` : ''}`,
        time: getRelativeTimeLabel(invoice.updated_at || invoice.created_at),
        color: invoice.status === 'payee'
          ? 'bg-emerald-500'
          : invoice.status === 'en_retard'
            ? 'bg-red-500'
            : 'bg-amber-500',
        href: '/factures',
      })),
      ...projects.slice(0, 4).map((project) => ({
        id: `project-${project.id}`,
        label: `${project.name} • ${(PROJECT_STATUSES[project.status] || PROJECT_STATUSES.a_planifier).label}`,
        time: getRelativeTimeLabel(project.updated_at || project.created_at),
        color: project.status === 'termine'
          ? 'bg-emerald-500'
          : project.status === 'en_pause'
            ? 'bg-amber-500'
            : 'bg-primary',
        href: '/chantiers',
      })),
    ].slice(0, 8);

    const deadlineItems: DeadlineItem[] = [
      ...invoices
        .filter((invoice) => invoice.due_date && invoice.status !== 'payee' && new Date(invoice.due_date) >= now)
        .map((invoice) => ({
          id: `invoice-${invoice.id}`,
          label: invoice.title || invoice.invoice_number,
          date: invoice.due_date as string,
          badgeLabel: INVOICE_STATUSES[invoice.status]?.label || 'Facture',
          badgeColor: INVOICE_STATUSES[invoice.status]?.color || INVOICE_STATUSES.brouillon.color,
          href: '/factures',
        })),
      ...projects
        .filter((project) => project.start_date && project.status === 'a_planifier' && new Date(project.start_date) >= now)
        .map((project) => ({
          id: `project-${project.id}`,
          label: project.name,
          date: project.start_date as string,
          badgeLabel: 'Demarrage chantier',
          badgeColor: 'bg-blue-50 text-blue-700',
          href: '/chantiers',
        })),
      ...quotes
        .filter((quote) => quote.valid_until && quote.status === 'envoye' && new Date(quote.valid_until) >= now)
        .map((quote) => ({
          id: `quote-${quote.id}`,
          label: quote.title || quote.quote_number,
          date: quote.valid_until as string,
          badgeLabel: 'Validite devis',
          badgeColor: 'bg-amber-50 text-amber-700',
          href: '/devis',
        })),
    ]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 6);

    const reminderItems: ReminderItem[] = [
      ...invoices
        .filter((invoice) => invoice.status === 'en_retard' && invoice.due_date)
        .map((invoice) => {
          const daysLate = Math.max(1, Math.abs(differenceInDays(invoice.due_date as string, now)));
          return {
            id: `invoice-overdue-${invoice.id}`,
            title: `Relancer ${invoice.invoice_number}`,
            description: `${invoice.clients?.name || 'Un client'} n'a pas encore regle cette facture.`,
            dueLabel: `En retard depuis ${daysLate} jour${daysLate > 1 ? 's' : ''}`,
            priority: 'high' as const,
            href: '/factures',
            actionLabel: 'Voir les factures',
            kind: 'facturation' as const,
          };
        }),
      ...invoices
        .filter((invoice) => (invoice.status === 'envoyee' || invoice.status === 'brouillon') && invoice.due_date)
        .map((invoice) => {
          const days = differenceInDays(invoice.due_date as string, now);
          if (days < 0 || days > 7) return null;

          return {
            id: `invoice-due-${invoice.id}`,
            title: `Suivre ${invoice.invoice_number}`,
            description: `${invoice.clients?.name || 'Ce client'} arrive a l'echeance de paiement.`,
            dueLabel: days === 0 ? 'Echeance aujourd’hui' : `Echeance dans ${days} jour${days > 1 ? 's' : ''}`,
            priority: days <= 2 ? 'high' as const : 'medium' as const,
            href: '/factures',
            actionLabel: 'Ouvrir les factures',
            kind: 'facturation' as const,
          };
        })
        .filter(Boolean) as ReminderItem[],
      ...quotes
        .filter((quote) => quote.status === 'envoye')
        .map((quote) => {
          const sentSinceDays = Math.max(0, Math.floor((now.getTime() - new Date(quote.created_at).getTime()) / (1000 * 60 * 60 * 24)));
          if (sentSinceDays < 3) return null;

          return {
            id: `quote-relaunch-${quote.id}`,
            title: `Relancer ${quote.quote_number}`,
            description: `${quote.clients?.name || 'Ce client'} n'a pas encore repondu au devis.`,
            dueLabel: `Envoye il y a ${sentSinceDays} jour${sentSinceDays > 1 ? 's' : ''}`,
            priority: sentSinceDays >= 7 ? 'high' as const : 'medium' as const,
            href: '/devis',
            actionLabel: 'Voir les devis',
            kind: 'commercial' as const,
          };
        })
        .filter(Boolean) as ReminderItem[],
      ...quotes
        .filter((quote) => quote.status === 'envoye' && quote.valid_until)
        .map((quote) => {
          const days = differenceInDays(quote.valid_until as string, now);
          if (days < 0 || days > 7) return null;

          return {
            id: `quote-expiry-${quote.id}`,
            title: `Validite bientot atteinte pour ${quote.quote_number}`,
            description: `${quote.clients?.name || 'Ce client'} doit etre relance avant expiration.`,
            dueLabel: days === 0 ? 'Expire aujourd’hui' : `Expire dans ${days} jour${days > 1 ? 's' : ''}`,
            priority: days <= 2 ? 'high' as const : 'medium' as const,
            href: '/devis',
            actionLabel: 'Verifier le devis',
            kind: 'commercial' as const,
          };
        })
        .filter(Boolean) as ReminderItem[],
      ...projects
        .filter((project) => project.status === 'a_planifier' && project.start_date)
        .map((project) => {
          const days = differenceInDays(project.start_date as string, now);
          if (days < 0 || days > 7) return null;

          return {
            id: `project-start-${project.id}`,
            title: `Preparer ${project.name}`,
            description: `${project.clients?.name || 'Le client'} attend le lancement du chantier.`,
            dueLabel: days === 0 ? 'Demarrage aujourd’hui' : `Demarrage dans ${days} jour${days > 1 ? 's' : ''}`,
            priority: days <= 2 ? 'high' as const : 'medium' as const,
            href: '/chantiers',
            actionLabel: 'Voir le chantier',
            kind: 'chantier' as const,
          };
        })
        .filter(Boolean) as ReminderItem[],
      ...projects
        .filter((project) => project.status === 'en_cours' && project.end_date)
        .map((project) => {
          const days = differenceInDays(project.end_date as string, now);
          if (days < 0 || days > 3) return null;

          return {
            id: `project-end-${project.id}`,
            title: `Clore ${project.name}`,
            description: 'Pensez a finaliser le chantier, envoyer la facture et demander un avis client.',
            dueLabel: days === 0 ? 'Fin prevue aujourd’hui' : `Fin prevue dans ${days} jour${days > 1 ? 's' : ''}`,
            priority: days === 0 ? 'high' as const : 'low' as const,
            href: '/chantiers',
            actionLabel: 'Suivre le chantier',
            kind: 'chantier' as const,
          };
        })
        .filter(Boolean) as ReminderItem[],
    ]
      .sort((a, b) => {
        const priorityWeight = { high: 0, medium: 1, low: 2 };
        return priorityWeight[a.priority] - priorityWeight[b.priority];
      })
      .slice(0, 6);

    const revenueChartData = buildMonthlySeries(quotes, invoices);
    const funnelChartData: FunnelPoint[] = [
      {
        label: 'Devis en attente',
        value: pendingQuotes.length,
        fill: 'hsl(var(--chart-3))',
      },
      {
        label: 'Factures a encaisser',
        value: invoices.filter((invoice) => invoice.status === 'envoyee' || invoice.status === 'en_retard').length,
        fill: 'hsl(var(--chart-1))',
      },
      {
        label: 'Chantiers en cours',
        value: projects.filter((project) => project.status === 'en_cours').length,
        fill: 'hsl(var(--chart-2))',
      },
      {
        label: 'A planifier',
        value: projects.filter((project) => project.status === 'a_planifier').length,
        fill: 'hsl(var(--chart-4))',
      },
    ];

    return {
      revenueThisMonth,
      revenuePreviousMonth,
      revenueDelta,
      pendingQuotes,
      quotesToRelaunch,
      acceptanceRate,
      acceptanceDelta,
      activityItems,
      deadlineItems,
      reminderItems,
      revenueChartData,
      funnelChartData,
      hasAnyData: quotes.length > 0 || invoices.length > 0 || projects.length > 0,
      activeProjects: projects.filter((project) => project.status === 'en_cours').length,
      unpaidInvoicesTotal: invoices
        .filter((invoice) => invoice.status === 'envoyee' || invoice.status === 'en_retard')
        .reduce((sum, invoice) => sum + invoice.total_ttc, 0),
      openProjectsBudget: projects
        .filter((project) => project.status !== 'termine')
        .reduce((sum, project) => sum + project.budget, 0),
      activePipelineTotal: quotes
        .filter((quote) => quote.status === 'brouillon' || quote.status === 'envoye')
        .reduce((sum, quote) => sum + quote.total_ttc, 0),
      projectsToLaunchSoon: projects.filter((project) => {
        if (project.status !== 'a_planifier' || !project.start_date) return false;
        const days = differenceInDays(project.start_date, now);
        return days >= 0 && days <= 7;
      }).length,
      activeTeamMembers: teamMembers.filter((member) => member.status === 'actif'),
      nextPlanningEvents: planningEvents
        .filter((event) => new Date(event.start_date) >= todayStart)
        .slice(0, 3),
      planningThisWeekCount: planningEvents.filter((event) => {
        const start = new Date(event.start_date);
        return start >= todayStart && start <= nextWeek;
      }).length,
    };
  }, [invoices, planningEvents, projects, quotes, teamMembers]);

  const revenueSubtitle = dashboardData.revenuePreviousMonth > 0
    ? `vs ${formatCurrency(dashboardData.revenuePreviousMonth)} le mois dernier`
    : dashboardData.revenueThisMonth > 0
      ? 'Premier encaissement enregistre ce mois-ci'
      : 'Aucun paiement enregistre ce mois-ci';

  const acceptanceSubtitle = quotes.length > 0
    ? 'Sur les devis decides des 30 derniers jours'
    : 'Le taux apparaitra des que vous aurez des devis';

  const displayName = profile?.company_name || profile?.full_name || 'BatiFlow';
  const topPriorityReminder = dashboardData.reminderItems[0] || null;
  const nextDeadline = dashboardData.deadlineItems[0] || null;

  if (authLoading || loading) {
    return (
      <div className="space-y-5 sm:space-y-8">
        <div className="h-44 animate-pulse rounded-3xl bg-muted" />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="h-40 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <div className="xl:col-span-2 h-96 animate-pulse rounded-xl bg-muted" />
          <div className="h-96 animate-pulse rounded-xl bg-muted" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 sm:space-y-8">
      <PageHeader
        title="Tableau de bord"
        description="Le cockpit de votre activite : tresorerie, pipeline, chantiers et actions a lancer."
      >
        <Button asChild variant="outline">
          <Link href="/planning">Voir le planning</Link>
        </Button>
        <Button asChild>
          <Link href="/devis">Nouveau devis</Link>
        </Button>
      </PageHeader>

      {!dashboardData.hasAnyData ? (
        <EmptyState
          icon={FolderKanban}
          title="Votre tableau de bord se remplira automatiquement"
          description="Votre compte est pret. Creez un premier client, un devis ou un chantier pour voir vos vrais indicateurs apparaitre ici."
        >
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button asChild>
              <Link href="/devis">Creer un devis</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/clients">Ajouter un client</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/chantiers">Creer un chantier</Link>
            </Button>
          </div>
        </EmptyState>
      ) : (
        <>
          <section className="overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/10 via-background to-chart-3/10">
            <div className="grid gap-6 p-5 sm:p-6 xl:grid-cols-[1.35fr_0.95fr] xl:items-end">
              <div className="space-y-4">
                <Badge variant="outline" className="border-primary/20 bg-background/70 text-primary">
                  Vue dirigeant
                </Badge>
                <div className="space-y-1">
                  <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                    Bonjour {displayName}, voici ce qui merite votre attention aujourd&apos;hui.
                  </h2>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button asChild>
                    <Link href="/factures">Voir les encaissements</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href="/chantiers">Suivre les chantiers</Link>
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-2">
                <Link
                  href={topPriorityReminder?.href || '/dashboard'}
                  className="rounded-2xl border border-white/40 bg-white/70 p-4 backdrop-blur transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Priorite du jour</p>
                      <p className="mt-2 text-lg font-semibold text-foreground">
                        {topPriorityReminder ? topPriorityReminder.title : 'Rien d urgent'}
                      </p>
                    </div>
                    <div className="rounded-xl bg-primary/10 p-2 text-primary">
                      <BellRing className="h-5 w-5" />
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {topPriorityReminder
                      ? topPriorityReminder.dueLabel
                      : 'Votre tableau est calme pour le moment.'}
                  </p>
                </Link>
                <Link
                  href={nextDeadline?.href || '/planning'}
                  className="rounded-2xl border border-white/40 bg-white/70 p-4 backdrop-blur transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Prochaine echeance</p>
                      <p className="mt-2 text-lg font-semibold text-foreground">
                        {nextDeadline ? nextDeadline.label : 'Aucune urgence planifiee'}
                      </p>
                    </div>
                    <div className="rounded-xl bg-primary/10 p-2 text-primary">
                      <CalendarClock className="h-5 w-5" />
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {nextDeadline ? formatDate(nextDeadline.date) : 'Rien a surveiller cette semaine.'}
                  </p>
                </Link>
                <Link
                  href="/chantiers"
                  className="rounded-2xl border border-white/40 bg-white/70 p-4 backdrop-blur transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Chantiers a lancer</p>
                      <p className="mt-2 text-2xl font-semibold text-foreground">{dashboardData.projectsToLaunchSoon}</p>
                    </div>
                    <div className="rounded-xl bg-primary/10 p-2 text-primary">
                      <FolderKanban className="h-5 w-5" />
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {dashboardData.projectsToLaunchSoon > 0
                      ? 'Des lancements sont a caler dans les 7 prochains jours.'
                      : 'Aucun demarrage imminent a preparer.'}
                  </p>
                </Link>
                <Link
                  href="/planning"
                  className="rounded-2xl border border-white/40 bg-white/70 p-4 backdrop-blur transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Equipe et planning</p>
                      <p className="mt-2 text-2xl font-semibold text-foreground">
                        {dashboardData.activeTeamMembers.length}
                      </p>
                    </div>
                    <div className="rounded-xl bg-primary/10 p-2 text-primary">
                      <Users className="h-5 w-5" />
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {dashboardData.activeTeamMembers.filter((member) => member.type === 'salarie').length} salaries actifs,
                    {' '}
                    {dashboardData.activeTeamMembers.filter((member) => member.type !== 'salarie').length} prestataires et
                    {' '}
                    {dashboardData.planningThisWeekCount} element(s) planifies cette semaine.
                  </p>
                </Link>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <Link href="/factures" className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl">
              <KpiCard
                title="CA encaisse ce mois"
                value={formatCurrency(dashboardData.revenueThisMonth)}
                subtitle={revenueSubtitle}
                trend={
                  dashboardData.revenueThisMonth > 0 || dashboardData.revenuePreviousMonth > 0
                    ? {
                        value: `${dashboardData.revenueDelta >= 0 ? '+' : ''}${dashboardData.revenueDelta}%`,
                        positive: dashboardData.revenueDelta >= 0,
                      }
                    : undefined
                }
                icon={Euro}
              />
            </Link>
            <Link href="/devis" className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl">
              <KpiCard
                title="Devis en attente"
                value={String(dashboardData.pendingQuotes.length)}
                subtitle={
                  dashboardData.quotesToRelaunch.length > 0
                    ? `${dashboardData.quotesToRelaunch.length} a relancer cette semaine`
                    : 'Aucune relance urgente pour le moment'
                }
                icon={FileText}
              />
            </Link>
            <Link href="/devis" className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl">
              <KpiCard
                title="Taux d'acceptation"
                value={`${dashboardData.acceptanceRate}%`}
                subtitle={acceptanceSubtitle}
                trend={
                  quotes.length > 0
                    ? {
                        value: `${dashboardData.acceptanceDelta >= 0 ? '+' : ''}${dashboardData.acceptanceDelta} pts`,
                        positive: dashboardData.acceptanceDelta >= 0,
                      }
                    : undefined
                }
                icon={TrendingUp}
              />
            </Link>
            <Link href="/chantiers" className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl">
              <KpiCard
                title="Chantiers en cours"
                value={String(dashboardData.activeProjects)}
                subtitle={dashboardData.activeProjects > 0 ? 'Suivis actifs en ce moment' : 'Aucun chantier actif actuellement'}
                icon={FolderKanban}
              />
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            <div className="xl:col-span-2 rounded-xl border border-border bg-card p-4 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-foreground">Dynamique business</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Encaissements et devis sur les 6 derniers mois</p>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href="/factures">Ouvrir les factures</Link>
                </Button>
              </div>
              <div className="mt-6">
                <ChartContainer config={revenueChartConfig} className="h-[280px] w-full">
                  <AreaChart data={dashboardData.revenueChartData} margin={{ left: 12, right: 12, top: 10 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
                    <YAxis hide />
                    <ChartTooltip content={<ChartTooltipContent formatter={(value, name) => (
                      <div className="flex w-full items-center justify-between gap-4">
                        <span>{name}</span>
                        <span className="font-medium text-foreground">{formatCurrency(Number(value || 0))}</span>
                      </div>
                    )} />} />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Area type="monotone" dataKey="encaisse" stroke="var(--color-encaisse)" fill="var(--color-encaisse)" fillOpacity={0.18} strokeWidth={3} />
                    <Area type="monotone" dataKey="devis" stroke="var(--color-devis)" fill="var(--color-devis)" fillOpacity={0.1} strokeWidth={2} />
                  </AreaChart>
                </ChartContainer>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-foreground">Pipeline en un coup d&apos;oeil</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Les volumes a surveiller aujourd&apos;hui</p>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href="/devis">Voir le detail</Link>
                </Button>
              </div>
              <div className="mt-6">
                <ChartContainer config={funnelChartConfig} className="h-[280px] w-full">
                  <BarChart data={dashboardData.funnelChartData} layout="vertical" margin={{ left: 12, right: 12, top: 10, bottom: 10 }}>
                    <CartesianGrid horizontal={false} />
                    <XAxis type="number" hide />
                    <YAxis dataKey="label" type="category" tickLine={false} axisLine={false} width={110} />
                    <ChartTooltip content={<ChartTooltipContent hideLabel formatter={(value) => (
                      <span className="font-medium text-foreground">{value}</span>
                    )} />} />
                    <Bar dataKey="value" radius={10}>
                      {dashboardData.funnelChartData.map((entry) => (
                        <Cell key={entry.label} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <BellRing className="h-4 w-4 text-primary" />
                  <h2 className="text-base font-semibold text-foreground">Rappels chef d&apos;entreprise</h2>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Vos prochaines actions utiles, generees automatiquement a partir de vos devis, factures et chantiers.
                </p>
              </div>
              <Badge variant="outline" className="w-fit border-primary/20 bg-primary/5 text-primary">
                V1 automatique
              </Badge>
            </div>

            {dashboardData.reminderItems.length === 0 ? (
              <div className="mt-6 rounded-xl border border-dashed border-border bg-muted/20 p-6 text-sm text-muted-foreground">
                Aucun rappel prioritaire pour le moment. Des rappels automatiques apparaitront ici des que vos devis,
                factures ou chantiers auront besoin d&apos;une action.
              </div>
            ) : (
              <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
                {dashboardData.reminderItems.map((reminder) => (
                  <Link key={reminder.id} href={reminder.href} className="block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <div className="rounded-xl border border-border bg-background p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-border/80 hover:shadow-md">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className={getReminderPriorityClasses(reminder.priority)}>
                          {reminder.priority === 'high'
                            ? 'Priorite haute'
                            : reminder.priority === 'medium'
                              ? 'Priorite moyenne'
                              : 'Priorite basse'}
                        </Badge>
                        <Badge variant="outline" className="border-border bg-muted/50 text-muted-foreground">
                          {getReminderKindLabel(reminder.kind)}
                        </Badge>
                      </div>

                      <div className="mt-3 flex items-start gap-3">
                        <div className="mt-1 rounded-full bg-primary/10 p-2 text-primary">
                          <CircleAlert className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-foreground">{reminder.title}</p>
                          <p className="mt-1 text-sm text-muted-foreground">{reminder.description}</p>
                          <p className="mt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            {reminder.dueLabel}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-3">
                        <span className="text-xs text-muted-foreground">
                          BatiFlow vous aide a ne rien laisser trainer.
                        </span>
                        <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                          {reminder.actionLabel}
                          <ArrowRight className="h-4 w-4" />
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            <div className="mt-5 rounded-xl border border-dashed border-primary/20 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
              Les rappels administratifs comme la TVA, la paie, la DSN ou la cloture comptable seront encore plus precis
              des que nous aurons ajoute les parametres entreprise dedies.
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-foreground">Activite recente</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Vos derniers mouvements utiles</p>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href="/dashboard">Rafraichir</Link>
                </Button>
              </div>
              {dashboardData.activityItems.length === 0 ? (
                <div className="mt-6 rounded-xl border border-dashed border-border bg-muted/20 p-6 text-sm text-muted-foreground">
                  Aucun mouvement recent pour le moment.
                </div>
              ) : (
                <div className="mt-6 space-y-3">
                  {dashboardData.activityItems.map((item) => (
                    <Link
                      key={item.id}
                      href={item.href}
                      className="flex items-center gap-3 rounded-xl border border-transparent px-2 py-2 transition-colors hover:border-border hover:bg-muted/40"
                    >
                      <div className={`h-2.5 w-2.5 rounded-full ${item.color}`} />
                      <p className="flex-1 text-sm text-foreground">{item.label}</p>
                      <span className="text-xs text-muted-foreground">{item.time}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-foreground">Equipe au travail</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Qui est mobilise sur les prochains jours</p>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href="/planning">Ouvrir le planning</Link>
                </Button>
              </div>

              {dashboardData.activeTeamMembers.length === 0 ? (
                <div className="mt-6 rounded-xl border border-dashed border-border bg-muted/20 p-6 text-sm text-muted-foreground">
                  Ajoutez vos salaries et prestataires pour obtenir une vraie vue d&apos;ensemble equipe.
                </div>
              ) : (
                <div className="mt-6 space-y-3">
                  {dashboardData.activeTeamMembers.slice(0, 4).map((member) => {
                    const nextEvent = dashboardData.nextPlanningEvents.find((event) => event.team_member_id === member.id);
                    return (
                      <Link
                        key={member.id}
                        href="/planning"
                        className="flex items-center justify-between gap-3 rounded-xl border border-transparent px-2 py-2 transition-colors hover:border-border hover:bg-muted/40"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-block h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: member.color || '#E97F2A' }}
                            />
                            <p className="truncate text-sm font-medium text-foreground">{member.name}</p>
                            <StatusBadge
                              label={MEMBER_TYPES[member.type]?.label || 'Equipe'}
                              color={MEMBER_TYPES[member.type]?.color || 'bg-slate-100 text-slate-700'}
                            />
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {nextEvent
                              ? `${nextEvent.title} • ${formatDate(nextEvent.start_date)}`
                              : 'Aucun evenement planifie prochainement'}
                          </p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-foreground">Prochaines echeances</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Ce qui arrive ensuite dans votre semaine</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <CalendarClock className="h-5 w-5" />
                </div>
              </div>

              {dashboardData.deadlineItems.length === 0 ? (
                <div className="mt-6 rounded-xl border border-dashed border-border bg-muted/20 p-6 text-sm text-muted-foreground">
                  Aucune echeance proche. Votre planning est calme pour le moment.
                </div>
              ) : (
                <div className="mt-6 space-y-3">
                  {dashboardData.deadlineItems.map((item) => (
                    <Link
                      key={item.id}
                      href={item.href}
                      className="flex items-center justify-between gap-3 rounded-xl border border-transparent px-2 py-2 transition-colors hover:border-border hover:bg-muted/40"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-medium text-muted-foreground">
                          {new Date(item.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{item.label}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(item.date)}</p>
                        </div>
                      </div>
                      <StatusBadge label={item.badgeLabel} color={item.badgeColor} />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

        </>
      )}
    </div>
  );
}
