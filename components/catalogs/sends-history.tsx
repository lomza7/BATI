'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Send, Eye, Copy, Check, Clock, Link2, ExternalLink } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { formatDate } from '@/lib/constants';

interface SendItem {
  id: string;
  client_name: string;
  client_email: string;
  token: string;
  expires_at: string;
  viewed_at: string | null;
  created_at: string;
  catalogs: { name: string } | null;
  selections_count: number;
}

interface Props {
  onBack: () => void;
}

export function SendsHistory({ onBack }: Props) {
  const { user } = useAuth();
  const [sends, setSends] = useState<SendItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchSends = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('catalog_sends')
      .select('*, catalogs(name), catalog_client_selections(count)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (data) {
      const mapped = data.map((s: any) => ({
        ...s,
        selections_count: s.catalog_client_selections?.[0]?.count || 0,
      }));
      setSends(mapped);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchSends();
  }, [fetchSends]);

  function copyLink(token: string, id: string) {
    const link = `${window.location.origin}/c/${token}`;
    navigator.clipboard.writeText(link);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function isExpired(date: string) {
    return new Date(date) < new Date();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="h-9 w-9 rounded-lg border border-border bg-white flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Historique des envois
          </h1>
          <p className="text-sm text-muted-foreground">
            Suivez les catalogues envoyes a vos clients
          </p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-muted/50 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : sends.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <Send className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">Aucun envoi</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Les catalogues envoyes a vos clients apparaitront ici.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sends.map((send) => {
            const expired = isExpired(send.expires_at);
            return (
              <div
                key={send.id}
                className={`rounded-xl border bg-white p-4 transition-all ${
                  expired ? 'border-border/50 opacity-60' : 'border-border hover:shadow-sm'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    send.viewed_at ? 'bg-emerald-50' : expired ? 'bg-muted' : 'bg-primary/10'
                  }`}>
                    {send.viewed_at ? (
                      <Eye className="h-5 w-5 text-emerald-600" />
                    ) : (
                      <Send className="h-5 w-5 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-foreground">{send.client_name}</h3>
                      {expired && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-600">Expire</span>
                      )}
                      {send.viewed_at && !expired && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">Consulte</span>
                      )}
                      {!send.viewed_at && !expired && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">En attente</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {(send.catalogs as any)?.name || 'Catalogue'} - Envoye le {formatDate(send.created_at)}
                    </p>
                    {send.selections_count > 0 && (
                      <p className="text-xs font-medium text-primary mt-1">
                        {send.selections_count} produit{send.selections_count > 1 ? 's' : ''} selectionne{send.selections_count > 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {!expired && (
                      <button
                        onClick={() => copyLink(send.token, send.id)}
                        className={`h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                          copiedId === send.id
                            ? 'bg-emerald-500 text-white'
                            : 'border border-border bg-white text-foreground hover:bg-muted/50'
                        }`}
                      >
                        {copiedId === send.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        {copiedId === send.id ? 'Copie' : 'Lien'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
