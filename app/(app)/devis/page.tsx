'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, FileText, Search, Filter, MoveHorizontal as MoreHorizontal, Send, Check, X, Mic, Wand2, PenLine, Eye, Copy, ExternalLink, Trash2, Mail, RefreshCw, Download, Receipt } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { moveEntityToTrash } from '@/lib/recycle-bin';
import { QUOTE_STATUSES, formatCurrency, formatDate } from '@/lib/constants';
import { SendQuoteDialog } from '@/components/devis/send-quote-dialog';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { EmptyState } from '@/components/shared/empty-state';
import { ImportCsvButton } from '@/components/shared/import-csv-button';
import { FirstBankAccountDialog } from '@/components/shared/first-bank-account-dialog';
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
import { DocumentPreviewDialog } from '@/components/shared/document-preview-dialog';

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

export default function DevisPage() {
  const AI_INTRO_SESSION_KEY = 'hellobat_ai_quote_intro_seen';
  const { user } = useAuth();
  const router = useRouter();
  const prefillProjectId = useRef<string | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreateOptions, setShowCreateOptions] = useState(false);
  const [showAiIntro, setShowAiIntro] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [sendQuote, setSendQuote] = useState<Quote | null>(null);
  const [quoteSends, setQuoteSends] = useState<Record<string, QuoteSend>>({}); // quote_id -> latest send
  const [trackingQuote, setTrackingQuote] = useState<Quote | null>(null);
  const [trackingViews, setTrackingViews] = useState<{ viewed_at: string; user_agent: string }[]>([]);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [resendingQuoteId, setResendingQuoteId] = useState<string | null>(null);
  const [resentQuoteId, setResentQuoteId] = useState<string | null>(null);
  const [previewQuoteId, setPreviewQuoteId] = useState<string | null>(null);
  // Set when returning from /devis/ai after a successful creation — drives
  // the confirmation banner at the top of the list. Cleared automatically
  // after 5s.
  const [aiCreatedNumber, setAiCreatedNumber] = useState<string | null>(null);
  // null = pas encore verifie, true/false = resultat de la verif
  const [hasBankAccount, setHasBankAccount] = useState<boolean | null>(null);
  const [showFirstRibDialog, setShowFirstRibDialog] = useState(false);

  useEffect(() => {
    loadQuotes();

    // Pré-remplissage depuis l'URL (venant d'un chantier ou d'une fiche client)
    const params = new URLSearchParams(window.location.search);
    const paramClientId = params.get('client_id');
    const paramProjectId = params.get('project_id');
    const aiCreated = params.get('ai_created');

    if (paramClientId || paramProjectId) {
      const forwardParams = new URLSearchParams();
      if (paramClientId) forwardParams.set('client_id', paramClientId);
      if (paramProjectId) forwardParams.set('project_id', paramProjectId);
      setShowCreateOptions(true);
      // Store params so openManualCreate can forward them
      prefillProjectId.current = paramProjectId;
      setSelectedClientId(paramClientId);
      router.replace('/devis', { scroll: false });
    }

    // When the AI assistant redirects back with ?ai_created=<number>, show
    // a confirmation banner and strip the query param.
    if (aiCreated) {
      setAiCreatedNumber(aiCreated);
      router.replace('/devis', { scroll: false });
      window.setTimeout(() => setAiCreatedNumber(null), 5000);
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

    // Vérifie si l'utilisateur a déjà au moins un RIB (pour la modale
    // de premier devis). Séparé du load principal pour ne pas bloquer
    // l'affichage de la liste.
    const { data: bankRows } = await supabase
      .from('bank_accounts')
      .select('id')
      .is('deleted_at', null)
      .limit(1);
    setHasBankAccount((bankRows?.length || 0) > 0);
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
    if (send.signed_at) return { label: 'Signé', color: 'bg-emerald-50 text-emerald-700', icon: Check };
    if (send.view_count > 0) return { label: `Vu ${send.view_count}x`, color: 'bg-blue-50 text-blue-700', icon: Eye };
    if (new Date(send.expires_at) < new Date()) return { label: 'Expiré', color: 'bg-amber-50 text-amber-700', icon: null };
    return { label: 'Envoyé', color: 'bg-violet-50 text-violet-700', icon: Send };
  }

  const filteredQuotes = quotes.filter(q =>
    q.title.toLowerCase().includes(search.toLowerCase()) ||
    q.quote_number.toLowerCase().includes(search.toLowerCase()) ||
    q.clients?.name?.toLowerCase().includes(search.toLowerCase())
  );


  function openCreateOptions() {
    // Premier devis : on force l'ajout d'un RIB avant tout
    if (hasBankAccount === false) {
      setShowFirstRibDialog(true);
      return;
    }
    setShowCreateOptions(true);
  }

  function openManualCreate() {
    setShowCreateOptions(false);
    const params = new URLSearchParams();
    if (selectedClientId) params.set('client_id', selectedClientId);
    if (prefillProjectId.current) params.set('project_id', prefillProjectId.current);
    router.push(`/devis/nouveau${params.toString() ? `?${params}` : ''}`);
  }

  function openAiCreate() {
    setShowCreateOptions(false);

    if (typeof window !== 'undefined' && !window.sessionStorage.getItem(AI_INTRO_SESSION_KEY)) {
      window.sessionStorage.setItem(AI_INTRO_SESSION_KEY, 'seen');
      setShowAiIntro(true);
      return;
    }

    router.push('/devis/ai');
  }

  function startAiCreate() {
    setShowAiIntro(false);
    router.push('/devis/ai');
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Devis" description="Créez, gérez et envoyez vos devis">
        <ImportCsvButton type="quotes" onImported={loadQuotes} />
        <Button onClick={openCreateOptions} className="gap-2">
          <Plus className="h-4 w-4" />
          Nouveau devis
        </Button>
      </PageHeader>

      {aiCreatedNumber && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
          <div className="flex-1">
            <p className="font-medium">Devis {aiCreatedNumber} créé par l&apos;IA</p>
            <p className="text-xs text-emerald-800/80">Tu peux le retrouver dans la liste ci-dessous et l&apos;envoyer dès que tu es prêt.</p>
          </div>
          <button
            type="button"
            onClick={() => setAiCreatedNumber(null)}
            className="text-emerald-700 hover:text-emerald-900"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher un devis…"
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
          description="Créez votre premier devis pour commencer à facturer vos clients."
        >
          <Button onClick={openCreateOptions} className="gap-2">
            <Plus className="h-4 w-4" />
            Créer un devis
          </Button>
        </EmptyState>
      ) : (
        <>
          <div className="hidden sm:block rounded-xl border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Numéro</th>
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
                              <DropdownMenuItem onClick={() => setPreviewQuoteId(q.id)}>
                                <Eye className="mr-2 h-4 w-4" /> Visualiser
                              </DropdownMenuItem>
                              {q.status === 'accepte' && (
                                <DropdownMenuItem onClick={() => router.push(`/factures?billing=${q.id}`)}>
                                  <Receipt className="mr-2 h-4 w-4" /> Facturation
                                </DropdownMenuItem>
                              )}
                              {(q.status === 'brouillon' || q.status === 'envoye') && (
                                <DropdownMenuItem onClick={() => setSendQuote(q)}>
                                  <PenLine className="mr-2 h-4 w-4" /> {send ? 'Renvoyer pour signature' : 'Envoyer pour signature'}
                                </DropdownMenuItem>
                              )}
                              {send && (
                                <DropdownMenuItem onClick={() => resendEmail(q.id)} disabled={resendingQuoteId === q.id}>
                                  {resentQuoteId === q.id ? (
                                    <><Check className="mr-2 h-4 w-4 text-emerald-600" /> Email renvoyé !</>
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
                                  <Download className="mr-2 h-4 w-4" /> Télécharger le devis signé
                                </DropdownMenuItem>
                              )}
                              {q.status !== 'accepte' && (
                                <DropdownMenuItem onClick={() => updateStatus(q.id, 'accepte')}>
                                  <Check className="mr-2 h-4 w-4" /> Marquer accepté
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => updateStatus(q.id, 'refuse')}>
                                <X className="mr-2 h-4 w-4" /> Marquer refusé
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
                        <DropdownMenuItem onClick={() => setPreviewQuoteId(q.id)}>
                          <Eye className="mr-2 h-4 w-4" /> Visualiser
                        </DropdownMenuItem>
                        {q.status === 'accepte' && (
                          <DropdownMenuItem onClick={() => router.push(`/factures?billing=${q.id}`)}>
                            <Receipt className="mr-2 h-4 w-4" /> Facturation
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => setSendQuote(q)}>
                          <PenLine className="mr-2 h-4 w-4" /> {send ? 'Renvoyer' : 'Envoyer pour signature'}
                        </DropdownMenuItem>
                        {send && (
                          <DropdownMenuItem onClick={() => resendEmail(q.id)} disabled={resendingQuoteId === q.id}>
                            {resentQuoteId === q.id ? (
                              <><Check className="mr-2 h-4 w-4 text-emerald-600" /> Email renvoyé !</>
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
                            <Download className="mr-2 h-4 w-4" /> Télécharger le devis signé
                          </DropdownMenuItem>
                        )}
                        {q.status !== 'accepte' && (
                          <DropdownMenuItem onClick={() => updateStatus(q.id, 'accepte')}>
                            <Check className="mr-2 h-4 w-4" /> Marquer accepté
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => updateStatus(q.id, 'refuse')}>
                          <X className="mr-2 h-4 w-4" /> Marquer refusé
                        </DropdownMenuItem>
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
                        {copiedLink === send.token ? 'Copié !' : 'Copier le lien'}
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

      <FirstBankAccountDialog
        open={showFirstRibDialog}
        onOpenChange={setShowFirstRibDialog}
        context="devis"
        onSaved={() => {
          setHasBankAccount(true);
          setShowFirstRibDialog(false);
          setShowCreateOptions(true);
        }}
      />

      <Dialog open={showCreateOptions} onOpenChange={setShowCreateOptions}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Comment voulez-vous préparer ce devis ?</DialogTitle>
            <DialogDescription>
              Choisissez votre point de départ. Vous pourrez toujours reprendre la main avant l&apos;envoi au client.
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
                Ouvrir le formulaire habituel et saisir les lignes vous-même.
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
                  Vocal
                </span>
              </div>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Décris ta demande à voix haute et laisse l&apos;assistant rédiger un brouillon prêt à envoyer.
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
                <p>1. Appuie sur le micro et décris ton chantier.</p>
                <p>2. Réponds aux questions éventuelles de l&apos;IA.</p>
                <p>3. Vérifie le brouillon et crée le devis.</p>
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


      <DocumentPreviewDialog
        mode="quote"
        open={!!previewQuoteId}
        onClose={() => setPreviewQuoteId(null)}
        documentId={previewQuoteId}
      />

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
                        <p className="text-sm font-medium text-foreground">Lien envoyé</p>
                        <p className="text-xs text-muted-foreground">{formatDate(send.created_at)} — à {send.client_name}</p>
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
                          <p className="text-sm font-medium text-emerald-700">Devis signé</p>
                          <p className="text-xs text-muted-foreground">{formatDate(send.signed_at)}</p>
                          {send.docuseal_signed_document_url && (
                            <a
                              href={send.docuseal_signed_document_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                            >
                              <Download className="h-3 w-3" />
                              Télécharger le devis signé
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
                        {send.signed_at ? 'Signé' : new Date(send.expires_at) < new Date() ? 'Expiré' : 'En attente'}
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
