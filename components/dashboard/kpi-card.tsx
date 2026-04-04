'use client';

import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';

interface KpiCardProps {
  title: string;
  value: string;
  subtitle: string;
  trend?: {
    value: string;
    positive: boolean;
  };
  icon: React.ElementType;
  sparkline?: { value: number }[];
  sparklineColor?: string;
}

export function KpiCard({ title, value, subtitle, trend, icon: Icon, sparkline, sparklineColor = 'hsl(var(--primary))' }: KpiCardProps) {
  return (
    <div className="group relative rounded-xl border border-border bg-card p-4 sm:p-6 transition-all duration-200 hover:shadow-md hover:border-border/80 overflow-hidden">
      {/* Background sparkline */}
      {sparkline && sparkline.length > 1 && (
        <div className="absolute inset-x-0 bottom-0 h-[60%] opacity-[0.07] pointer-events-none">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkline} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <Area
                type="monotone"
                dataKey="value"
                stroke={sparklineColor}
                fill={sparklineColor}
                fillOpacity={0.4}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="relative flex items-start justify-between">
        <div className="space-y-2 sm:space-y-3 min-w-0">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className="flex items-baseline gap-2 sm:gap-3 flex-wrap">
            <p className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">{value}</p>
            {trend && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                  trend.positive
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-red-50 text-red-700'
                )}
              >
                {trend.positive ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {trend.value}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
