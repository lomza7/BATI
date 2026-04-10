'use client';

import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { BarChart3, Clock } from 'lucide-react';
import { TODO_CATEGORIES, type Todo } from '@/lib/todo-constants';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';

type Period = 'aujourdhui' | 'semaine' | 'mois' | 'annee';
type Mode = 'count' | 'time';

const PERIOD_LABELS: Record<Period, string> = {
  aujourdhui: "Aujourd'hui",
  semaine: 'Cette semaine',
  mois: 'Ce mois-ci',
  annee: "Cette année",
};

const countChartConfig = {
  count: {
    label: 'Tâches',
    color: 'hsl(var(--chart-2))',
  },
} satisfies ChartConfig;

const timeChartConfig = {
  minutes: {
    label: 'Minutes',
    color: 'hsl(var(--chart-1))',
  },
} satisfies ChartConfig;

function getStartDate(period: Period): Date {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  if (period === 'aujourdhui') return now;
  if (period === 'semaine') {
    const day = now.getDay();
    const diff = day === 0 ? 6 : day - 1;
    now.setDate(now.getDate() - diff);
    return now;
  }
  if (period === 'mois') {
    now.setDate(1);
    return now;
  }
  now.setMonth(0, 1);
  return now;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${h}h`;
}

interface TimeByChartProps {
  todos: Todo[];
  compact?: boolean;
}

export function TimeByCategoryChart({ todos, compact }: TimeByChartProps) {
  const [period, setPeriod] = useState<Period>('semaine');
  const [mode, setMode] = useState<Mode>('count');

  const data = useMemo(() => {
    const start = getStartDate(period);

    const filtered = todos.filter(t => {
      const ref = t.completed_at || t.updated_at || t.created_at;
      return new Date(ref) >= start;
    });

    const byCategory: Record<string, { count: number; minutes: number }> = {};
    for (const t of filtered) {
      if (!byCategory[t.category]) byCategory[t.category] = { count: 0, minutes: 0 };
      byCategory[t.category].count += 1;
      byCategory[t.category].minutes += (t.time_spent || 0);
    }

    return Object.entries(TODO_CATEGORIES)
      .map(([key, cat]) => ({
        category: cat.label,
        count: byCategory[key]?.count || 0,
        minutes: byCategory[key]?.minutes || 0,
      }))
      .filter(d => mode === 'count' ? d.count > 0 : d.minutes > 0);
  }, [todos, period, mode]);

  const totalCount = data.reduce((s, d) => s + d.count, 0);
  const totalMinutes = data.reduce((s, d) => s + d.minutes, 0);

  const dataKey = mode === 'count' ? 'count' : 'minutes';
  const config = mode === 'count' ? countChartConfig : timeChartConfig;
  const emptyLabel = mode === 'count'
    ? 'Aucune tâche pour cette période'
    : 'Aucun temps enregistré pour cette période';

  return (
    <div className={compact ? '' : 'rounded-xl border bg-card p-4 sm:p-6'}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          {mode === 'count' ? (
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          ) : (
            <Clock className="h-4 w-4 text-muted-foreground" />
          )}
          <h3 className="font-semibold text-sm">
            {mode === 'count' ? 'Tâches par catégorie' : 'Temps par catégorie'}
          </h3>
          {mode === 'count' && totalCount > 0 && (
            <span className="text-xs text-muted-foreground">({totalCount} tâche{totalCount > 1 ? 's' : ''})</span>
          )}
          {mode === 'time' && totalMinutes > 0 && (
            <span className="text-xs text-muted-foreground">({formatDuration(totalMinutes)})</span>
          )}
          <button
            onClick={() => setMode(mode === 'count' ? 'time' : 'count')}
            className="ml-1 flex items-center gap-1 px-2 py-0.5 text-xs rounded-md border border-border text-muted-foreground hover:bg-muted transition-colors"
          >
            {mode === 'count' ? <Clock className="h-3 w-3" /> : <BarChart3 className="h-3 w-3" />}
            {mode === 'count' ? 'Temps' : 'Quantité'}
          </button>
        </div>
        <div className="flex gap-1">
          {(Object.entries(PERIOD_LABELS) as [Period, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setPeriod(key)}
              className={`px-2 py-1 text-xs rounded-md transition-colors ${
                period === key
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {data.length === 0 ? (
        <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
          {emptyLabel}
        </div>
      ) : (
        <ChartContainer config={config} className={compact ? 'h-[200px] w-full' : 'h-[250px] w-full'}>
          <BarChart data={data} layout="vertical" margin={{ left: 0, right: 12, top: 0, bottom: 0 }}>
            <CartesianGrid horizontal={false} strokeDasharray="3 3" />
            <YAxis
              dataKey="category"
              type="category"
              tickLine={false}
              axisLine={false}
              width={90}
              tick={{ fontSize: 12 }}
            />
            <XAxis
              type="number"
              tickLine={false}
              axisLine={false}
              tickFormatter={mode === 'time' ? (v) => formatDuration(v) : undefined}
              allowDecimals={false}
              tick={{ fontSize: 11 }}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={mode === 'time'
                    ? (value) => formatDuration(Number(value))
                    : (value) => `${value} tâche${Number(value) > 1 ? 's' : ''}`
                  }
                />
              }
            />
            <Bar
              dataKey={dataKey}
              fill={mode === 'count' ? 'var(--color-count)' : 'var(--color-minutes)'}
              radius={[0, 4, 4, 0]}
              barSize={24}
            />
          </BarChart>
        </ChartContainer>
      )}
    </div>
  );
}
