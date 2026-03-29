'use client';

import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface KpiCardProps {
  title: string;
  value: string;
  subtitle: string;
  trend?: {
    value: string;
    positive: boolean;
  };
  icon: React.ElementType;
}

export function KpiCard({ title, value, subtitle, trend, icon: Icon }: KpiCardProps) {
  return (
    <div className="group relative rounded-xl border border-border bg-card p-4 sm:p-6 transition-all duration-200 hover:shadow-md hover:border-border/80">
      <div className="flex items-start justify-between">
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
