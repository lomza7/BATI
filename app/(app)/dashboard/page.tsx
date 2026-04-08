'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
  Calendar,
  CalendarClock,
  CircleAlert,
  Compass,
  Euro,
  FileText,
  FolderKanban,
  Receipt,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { buildLeadSourceLabelMap, type LeadSource } from '@/lib/lead-sources';
import { DEFAULT_LEAD_STAGES, type LeadStageConfig } from '@/lib/lead-pipeline';
import {
  INVOICE_STATUSES,
  MEMBER_TYPES,
  PROJECT_STATUSES,
  QUOTE_STATUSES,
  formatCurrency,
  formatDate,
} from '@/lib/constants';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { DemoBanner } from '@/components/dashboard/demo-banner';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { StatusBadge } from '@/components/shared/status-badge';
import { TimeByCategoryChart } from '@/components/todos/time-by-category-chart';
import type { Todo } from '@/lib/todo-constants';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';

type DatePreset = 'jour' | 'semaine' | 'mois' | 'annee' | 'custom';

function getDateRange(
  preset: DatePreset,
  customRange?: { from?: Date; to?: Date }
): { start: Date; end: Date } {
  const now = new Date();
  switch (preset) {
    case 'jour': {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      return { start, end };
    }
    case 'semaine': {
      const day = now.getDay();
      const diffToMonday = day === 0 ? 6 : day - 1;
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday);
      const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6, 23, 59, 59, 999);
      return { start, end };
    }
    case 'mois': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      return { start, end };
    }
    case 'annee': {
      const start = new Date(now.getFullYear(), 0, 1);
      const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      return { start, end };
    }
    case 'custom': {
      if (!customRange?.from) return getDateRange('mois');
      const from = customRange.from;
      const to = customRange.to || from;
      const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
      const end = new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59, 999);
      return { start, end };
    }
  }
}

const PRESET_LABELS: Record<DatePreset, string> = {
  jour: "Aujourd'hui",
  semaine: 'Cette semaine',
  mois: 'Ce mois',
  annee: 'Cette annee',
  custom: 'Date precise',
};

interface QuoteRow {
  id: string;
  quote_number: string;
  title: string;
  status: keyof typeof QUOTE_STATUSES;
  total_ttc: number;
  valid_until: string | null;
  created_at: string;
  updated_at: string;
  project_id: string | null;
  clients: { name: string } | null;
}

interface InvoiceRow {
  id: string;
  invoice_number: string;
  title: string;
  status: keyof typeof INVOICE_STATUSES;
  total_ht: number;
  total_ttc: number;
  due_date: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
  project_id: string | null;
  quote_id: string | null;
  clients: { name: string } | null;
}

interface ExpenseRow {
  id: string;
  date: string;
  amount: number;
  amount_ht: number;
  project_id: string | null;
}

interface TeamAssignmentRow {
  id: string;
  project_id: string | null;
  date: string;
  hours: number;
  team_member_id: string;
  team_members: { hourly_rate: number | null } | null;
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
  project_id: string | null;
  team_members: { name: string; color: string | null } | null;
}

interface ReminderSettingsRow {
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
}

interface CompanyProfileRow {
  legal_form: string;
  naf_label: string;
  tva_number: string;
}

interface LeadDashboardRow {
  id: string;
  source: string;
  stage: string;
  value: number;
}

interface ContractDashboardRow {
  id: string;
  title: string;
  amount: number;
  frequency: string;
  status: string;
  next_billing: string | null;
  created_at: string;
  cancelled_at: string | null;
  clients: { name: string } | null;
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
  dueDate?: string;
  priority: 'high' | 'medium' | 'low';
  href: string;
  actionLabel: string;
  kind: 'commercial' | 'facturation' | 'chantier' | 'administratif';
};

type RevenuePoint = {
  month: string;
  encaisse: number;
  devis: number;
  factures: number;
};

type FunnelPoint = {
  label: string;
  value: number;
  fill: string;
};

type LeadSourcePoint = {
  source: string;
  active: number;
  won: number;
  lost: number;
};

type StageConversionPoint = {
  slug: string;
  label: string;
  color: string;
  total: number;
  wonValue: number;
  conversionRate: number;
};

