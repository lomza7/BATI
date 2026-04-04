'use client';

import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { Clock } from 'lucide-react';
import { TODO_CATEGORIES, type Todo } from '@/lib/todo-constants';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';

type Period = 'aujourdhui' | 'semaine' | 'mois' | 'annee';

const PERIOD_LABELS: Record<Period, string> = {
  aujourdhui: "Aujourd'hui",
  semaine: 'Cette semaine',
  mois: 'Ce mois-ci',
  annee: "Cette annee",
};

const chartConfig = {
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
    const diff = day === 0 ? 6 : day - 1; // lundi = debut de semaine
    now.setDate(now.getDate() - diff);
    return now;
  }
  if (period === 'mois') {
    now.setDate(1);
    return now;
  }
  // annee
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

  const data = useMemo(() => {
    const start = getStartDate(period);
    const filtered = todos.filter(t => {
      if (!t.time_spent || t.time_spent <= 0) return false;
      // Utiliser completed_at ou updated_at pour dater
      const ref = t.completed_at || t.updated_at || t.created_at;
      return new Date(ref) >= start;
    });

    const byCategory: Record<string, number> = {};
    for (const t of filtered) {
      byCategory[t.category] = (byCategory[t.category] || 0) + t.time_spent;
    }

    return Object.entries(TODO_CATEGORIES)
      .map(([key, cat]) => ({
        category: cat.label,
        minutes: byCategory[key] || 0,
      }))
      .filter(d => d.minutes > 0);
  }, [todos, period]);

  const totalMinutes = data.reduce((s, d) => s + d.minutes, 0);

  return (
    <div className={compact ? '' : 'rounded-xl border bg-card p-4 sm:p-6'}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm">Temps par categorie</h3>
          {totalMinutes > 0 && (
            <span className="text-xs text-muted-foreground">({formatDuration(totalMinutes)})</span>
          )}
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
          Aucun temps enregistre pour cette periode
        </div>
      ) : (
        <ChartContainer config={chartConfig} className={compact ? 'h-[200px] w-full' : 'h-[250px] w-full'}>
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
              tickFormatter={(v) => formatDuration(v)}
              tick={{ fontSize: 11 }}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) => formatDuration(Number(value))}
                />
              }
            />
            <Bar
              dataKey="minutes"
              fill="var(--color-minutes)"
              radius={[0, 4, 4, 0]}
              barSize={24}
            />
          </BarChart>
        </ChartContainer>
      )}
    </div>
  );
}
