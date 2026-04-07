'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, FileText, Search, Filter, MoveHorizontal as MoreHorizontal, Send, Check, X, Mic, Wand2, PenLine, Eye, Copy, ExternalLink, Package, Trash2, Mail, RefreshCw, Download } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { moveEntityToTrash } from '@/lib/recycle-bin';
import { QUOTE_STATUSES, formatCurrency, formatDate } from '@/lib/constants';
import { QuoteAiAssistant, type AiQuoteDraft } from '@/components/devis/quote-ai-assistant';
import { SendQuoteDialog } from '@/components/devis/send-quote-dialog';
import { ServicePicker } from '@/components/devis/service-picker';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { EmptyState } from '@/components/shared/empty-state';
import { ClientPicker } from '@/components/shared/client-picker';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface QuoteSend {
  id: string;
  token: string;
  client_name: string;
  expires_at: string;
  viewed_at: string | null;
  signed_at: string | null;
  created_at: string;
  view_count: number;
  docuseal_signed_document_url: string | null;
}

interface Quote {
  id: string;
  quote_number: string;
  title: string;
  status: keyof typeof QUOTE_STATUSES;
  total_ttc: number;
  valid_until: string | null;
  created_at: string;
  clients: { name: string; email: string | null } | null;
  recurring_contract_id: string | null;
}

interface QuoteLine {
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  is_recurring?: boolean;
  frequency?: string;
}