const revenueChartConfig = {
  encaisse: {
    label: 'CA encaisse',
    color: 'hsl(var(--chart-1))',
  },
  factures: {
    label: 'Factures creees',
    color: 'hsl(var(--chart-2))',
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

const leadSourceChartConfig = {
  active: {
    label: 'En cours',
    color: 'hsl(var(--chart-3))',
  },
  won: {
    label: 'Gagnes',
    color: 'hsl(var(--chart-2))',
  },
  lost: {
    label: 'Perdus',
    color: 'hsl(var(--chart-5))',
  },
} satisfies ChartConfig;

const mrrChartConfig = {
  mrr: { label: 'MRR', color: 'hsl(var(--chart-4))' },
} satisfies ChartConfig;

const marginChartConfig = {
  ca: { label: 'CA HT', color: 'hsl(var(--chart-1))' },
  cout: { label: "Coût engagé", color: 'hsl(var(--chart-5))' },
  marge: { label: 'Marge brute', color: 'hsl(var(--chart-2))' },
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

function inferBenefitTaxRegime(legalFormSetting: string) {
  if (legalFormSetting === 'micro') return 'micro';
  if (legalFormSetting === 'ei') return 'ir';
  if (legalFormSetting === 'sas' || legalFormSetting === 'sasu') return 'is';
  return '';
}

function getNextMonthlyOccurrence(day: number, now = new Date()) {
  const year = now.getFullYear();
  const month = now.getMonth();
  const currentMonthLastDay = new Date(year, month + 1, 0).getDate();
  const currentCandidate = new Date(year, month, Math.min(day, currentMonthLastDay), 9, 0, 0, 0);

  if (currentCandidate >= now) {
    return currentCandidate;
  }

  const nextMonthLastDay = new Date(year, month + 2, 0).getDate();
  return new Date(year, month + 1, Math.min(day, nextMonthLastDay), 9, 0, 0, 0);
}

function getNextAnnualOccurrence(month: number, day: number, now = new Date()) {
  const year = now.getFullYear();
  const currentYearLastDay = new Date(year, month, 0).getDate();
  const currentCandidate = new Date(year, month - 1, Math.min(day, currentYearLastDay), 9, 0, 0, 0);

  if (currentCandidate >= now) {
    return currentCandidate;
  }

  const nextYearLastDay = new Date(year + 1, month, 0).getDate();
  return new Date(year + 1, month - 1, Math.min(day, nextYearLastDay), 9, 0, 0, 0);
}

function createAdminReminders(
  settings: ReminderSettingsRow | null,
  companyProfile: CompanyProfileRow | null,
  now: Date
) {
  const reminders: ReminderItem[] = [];
  const legalForm = settings?.legal_form || mapPappersLegalFormToSetting(companyProfile?.legal_form || '');
  const benefitTaxRegime = settings?.benefit_tax_regime || inferBenefitTaxRegime(legalForm);
  const hasEmployees = settings?.has_employees || false;

  if (settings?.vat_regime && settings.vat_regime !== 'franchise_en_base' && settings.vat_reminder_day) {
    const dueDate = getNextMonthlyOccurrence(settings.vat_reminder_day, now);
    const days = differenceInDays(dueDate.toISOString(), now);
    if (days <= 10) {
      reminders.push({
        id: 'admin-vat',
        title: 'TVA a preparer',
        description: companyProfile?.tva_number
          ? `Votre numero de TVA est bien renseigne. Preparez votre declaration ${settings.vat_frequency || 'periodique'}.`
          : 'Pensez a preparer votre declaration de TVA et a verifier vos justificatifs.',
        dueLabel: days <= 0 ? "Echeance aujourd'hui" : `Rappel programme dans ${days} jour${days > 1 ? 's' : ''}`,
        dueDate: dueDate.toISOString(),
        priority: days <= 2 ? 'high' : 'medium',
        href: '/parametres?tab=parametres',
        actionLabel: 'Verifier les reglages',
        kind: 'administratif',
      });
    }
  }

  if (hasEmployees && settings?.payroll_day) {
    const dueDate = getNextMonthlyOccurrence(settings.payroll_day, now);
    const days = differenceInDays(dueDate.toISOString(), now);
    if (days <= 7) {
      reminders.push({
        id: 'admin-payroll',
        title: 'Paie a lancer',
        description: `La paie de votre equipe approche${settings.employee_count ? ` pour ${settings.employee_count} personne${settings.employee_count > 1 ? 's' : ''}` : ''}.`,
        dueLabel: days <= 0 ? "Paie prevue aujourd'hui" : `Paie dans ${days} jour${days > 1 ? 's' : ''}`,
        dueDate: dueDate.toISOString(),
        priority: days <= 2 ? 'high' : 'medium',
        href: '/parametres?tab=parametres',
        actionLabel: 'Voir les reglages paie',
        kind: 'administratif',
      });
    }
  }

  if (hasEmployees && settings?.dsn_due_day) {
    const dueDate = getNextMonthlyOccurrence(settings.dsn_due_day, now);
    const days = differenceInDays(dueDate.toISOString(), now);
    if (days <= 10) {
      reminders.push({
        id: 'admin-dsn',
        title: 'DSN a transmettre',
        description: 'Votre declaration sociale nominative doit etre verifiee avant l echeance.',
        dueLabel: days <= 0 ? "DSN due aujourd'hui" : `DSN dans ${days} jour${days > 1 ? 's' : ''}`,
        dueDate: dueDate.toISOString(),
        priority: days <= 2 ? 'high' : 'medium',
        href: '/parametres?tab=parametres',
        actionLabel: 'Verifier la DSN',
        kind: 'administratif',
      });
    }
  }

  if (settings?.fiscal_year_end_day && settings?.fiscal_year_end_month) {
    const dueDate = getNextAnnualOccurrence(settings.fiscal_year_end_month, settings.fiscal_year_end_day, now);
    const days = differenceInDays(dueDate.toISOString(), now);
    if (days <= 60) {
      reminders.push({
        id: 'admin-cloture',
        title: 'Cloture comptable a anticiper',
        description: benefitTaxRegime === 'is'
          ? 'Preparez votre cloture, la liasse fiscale et les prochaines echeances IS.'
          : 'Preparez vos pieces comptables pour votre prochaine cloture d exercice.',
        dueLabel: days <= 0 ? "Cloture prevue aujourd'hui" : `Cloture dans ${days} jour${days > 1 ? 's' : ''}`,
        dueDate: dueDate.toISOString(),
        priority: days <= 15 ? 'high' : 'low',
        href: '/parametres?tab=parametres',
        actionLabel: 'Voir la cloture',
        kind: 'administratif',
      });
    }
  }

  if (benefitTaxRegime === 'is') {
    const isInstallments = [
      { month: 3, day: 15, id: 'is-mars' },
      { month: 6, day: 15, id: 'is-juin' },
      { month: 9, day: 15, id: 'is-septembre' },
      { month: 12, day: 15, id: 'is-decembre' },
    ];
    const nextInstallment = isInstallments
      .map((item) => ({
        ...item,
        date: getNextAnnualOccurrence(item.month, item.day, now),
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime())[0];

    const days = differenceInDays(nextInstallment.date.toISOString(), now);
    if (days <= 20) {
      reminders.push({
        id: `admin-${nextInstallment.id}`,
        title: 'Acompte d IS a verifier',
        description: 'Votre prochaine echeance d impot sur les societes approche.',
        dueLabel: days <= 0 ? "Echeance aujourd'hui" : `Dans ${days} jour${days > 1 ? 's' : ''}`,
        dueDate: nextInstallment.date.toISOString(),
        priority: days <= 5 ? 'high' : 'medium',
        href: '/parametres?tab=parametres',
        actionLabel: 'Verifier l echeance',
        kind: 'administratif',
      });
    }
  }

  if (settings?.cfe_applicable) {
    const cfeDates = [
      { month: 6, day: 15, label: 'Acompte CFE' },
      { month: 12, day: 15, label: 'Solde CFE' },
    ];
    const nextCfe = cfeDates
      .map((item) => ({
        ...item,
        date: getNextAnnualOccurrence(item.month, item.day, now),
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime())[0];

    const days = differenceInDays(nextCfe.date.toISOString(), now);
    if (days <= 20) {
      reminders.push({
        id: `admin-cfe-${nextCfe.month}`,
        title: nextCfe.label,
        description: 'Pensez a verifier votre avis CFE et a anticiper le reglement.',
        dueLabel: days <= 0 ? "Echeance aujourd'hui" : `Dans ${days} jour${days > 1 ? 's' : ''}`,
        dueDate: nextCfe.date.toISOString(),
        priority: days <= 5 ? 'high' : 'low',
        href: '/parametres?tab=parametres',
        actionLabel: 'Voir la fiscalite',
        kind: 'administratif',
      });
    }
  }

  return reminders;
}

function buildRevenueSeries(
  quotes: QuoteRow[],
  invoices: InvoiceRow[],
  preset: DatePreset,
  range: { start: Date; end: Date }
) {
  const points: RevenuePoint[] = [];

  if (preset === 'custom') {
    // Custom range → auto granularity based on duration
    const durationDays = Math.round((range.end.getTime() - range.start.getTime()) / (1000 * 60 * 60 * 24));
    if (durationDays <= 1) {
      // Single day → hours
      for (let h = 8; h <= 20; h += 2) {
        const start = new Date(range.start.getFullYear(), range.start.getMonth(), range.start.getDate(), h);
        const end = new Date(range.start.getFullYear(), range.start.getMonth(), range.start.getDate(), h + 2, 0, 0, -1);
        points.push({
          month: `${h}h`,
          encaisse: invoices.filter((inv) => inv.status === 'payee' && isBetween(inv.paid_at, start, end)).reduce((s, inv) => s + inv.total_ttc, 0),
          factures: invoices.filter((inv) => isBetween(inv.created_at, start, end)).reduce((s, inv) => s + inv.total_ttc, 0),
          devis: quotes.filter((q) => isBetween(q.created_at, start, end)).reduce((s, q) => s + q.total_ttc, 0),
        });
      }
    } else if (durationDays <= 31) {
      // Up to a month → each day
      let cursor = new Date(range.start);
      while (cursor <= range.end) {
        const start = new Date(cursor);
        const end = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate(), 23, 59, 59, 999);
        points.push({
          month: `${cursor.getDate()}/${cursor.getMonth() + 1}`,
          encaisse: invoices.filter((inv) => inv.status === 'payee' && isBetween(inv.paid_at, start, end)).reduce((s, inv) => s + inv.total_ttc, 0),
          factures: invoices.filter((inv) => isBetween(inv.created_at, start, end)).reduce((s, inv) => s + inv.total_ttc, 0),
          devis: quotes.filter((q) => isBetween(q.created_at, start, end)).reduce((s, q) => s + q.total_ttc, 0),
        });
        cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
      }
    } else if (durationDays <= 365) {
      // Up to a year → each month
      let cursor = new Date(range.start.getFullYear(), range.start.getMonth(), 1);
      while (cursor <= range.end) {
        const start = new Date(cursor);
        const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59, 999);
        const clampedStart = start < range.start ? range.start : start;
        const clampedEnd = end > range.end ? range.end : end;
        const label = cursor.toLocaleDateString('fr-FR', { month: 'short' });
        points.push({
          month: label.charAt(0).toUpperCase() + label.slice(1),
          encaisse: invoices.filter((inv) => inv.status === 'payee' && isBetween(inv.paid_at, clampedStart, clampedEnd)).reduce((s, inv) => s + inv.total_ttc, 0),
          factures: invoices.filter((inv) => isBetween(inv.created_at, clampedStart, clampedEnd)).reduce((s, inv) => s + inv.total_ttc, 0),
          devis: quotes.filter((q) => isBetween(q.created_at, clampedStart, clampedEnd)).reduce((s, q) => s + q.total_ttc, 0),
        });
        cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      }
    } else {
      // Multi-year → each year
      for (let y = range.start.getFullYear(); y <= range.end.getFullYear(); y++) {
        const start = new Date(y, 0, 1);
        const end = new Date(y, 11, 31, 23, 59, 59, 999);
        points.push({
          month: String(y),
          encaisse: invoices.filter((inv) => inv.status === 'payee' && isBetween(inv.paid_at, start, end)).reduce((s, inv) => s + inv.total_ttc, 0),
          factures: invoices.filter((inv) => isBetween(inv.created_at, start, end)).reduce((s, inv) => s + inv.total_ttc, 0),
          devis: quotes.filter((q) => isBetween(q.created_at, start, end)).reduce((s, q) => s + q.total_ttc, 0),
        });
      }
    }
  } else if (preset === 'jour') {
    for (let h = 8; h <= 20; h += 2) {
      const start = new Date(range.start.getFullYear(), range.start.getMonth(), range.start.getDate(), h);
      const end = new Date(range.start.getFullYear(), range.start.getMonth(), range.start.getDate(), h + 2, 0, 0, -1);
      points.push({
        month: `${h}h`,
        encaisse: invoices.filter((inv) => inv.status === 'payee' && isBetween(inv.paid_at, start, end)).reduce((s, inv) => s + inv.total_ttc, 0),
        factures: invoices.filter((inv) => isBetween(inv.created_at, start, end)).reduce((s, inv) => s + inv.total_ttc, 0),
        devis: quotes.filter((q) => isBetween(q.created_at, start, end)).reduce((s, q) => s + q.total_ttc, 0),
      });
    }
  } else if (preset === 'semaine') {
    const dayLabels = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
    for (let d = 0; d < 7; d++) {
      const start = new Date(range.start.getFullYear(), range.start.getMonth(), range.start.getDate() + d);
      const end = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 23, 59, 59, 999);
      points.push({
        month: dayLabels[d],
        encaisse: invoices.filter((inv) => inv.status === 'payee' && isBetween(inv.paid_at, start, end)).reduce((s, inv) => s + inv.total_ttc, 0),
        factures: invoices.filter((inv) => isBetween(inv.created_at, start, end)).reduce((s, inv) => s + inv.total_ttc, 0),
        devis: quotes.filter((q) => isBetween(q.created_at, start, end)).reduce((s, q) => s + q.total_ttc, 0),
      });
    }
  } else if (preset === 'mois') {
    const monthStart = range.start;
    let weekNum = 1;
    let cursor = new Date(monthStart);
    while (cursor <= range.end) {
      const weekStart = new Date(cursor);
      const weekEnd = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 6, 23, 59, 59, 999);
      const clampedEnd = weekEnd > range.end ? range.end : weekEnd;
      points.push({
        month: `S${weekNum}`,
        encaisse: invoices.filter((inv) => inv.status === 'payee' && isBetween(inv.paid_at, weekStart, clampedEnd)).reduce((s, inv) => s + inv.total_ttc, 0),
        factures: invoices.filter((inv) => isBetween(inv.created_at, weekStart, clampedEnd)).reduce((s, inv) => s + inv.total_ttc, 0),
        devis: quotes.filter((q) => isBetween(q.created_at, weekStart, clampedEnd)).reduce((s, q) => s + q.total_ttc, 0),
      });
      cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 7);
      weekNum++;
    }
  } else {
    for (let m = 0; m < 12; m++) {
      const start = new Date(range.start.getFullYear(), m, 1);
      const end = new Date(range.start.getFullYear(), m + 1, 0, 23, 59, 59, 999);
      const label = start.toLocaleDateString('fr-FR', { month: 'short' });
      points.push({
        month: label.charAt(0).toUpperCase() + label.slice(1),
        encaisse: invoices.filter((inv) => inv.status === 'payee' && isBetween(inv.paid_at, start, end)).reduce((s, inv) => s + inv.total_ttc, 0),
        factures: invoices.filter((inv) => isBetween(inv.created_at, start, end)).reduce((s, inv) => s + inv.total_ttc, 0),
        devis: quotes.filter((q) => isBetween(q.created_at, start, end)).reduce((s, q) => s + q.total_ttc, 0),
      });
    }
  }

  return points;
}

export default function DashboardPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [leads, setLeads] = useState<LeadDashboardRow[]>([]);
  const [leadSources, setLeadSources] = useState<LeadSource[]>([]);
  const [leadStages, setLeadStages] = useState<LeadStageConfig[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMemberRow[]>([]);
  const [planningEvents, setPlanningEvents] = useState<PlanningEventRow[]>([]);
  const [reminderSettings, setReminderSettings] = useState<ReminderSettingsRow | null>(null);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfileRow | null>(null);
  const [dashTodos, setDashTodos] = useState<Todo[]>([]);
  const [contracts, setContracts] = useState<ContractDashboardRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [teamAssignments, setTeamAssignments] = useState<TeamAssignmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [datePreset, setDatePreset] = useState<DatePreset>('annee');
  const [customRange, setCustomRange] = useState<{ from?: Date; to?: Date }>({});
  const [calendarOpen, setCalendarOpen] = useState(false);

  const loadDashboard = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const [quotesRes, invoicesRes, projectsRes, leadsRes, leadSourcesRes, leadStagesRes, teamMembersRes, planningEventsRes, reminderSettingsRes, profileRes, todosRes, contractsRes, expensesRes, assignmentsRes] = await Promise.all([
      supabase
        .from('quotes')
        .select('id, quote_number, title, status, total_ttc, valid_until, project_id, created_at, updated_at, clients(name, deleted_at)')
        .is('deleted_at', null)
        .order('created_at', { ascending: false }),
      supabase
        .from('invoices')
        .select('id, invoice_number, title, status, total_ht, total_ttc, due_date, paid_at, project_id, quote_id, created_at, updated_at, clients(name, deleted_at)')
        .order('created_at', { ascending: false }),
      supabase
        .from('projects')
        .select('id, name, status, budget, start_date, end_date, created_at, updated_at, clients(name, deleted_at)')
        .is('deleted_at', null)
        .order('created_at', { ascending: false }),
      supabase
        .from('leads')
        .select('id, source, stage, value')
        .is('deleted_at', null)
        .order('updated_at', { ascending: false }),
      supabase
        .from('lead_sources')
        .select('*')
        .order('position', { ascending: true }),
      supabase
        .from('lead_stages')
        .select('*')
        .order('position', { ascending: true }),
      supabase
        .from('team_members')
        .select('id, name, type, status, color')
        .order('name'),
      supabase
        .from('planning_events')
        .select('id, title, event_type, start_date, end_date, team_member_id, project_id, team_members(name, color)')
        .order('start_date'),
      supabase
        .from('business_reminder_settings')
        .select(
          'legal_form, benefit_tax_regime, vat_regime, vat_frequency, vat_reminder_day, has_employees, employee_count, payroll_day, dsn_due_day, fiscal_year_end_day, fiscal_year_end_month, social_contributions_day, cfe_applicable, apprenticeship_tax_applicable'
        )
        .eq('user_id', user!.id)
        .maybeSingle(),
      supabase
        .from('profiles')
        .select('legal_form, naf_label, tva_number')
        .eq('id', user!.id)
        .maybeSingle(),
      supabase
        .from('todos')
        .select('id, title, description, priority, category, due_date, completed, completed_at, time_spent, position, client_id, created_at, updated_at')
        .is('deleted_at', null),
      supabase
        .from('recurring_contracts')
        .select('id, title, amount, frequency, status, next_billing, created_at, cancelled_at, clients(name, deleted_at)')
        .order('next_billing', { ascending: true }),
      supabase
        .from('expenses')
        .select('id, date, amount, amount_ht, project_id')
        .not('project_id', 'is', null),
      supabase
        .from('team_assignments')
        .select('id, project_id, date, hours, team_member_id, team_members(hourly_rate)')
        .not('project_id', 'is', null),
    ]);

    setQuotes((((quotesRes.data as unknown as Array<Record<string, unknown>>) || [])).map((quote) => {
      const clientValue = Array.isArray(quote.clients) ? quote.clients[0] : quote.clients;
      return {
        ...quote,
        clients: clientValue && typeof clientValue === 'object' && !(clientValue as { deleted_at?: string | null }).deleted_at
          ? { name: String((clientValue as { name?: string }).name || '') }
          : null,
        total_ttc: toNumber(quote.total_ttc as string | number | null | undefined),
        project_id: (quote.project_id as string | null) || null,
      } as QuoteRow;
    }));
    setInvoices((((invoicesRes.data as unknown as Array<Record<string, unknown>>) || [])).map((invoice) => {
      const clientValue = Array.isArray(invoice.clients) ? invoice.clients[0] : invoice.clients;
      return {
        ...invoice,
        clients: clientValue && typeof clientValue === 'object' && !(clientValue as { deleted_at?: string | null }).deleted_at
          ? { name: String((clientValue as { name?: string }).name || '') }
          : null,
        total_ht: toNumber(invoice.total_ht as string | number | null | undefined),
        total_ttc: toNumber(invoice.total_ttc as string | number | null | undefined),
        project_id: (invoice.project_id as string | null) || null,
        quote_id: (invoice.quote_id as string | null) || null,
      } as InvoiceRow;
    }));
    const loadedProjects = (((projectsRes.data as unknown as Array<Record<string, unknown>>) || [])).map((project) => {
      const clientValue = Array.isArray(project.clients) ? project.clients[0] : project.clients;
      return {
        ...project,
        clients: clientValue && typeof clientValue === 'object' && !(clientValue as { deleted_at?: string | null }).deleted_at
          ? { name: String((clientValue as { name?: string }).name || '') }
          : null,
        budget: toNumber(project.budget as string | number | null | undefined),
      } as ProjectRow;
    });
    const activeProjectIds = new Set(loadedProjects.map((project) => project.id));

    setProjects(loadedProjects);
    setLeads((((leadsRes.data as LeadDashboardRow[]) || [])).map((lead) => ({
      ...lead,
      value: toNumber(lead.value),
    })));
    setLeadSources((leadSourcesRes.data as LeadSource[]) || []);
    setLeadStages(((leadStagesRes.data as LeadStageConfig[]) || []).length > 0 ? (leadStagesRes.data as LeadStageConfig[]) : DEFAULT_LEAD_STAGES.map((stage, index) => ({
      id: `default-${stage.slug}`,
      user_id: user.id,
      slug: stage.slug,
      label: stage.label,
      color: stage.color,
      position: stage.position ?? index,
      is_terminal: stage.is_terminal,
    })));
    setTeamMembers((teamMembersRes.data as TeamMemberRow[]) || []);
    setPlanningEvents(
      ((planningEventsRes.data as unknown as PlanningEventRow[]) || []).filter(
        (event) => !event.project_id || activeProjectIds.has(event.project_id)
      )
    );
    setReminderSettings((reminderSettingsRes.data as ReminderSettingsRow | null) || null);
    setCompanyProfile((profileRes.data as CompanyProfileRow | null) || null);
    setDashTodos(((todosRes.data as unknown as Todo[]) || []).map(t => ({ ...t, client_name: undefined })));
    setContracts((((contractsRes.data as unknown as Array<Record<string, unknown>>) || [])).map((contract) => {
      const clientValue = Array.isArray(contract.clients) ? contract.clients[0] : contract.clients;
      return {
        ...contract,
        clients: clientValue && typeof clientValue === 'object' && !(clientValue as { deleted_at?: string | null }).deleted_at
          ? { name: String((clientValue as { name?: string }).name || '') }
          : null,
        amount: toNumber(contract.amount as string | number | null | undefined),
      } as ContractDashboardRow;
    }));
    setExpenses((((expensesRes.data as unknown as Array<Record<string, unknown>>) || [])).map((expense) => ({
      id: String(expense.id),
      date: String(expense.date),
      amount: toNumber(expense.amount as string | number | null | undefined),
      amount_ht: toNumber(expense.amount_ht as string | number | null | undefined),
      project_id: (expense.project_id as string | null) || null,
    })));
    setTeamAssignments((((assignmentsRes.data as unknown as Array<Record<string, unknown>>) || [])).map((assignment) => {
      const memberValue = Array.isArray(assignment.team_members) ? assignment.team_members[0] : assignment.team_members;
      return {
        id: String(assignment.id),
        project_id: (assignment.project_id as string | null) || null,
        date: String(assignment.date),
        hours: toNumber(assignment.hours as string | number | null | undefined),
        team_member_id: String(assignment.team_member_id),
        team_members: memberValue && typeof memberValue === 'object'
          ? { hourly_rate: toNumber((memberValue as { hourly_rate?: number | string | null }).hourly_rate) }
          : null,
      };
    }));
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }

    void loadDashboard();
  }, [authLoading, user, loadDashboard]);

  const dashboardData = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const filterRange = getDateRange(datePreset, customRange);
    const filterDurationMs = filterRange.end.getTime() - filterRange.start.getTime();
    const previousRange = {
      start: new Date(filterRange.start.getTime() - filterDurationMs - 1),
      end: new Date(filterRange.start.getTime() - 1),
    };

    // ── Filter all raw data by the selected period ──
    const fQuotes = quotes.filter((q) => isBetween(q.created_at, filterRange.start, filterRange.end));
    const fInvoices = invoices.filter((inv) => isBetween(inv.created_at, filterRange.start, filterRange.end));
    const fProjects = projects.filter((p) => isBetween(p.created_at, filterRange.start, filterRange.end));
    const fEvents = planningEvents.filter((e) => isBetween(e.start_date, filterRange.start, filterRange.end));

    // Revenue: paid invoices in period (any invoice paid in range, not just created in range)
    const paidThisPeriod = invoices.filter(
      (invoice) => invoice.status === 'payee' && isBetween(invoice.paid_at, filterRange.start, filterRange.end)
    );
    const paidPreviousPeriod = invoices.filter(
      (invoice) => invoice.status === 'payee' && isBetween(invoice.paid_at, previousRange.start, previousRange.end)
    );
    const revenueThisMonth = paidThisPeriod.reduce((sum, invoice) => sum + invoice.total_ttc, 0);
    const revenuePreviousMonth = paidPreviousPeriod.reduce((sum, invoice) => sum + invoice.total_ttc, 0);
    const revenueDelta = revenuePreviousMonth > 0
      ? Math.round(((revenueThisMonth - revenuePreviousMonth) / revenuePreviousMonth) * 100)
      : revenueThisMonth > 0
        ? 100
        : 0;

    // Quotes KPIs scoped to period
    const pendingQuotes = fQuotes.filter((quote) => quote.status === 'envoye');
    const quotesToRelaunch = pendingQuotes.filter((quote) => {
      if (!quote.valid_until) return false;
      const validUntil = new Date(quote.valid_until);
      const daysLeft = Math.ceil((validUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return daysLeft <= 7;
    });

    const acceptedWindow = fQuotes.filter((q) => q.status === 'accepte').length;
    const decidedWindow = fQuotes.filter((q) => ['accepte', 'refuse', 'expire'].includes(q.status)).length;
    const acceptanceRate = decidedWindow > 0 ? Math.round((acceptedWindow / decidedWindow) * 100) : 0;

    const prevQuotes = quotes.filter((q) => isBetween(q.created_at, previousRange.start, previousRange.end));
    const acceptedPrev = prevQuotes.filter((q) => q.status === 'accepte').length;
    const decidedPrev = prevQuotes.filter((q) => ['accepte', 'refuse', 'expire'].includes(q.status)).length;
    const previousAcceptanceRate = decidedPrev > 0 ? Math.round((acceptedPrev / decidedPrev) * 100) : 0;
    const acceptanceDelta = acceptanceRate - previousAcceptanceRate;

    // Activity items — scoped to period
    const activityItems: ActivityItem[] = [
      ...fQuotes.slice(0, 4).map((quote) => ({
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
      ...fInvoices.slice(0, 4).map((invoice) => ({
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
      ...fProjects.slice(0, 4).map((project) => ({
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

    // Deadlines scoped to period
    const deadlineItems: DeadlineItem[] = [
      ...fInvoices
        .filter((invoice) => invoice.due_date && invoice.status !== 'payee')
        .map((invoice) => ({
          id: `invoice-${invoice.id}`,
          label: invoice.title || invoice.invoice_number,
          date: invoice.due_date as string,
          badgeLabel: INVOICE_STATUSES[invoice.status]?.label || 'Facture',
          badgeColor: INVOICE_STATUSES[invoice.status]?.color || INVOICE_STATUSES.brouillon.color,
          href: '/factures',
        })),
      ...fProjects
        .filter((project) => project.start_date && project.status === 'a_planifier')
        .map((project) => ({
          id: `project-${project.id}`,
          label: project.name,
          date: project.start_date as string,
          badgeLabel: 'Demarrage chantier',
          badgeColor: 'bg-blue-50 text-blue-700',
          href: '/chantiers',
        })),
      ...fQuotes
        .filter((quote) => quote.valid_until && quote.status === 'envoye')
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

    // Reminders scoped to period
    const reminderItems: ReminderItem[] = [
      ...fInvoices
        .filter((invoice) => invoice.status === 'en_retard' && invoice.due_date)
        .map((invoice) => {
          const daysLate = Math.max(1, Math.abs(differenceInDays(invoice.due_date as string, now)));
          return {
            id: `invoice-overdue-${invoice.id}`,
            title: `Relancer ${invoice.invoice_number}`,
            description: `${invoice.clients?.name || 'Un client'} n'a pas encore regle cette facture.`,
            dueLabel: `En retard depuis ${daysLate} jour${daysLate > 1 ? 's' : ''}`,
            priority: 'high' as const,
            dueDate: invoice.due_date as string,
            href: '/factures',
            actionLabel: 'Voir les factures',
            kind: 'facturation' as const,
          };
        }),
      ...fInvoices
        .filter((invoice) => (invoice.status === 'envoyee' || invoice.status === 'brouillon') && invoice.due_date)
        .map((invoice) => {
          const days = differenceInDays(invoice.due_date as string, now);
          if (days < 0 || days > 7) return null;

          return {
            id: `invoice-due-${invoice.id}`,
            title: `Suivre ${invoice.invoice_number}`,
            description: `${invoice.clients?.name || 'Ce client'} arrive a l'echeance de paiement.`,
            dueLabel: days === 0 ? "Echeance aujourd'hui" : `Echeance dans ${days} jour${days > 1 ? 's' : ''}`,
            priority: days <= 2 ? 'high' as const : 'medium' as const,
            dueDate: invoice.due_date as string,
            href: '/factures',
            actionLabel: 'Ouvrir les factures',
            kind: 'facturation' as const,
          };
        })
        .filter(Boolean) as ReminderItem[],
      ...fQuotes
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
            dueDate: quote.valid_until || quote.created_at,
            href: '/devis',
            actionLabel: 'Voir les devis',
            kind: 'commercial' as const,
          };
        })
        .filter(Boolean) as ReminderItem[],
      ...fQuotes
        .filter((quote) => quote.status === 'envoye' && quote.valid_until)
        .map((quote) => {
          const days = differenceInDays(quote.valid_until as string, now);
          if (days < 0 || days > 7) return null;

          return {
            id: `quote-expiry-${quote.id}`,
            title: `Validite bientot atteinte pour ${quote.quote_number}`,
            description: `${quote.clients?.name || 'Ce client'} doit etre relance avant expiration.`,
            dueLabel: days === 0 ? "Expire aujourd'hui" : `Expire dans ${days} jour${days > 1 ? 's' : ''}`,
            priority: days <= 2 ? 'high' as const : 'medium' as const,
            dueDate: quote.valid_until as string,
            href: '/devis',
            actionLabel: 'Verifier le devis',
            kind: 'commercial' as const,
          };
        })
        .filter(Boolean) as ReminderItem[],
      ...fProjects
        .filter((project) => project.status === 'a_planifier' && project.start_date)
        .map((project) => {
          const days = differenceInDays(project.start_date as string, now);
          if (days < 0 || days > 7) return null;

          return {
            id: `project-start-${project.id}`,
            title: `Preparer ${project.name}`,
            description: `${project.clients?.name || 'Le client'} attend le lancement du chantier.`,
            dueLabel: days === 0 ? "Demarrage aujourd'hui" : `Demarrage dans ${days} jour${days > 1 ? 's' : ''}`,
            priority: days <= 2 ? 'high' as const : 'medium' as const,
            dueDate: project.start_date as string,
            href: '/chantiers',
            actionLabel: 'Voir le chantier',
            kind: 'chantier' as const,
          };
        })
        .filter(Boolean) as ReminderItem[],
      ...fProjects
        .filter((project) => project.status === 'en_cours' && project.end_date)
        .map((project) => {
          const days = differenceInDays(project.end_date as string, now);
          if (days < 0 || days > 3) return null;

          return {
            id: `project-end-${project.id}`,
            title: `Clore ${project.name}`,
            description: 'Pensez a finaliser le chantier, envoyer la facture et demander un avis client.',
            dueLabel: days === 0 ? "Fin prevue aujourd'hui" : `Fin prevue dans ${days} jour${days > 1 ? 's' : ''}`,
            priority: days === 0 ? 'high' as const : 'low' as const,
            dueDate: project.end_date as string,
            href: '/chantiers',
            actionLabel: 'Suivre le chantier',
            kind: 'chantier' as const,
          };
        })
        .filter(Boolean) as ReminderItem[],
      ...createAdminReminders(reminderSettings, companyProfile, now),
      ...contracts
        .filter(c => c.status === 'actif' && c.next_billing)
        .map(c => {
          const days = differenceInDays(c.next_billing!, now);
          if (days < 0 || days > 7) return null;
          return {
            id: `contract-billing-${c.id}`,
            title: `Facturation ${c.title}`,
            description: `${c.clients?.name || 'Un client'} — contrat recurrent a facturer.`,
            dueLabel: days === 0 ? "Facturation aujourd'hui" : `Facturation dans ${days} jour${days > 1 ? 's' : ''}`,
            priority: days <= 1 ? 'high' as const : 'medium' as const,
            dueDate: c.next_billing!,
            href: '/contrats',
            actionLabel: 'Voir les contrats',
            kind: 'facturation' as const,
          };
        })
        .filter(Boolean) as ReminderItem[],
    ]
      .sort((a, b) => {
        const priorityWeight = { high: 0, medium: 1, low: 2 };
        const byPriority = priorityWeight[a.priority] - priorityWeight[b.priority];
        if (byPriority !== 0) return byPriority;
        return new Date(a.dueDate || now).getTime() - new Date(b.dueDate || now).getTime();
      })
      .slice(0, 6);

    // Revenue chart — adapts to selected period
    const revenueChartData = buildRevenueSeries(quotes, invoices, datePreset, filterRange);

    // Pipeline funnel — scoped to period
    const funnelChartData: FunnelPoint[] = [
      {
        label: 'Devis en attente',
        value: pendingQuotes.length,
        fill: 'hsl(var(--chart-3))',
      },
      {
        label: 'Factures a encaisser',
        value: fInvoices.filter((invoice) => invoice.status === 'envoyee' || invoice.status === 'en_retard').length,
        fill: 'hsl(var(--chart-1))',
      },
      {
        label: 'Chantiers en cours',
        value: fProjects.filter((project) => project.status === 'en_cours').length,
        fill: 'hsl(var(--chart-2))',
      },
      {
        label: 'A planifier',
        value: fProjects.filter((project) => project.status === 'a_planifier').length,
        fill: 'hsl(var(--chart-4))',
      },
    ];

    // Leads — no created_at available in the dashboard query, keep global for now
    const sourceLabelMap = buildLeadSourceLabelMap(leadSources);
    const leadSourceChartData: LeadSourcePoint[] = Array.from(
      leads.reduce((acc, lead) => {
        const key = lead.source || 'autre';
        const entry = acc.get(key) || {
          source: sourceLabelMap.get(key) || key,
          active: 0,
          won: 0,
          lost: 0,
        };

        if (lead.stage === 'gagne') {
          entry.won += 1;
        } else if (lead.stage === 'perdu') {
          entry.lost += 1;
        } else {
          entry.active += 1;
        }

        acc.set(key, entry);
        return acc;
      }, new Map<string, LeadSourcePoint>()).values()
    )
      .sort((a, b) => (b.active + b.won + b.lost) - (a.active + a.won + a.lost))
      .slice(0, 6);

    const topPartnerSources = leadSources
      .filter((source) => source.source_type === 'partner' && source.is_active)
      .map((source) => {
        const sourceLeads = leads.filter((lead) => lead.source === source.slug);
        const wonLeads = sourceLeads.filter((lead) => lead.stage === 'gagne');
        return {
          ...source,
          leadCount: sourceLeads.length,
          wonCount: wonLeads.length,
          wonValue: wonLeads.reduce((sum, lead) => sum + lead.value, 0),
        };
      })
      .sort((a, b) => b.wonValue - a.wonValue || b.leadCount - a.leadCount);

    const stageConversionData: StageConversionPoint[] = leadStages
      .map((stage) => {
        const stageLeads = leads.filter((lead) => lead.stage === stage.slug);
        const total = stageLeads.length;
        const wonValue = stageLeads
          .filter((lead) => lead.stage === 'gagne')
          .reduce((sum, lead) => sum + lead.value, 0);
        const conversionRate = leads.length > 0 ? Math.round((total / leads.length) * 100) : 0;

        return {
          slug: stage.slug,
          label: stage.label,
          color: stage.color,
          total,
          wonValue,
          conversionRate,
        };
      })
      .filter((stage) => stage.total > 0)
      .sort((a, b) => b.total - a.total || a.slug.localeCompare(b.slug));

    const totalQuotesPeriod = fQuotes.reduce((sum, q) => sum + q.total_ttc, 0);
    const totalInvoicesPeriod = fInvoices.reduce((sum, inv) => sum + inv.total_ttc, 0);

    // MRR from active contracts
    const activeContracts = contracts.filter(c => c.status === 'actif');
    const mrr = activeContracts.reduce((sum, c) => {
      if (c.frequency === 'mensuel') return sum + c.amount;
      if (c.frequency === 'trimestriel') return sum + c.amount / 3;
      if (c.frequency === 'annuel') return sum + c.amount / 12;
      return sum + c.amount;
    }, 0);

    // Contracts with billing in next 7 days
    const upcomingBillings = activeContracts.filter(c => {
      if (!c.next_billing) return false;
      const days = differenceInDays(c.next_billing, now);
      return days >= 0 && days <= 7;
    });

    // MRR chart — 12-month series based on contract creation dates
    const mrrChartData: { month: string; mrr: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
      const label = d.toLocaleDateString('fr-FR', { month: 'short' });
      // Sum MRR of contracts that were active (created before month end, not cancelled before month start)
      const monthMrr = contracts
        .filter(c => {
          const created = new Date(c.created_at);
          if (created > monthEnd) return false;
          if (c.status === 'resilie' && c.cancelled_at) {
            const cancelled = new Date(c.cancelled_at);
            if (cancelled < d) return false;
          }
          if (c.status === 'suspendu') return false;
          return true;
        })
        .reduce((sum, c) => {
          if (c.frequency === 'mensuel') return sum + c.amount;
          if (c.frequency === 'trimestriel') return sum + c.amount / 3;
          if (c.frequency === 'annuel') return sum + c.amount / 12;
          return sum + c.amount;
        }, 0);
      mrrChartData.push({ month: label, mrr: Math.round(monthMrr) });
    }

    // ── Marge chantiers ──
    // Helper: resolve a project_id from an invoice (direct link, then fallback via quote_id)
    const quotesById = new Map<string, QuoteRow>();
    quotes.forEach((q) => quotesById.set(q.id, q));
    function invoiceProjectId(inv: InvoiceRow): string | null {
      if (inv.project_id) return inv.project_id;
      if (inv.quote_id) {
        const q = quotesById.get(inv.quote_id);
        if (q?.project_id) return q.project_id;
      }
      return null;
    }

    // Build per-project finance over the SELECTED period (filterRange)
    type ProjectFinance = {
      id: string;
      name: string;
      caHT: number;
      mainOeuvreHT: number;
      depensesHT: number;
      coutTotal: number;
      margeBrute: number;
      margePct: number | null;
    };
    const projectFinanceMap = new Map<string, ProjectFinance>();
    projects.forEach((p) => {
      projectFinanceMap.set(p.id, {
        id: p.id,
        name: p.name,
        caHT: 0,
        mainOeuvreHT: 0,
        depensesHT: 0,
        coutTotal: 0,
        margeBrute: 0,
        margePct: null,
      });
    });

    // CA HT: invoices émises (any status) dans la période, rattachées à un chantier
    invoices.forEach((inv) => {
      const projectId = invoiceProjectId(inv);
      if (!projectId) return;
      const entry = projectFinanceMap.get(projectId);
      if (!entry) return;
      // Use created_at for period filter (date d'émission)
      if (!isBetween(inv.created_at, filterRange.start, filterRange.end)) return;
      entry.caHT += inv.total_ht || 0;
    });

    // Dépenses HT
    expenses.forEach((e) => {
      if (!e.project_id) return;
      const entry = projectFinanceMap.get(e.project_id);
      if (!entry) return;
      if (!isBetween(e.date, filterRange.start, filterRange.end)) return;
      entry.depensesHT += e.amount_ht || 0;
    });

    // Main d'oeuvre = heures pointées × taux horaire
    teamAssignments.forEach((a) => {
      if (!a.project_id) return;
      const entry = projectFinanceMap.get(a.project_id);
      if (!entry) return;
      if (!isBetween(a.date, filterRange.start, filterRange.end)) return;
      const rate = a.team_members?.hourly_rate || 0;
      entry.mainOeuvreHT += (a.hours || 0) * rate;
    });

    // Compute totals per project
    projectFinanceMap.forEach((p) => {
      p.coutTotal = p.mainOeuvreHT + p.depensesHT;
      p.margeBrute = p.caHT - p.coutTotal;
      p.margePct = p.caHT > 0 ? (p.margeBrute / p.caHT) * 100 : null;
    });

    const projectMargins = Array.from(projectFinanceMap.values())
      .filter((p) => p.caHT > 0 || p.coutTotal > 0);

    // Aggregated metrics on the period (weighted average across all chantiers actifs)
    const totalCA = projectMargins.reduce((s, p) => s + p.caHT, 0);
    const totalCost = projectMargins.reduce((s, p) => s + p.coutTotal, 0);
    const totalMargeBrute = totalCA - totalCost;
    const avgMargePct = totalCA > 0 ? (totalMargeBrute / totalCA) * 100 : null;

    // Average margin % among individual chantiers (simple mean of margePct, only those with caHT > 0)
    const billedProjects = projectMargins.filter((p) => p.margePct !== null);
    const avgMargePctPerChantier = billedProjects.length > 0
      ? billedProjects.reduce((s, p) => s + (p.margePct || 0), 0) / billedProjects.length
      : null;

    // Top 5 / Bottom 5 chantiers (only ceux avec marge calculable)
    const topMargins = [...billedProjects].sort((a, b) => (b.margePct || 0) - (a.margePct || 0)).slice(0, 5);
    const worstMargins = [...billedProjects].sort((a, b) => (a.margePct || 0) - (b.margePct || 0)).slice(0, 5);

    // Annual aggregated (year-to-date, not period-filtered)
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const yearEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
    let yearCA = 0;
    let yearCost = 0;
    invoices.forEach((inv) => {
      const projectId = invoiceProjectId(inv);
      if (!projectId) return;
      if (!isBetween(inv.created_at, yearStart, yearEnd)) return;
      yearCA += inv.total_ht || 0;
    });
    expenses.forEach((e) => {
      if (!e.project_id) return;
      if (!isBetween(e.date, yearStart, yearEnd)) return;
      yearCost += e.amount_ht || 0;
    });
    teamAssignments.forEach((a) => {
      if (!a.project_id) return;
      if (!isBetween(a.date, yearStart, yearEnd)) return;
      const rate = a.team_members?.hourly_rate || 0;
      yearCost += (a.hours || 0) * rate;
    });
    const yearMarge = yearCA - yearCost;
    const yearMargePct = yearCA > 0 ? (yearMarge / yearCA) * 100 : null;

    // Monthly margin chart — last 12 months
    const marginChartData: { month: string; ca: number; cout: number; marge: number; margePct: number | null }[] = [];
    for (let i = 11; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
      const label = monthStart.toLocaleDateString('fr-FR', { month: 'short' });
      let ca = 0;
      let cout = 0;
      invoices.forEach((inv) => {
        const projectId = invoiceProjectId(inv);
        if (!projectId) return;
        if (!isBetween(inv.created_at, monthStart, monthEnd)) return;
        ca += inv.total_ht || 0;
      });
      expenses.forEach((e) => {
        if (!e.project_id) return;
        if (!isBetween(e.date, monthStart, monthEnd)) return;
        cout += e.amount_ht || 0;
      });
      teamAssignments.forEach((a) => {
        if (!a.project_id) return;
        if (!isBetween(a.date, monthStart, monthEnd)) return;
        const rate = a.team_members?.hourly_rate || 0;
        cout += (a.hours || 0) * rate;
      });
      const marge = ca - cout;
      marginChartData.push({
        month: label,
        ca: Math.round(ca),
        cout: Math.round(cout),
        marge: Math.round(marge),
        margePct: ca > 0 ? Math.round((marge / ca) * 100) : null,
      });
    }

    return {
      revenueThisMonth,
      revenuePreviousMonth,
      revenueDelta,
      pendingQuotes,
      quotesToRelaunch,
      acceptanceRate,
      acceptanceDelta,
      totalQuotesPeriod,
      totalInvoicesPeriod,
      activityItems,
      deadlineItems,
      reminderItems,
      revenueChartData,
      funnelChartData,
      leadSourceChartData,
      topPartnerSources,
      stageConversionData,
      mrr,
      mrrChartData,
      activeContractsCount: activeContracts.length,
      upcomingBillingsCount: upcomingBillings.length,
      hasAnyData: quotes.length > 0 || invoices.length > 0 || projects.length > 0 || leads.length > 0 || contracts.length > 0,
      activeProjects: fProjects.filter((project) => project.status === 'en_cours').length,
      unpaidInvoicesTotal: fInvoices
        .filter((invoice) => invoice.status === 'envoyee' || invoice.status === 'en_retard')
        .reduce((sum, invoice) => sum + invoice.total_ttc, 0),
      openProjectsBudget: fProjects
        .filter((project) => project.status !== 'termine')
        .reduce((sum, project) => sum + project.budget, 0),
      activePipelineTotal: fQuotes
        .filter((quote) => quote.status === 'brouillon' || quote.status === 'envoye')
        .reduce((sum, quote) => sum + quote.total_ttc, 0),
      projectsToLaunchSoon: fProjects.filter((project) => {
        if (project.status !== 'a_planifier' || !project.start_date) return false;
        const days = differenceInDays(project.start_date, now);
        return days >= 0 && days <= 7;
      }).length,
      activeTeamMembers: teamMembers.filter((member) => member.status === 'actif'),
      nextPlanningEvents: fEvents.slice(0, 3),
      planningThisWeekCount: fEvents.length,
      // Marge chantiers
      marginPeriodCA: totalCA,
      marginPeriodCost: totalCost,
      marginPeriodAmount: totalMargeBrute,
      marginPeriodPct: avgMargePct,
      marginAvgPctPerChantier: avgMargePctPerChantier,
      marginBilledChantiersCount: billedProjects.length,
      marginYearCA: yearCA,
      marginYearAmount: yearMarge,
      marginYearPct: yearMargePct,
      marginChartData,
      marginTopProjects: topMargins,
      marginWorstProjects: worstMargins,
    };
  }, [companyProfile, contracts, customRange, datePreset, expenses, invoices, leadSources, leadStages, leads, planningEvents, projects, quotes, reminderSettings, teamAssignments, teamMembers]);

  const periodLabel = datePreset === 'custom' && customRange.from
    ? customRange.to
      ? `Du ${customRange.from.toLocaleDateString('fr-FR')} au ${customRange.to.toLocaleDateString('fr-FR')}`
      : customRange.from.toLocaleDateString('fr-FR')
    : PRESET_LABELS[datePreset];
  const revenueSubtitle = dashboardData.revenuePreviousMonth > 0
    ? `vs ${formatCurrency(dashboardData.revenuePreviousMonth)} sur la periode precedente`
    : dashboardData.revenueThisMonth > 0
      ? `Premier encaissement sur ${periodLabel.toLowerCase()}`
      : `Aucun paiement sur ${periodLabel.toLowerCase()}`;

  const acceptanceSubtitle = quotes.length > 0
    ? 'Sur les devis decides des 30 derniers jours'
    : 'Le taux apparaitra des que vous aurez des devis';

  const hasConfiguredAdminSignals = Boolean(
    reminderSettings?.vat_regime ||
      reminderSettings?.vat_reminder_day ||
      reminderSettings?.has_employees ||
      reminderSettings?.payroll_day ||
      reminderSettings?.dsn_due_day ||
      reminderSettings?.social_contributions_day ||
      (reminderSettings &&
        (reminderSettings.fiscal_year_end_day !== 31 || reminderSettings.fiscal_year_end_month !== 12))
  );

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
      <DemoBanner />
      <PageHeader
        title="Tableau de bord"
        description="Le cockpit de votre activite : tresorerie, pipeline, chantiers et actions a lancer."
      >
        <div className="flex flex-wrap items-center gap-2">
          {(['jour', 'semaine', 'mois', 'annee'] as DatePreset[]).map((p) => (
            <Button
              key={p}
              size="sm"
              variant={datePreset === p ? 'default' : 'outline'}
              onClick={() => { setDatePreset(p); setCustomRange({}); }}
            >
              {PRESET_LABELS[p]}
            </Button>
          ))}
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                size="sm"
                variant={datePreset === 'custom' ? 'default' : 'outline'}
                className="gap-1.5"
              >
                <Calendar className="h-3.5 w-3.5" />
                {datePreset === 'custom' && customRange.from
                  ? customRange.to
                    ? `${customRange.from.toLocaleDateString('fr-FR')} — ${customRange.to.toLocaleDateString('fr-FR')}`
                    : customRange.from.toLocaleDateString('fr-FR')
                  : 'Periode'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <CalendarPicker
                mode="range"
                selected={customRange.from ? { from: customRange.from, to: customRange.to } : undefined}
                onSelect={(range) => {
                  if (range?.from) {
                    setCustomRange({ from: range.from, to: range.to });
                    setDatePreset('custom');
                    if (range.to) {
                      setCalendarOpen(false);
                    }
                  }
                }}
                numberOfMonths={2}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
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
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <Link href="/factures" className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl">
              <KpiCard
                title={`CA encaisse — ${periodLabel.toLowerCase()}`}
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
                sparkline={dashboardData.revenueChartData.map(p => ({ value: p.encaisse }))}
                sparklineColor="hsl(var(--chart-1))"
              />
            </Link>
            <Link href="/devis" className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl">
              <KpiCard
                title={`Devis crees — ${periodLabel.toLowerCase()}`}
                value={formatCurrency(dashboardData.totalQuotesPeriod)}
                subtitle={`${dashboardData.pendingQuotes.length} en attente de reponse`}
                icon={FileText}
                sparkline={dashboardData.revenueChartData.map(p => ({ value: p.devis }))}
                sparklineColor="hsl(var(--chart-3))"
              />
            </Link>
            <Link href="/factures" className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl">
              <KpiCard
                title={`Factures creees — ${periodLabel.toLowerCase()}`}
                value={formatCurrency(dashboardData.totalInvoicesPeriod)}
                subtitle={`${dashboardData.unpaidInvoicesTotal > 0 ? formatCurrency(dashboardData.unpaidInvoicesTotal) + ' a encaisser' : 'Aucune facture impayee'}`}
                icon={Receipt}
                sparkline={dashboardData.revenueChartData.map(p => ({ value: p.factures }))}
                sparklineColor="hsl(var(--chart-2))"
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
                sparkline={dashboardData.revenueChartData.map(p => ({ value: p.devis }))}
                sparklineColor="hsl(var(--chart-3))"
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
                  <p className="mt-1 text-sm text-muted-foreground">Devis, factures et encaissements — {periodLabel.toLowerCase()}</p>
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
                    <Area type="monotone" dataKey="devis" stroke="var(--color-devis)" fill="var(--color-devis)" fillOpacity={0.08} strokeWidth={2} />
                    <Area type="monotone" dataKey="factures" stroke="var(--color-factures)" fill="var(--color-factures)" fillOpacity={0.12} strokeWidth={2} />
                    <Area type="monotone" dataKey="encaisse" stroke="var(--color-encaisse)" fill="var(--color-encaisse)" fillOpacity={0.18} strokeWidth={3} />
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

          {/* ─── Marge chantiers ─── */}
          {(dashboardData.marginPeriodCA > 0 || dashboardData.marginPeriodCost > 0 || dashboardData.marginYearCA > 0) && (
            <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Compass className="h-4 w-4 text-[#D35400]" />
                    <h2 className="text-base font-semibold text-foreground">Marge chantiers</h2>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Rentabilité de vos chantiers — CA HT facturé moins coûts engagés (main-d&apos;œuvre + achats)
                  </p>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href="/chantiers">Voir les chantiers</Link>
                </Button>
              </div>

              {/* KPIs marge */}
              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {/* Marge sur la période */}
                {(() => {
                  const pct = dashboardData.marginPeriodPct;
                  const color = pct === null ? 'text-muted-foreground' : pct < 0 ? 'text-red-600' : pct < 15 ? 'text-amber-600' : 'text-emerald-600';
                  return (
                    <div className="rounded-2xl border border-border bg-gradient-to-br from-card via-card to-muted/30 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-[10px] sm:text-xs font-medium uppercase tracking-wide text-muted-foreground">Marge — {periodLabel.toLowerCase()}</p>
                          <p className={`mt-1 text-2xl sm:text-3xl font-bold tabular-nums ${color}`}>
                            {pct !== null ? `${pct >= 0 ? '+' : ''}${pct.toFixed(0)}%` : '—'}
                          </p>
                        </div>
                        {pct !== null && (
                          pct >= 15 ? <TrendingUp className={`h-5 w-5 ${color}`} /> : pct < 0 ? <TrendingDown className={`h-5 w-5 ${color}`} /> : null
                        )}
                      </div>
                      <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>{formatCurrency(dashboardData.marginPeriodCA)} HT facturé</span>
                        <span className={dashboardData.marginPeriodAmount >= 0 ? 'font-medium text-emerald-700' : 'font-medium text-red-700'}>
                          {dashboardData.marginPeriodAmount >= 0 ? '+' : ''}{formatCurrency(dashboardData.marginPeriodAmount)}
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {/* Marge moyenne par chantier */}
                {(() => {
                  const pct = dashboardData.marginAvgPctPerChantier;
                  const color = pct === null ? 'text-muted-foreground' : pct < 0 ? 'text-red-600' : pct < 15 ? 'text-amber-600' : 'text-emerald-600';
                  return (
                    <div className="rounded-2xl border border-border bg-gradient-to-br from-card via-card to-muted/30 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-[10px] sm:text-xs font-medium uppercase tracking-wide text-muted-foreground">Marge moyenne / chantier</p>
                          <p className={`mt-1 text-2xl sm:text-3xl font-bold tabular-nums ${color}`}>
                            {pct !== null ? `${pct >= 0 ? '+' : ''}${pct.toFixed(0)}%` : '—'}
                          </p>
                        </div>
                      </div>
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        {dashboardData.marginBilledChantiersCount > 0
                          ? `Sur ${dashboardData.marginBilledChantiersCount} chantier${dashboardData.marginBilledChantiersCount > 1 ? 's' : ''} facturé${dashboardData.marginBilledChantiersCount > 1 ? 's' : ''}`
                          : 'Aucun chantier facturé sur cette période'}
                      </p>
                    </div>
                  );
                })()}

                {/* Marge annuelle */}
                {(() => {
                  const pct = dashboardData.marginYearPct;
                  const color = pct === null ? 'text-muted-foreground' : pct < 0 ? 'text-red-600' : pct < 15 ? 'text-amber-600' : 'text-emerald-600';
                  const year = new Date().getFullYear();
                  return (
                    <div className="rounded-2xl border border-border bg-gradient-to-br from-card via-card to-muted/30 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-[10px] sm:text-xs font-medium uppercase tracking-wide text-muted-foreground">Marge annuelle {year}</p>
                          <p className={`mt-1 text-2xl sm:text-3xl font-bold tabular-nums ${color}`}>
                            {pct !== null ? `${pct >= 0 ? '+' : ''}${pct.toFixed(0)}%` : '—'}
                          </p>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>{formatCurrency(dashboardData.marginYearCA)} HT</span>
                        <span className={dashboardData.marginYearAmount >= 0 ? 'font-medium text-emerald-700' : 'font-medium text-red-700'}>
                          {dashboardData.marginYearAmount >= 0 ? '+' : ''}{formatCurrency(dashboardData.marginYearAmount)}
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Chart mensuel */}
              <div className="mt-5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Marge mensuelle — 12 derniers mois</p>
                <div className="mt-2 h-[220px] sm:h-[260px]">
                  <ChartContainer config={marginChartConfig} className="h-full w-full">
                    <BarChart data={dashboardData.marginChartData} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={11} />
                      <YAxis tickLine={false} axisLine={false} fontSize={11} tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} width={40} />
                      <ChartTooltip
                        cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                        content={
                          <ChartTooltipContent
                            formatter={(value, name) => (
                              <div className="flex w-full items-center justify-between gap-4">
                                <span>{name}</span>
                                <span className="font-medium text-foreground">{formatCurrency(Number(value || 0))}</span>
                              </div>
                            )}
                          />
                        }
                      />
                      <ChartLegend content={<ChartLegendContent />} />
                      <Bar dataKey="ca" fill="var(--color-ca)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="cout" fill="var(--color-cout)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="marge" fill="var(--color-marge)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                </div>
              </div>

              {/* Top + worst chantiers */}
              {(dashboardData.marginTopProjects.length > 0 || dashboardData.marginWorstProjects.length > 0) && (
                <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-emerald-200/60 bg-emerald-50/40 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <TrendingUp className="h-4 w-4 text-emerald-600" />
                      <p className="text-sm font-semibold text-foreground">Chantiers les plus rentables</p>
                    </div>
                    {dashboardData.marginTopProjects.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Aucun chantier facturé sur la période.</p>
                    ) : (
                      <ul className="space-y-2">
                        {dashboardData.marginTopProjects.map((p) => (
                          <li key={p.id} className="flex items-center justify-between gap-3 text-sm">
                            <Link href="/chantiers" className="truncate font-medium text-foreground hover:text-[#D35400] transition-colors">
                              {p.name}
                            </Link>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[11px] text-muted-foreground tabular-nums">{formatCurrency(p.margeBrute)}</span>
                              <span className="text-sm font-bold text-emerald-700 tabular-nums">
                                {(p.margePct ?? 0) >= 0 ? '+' : ''}{(p.margePct ?? 0).toFixed(0)}%
                              </span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="rounded-2xl border border-red-200/60 bg-red-50/40 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <TrendingDown className="h-4 w-4 text-red-600" />
                      <p className="text-sm font-semibold text-foreground">Chantiers à surveiller</p>
                    </div>
                    {dashboardData.marginWorstProjects.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Tous vos chantiers sont rentables.</p>
                    ) : (
                      <ul className="space-y-2">
                        {dashboardData.marginWorstProjects.map((p) => {
                          const pct = p.margePct ?? 0;
                          return (
                            <li key={p.id} className="flex items-center justify-between gap-3 text-sm">
                              <Link href="/chantiers" className="truncate font-medium text-foreground hover:text-[#D35400] transition-colors">
                                {p.name}
                              </Link>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-[11px] text-muted-foreground tabular-nums">{formatCurrency(p.margeBrute)}</span>
                                <span className={`text-sm font-bold tabular-nums ${pct < 0 ? 'text-red-700' : pct < 15 ? 'text-amber-700' : 'text-emerald-700'}`}>
                                  {pct >= 0 ? '+' : ''}{pct.toFixed(0)}%
                                </span>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {dashboardData.activeContractsCount > 0 && (
            <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 text-primary" />
                    <h2 className="text-base font-semibold text-foreground">Revenus recurrents (MRR)</h2>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatCurrency(dashboardData.mrr)}/mois · {dashboardData.activeContractsCount} contrat{dashboardData.activeContractsCount > 1 ? 's' : ''} actif{dashboardData.activeContractsCount > 1 ? 's' : ''}
                    {dashboardData.upcomingBillingsCount > 0 && ` · ${dashboardData.upcomingBillingsCount} a facturer cette semaine`}
                  </p>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href="/contrats">Voir les contrats</Link>
                </Button>
              </div>
              <div className="mt-4 h-[200px]">
                <ChartContainer config={mrrChartConfig} className="h-full w-full">
                  <AreaChart data={dashboardData.mrrChartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
                    <YAxis tickLine={false} axisLine={false} fontSize={12} tickFormatter={v => `${v}€`} width={50} />
                    <ChartTooltip content={<ChartTooltipContent formatter={(value) => (
                      <span className="font-medium text-foreground">{formatCurrency(Number(value || 0))}/mois</span>
                    )} />} />
                    <Area
                      type="monotone"
                      dataKey="mrr"
                      stroke="var(--color-mrr)"
                      fill="var(--color-mrr)"
                      fillOpacity={0.15}
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ChartContainer>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.2fr_0.7fr_0.7fr]">
            <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-foreground">Origine de vos leads</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Ou vos opportunites entrent vraiment, et dans quel etat elles se trouvent</p>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href="/prospection">Ouvrir le CRM</Link>
                </Button>
              </div>

              {dashboardData.leadSourceChartData.length === 0 ? (
                <div className="mt-6 rounded-xl border border-dashed border-border bg-muted/20 p-6 text-sm text-muted-foreground">
                  Des que vos leads seront qualifies avec une source, vous verrez ici quels canaux performent le mieux.
                </div>
              ) : (
                <div className="mt-6">
                  <ChartContainer config={leadSourceChartConfig} className="h-[300px] w-full">
                    <BarChart data={dashboardData.leadSourceChartData} margin={{ left: 12, right: 12, top: 10, bottom: 10 }}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="source" tickLine={false} axisLine={false} tickMargin={8} />
                      <YAxis hide />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <ChartLegend content={<ChartLegendContent />} />
                      <Bar dataKey="active" stackId="state" radius={[6, 6, 0, 0]} fill="var(--color-active)" />
                      <Bar dataKey="won" stackId="state" fill="var(--color-won)" />
                      <Bar dataKey="lost" stackId="state" radius={[6, 6, 0, 0]} fill="var(--color-lost)" />
                    </BarChart>
                  </ChartContainer>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-foreground">Top apporteurs</h2>
                  <p className="mt-1 text-sm text-muted-foreground">La course de vos meilleurs partenaires</p>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href="/parametres?tab=parametres">Gerer les sources</Link>
                </Button>
              </div>

              {dashboardData.topPartnerSources.length === 0 ? (
                <div className="mt-6 rounded-xl border border-dashed border-border bg-muted/20 p-6 text-sm text-muted-foreground">
                  Ajoutez vos apporteurs d affaires dans Parametres pour suivre ceux qui vous envoient les meilleurs leads.
                </div>
              ) : (() => {
                const maxValue = Math.max(...dashboardData.topPartnerSources.map((s) => s.wonValue), 1);
                const barColors = [
                  'hsl(var(--primary))',
                  'hsl(var(--chart-2))',
                  'hsl(var(--chart-3))',
                  'hsl(var(--chart-4))',
                  'hsl(var(--chart-5))',
                ];
                return (
                  <div className="mt-6 space-y-3">
                    {dashboardData.topPartnerSources.slice(0, 5).map((source, i) => {
                      const pct = maxValue > 0 ? Math.max((source.wonValue / maxValue) * 100, 8) : 8;
                      const color = barColors[i % barColors.length];
                      return (
                        <Link
                          key={source.id}
                          href="/prospection"
                          className="group block rounded-lg p-2.5 -mx-1 transition-colors hover:bg-muted/30"
                        >
                          <div className="flex items-baseline justify-between gap-2 mb-1.5">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-sm text-muted-foreground w-5 text-right shrink-0">{i + 1}.</span>
                              <p className="text-sm font-medium text-foreground truncate">{source.name}</p>
                            </div>
                            <p className="text-sm font-semibold text-foreground tabular-nums whitespace-nowrap">{formatCurrency(source.wonValue)}</p>
                          </div>
                          <div className="relative h-6 w-full overflow-hidden rounded-full bg-muted/50">
                            <div
                              className="absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out"
                              style={{
                                width: `${pct}%`,
                                backgroundColor: color,
                              }}
                            />
                            <div className="absolute inset-0 flex items-center px-3">
                              <span className="text-[11px] font-medium text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]">
                                {source.wonCount} signe{source.wonCount > 1 ? 's' : ''} · {source.leadCount} lead{source.leadCount > 1 ? 's' : ''}
                              </span>
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-foreground">Lecture par etape</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Visualisez ou votre pipe se remplit et ou les leads stagnent</p>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href="/prospection">Voir le kanban</Link>
                </Button>
              </div>

              {dashboardData.stageConversionData.length === 0 ? (
                <div className="mt-6 rounded-xl border border-dashed border-border bg-muted/20 p-6 text-sm text-muted-foreground">
                  Des que votre pipe contiendra des leads, vous verrez ici le poids de chaque etape.
                </div>
              ) : (
                <div className="mt-6 space-y-4">
                  {dashboardData.stageConversionData.slice(0, 6).map((stage) => (
                    <div key={stage.slug} className="space-y-2 rounded-xl border border-border/70 bg-muted/10 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${stage.color}`}>
                            {stage.label}
                          </span>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-foreground">{stage.total} lead{stage.total > 1 ? 's' : ''}</p>
                          <p className="text-xs text-muted-foreground">{stage.conversionRate}% du pipe</p>
                        </div>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${Math.max(stage.conversionRate, 6)}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {stage.slug === 'gagne'
                          ? `${formatCurrency(stage.wonValue)} signes sur cette etape finale.`
                          : `Surveillez cette etape si les leads y restent trop longtemps.`}
                      </p>
                    </div>
                  ))}
                </div>
              )}
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
                  Vos prochaines actions utiles, generees a partir de vos devis, factures, chantiers et reglages entreprise.
                </p>
              </div>
              <Badge variant="outline" className="w-fit border-primary/20 bg-primary/5 text-primary">
                Pilote automatiquement
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
                          Hellobat vous aide a ne rien laisser trainer.
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
              {reminderSettings
                ? hasConfiguredAdminSignals
                  ? 'Vos reglages TVA, paie, DSN et cloture sont maintenant pris en compte ici. Vous pouvez les affiner a tout moment dans Parametres.'
                  : 'Les rappels administratifs sont prets. Ajoutez vos vraies dates TVA, paie, DSN et cloture pour les rendre encore plus precis.'
                : 'Ajoutez vos reglages TVA, paie, DSN et cloture dans Parametres pour faire apparaitre aussi les rappels administratifs.'}
              {' '}
              <Link href="/parametres?tab=parametres" className="font-medium text-primary underline-offset-2 hover:underline">
                Ouvrir les parametres
              </Link>
            </div>
          </div>

          <TimeByCategoryChart todos={dashTodos} />

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
