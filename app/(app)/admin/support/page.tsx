'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bug, CircleHelp, Lightbulb, Loader2, Mail, Phone, RefreshCw, Search, Paperclip, FileText, Image as ImageIcon, FileVideo } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type TicketType = 'bug' | 'question' | 'amelioration';
type TicketStatus = 'new' | 'in_progress' | 'resolved' | 'closed';

interface TicketAttachment {
  path: string;
  name: string;
  mime: string;
  size: number;
  url: string | null;
}

interface Ticket {
  id: string;
  user_id: string;
  type: TicketType;
  message: string;
  user_email: string;
  user_full_name: string;
  user_phone: string;
  company_name: string;
  page_url: string;
  user_agent: string;
  status: TicketStatus;
  admin_notes: string;
  handled_at: string | null;
  created_at: string;
  updated_at: string;
  attachments: TicketAttachment[];
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}

function iconForMime(mime: string): React.ElementType {
  if (mime.startsWith('image/')) return ImageIcon;
  if (mime.startsWith('video/')) return FileVideo;
  return FileText;
}

const TYPE_META: Record<TicketType, { label: string; icon: React.ElementType; color: string }> = {
  bug: { label: 'Bug', icon: Bug, color: 'text-rose-600 bg-rose-50' },
  question: { label: 'Question', icon: CircleHelp, color: 'text-sky-600 bg-sky-50' },
  amelioration: { label: 'Amélioration', icon: Lightbulb, color: 'text-amber-600 bg-amber-50' },
};

