'use client';

import { useEffect, useState, useCallback } from 'react';
import { Mail, Inbox, Send, Star, Archive, Sparkles, Search, Plus, ArrowLeft, RefreshCw, Unplug, Trash2, MailOpen, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import type { GmailMessageHeader, GmailMessageFull } from '@/lib/gmail';

// ---------------------------------------------------------------------------

type Folder = 'inbox' | 'sent' | 'starred';

function formatEmailDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    if (diffDays === 1) return 'Hier';
    if (diffDays < 7) return d.toLocaleDateString('fr-FR', { weekday: 'short' });
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  } catch {
    return dateStr;
  }
}

function extractName(from: string): string {
  const match = from.match(/^"?([^"<]+)"?\s*</);
  if (match) return match[1].trim();
  return from.split('@')[0] || from;
}

// ---------------------------------------------------------------------------

export default function MailPage() {
  const [gmailConnected, setGmailConnected] = useState(false);
  const [gmailEmail, setGmailEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);

  const [folder, setFolder] = useState<Folder>('inbox');
  const [messages, setMessages] = useState<GmailMessageHeader[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<GmailMessageFull | null>(null);
  const [selectedLoading, setSelectedLoading] = useState(false);
  const [search, setSearch] = useState('');

  // Compose
  const [composing, setComposing] = useState(false);
  const [replyingTo, setReplyingTo] = useState<GmailMessageFull | null>(null);
  const [composeForm, setComposeForm] = useState({ to: '', cc: '', subject: '', body: '' });
  const [sending, setSending] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);

  // ─── Auth helper ──────────────────────────────────────────────────
  const getAccessToken = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || '';
  }, []);

  // ─── Check Gmail connection ───────────────────────────────────────
  useEffect(() => {
    async function checkStatus() {
      try {
        const token = await getAccessToken();
        if (!token) { setLoading(false); return; }
        const res = await fetch('/api/gmail/status', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setGmailConnected(data.connected);
          setGmailEmail(data.emailAddress || '');
        }
      } catch { /* silent */ }
      setLoading(false);
    }
    checkStatus();

    // Handle ?gmail_connected=1
    const params = new URLSearchParams(window.location.search);
    if (params.get('gmail_connected') === '1') {
      setGmailConnected(true);
      window.history.replaceState({}, '', '/mail');
    }
  }, [getAccessToken]);

  // ─── Load messages ────────────────────────────────────────────────
  const loadMessages = useCallback(async (f?: Folder, q?: string) => {
    setMessagesLoading(true);
    try {
      const token = await getAccessToken();
      const params = new URLSearchParams({ folder: f || folder });
      if (q || search) params.set('q', q ?? search);
      const res = await fetch(`/api/gmail/messages?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch { /* silent */ }
    setMessagesLoading(false);
  }, [folder, search, getAccessToken]);

  useEffect(() => {
    if (gmailConnected) loadMessages();
  }, [gmailConnected, folder]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Open message ─────────────────────────────────────────────────
  async function openMessage(msg: GmailMessageHeader) {
    setSelectedLoading(true);
    setSelectedMessage(null);
    try {
      const token = await getAccessToken();
      const res = await fetch(`/api/gmail/messages/${msg.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedMessage(data);
        // Mark as read in local state
        setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, isUnread: false } : m));
      }
    } catch { /* silent */ }
    setSelectedLoading(false);
  }

  // ─── Actions ──────────────────────────────────────────────────────
  async function modifyMessage(messageId: string, action: string) {
    const token = await getAccessToken();
    await fetch('/api/gmail/modify', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId, action }),
    });
  }

  async function toggleStar(msg: GmailMessageHeader) {
    const action = msg.isStarred ? 'unstar' : 'star';
    await modifyMessage(msg.id, action);
    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, isStarred: !m.isStarred } : m));
  }

  async function archiveMessage(messageId: string) {
    await modifyMessage(messageId, 'archive');
    setMessages(prev => prev.filter(m => m.id !== messageId));
    setSelectedMessage(null);
  }

  async function trashMessage(messageId: string) {
    await modifyMessage(messageId, 'trash');
    setMessages(prev => prev.filter(m => m.id !== messageId));
    setSelectedMessage(null);
  }

  // ─── Send / Reply ─────────────────────────────────────────────────
  async function sendEmail() {
    if (!composeForm.to || !composeForm.subject) return;
    setSending(true);
    try {
      const token = await getAccessToken();
      const payload: Record<string, string> = {
        to: composeForm.to,
        subject: composeForm.subject,
        body: composeForm.body.replace(/\n/g, '<br>'),
      };
      if (composeForm.cc) payload.cc = composeForm.cc;
      if (replyingTo) {
        payload.threadId = replyingTo.threadId;
        payload.inReplyTo = replyingTo.id;
      }

      const res = await fetch('/api/gmail/send', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setComposing(false);
        setReplyingTo(null);
        setComposeForm({ to: '', cc: '', subject: '', body: '' });
        if (folder === 'sent') loadMessages();
      }
    } catch { /* silent */ }
    setSending(false);
  }

  function startReply(msg: GmailMessageFull) {
    const replyTo = msg.replyTo || msg.from;
    setReplyingTo(msg);
    setComposeForm({
      to: replyTo,
      cc: '',
      subject: msg.subject.startsWith('Re:') ? msg.subject : `Re: ${msg.subject}`,
      body: '',
    });
    setComposing(true);
  }

  async function generateAiReply(msg: GmailMessageFull) {
    setAiGenerating(true);
    // If not already in compose mode, start reply first
    if (!composing) {
      const replyTo = msg.replyTo || msg.from;
      setReplyingTo(msg);
      setComposeForm({
        to: replyTo,
        cc: '',
        subject: msg.subject.startsWith('Re:') ? msg.subject : `Re: ${msg.subject}`,
        body: '',
      });
      setComposing(true);
    }
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/ai/email-reply', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailBody: msg.body,
          emailFrom: msg.from,
          emailSubject: msg.subject,
          emailTo: msg.to,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setComposeForm(prev => ({ ...prev, body: data.reply || '' }));
      }
    } catch { /* silent */ }
    setAiGenerating(false);
  }

  // ─── Disconnect ───────────────────────────────────────────────────
  async function disconnectGmail() {
    const token = await getAccessToken();
    await fetch('/api/gmail/disconnect', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    setGmailConnected(false);
    setMessages([]);
    setSelectedMessage(null);
  }

  // ─── Search ───────────────────────────────────────────────────────
  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    loadMessages(folder, search);
  }

  // ─── Folders ──────────────────────────────────────────────────────
  const unreadCount = messages.filter(m => m.isUnread).length;
  const starredCount = messages.filter(m => m.isStarred).length;

  const folders = [
    { id: 'inbox' as const, label: 'Boite de reception', icon: Inbox, count: folder === 'inbox' ? unreadCount : 0 },
    { id: 'sent' as const, label: 'Envoyes', icon: Send, count: 0 },
    { id: 'starred' as const, label: 'Favoris', icon: Star, count: folder === 'starred' ? starredCount : 0 },
  ];

  // ─── Loading / Not connected ──────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!gmailConnected) {
    return (
      <div className="space-y-6">
        <PageHeader title="Boite mail" description="Connectez votre Gmail pour gerer vos emails depuis Hellobat" />
        <div className="flex flex-col items-center justify-center min-h-[400px] rounded-xl border border-dashed border-border bg-card p-8 text-center">
          <Mail className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold text-foreground">Connectez votre boite mail</h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-md">
            Recevez et envoyez vos emails directement depuis Hellobat. Vos emails restent sur Gmail — Hellobat les affiche et vous permet de repondre.
          </p>
          <Button
            className="mt-6 gap-2"
            onClick={async () => {
              const { data: { session } } = await supabase.auth.getSession();
              if (!session?.access_token) return;
              window.location.href = `/api/gmail/connect?token=${session.access_token}`;
            }}
          >
            <Mail className="h-4 w-4" />
            Connecter Gmail
          </Button>
        </div>
      </div>
    );
  }

  // ─── Connected UI ─────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <PageHeader title="Boite mail" description={gmailEmail ? `Connecte a ${gmailEmail}` : 'Gerez vos emails depuis Hellobat'}>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => loadMessages()} className="gap-1.5">
            <RefreshCw className={cn('h-4 w-4', messagesLoading && 'animate-spin')} />
            <span className="hidden sm:inline">Actualiser</span>
          </Button>
          <Button onClick={() => { setComposing(true); setReplyingTo(null); setComposeForm({ to: '', cc: '', subject: '', body: '' }); }} className="gap-2">
            <Plus className="h-4 w-4" /> Nouveau message
          </Button>
          <Button variant="ghost" size="sm" onClick={disconnectGmail} className="text-muted-foreground" title="Deconnecter Gmail">
            <Unplug className="h-4 w-4" />
          </Button>
        </div>
      </PageHeader>

      <div className="flex flex-col sm:grid sm:grid-cols-12 gap-4 min-h-[400px] sm:min-h-[600px]">
        {/* Sidebar */}
        <div className="sm:col-span-3 rounded-xl border border-border bg-card p-2 sm:p-3">
          <div className="flex sm:flex-col gap-1 overflow-x-auto">
            {folders.map(f => (
              <button
                key={f.id}
                onClick={() => { setFolder(f.id); setSelectedMessage(null); setComposing(false); }}
                className={cn(
                  'flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors',
                  folder === f.id ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-muted'
                )}
              >
                <span className="flex items-center gap-2"><f.icon className="h-4 w-4" />{f.label}</span>
                {f.count > 0 && <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">{f.count}</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Main content */}
        <div className="sm:col-span-9 rounded-xl border border-border bg-card overflow-hidden">
          {composing ? (
            /* ─── Compose / Reply ──────────────────────────────────── */
            <div className="p-4 sm:p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground">
                  {replyingTo ? `Reponse a ${extractName(replyingTo.from)}` : 'Nouveau message'}
                </h3>
                <Button variant="ghost" size="sm" onClick={() => { setComposing(false); setReplyingTo(null); }}>Annuler</Button>
              </div>
              <div>
                <Input
                  placeholder="A : email@client.com"
                  value={composeForm.to}
                  onChange={e => setComposeForm({ ...composeForm, to: e.target.value })}
                />
              </div>
              <div>
                <Input
                  placeholder="Cc (optionnel)"
                  value={composeForm.cc}
                  onChange={e => setComposeForm({ ...composeForm, cc: e.target.value })}
                />
              </div>
              <div>
                <Input
                  placeholder="Objet"
                  value={composeForm.subject}
                  onChange={e => setComposeForm({ ...composeForm, subject: e.target.value })}
                />
              </div>
              <textarea
                className="w-full min-h-[200px] rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Votre message..."
                value={composeForm.body}
                onChange={e => setComposeForm({ ...composeForm, body: e.target.value })}
              />
              <div className="flex items-center justify-between">
                {replyingTo ? (
                  <Button variant="outline" onClick={() => generateAiReply(replyingTo)} disabled={aiGenerating} className="gap-2">
                    {aiGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {aiGenerating ? 'Generation...' : 'Generer avec l\'IA'}
                  </Button>
                ) : <div />}
                <Button onClick={sendEmail} disabled={sending || !composeForm.to || !composeForm.subject} className="gap-2">
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Envoyer
                </Button>
              </div>
            </div>
          ) : selectedMessage ? (
            /* ─── Message detail ───────────────────────────────────── */
            <div className="p-4 sm:p-6">
              <Button variant="ghost" size="sm" onClick={() => setSelectedMessage(null)} className="mb-4 gap-1">
                <ArrowLeft className="h-4 w-4" /> Retour
              </Button>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold text-foreground">{selectedMessage.subject}</h2>
                  <p className="text-sm text-muted-foreground mt-1">De : {selectedMessage.from}</p>
                  <p className="text-sm text-muted-foreground">A : {selectedMessage.to}</p>
                  {selectedMessage.cc && <p className="text-sm text-muted-foreground">Cc : {selectedMessage.cc}</p>}
                </div>
                <span className="text-xs text-muted-foreground flex-shrink-0">{formatEmailDate(selectedMessage.date)}</span>
              </div>
              <div
                className="mt-6 text-sm text-foreground leading-relaxed prose prose-sm max-w-none dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: selectedMessage.body }}
              />
              <div className="mt-6 flex flex-wrap gap-2 border-t border-border pt-4">
                <Button variant="outline" onClick={() => startReply(selectedMessage)} className="gap-2">
                  <ArrowLeft className="h-4 w-4" /> Repondre
                </Button>
                <Button variant="outline" onClick={() => generateAiReply(selectedMessage)} disabled={aiGenerating} className="gap-2">
                  {aiGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Reponse IA
                </Button>
                <Button variant="outline" onClick={() => archiveMessage(selectedMessage.id)} className="gap-2">
                  <Archive className="h-4 w-4" /> Archiver
                </Button>
                <Button variant="outline" onClick={() => trashMessage(selectedMessage.id)} className="gap-2 text-red-600 hover:text-red-700">
                  <Trash2 className="h-4 w-4" /> Supprimer
                </Button>
              </div>
            </div>
          ) : selectedLoading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            /* ─── Message list ─────────────────────────────────────── */
            <div>
              <form onSubmit={handleSearch} className="p-3 border-b border-border">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher dans les mails..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </form>

              {messagesLoading ? (
                <div className="flex items-center justify-center p-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : messages.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">
                  <MailOpen className="h-8 w-8 mx-auto mb-2" />
                  <p className="text-sm">Aucun email</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {messages.map(msg => (
                    <div
                      key={msg.id}
                      className={cn(
                        'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30 cursor-pointer',
                        msg.isUnread && 'bg-primary/5'
                      )}
                    >
                      <div className="flex-1 min-w-0" onClick={() => openMessage(msg)}>
                        <div className="flex items-center justify-between">
                          <p className={cn('text-sm truncate', msg.isUnread ? 'font-semibold text-foreground' : 'text-foreground')}>
                            {extractName(msg.from)}
                          </p>
                          <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">{formatEmailDate(msg.date)}</span>
                        </div>
                        <p className={cn('text-sm truncate', msg.isUnread ? 'font-medium text-foreground' : 'text-muted-foreground')}>
                          {msg.subject}
                        </p>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{msg.snippet}</p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleStar(msg); }}
                        className="flex-shrink-0 mt-1 p-1 rounded hover:bg-muted"
                      >
                        <Star className={cn('h-4 w-4', msg.isStarred ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground')} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
