'use client';

import { Check, Clock, AlertTriangle, Ban, MailX, MailWarning } from 'lucide-react';
import { cn } from '@/lib/utils';

export type EmailStatus =
  | 'pending'
  | 'sent'
  | 'delivered'
  | 'bounced'
  | 'complained'
  | 'failed'
  | 'skipped';

interface EmailStatusBadgeProps {
  status: EmailStatus | string | null | undefined;
  error?: string | null;
  compact?: boolean;
}

const META: Record<
  EmailStatus,
  { label: string; icon: React.ElementType; className: string }
> = {
  pending: {
    label: 'En attente',
    icon: Clock,
    className: 'bg-muted text-muted-foreground border-border',
  },
  sent: {
    label: 'Envoyé',
    icon: Clock,
    className: 'bg-sky-50 text-sky-700 border-sky-200',
  },
  delivered: {
    label: 'Reçu',
    icon: Check,
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  bounced: {
    label: 'Non délivré',
    icon: MailX,
    className: 'bg-red-50 text-red-700 border-red-200',
  },
  complained: {
    label: 'Signalé spam',
    icon: MailWarning,
    className: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  failed: {
    label: 'Échec envoi',
    icon: AlertTriangle,
    className: 'bg-red-50 text-red-700 border-red-200',
  },
  skipped: {
    label: 'Non envoyé',
    icon: Ban,
    className: 'bg-muted text-muted-foreground border-border',
  },
};

export function EmailStatusBadge({ status, error, compact = false }: EmailStatusBadgeProps) {
  if (!status) return null;
  const meta = META[status as EmailStatus] || META.pending;
  const Icon = meta.icon;
  const title = error ? `${meta.label} — ${error}` : meta.label;
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border font-medium',
        meta.className,
        compact ? 'px-1.5 py-0 text-[10px]' : 'px-2 py-0.5 text-xs',
      )}
    >
      <Icon className={compact ? 'h-2.5 w-2.5' : 'h-3 w-3'} />
      {meta.label}
    </span>
  );
}
