'use client';

import { useState } from 'react';
import { Copy, Loader2, Sparkles, Mail, RotateCcw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

export default function AssistantEmailPage() {
  const { toast } = useToast();
  const [emailFrom, setEmailFrom] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [tone, setTone] = useState<'neutral' | 'friendly' | 'formal'>('neutral');
  const [reply, setReply] = useState('');
  const [clientFound, setClientFound] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function generate() {
    if (!emailFrom.trim() || !emailSubject.trim() || !emailBody.trim()) {
      toast({
        title: 'Champs manquants',
        description: 'Renseignez l’expéditeur, l’objet et le contenu du mail.',
        variant: 'destructive',
      });
      return;
    }
    setLoading(true);
    setReply('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast({ title: 'Session expirée', variant: 'destructive' });
        return;
      }
      const res = await fetch('/api/ai/email-reply', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ emailFrom, emailSubject, emailBody, tone }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({
          title: 'Erreur IA',
          description: data.error || 'Impossible de générer la réponse.',
          variant: 'destructive',
        });
        return;
      }
      setReply(data.reply || '');
      setClientFound(Boolean(data.clientFound));
    } finally {
      setLoading(false);
    }
  }

  async function copyReply() {
    await navigator.clipboard.writeText(reply);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function reset() {
    setEmailFrom('');
    setEmailSubject('');
    setEmailBody('');
    setReply('');
    setClientFound(false);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assistant email IA"
        description="Collez un email reçu, l’IA rédige une réponse prête à coller dans votre messagerie."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ─── Colonne gauche : Email reçu ───────────────────── */}
        <div className="space-y-4 rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Mail className="h-4 w-4 text-[#D35400]" />
            Email reçu
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Expéditeur</label>
            <Input
              value={emailFrom}
              onChange={(e) => setEmailFrom(e.target.value)}
              placeholder="Jean Dupont <jean@exemple.fr>"
              className="mt-1"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Si l’email correspond à un de vos contacts, l’IA utilise son historique (devis, factures,
              chantiers).
            </p>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Objet</label>
            <Input
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              placeholder="Ex : Demande de devis pour salle de bain"
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Contenu</label>
            <Textarea
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
              placeholder="Collez ici le contenu de l’email reçu…"
              rows={10}
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Ton de la réponse</label>
            <Select value={tone} onValueChange={(v) => setTone(v as typeof tone)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="neutral">Professionnel (par défaut)</SelectItem>
                <SelectItem value="friendly">Amical et chaleureux</SelectItem>
                <SelectItem value="formal">Très formel</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={generate}
              disabled={loading}
              className="flex-1 gap-2 bg-[#D35400] text-white hover:bg-[#B84400]"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {loading ? 'Génération…' : 'Générer une réponse'}
            </Button>
            {(emailBody || reply) && (
              <Button variant="ghost" onClick={reset} className="gap-1.5">
                <RotateCcw className="h-3.5 w-3.5" />
                Effacer
              </Button>
            )}
          </div>
        </div>

        {/* ─── Colonne droite : Réponse générée ──────────────── */}
        <div className="space-y-4 rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="h-4 w-4 text-[#D35400]" />
              Réponse suggérée
            </div>
            {reply && (
              <Button size="sm" variant="outline" onClick={copyReply} className="gap-1.5">
                <Copy className="h-3.5 w-3.5" />
                {copied ? 'Copié !' : 'Copier'}
              </Button>
            )}
          </div>

          {clientFound && reply && (
            <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">
              ✓ Contact identifié dans votre base — l’IA a tenu compte de son historique.
            </div>
          )}

          {reply ? (
            <Textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              rows={18}
              className="font-mono text-sm"
            />
          ) : (
            <div className="flex h-[400px] flex-col items-center justify-center rounded-lg border border-dashed text-center text-sm text-muted-foreground">
              <Sparkles className="mb-2 h-8 w-8 text-muted-foreground/40" />
              <p>Collez un email et cliquez sur « Générer » pour voir la réponse suggérée ici.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