const STATUS_META: Record<TicketStatus, { label: string; color: string }> = {
  new: { label: 'Nouveau', color: 'bg-blue-100 text-blue-700' },
  in_progress: { label: 'En cours', color: 'bg-amber-100 text-amber-700' },
  resolved: { label: 'Résolu', color: 'bg-emerald-100 text-emerald-700' },
  closed: { label: 'Fermé', color: 'bg-muted text-muted-foreground' },
};

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('fr-FR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function AdminSupportPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<TicketType | 'all'>('all');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Session expirée');

      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (typeFilter !== 'all') params.set('type', typeFilter);

      const res = await fetch(`/api/admin/support/tickets?${params.toString()}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Erreur');
      setTickets(data.tickets || []);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur de chargement';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [user, statusFilter, typeFilter]);

  useEffect(() => { void load(); }, [load]);

  async function updateTicket(id: string, update: Partial<Pick<Ticket, 'status' | 'admin_notes'>>) {
    setSaving(id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Session expirée');

      const res = await fetch('/api/admin/support/tickets', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ id, ...update }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Erreur');

      setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, ...update, updated_at: data.ticket.updated_at, handled_at: data.ticket.handled_at ?? t.handled_at } : t)));
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur';
      toast({ title: 'Erreur', description: msg, variant: 'destructive' });
    } finally {
      setSaving(null);
    }
  }

  const filtered = search.trim()
    ? tickets.filter((t) =>
        [t.message, t.user_email, t.company_name, t.user_full_name]
          .join(' ')
          .toLowerCase()
          .includes(search.toLowerCase()),
      )
    : tickets;

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Support — Tickets utilisateurs"
        description="Bugs, questions et suggestions remontés depuis le bouton Aide"
      >
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={cn('h-3.5 w-3.5 mr-2', loading && 'animate-spin')} />
          Rafraîchir
        </Button>
      </PageHeader>

      {/* Filtres */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher (email, entreprise, message…)"
            className="pl-9"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {(['all', 'new', 'in_progress', 'resolved', 'closed'] as const).map((s) => (
            <Button
              key={s}
              size="sm"
              variant={statusFilter === s ? 'default' : 'outline'}
              onClick={() => setStatusFilter(s)}
            >
              {s === 'all' ? 'Tous' : STATUS_META[s].label}
            </Button>
          ))}
        </div>
        <div className="flex gap-2 flex-wrap">
          {(['all', 'bug', 'question', 'amelioration'] as const).map((t) => (
            <Button
              key={t}
              size="sm"
              variant={typeFilter === t ? 'default' : 'outline'}
              onClick={() => setTypeFilter(t)}
            >
              {t === 'all' ? 'Tous types' : TYPE_META[t].label}
            </Button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={CircleHelp}
          title="Aucun ticket"
          description={tickets.length === 0 ? 'Aucun ticket envoyé pour le moment.' : 'Aucun ticket ne correspond à vos filtres.'}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((ticket) => {
            const meta = TYPE_META[ticket.type];
            const Icon = meta.icon;
            const statusMeta = STATUS_META[ticket.status];
            const isSaving = saving === ticket.id;

            return (
              <div key={ticket.id} className="rounded-xl border border-border bg-card p-4 sm:p-5 space-y-3">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0', meta.color)}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-foreground">{meta.label}</span>
                        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', statusMeta.color)}>
                          {statusMeta.label}
                        </span>
                        <span className="text-xs text-muted-foreground">{formatDateTime(ticket.created_at)}</span>
                      </div>
                      <div className="mt-1 text-sm text-foreground">
                        <span className="font-medium">{ticket.user_full_name || ticket.user_email}</span>
                        {ticket.company_name && <span className="text-muted-foreground"> · {ticket.company_name}</span>}
                      </div>
                      <div className="mt-1 flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
                        <a href={`mailto:${ticket.user_email}`} className="flex items-center gap-1 hover:text-foreground">
                          <Mail className="h-3 w-3" /> {ticket.user_email}
                        </a>
                        {ticket.user_phone && (
                          <a href={`tel:${ticket.user_phone}`} className="flex items-center gap-1 hover:text-foreground">
                            <Phone className="h-3 w-3" /> {ticket.user_phone}
                          </a>
                        )}
                        {ticket.page_url && (
                          <span className="truncate max-w-[300px] font-mono text-[11px]">{ticket.page_url}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Message */}
                <div className="rounded-lg bg-muted/50 p-3 text-sm whitespace-pre-wrap leading-relaxed">
                  {ticket.message}
                </div>

                {/* Pièces jointes */}
                {ticket.attachments && ticket.attachments.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <Paperclip className="h-3 w-3" />
                      {ticket.attachments.length} pièce{ticket.attachments.length > 1 ? 's' : ''} jointe{ticket.attachments.length > 1 ? 's' : ''}
                    </div>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {ticket.attachments.map((att) => {
                        const Icon = iconForMime(att.mime);
                        const isImage = att.mime.startsWith('image/') && att.url;
                        return (
                          <li key={att.path} className="rounded-lg border border-border bg-background overflow-hidden">
                            {isImage ? (
                              <a href={att.url!} target="_blank" rel="noopener noreferrer" className="block">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={att.url!}
                                  alt={att.name}
                                  className="w-full h-32 object-cover bg-muted"
                                  loading="lazy"
                                />
                              </a>
                            ) : null}
                            <div className="p-2 flex items-center gap-2">
                              <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              <div className="min-w-0 flex-1">
                                {att.url ? (
                                  <a
                                    href={att.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-foreground hover:text-primary truncate block"
                                    title={att.name}
                                  >
                                    {att.name}
                                  </a>
                                ) : (
                                  <span className="text-xs text-muted-foreground italic">Lien expiré (rafraîchir)</span>
                                )}
                                <span className="text-[11px] text-muted-foreground">{formatSize(att.size)}</span>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                {/* Actions admin */}
                <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                  <div className="flex gap-1.5 flex-wrap">
                    {(['new', 'in_progress', 'resolved', 'closed'] as const).map((s) => (
                      <Button
                        key={s}
                        size="sm"
                        variant={ticket.status === s ? 'default' : 'outline'}
                        onClick={() => updateTicket(ticket.id, { status: s })}
                        disabled={isSaving || ticket.status === s}
                      >
                        {STATUS_META[s].label}
                      </Button>
                    ))}
                  </div>
                  {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                </div>

                {/* Admin notes */}
                <details className="text-sm">
                  <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                    Notes internes {ticket.admin_notes && '(renseignées)'}
                  </summary>
                  <Textarea
                    defaultValue={ticket.admin_notes}
                    placeholder="Notes internes (visibles uniquement par les admins)"
                    rows={3}
                    className="mt-2"
                    onBlur={(e) => {
                      if (e.target.value !== ticket.admin_notes) {
                        void updateTicket(ticket.id, { admin_notes: e.target.value });
                      }
                    }}
                  />
                </details>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
