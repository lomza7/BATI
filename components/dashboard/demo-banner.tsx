'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CalendarCheck,
  FolderKanban,
  Info,
  Loader2,
  Receipt,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type DemoState =
  | { status: 'loading' }
  | { status: 'hidden' }
  | { status: 'intro' }
  | { status: 'banner' };

export function DemoBanner() {
  const { user, session, showOnboarding } = useAuth();
  const { toast } = useToast();
  const [state, setState] = useState<DemoState>({ status: 'loading' });
  const [closing, setClosing] = useState(false);
  const bootstrappedRef = useRef(false);

  const loadState = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('demo_active, demo_intro_seen')
      .eq('id', user.id)
      .maybeSingle();

    if (!data || !data.demo_active) {
      setState({ status: 'hidden' });
      return;
    }
    setState({ status: data.demo_intro_seen ? 'banner' : 'intro' });
  }, [user]);

  // Wait for the onboarding flow to finish before loading / showing the demo state.
  // Without this guard the intro modal would overlap the onboarding modal on first signup.
  useEffect(() => {
    if (showOnboarding) return;
    loadState();
  }, [loadState, showOnboarding]);

  // Bootstrap the welcome PDF once, the first time we show the intro
  useEffect(() => {
    if (state.status !== 'intro') return;
    if (bootstrappedRef.current) return;
    if (!session?.access_token) return;
    bootstrappedRef.current = true;
    fetch('/api/demo/bootstrap-documents', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
    }).catch(() => {
      // Non-blocking — the rest of the demo still works without the PDF
    });
  }, [state.status, session?.access_token]);

  async function handleCloseIntro() {
    if (!user) return;
    await supabase
      .from('profiles')
      .update({ demo_intro_seen: true })
      .eq('id', user.id);
    setState({ status: 'banner' });
  }

  async function handleClearDemo() {
    setClosing(true);
    try {
      // Grab a fresh session at click time — the one in auth context can be
      // momentarily null/stale during a token refresh, which used to silently
      // abort this handler and make the button look broken.
      const { data: { session: freshSession } } = await supabase.auth.getSession();
      const accessToken = freshSession?.access_token;
      if (!accessToken) {
        toast({
          title: 'Session expirée',
          description: 'Veuillez vous reconnecter puis réessayer.',
          variant: 'destructive',
        });
        setClosing(false);
        return;
      }

      const res = await fetch('/api/demo/clear', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const msg = (errData as { error?: string }).error || `HTTP ${res.status}`;
        console.error('[demo-banner] clear failed:', msg);
        toast({
          title: 'Erreur',
          description: `Impossible de fermer la démo : ${msg}`,
          variant: 'destructive',
        });
        setClosing(false);
        return;
      }

      setState({ status: 'hidden' });
      toast({
        title: 'Démo fermée',
        description: 'Les données de démonstration ont été supprimées.',
      });
      // Force a reload so every already-mounted page clears its cached demo data
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    } catch (err) {
      console.error('[demo-banner] unexpected error:', err);
      toast({
        title: 'Erreur réseau',
        description: err instanceof Error ? err.message : 'Réessayez dans un instant.',
        variant: 'destructive',
      });
      setClosing(false);
    }
  }

  if (showOnboarding || state.status === 'loading' || state.status === 'hidden') {
    return null;
  }

  if (state.status === 'intro') {
    return (
      <Dialog open onOpenChange={(open) => { if (!open) handleCloseIntro(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#D35400]/10 text-[#D35400]">
              <Sparkles className="h-5 w-5" />
            </div>
            <DialogTitle className="text-xl">Bienvenue sur Hellobat</DialogTitle>
            <DialogDescription className="text-sm leading-relaxed">
              Pour vous aider a decouvrir la plateforme, nous avons prepare un jeu de
              <strong> donnees de demonstration</strong> dans toutes les rubriques : contacts,
              devis, factures, chantiers, planning, calendrier, documents...
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3 py-2 text-sm">
            <div className="flex items-start gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
              <Users className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#D35400]" />
              <div>
                <div className="font-medium text-neutral-900">Contacts</div>
                <div className="text-xs text-neutral-600">Clients, prospects, prestataires</div>
              </div>
            </div>
            <div className="flex items-start gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
              <Receipt className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#D35400]" />
              <div>
                <div className="font-medium text-neutral-900">Devis &amp; factures</div>
                <div className="text-xs text-neutral-600">Exemples realistes chiffres</div>
              </div>
            </div>
            <div className="flex items-start gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
              <FolderKanban className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#D35400]" />
              <div>
                <div className="font-medium text-neutral-900">Chantiers &amp; planning</div>
                <div className="text-xs text-neutral-600">Geolocalisation &amp; equipe</div>
              </div>
            </div>
            <div className="flex items-start gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
              <CalendarCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#D35400]" />
              <div>
                <div className="font-medium text-neutral-900">Calendrier &amp; taches</div>
                <div className="text-xs text-neutral-600">RDV et actions du mois</div>
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
            <strong>Bon a savoir :</strong> vous pouvez fermer la demo a tout moment depuis le
            tableau de bord pour retrouver un espace vierge avec vos vraies donnees.
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={handleClearDemo} disabled={closing}>
              {closing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Non merci, je demarre vierge
            </Button>
            <Button onClick={handleCloseIntro} className="bg-[#D35400] hover:bg-[#B84700]">
              Decouvrir la demo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // banner
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[#D35400]/30 bg-gradient-to-r from-[#D35400]/10 via-[#D35400]/5 to-transparent p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#D35400]/15 text-[#D35400]">
          <Info className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-neutral-900">
            Vous visualisez un jeu de donnees de demonstration
          </div>
          <div className="text-xs text-neutral-600">
            Explorez chaque rubrique pour decouvrir Hellobat. Fermez la demo quand vous etes pret a demarrer avec vos vraies donnees.
          </div>
        </div>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={handleClearDemo}
        disabled={closing}
        className="flex-shrink-0 border-[#D35400]/40 text-[#D35400] hover:bg-[#D35400]/10 hover:text-[#B84700]"
      >
        {closing ? (
          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
        ) : (
          <X className="mr-1.5 h-3.5 w-3.5" />
        )}
        Fermer la demo
      </Button>
    </div>
  );
}