export default function DevisPage() {
  const AI_INTRO_SESSION_KEY = 'hellobat_ai_quote_intro_seen';
  const { user } = useAuth();
  const router = useRouter();
  const prefillProjectId = useRef<string | null>(null);
  const draftId = useRef<string | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreateOptions, setShowCreateOptions] = useState(false);
  const [showAiIntro, setShowAiIntro] = useState(false);
  const [showAiCreate, setShowAiCreate] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [aiPresetRequest, setAiPresetRequest] = useState<{ id: number; mode: 'empty' | 'example' } | null>(null);
  const [newQuote, setNewQuote] = useState({ title: '', description: '' });
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [lines, setLines] = useState<QuoteLine[]>([
    { description: '', quantity: 1, unit: 'u', unit_price: 0 },
  ]);
  const [showServicePicker, setShowServicePicker] = useState(false);
  const [sendQuote, setSendQuote] = useState<Quote | null>(null);
  const [quoteSends, setQuoteSends] = useState<Record<string, QuoteSend>>({}); // quote_id -> latest send
  const [trackingQuote, setTrackingQuote] = useState<Quote | null>(null);
  const [trackingViews, setTrackingViews] = useState<{ viewed_at: string; user_agent: string }[]>([]);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [resendingQuoteId, setResendingQuoteId] = useState<string | null>(null);
  const [resentQuoteId, setResentQuoteId] = useState<string | null>(null);

  useEffect(() => {
    loadQuotes();

    // Pré-remplissage depuis l'URL (venant d'un chantier ou d'une fiche client)
    const params = new URLSearchParams(window.location.search);
    const paramClientId = params.get('client_id');
    const paramProjectId = params.get('project_id');

    if (paramClientId || paramProjectId) {
      if (paramProjectId) prefillProjectId.current = paramProjectId;
      if (paramClientId) setSelectedClientId(paramClientId);
      setShowCreateOptions(true);
      router.replace('/devis', { scroll: false });
    }
  }, []);

  async function loadQuotes() {
    const [quotesRes, sendsRes] = await Promise.all([
      supabase
        .from('quotes')
        .select('id, quote_number, title, status, total_ttc, valid_until, created_at, clients(name, email, deleted_at), recurring_contracts(id)')
        .is('deleted_at', null)
        .order('created_at', { ascending: false }),
      supabase
        .from('quote_sends')
        .select('id, quote_id, token, client_name, expires_at, viewed_at, signed_at, created_at, view_count, docuseal_signed_document_url')
        .order('created_at', { ascending: false }),
    ]);

    setQuotes(((quotesRes.data as unknown as Array<Record<string, unknown>>) || []).map(q => {
      const contracts = Array.isArray(q.recurring_contracts) ? q.recurring_contracts as Array<{ id: string }> : [];
      const clientValue = Array.isArray(q.clients) ? q.clients[0] : q.clients;
      return {
        ...q,
        clients: clientValue && typeof clientValue === 'object' && !(clientValue as { deleted_at?: string | null }).deleted_at
          ? {
              name: String((clientValue as { name?: string }).name || ''),
              email: (clientValue as { email?: string | null }).email || null,
            }
          : null,
        recurring_contract_id: contracts[0]?.id || null,
      } as Quote;
    }));

    // Garder seulement le dernier envoi par devis
    const sendsMap: Record<string, QuoteSend> = {};
    if (sendsRes.data) {
      for (const s of sendsRes.data as any[]) {
        if (!sendsMap[s.quote_id]) {
          sendsMap[s.quote_id] = s;
        }
      }
      // Compter les vues depuis quote_send_views
      const sendIds = Object.values(sendsMap).map(s => s.id);
      if (sendIds.length > 0) {
        const { data: viewCounts } = await supabase
          .from('quote_send_views')
          .select('send_id')
          .in('send_id', sendIds);
        if (viewCounts) {
          const counts: Record<string, number> = {};
          for (const v of viewCounts) {
            counts[v.send_id] = (counts[v.send_id] || 0) + 1;
          }
          for (const qid of Object.keys(sendsMap)) {
            sendsMap[qid].view_count = counts[sendsMap[qid].id] || 0;
          }
        }
      }
    }
    setQuoteSends(sendsMap);
    setLoading(false);
  }

  // Auto-save: create a brouillon draft as soon as a client is selected
  async function autosaveDraft(clientId: string) {
    if (!user || draftId.current) return;

    const now = new Date();
    const quoteNumber = `D-${now.getFullYear()}-${String(Math.floor(Math.random() * 999) + 1).padStart(3, '0')}`;
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 30);

    const { data } = await supabase
      .from('quotes')
      .insert({
        user_id: user.id,
        quote_number: quoteNumber,
        client_id: clientId,
        project_id: prefillProjectId.current || null,
        title: newQuote.title || '',
        description: newQuote.description || '',
        status: 'brouillon',
        total_ht: 0,
        total_ttc: 0,
        valid_until: validUntil.toISOString().split('T')[0],
      })
      .select('id')
      .single();

    if (data) {
      draftId.current = data.id;
    }
  }

  function handleClientSelect(clientId: string | null) {
    setSelectedClientId(clientId);
    if (clientId && !draftId.current) {
      autosaveDraft(clientId);
    }
  }

  async function saveQuote() {
    if (!user) return;

    const validLines = lines.filter(l => l.description.trim());
    const totalHt = validLines.reduce((sum, l) => sum + l.quantity * l.unit_price, 0);
    const totalTtc = totalHt * 1.2;
    let savedQuoteId: string | null = null;

    if (draftId.current) {
      // Update existing draft
      await supabase
        .from('quotes')
        .update({
          client_id: selectedClientId,
          project_id: prefillProjectId.current || null,
          title: newQuote.title,
          description: newQuote.description,
          total_ht: totalHt,
          total_ttc: totalTtc,
          updated_at: new Date().toISOString(),
        })
        .eq('id', draftId.current);

      // Replace lines: delete old, insert new
      await supabase.from('quote_lines').delete().eq('quote_id', draftId.current);
      if (validLines.length > 0) {
        await supabase.from('quote_lines').insert(
          validLines.map((l, i) => ({
            user_id: user.id,
            quote_id: draftId.current!,
            description: l.description,
            quantity: l.quantity,
            unit: l.unit,
            unit_price: l.unit_price,
            total: l.quantity * l.unit_price,
            position: i,
          }))
        );
      }

      savedQuoteId = draftId.current;

      // Create lead if none exists yet for this quote
      const { data: existingLead } = await supabase
        .from('leads')
        .select('id')
        .eq('quote_id', draftId.current)
        .maybeSingle();

      if (!existingLead) {
        const now = new Date();
        const quoteNumber = `D-${now.getFullYear()}-${String(Math.floor(Math.random() * 999) + 1).padStart(3, '0')}`;
        await supabase.from('leads').insert({
          user_id: user.id,
          name: newQuote.title || `Devis ${quoteNumber}`,
          client_id: selectedClientId || null,
          quote_id: draftId.current,
          stage: 'devis_envoye',
          source: 'devis',
          value: totalTtc,
          notes: newQuote.description || '',
        });
      }
    } else {
      // No draft yet — create everything from scratch
      const now = new Date();
      const quoteNumber = `D-${now.getFullYear()}-${String(Math.floor(Math.random() * 999) + 1).padStart(3, '0')}`;
      const validUntil = new Date();
      validUntil.setDate(validUntil.getDate() + 30);

      const { data: quote } = await supabase
        .from('quotes')
        .insert({
          user_id: user.id,
          quote_number: quoteNumber,
          client_id: selectedClientId,
          project_id: prefillProjectId.current || null,
          title: newQuote.title,
          description: newQuote.description,
          total_ht: totalHt,
          total_ttc: totalTtc,
          valid_until: validUntil.toISOString().split('T')[0],
        })
        .select('id')
        .single();

      if (quote) savedQuoteId = quote.id;

      if (quote && validLines.length > 0) {
        await supabase.from('quote_lines').insert(
          validLines.map((l, i) => ({
            user_id: user.id,
            quote_id: quote.id,
            description: l.description,
            quantity: l.quantity,
            unit: l.unit,
            unit_price: l.unit_price,
            total: l.quantity * l.unit_price,
            position: i,
          }))
        );
      }

      if (quote) {
        await supabase.from('leads').insert({
          user_id: user.id,
          name: newQuote.title || `Devis ${quoteNumber}`,
          client_id: selectedClientId || null,
          quote_id: quote.id,
          stage: 'devis_envoye',
          source: 'devis',
          value: totalTtc,
          notes: newQuote.description || '',
        });
      }
    }

    // Auto-create recurring contracts from recurring service lines
    const recurringLines = validLines.filter(l => l.is_recurring);
    if (recurringLines.length > 0 && savedQuoteId && user) {
      // Check if contract already exists for this quote
      const { data: existingContract } = await supabase
        .from('recurring_contracts')
        .select('id')
        .eq('quote_id', savedQuoteId)
        .maybeSingle();

      if (!existingContract) {
        const startDate = new Date().toISOString().split('T')[0];
        for (const line of recurringLines) {
          await supabase.from('recurring_contracts').insert({
            user_id: user.id,
            client_id: selectedClientId || null,
            quote_id: savedQuoteId,
            title: line.description,
            contract_type: 'autre',
            amount: line.quantity * line.unit_price,
            frequency: line.frequency || 'mensuel',
            tva_rate: 20,
            status: 'en_attente',
            start_date: startDate,
            next_billing: startDate,
            auto_send: false,
          });
        }
      }
    }

    setShowCreate(false);
    setNewQuote({ title: '', description: '' });
    setSelectedClientId(null);
    setLines([{ description: '', quantity: 1, unit: 'u', unit_price: 0 }]);
    draftId.current = null;
    prefillProjectId.current = null;
    loadQuotes();
  }

  async function deleteQuote(id: string) {
    if (!user) return;
    await moveEntityToTrash('quote', id, user.id);
    loadQuotes();
  }

  async function updateStatus(id: string, status: string) {
    await supabase.from('quotes').update({ status, updated_at: new Date().toISOString() }).eq('id', id);

    // If accepted, activate any linked recurring contract
    if (status === 'accepte') {
      const quote = quotes.find(q => q.id === id);
      if (quote?.recurring_contract_id) {
        await supabase.from('recurring_contracts').update({
          status: 'actif',
          updated_at: new Date().toISOString(),
        }).eq('id', quote.recurring_contract_id);
      }
    }

    loadQuotes();
  }

  function copyLink(token: string) {
    const base = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    const link = `${base}/d/${token}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(token);
    setTimeout(() => setCopiedLink(null), 2000);
  }

  async function resendEmail(quoteId: string) {
    if (resendingQuoteId) return;
    setResendingQuoteId(quoteId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const res = await fetch('/api/docuseal/resend-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ quote_id: quoteId }),
      });

      if (res.ok) {
        setResentQuoteId(quoteId);
        setTimeout(() => setResentQuoteId(null), 3000);
      }
    } catch {
      // silently fail
    }
    setResendingQuoteId(null);
  }

  async function openTracking(q: Quote) {
    setTrackingQuote(q);
    const send = quoteSends[q.id];
    if (send) {
      const { data } = await supabase
        .from('quote_send_views')
        .select('viewed_at, user_agent')
        .eq('send_id', send.id)
        .order('viewed_at', { ascending: false });
      setTrackingViews((data as any[]) || []);
    } else {
      setTrackingViews([]);
    }
  }

  function getTrackingBadge(q: Quote) {
    const send = quoteSends[q.id];
    if (!send) return null;
    if (send.signed_at) return { label: 'Signe', color: 'bg-emerald-50 text-emerald-700', icon: Check };
    if (send.view_count > 0) return { label: `Vu ${send.view_count}x`, color: 'bg-blue-50 text-blue-700', icon: Eye };
    if (new Date(send.expires_at) < new Date()) return { label: 'Expire', color: 'bg-amber-50 text-amber-700', icon: null };
    return { label: 'Envoye', color: 'bg-violet-50 text-violet-700', icon: Send };
  }

  const filteredQuotes = quotes.filter(q =>
    q.title.toLowerCase().includes(search.toLowerCase()) ||
    q.quote_number.toLowerCase().includes(search.toLowerCase()) ||
    q.clients?.name?.toLowerCase().includes(search.toLowerCase())
  );

  function addLine() {
    setLines([...lines, { description: '', quantity: 1, unit: 'u', unit_price: 0 }]);
  }

  function updateLine(index: number, field: keyof QuoteLine, value: string | number) {
    const updated = [...lines];
    (updated[index] as unknown as Record<string, string | number>)[field] = value;
    setLines(updated);
  }

  function removeLine(index: number) {
    if (lines.length > 1) {
      setLines(lines.filter((_, i) => i !== index));
    }
  }

  function openCreateOptions() {
    setShowCreateOptions(true);
  }

  function openManualCreate() {
    setShowCreateOptions(false);
    draftId.current = null;
    setShowCreate(true);
  }

  function openAiCreate() {
    setShowCreateOptions(false);

    if (typeof window !== 'undefined' && !window.sessionStorage.getItem(AI_INTRO_SESSION_KEY)) {
      window.sessionStorage.setItem(AI_INTRO_SESSION_KEY, 'seen');
      setShowAiIntro(true);
      return;
    }

    setAiPresetRequest({ id: Date.now(), mode: 'empty' });
    setShowAiCreate(true);
  }

  function startAiCreate() {
    setShowAiIntro(false);
    setAiPresetRequest({ id: Date.now(), mode: 'empty' });
    setShowAiCreate(true);
  }

  async function applyAiDraft(draft: AiQuoteDraft) {
    setNewQuote({
      title: draft.title,
      description: draft.description,
    });
    setLines(draft.lines.map((line) => ({ ...line })));
    setShowAiCreate(false);
    setShowCreate(true);

    // Try to match AI client name to an existing client
    if (draft.clientName?.trim()) {
      const { data } = await supabase
        .from('clients')
        .select('id')
        .ilike('name', draft.clientName.trim())
        .is('deleted_at', null)
        .maybeSingle();
      if (data) setSelectedClientId(data.id);
    }
  }

  const linesTotal = lines.reduce((sum, l) => sum + l.quantity * l.unit_price, 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Devis" description="Creez, gerez et envoyez vos devis">
        <Button onClick={openCreateOptions} className="gap-2">
          <Plus className="h-4 w-4" />
          Nouveau devis
        </Button>
      </PageHeader>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher un devis..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button variant="outline" size="icon">
          <Filter className="h-4 w-4" />
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : filteredQuotes.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Aucun devis"
          description="Creez votre premier devis pour commencer a facturer vos clients."
        >
          <Button onClick={openCreateOptions} className="gap-2">
            <Plus className="h-4 w-4" />
            Creer un devis
          </Button>
        </EmptyState>
      ) : (
        <>
          <div className="hidden sm:block rounded-xl border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Numero</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Client</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Titre</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Statut</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Signature</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Montant TTC</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Date</th>
                    <th className="px-4 py-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredQuotes.map(q => {
                    const st = QUOTE_STATUSES[q.status] || QUOTE_STATUSES.brouillon;
                    const send = quoteSends[q.id];
                    const badge = getTrackingBadge(q);
                    return (
                      <tr key={q.id} className="transition-colors hover:bg-muted/20">
                        <td className="px-4 py-3 text-sm font-medium text-foreground">{q.quote_number}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{q.clients?.name || '-'}</td>
                        <td className="px-4 py-3 text-sm text-foreground">{q.title}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <StatusBadge label={st.label} color={st.color} />
                            {q.recurring_contract_id && (
                              <Badge variant="outline" className="gap-1 text-[10px] px-1.5 py-0"><RefreshCw className="h-2.5 w-2.5" /> Contrat</Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {send ? (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => openTracking(q)}
                                className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-colors hover:opacity-80 ${badge?.color || ''}`}
                              >
                                {badge?.icon && <badge.icon className="h-3 w-3" />}
                                {badge?.label}
                              </button>
                              <button
                                onClick={() => copyLink(send.token)}
                                className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                                title="Copier le lien"
                              >
                                {copiedLink === send.token ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setSendQuote(q)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                            >
                              <Send className="h-3 w-3" />
                              Envoyer
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-foreground text-right">{formatCurrency(q.total_ttc)}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{formatDate(q.created_at)}</td>
                        <td className="px-4 py-3">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {(q.status === 'brouillon' || q.status === 'envoye') && (
                                <DropdownMenuItem onClick={() => setSendQuote(q)}>
                                  <PenLine className="mr-2 h-4 w-4" /> {send ? 'Renvoyer pour signature' : 'Envoyer pour signature'}
                                </DropdownMenuItem>
                              )}
                              {send && (
                                <DropdownMenuItem onClick={() => resendEmail(q.id)} disabled={resendingQuoteId === q.id}>
                                  {resentQuoteId === q.id ? (
                                    <><Check className="mr-2 h-4 w-4 text-emerald-600" /> Email renvoye !</>
                                  ) : resendingQuoteId === q.id ? (
                                    <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Envoi en cours...</>
                                  ) : (
                                    <><Mail className="mr-2 h-4 w-4" /> Renvoyer l&apos;email</>
                                  )}
                                </DropdownMenuItem>
                              )}
                              {send && (
                                <DropdownMenuItem onClick={() => copyLink(send.token)}>
                                  <Copy className="mr-2 h-4 w-4" /> Copier le lien
                                </DropdownMenuItem>
                              )}
                              {send && (
                                <DropdownMenuItem onClick={() => window.open(`/d/${send.token}`, '_blank')}>
                                  <ExternalLink className="mr-2 h-4 w-4" /> Voir le devis
                                </DropdownMenuItem>
                              )}
                              {send?.docuseal_signed_document_url && (
                                <DropdownMenuItem onClick={() => window.open(send.docuseal_signed_document_url!, '_blank')}>
                                  <Download className="mr-2 h-4 w-4" /> Telecharger le devis signe
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => updateStatus(q.id, 'envoye')}>
                                <Send className="mr-2 h-4 w-4" /> Marquer envoye
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => updateStatus(q.id, 'accepte')}>
                                <Check className="mr-2 h-4 w-4" /> Marquer accepte
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => updateStatus(q.id, 'refuse')}>
                                <X className="mr-2 h-4 w-4" /> Marquer refuse
                              </DropdownMenuItem>
                              {q.status === 'brouillon' && (
                                <DropdownMenuItem className="text-destructive" onClick={() => deleteQuote(q.id)}>
                                  <Trash2 className="mr-2 h-4 w-4" /> Supprimer
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <div className="sm:hidden space-y-3">
            {filteredQuotes.map(q => {
              const st = QUOTE_STATUSES[q.status] || QUOTE_STATUSES.brouillon;
              const send = quoteSends[q.id];
              const badge = getTrackingBadge(q);
              return (
                <div key={q.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{q.title}</p>
                      <p className="text-xs text-muted-foreground">{q.clients?.name || '-'} &middot; {q.quote_number}</p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setSendQuote(q)}>
                          <PenLine className="mr-2 h-4 w-4" /> {send ? 'Renvoyer' : 'Envoyer pour signature'}
                        </DropdownMenuItem>
                        {send && (
                          <DropdownMenuItem onClick={() => resendEmail(q.id)} disabled={resendingQuoteId === q.id}>
                            {resentQuoteId === q.id ? (
                              <><Check className="mr-2 h-4 w-4 text-emerald-600" /> Email renvoye !</>
                            ) : resendingQuoteId === q.id ? (
                              <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Envoi...</>
                            ) : (
                              <><Mail className="mr-2 h-4 w-4" /> Renvoyer l&apos;email</>
                            )}
                          </DropdownMenuItem>
                        )}
                        {send && (
                          <DropdownMenuItem onClick={() => copyLink(send.token)}>
                            <Copy className="mr-2 h-4 w-4" /> Copier le lien
                          </DropdownMenuItem>
                        )}
                        {send && (
                          <DropdownMenuItem onClick={() => openTracking(q)}>
                            <Eye className="mr-2 h-4 w-4" /> Suivi d&apos;ouverture
                          </DropdownMenuItem>
                        )}
                        {send?.docuseal_signed_document_url && (
                          <DropdownMenuItem onClick={() => window.open(send.docuseal_signed_document_url!, '_blank')}>
                            <Download className="mr-2 h-4 w-4" /> Telecharger le devis signe
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => updateStatus(q.id, 'envoye')}>Marquer envoye</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => updateStatus(q.id, 'accepte')}>Marquer accepte</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => updateStatus(q.id, 'refuse')}>Marquer refuse</DropdownMenuItem>
                        {q.status === 'brouillon' && (
                          <DropdownMenuItem className="text-destructive" onClick={() => deleteQuote(q.id)}>
                            <Trash2 className="mr-2 h-4 w-4" /> Supprimer
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-2">
                      <StatusBadge label={st.label} color={st.color} />
                      {q.recurring_contract_id && (
                        <Badge variant="outline" className="gap-1 text-[10px] px-1.5 py-0"><RefreshCw className="h-2.5 w-2.5" /> Contrat</Badge>
                      )}
                      {badge && (
                        <button
                          onClick={() => openTracking(q)}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${badge.color}`}
                        >
                          {badge.icon && <badge.icon className="h-2.5 w-2.5" />}
                          {badge.label}
                        </button>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-foreground">{formatCurrency(q.total_ttc)}</p>
                  </div>
                  {!send && (q.status === 'brouillon' || q.status === 'envoye') && (
                    <button
                      onClick={() => setSendQuote(q)}
                      className="mt-3 w-full h-9 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Send className="h-3 w-3" />
                      Envoyer pour signature
                    </button>
                  )}
                  {send && !send.signed_at && (
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => copyLink(send.token)}
                        className="flex-1 h-9 rounded-lg text-xs font-medium border border-border bg-white text-foreground hover:bg-muted/50 transition-colors flex items-center justify-center gap-1.5"
                      >
                        {copiedLink === send.token ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                        {copiedLink === send.token ? 'Copie !' : 'Copier le lien'}
                      </button>
                      <button
                        onClick={() => setSendQuote(q)}
                        className="h-9 px-3 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Send className="h-3 w-3" />
                        Renvoyer
                      </button>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">{formatDate(q.created_at)}</p>
                </div>
              );
            })}
          </div>
        </>
      )}

      <Dialog open={showCreateOptions} onOpenChange={setShowCreateOptions}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Comment voulez-vous preparer ce devis ?</DialogTitle>
            <DialogDescription>
              Choisissez votre point de depart. Vous pourrez toujours reprendre la main avant l&apos;envoi au client.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={openManualCreate}
              className="rounded-2xl border border-border bg-card p-5 text-left transition-all hover:border-[#d35400]/30 hover:shadow-sm"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted">
                <FileText className="h-5 w-5 text-foreground" />
              </div>
              <p className="mt-4 text-base font-semibold text-foreground">Devis classique</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Ouvrir le formulaire habituel et saisir les lignes vous-meme.
              </p>
            </button>

            <button
              type="button"
              onClick={openAiCreate}
              className="rounded-2xl border border-[#d35400]/20 bg-[#fff7f0] p-5 text-left transition-all hover:border-[#d35400]/35 hover:shadow-sm"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#d35400] text-white">
                <Wand2 className="h-5 w-5" />
              </div>
              <div className="mt-4 flex items-center gap-2">
                <p className="text-base font-semibold text-foreground">Devis avec IA</p>
                <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-[#a34700]">
                  Voix + photos
                </span>
              </div>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Decrivez la demande, ajoutez des photos du chantier et laissez l&apos;assistant proposer une base de devis.
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs text-[#a34700]">
                <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1">
                  <Mic className="h-3 w-3" />
                  Vocal
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1">
                  <Wand2 className="h-3 w-3" />
                  Analyse IA
                </span>
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showAiIntro} onOpenChange={setShowAiIntro}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Devis IA</DialogTitle>
            <DialogDescription>Cette aide ne s&apos;affiche qu&apos;une fois pendant la session.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-2xl border border-[#d35400]/15 bg-[#fff7f0] p-4">
              <p className="text-sm font-medium text-foreground">Allez droit au but</p>
              <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                <p>1. Commencez a parler.</p>
                <p>2. Ajoutez des photos si besoin.</p>
                <p>3. Lancez la magie pour generer le brouillon.</p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => setShowAiIntro(false)}>
                Fermer
              </Button>
              <Button onClick={startAiCreate} className="gap-2">
                <Wand2 className="h-4 w-4" />
                Commencer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showAiCreate} onOpenChange={setShowAiCreate}>
        <DialogContent className="max-w-5xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Devis avec IA</DialogTitle>
            <DialogDescription>Parlez, ajoutez des photos, puis lancez la magie.</DialogDescription>
          </DialogHeader>

          <QuoteAiAssistant onUseDraft={applyAiDraft} presetRequest={aiPresetRequest} />
        </DialogContent>
      </Dialog>

      <Dialog open={showCreate} onOpenChange={(open) => {
        setShowCreate(open);
        if (!open) {
          // Reload list to show any auto-saved draft
          if (draftId.current) {
            loadQuotes();
            draftId.current = null;
          }
          setNewQuote({ title: '', description: '' });
          setSelectedClientId(null);
          setLines([{ description: '', quantity: 1, unit: 'u', unit_price: 0 }]);
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nouveau devis</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-foreground">Titre du devis</label>
                <Input
                  className="mt-1"
                  placeholder="Ex: Renovation salle de bain"
                  value={newQuote.title}
                  onChange={e => setNewQuote({ ...newQuote, title: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Client</label>
                <ClientPicker
                  className="mt-1"
                  value={selectedClientId}
                  onChange={(id) => handleClientSelect(id)}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Description</label>
              <textarea
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                rows={2}
                placeholder="Details supplementaires..."
                value={newQuote.description}
                onChange={e => setNewQuote({ ...newQuote, description: e.target.value })}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-3 gap-2">
                <label className="text-sm font-medium text-foreground">Lignes du devis</label>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setShowServicePicker(!showServicePicker)} className="gap-1">
                    <Package className="h-3 w-3" /> Mes prestations
                  </Button>
                  <Button variant="outline" size="sm" onClick={addLine} className="gap-1">
                    <Plus className="h-3 w-3" /> Ligne vide
                  </Button>
                </div>
              </div>
              {showServicePicker && (
                <div className="mb-4 rounded-lg border bg-muted/30 p-3">
                  <ServicePicker
                    onSelect={(svc) => {
                      setLines(prev => [...prev, svc]);
                    }}
                    onClose={() => setShowServicePicker(false)}
                  />
                </div>
              )}
              <div className="space-y-2">
                {lines.map((line, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-start">
                    <div className="col-span-12 sm:col-span-5">
                      <Input
                        placeholder="Description"
                        value={line.description}
                        onChange={e => updateLine(i, 'description', e.target.value)}
                      />
                    </div>
                    <div className="col-span-4 sm:col-span-2">
                      <Input
                        type="number"
                        placeholder="Qte"
                        value={line.quantity || ''}
                        onChange={e => updateLine(i, 'quantity', Number(e.target.value))}
                      />
                    </div>
                    <div className="col-span-3 sm:col-span-1">
                      <Input
                        placeholder="u"
                        value={line.unit}
                        onChange={e => updateLine(i, 'unit', e.target.value)}
                      />
                    </div>
                    <div className="col-span-4 sm:col-span-3">
                      <Input
                        type="number"
                        placeholder="Prix unit."
                        value={line.unit_price || ''}
                        onChange={e => updateLine(i, 'unit_price', Number(e.target.value))}
                      />
                    </div>
                    <div className="col-span-1 flex justify-center pt-2">
                      <button onClick={() => removeLine(i)} className="text-muted-foreground hover:text-destructive transition-colors">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-muted/50 p-4">
              <div className="text-sm text-muted-foreground">
                <p>Total HT : {formatCurrency(linesTotal)}</p>
                <p>TVA 20% : {formatCurrency(linesTotal * 0.2)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Total TTC</p>
                <p className="text-2xl font-semibold text-foreground">{formatCurrency(linesTotal * 1.2)}</p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowCreate(false)}>Annuler</Button>
              <Button onClick={saveQuote} disabled={!newQuote.title.trim()}>
                {draftId.current ? 'Enregistrer le devis' : 'Creer le devis'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {sendQuote && (
        <SendQuoteDialog
          quote={sendQuote}
          onClose={() => setSendQuote(null)}
          onSent={loadQuotes}
        />
      )}

      {/* Dialog suivi d'ouverture */}
      <Dialog open={!!trackingQuote} onOpenChange={() => setTrackingQuote(null)}>
        <DialogContent className="sm:max-w-[480px] p-0 gap-0">
          <DialogHeader className="px-6 py-5 border-b border-border">
            <DialogTitle className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center">
                <Eye className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-base font-semibold">Suivi du devis</p>
                <p className="text-xs text-muted-foreground font-normal">{trackingQuote?.quote_number} — {trackingQuote?.title}</p>
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="px-6 py-5 max-h-[60vh] overflow-y-auto">
            {trackingQuote && quoteSends[trackingQuote.id] ? (() => {
              const send = quoteSends[trackingQuote.id];
              return (
                <div className="space-y-5">
                  {/* Timeline */}
                  <div className="space-y-3">
                    {/* Envoye */}
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 h-6 w-6 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
                        <Send className="h-3 w-3 text-violet-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">Lien envoye</p>
                        <p className="text-xs text-muted-foreground">{formatDate(send.created_at)} — a {send.client_name}</p>
                      </div>
                    </div>

                    {/* Ouvertures */}
                    {trackingViews.length > 0 ? (
                      trackingViews.map((v, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <div className="mt-0.5 h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                            <Eye className="h-3 w-3 text-blue-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">Ouvert par le client</p>
                            <p className="text-xs text-muted-foreground">{formatDate(v.viewed_at)}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 h-6 w-6 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                          <Eye className="h-3 w-3 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Pas encore ouvert</p>
                        </div>
                      </div>
                    )}

                    {/* Signe */}
                    {send.signed_at ? (
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 h-6 w-6 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                          <Check className="h-3 w-3 text-emerald-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-emerald-700">Devis signe</p>
                          <p className="text-xs text-muted-foreground">{formatDate(send.signed_at)}</p>
                          {send.docuseal_signed_document_url && (
                            <a
                              href={send.docuseal_signed_document_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                            >
                              <Download className="h-3 w-3" />
                              Telecharger le devis signe
                            </a>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-3 opacity-40">
                        <div className="mt-0.5 h-6 w-6 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                          <PenLine className="h-3 w-3 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">En attente de signature</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Recap */}
                  <div className="rounded-xl bg-muted/30 p-4 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Ouvertures</span>
                      <span className="font-medium text-foreground">{trackingViews.length}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Expiration</span>
                      <span className="font-medium text-foreground">{formatDate(send.expires_at)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Statut</span>
                      <span className="font-medium text-foreground">
                        {send.signed_at ? 'Signe' : new Date(send.expires_at) < new Date() ? 'Expire' : 'En attente'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })() : (
              <p className="text-sm text-muted-foreground text-center py-8">Aucun envoi pour ce devis.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
