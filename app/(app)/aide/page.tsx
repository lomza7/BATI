'use client';

import { useEffect, useRef, useState } from 'react';
import {
  CircleHelp,
  MessageCircle,
  Send,
  Loader2,
  Sparkles,
  BookOpen,
  FileText,
  Receipt,
  Users,
  Calendar,
  Calculator,
  Mail,
  Globe,
  CreditCard,
  Bot,
  Search,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface FaqItem {
  q: string;
  a: string;
}

interface FaqCategory {
  id: string;
  title: string;
  icon: React.ElementType;
  color: string;
  items: FaqItem[];
}

const FAQ: FaqCategory[] = [
  {
    id: 'demarrage',
    title: 'Démarrage',
    icon: Sparkles,
    color: 'from-amber-500/15 to-orange-500/5 text-amber-600',
    items: [
      {
        q: 'Comment configurer mon compte la première fois ?',
        a: "À la création de votre compte, un onboarding en plusieurs étapes vous guide : informations entreprise, activité, premiers clients. Vous pouvez tout modifier ensuite depuis Paramètres.",
      },
      {
        q: 'Est-ce que Hellobat fonctionne sur mobile ?',
        a: "Oui, l'application est entièrement optimisée pour mobile. Vous pouvez créer des devis à la voix, prendre des photos de chantiers et gérer votre planning depuis votre téléphone.",
      },
      {
        q: 'Mes données sont-elles sauvegardées ?',
        a: "Oui, toutes vos données sont stockées sur Supabase (PostgreSQL) avec des sauvegardes automatiques. Vos fichiers (devis PDF, photos chantiers) sont stockés en toute sécurité.",
      },
    ],
  },
  {
    id: 'devis-factures',
    title: 'Devis & Factures',
    icon: FileText,
    color: 'from-blue-500/15 to-sky-500/5 text-blue-600',
    items: [
      {
        q: 'Comment créer un devis avec l\'assistant IA vocal ?',
        a: "Allez dans Devis > Nouveau devis > onglet Assistant IA. Cliquez sur le micro et décrivez le chantier. L'IA remplit automatiquement les lignes du devis. Disponible sur Chrome et Edge.",
      },
      {
        q: 'Comment faire signer un devis à un client ?',
        a: "Sur la page d'un devis, cliquez sur « Envoyer pour signature ». Hellobat utilise DocuSeal : votre client reçoit un email avec un lien de signature électronique. Vous êtes notifié quand c'est signé.",
      },
      {
        q: 'Puis-je personnaliser mes templates de documents ?',
        a: "Oui, dans Paramètres > Templates documents vous pouvez personnaliser le rendu des devis et factures (logo, couleurs, mentions légales).",
      },
      {
        q: 'Comment numéroter mes devis ?',
        a: "La numérotation est automatique au format D-YYYY-XXX (devis) et F-YYYY-XXX (factures). Le compteur se réinitialise chaque année.",
      },
    ],
  },
  {
    id: 'clients-chantiers',
    title: 'Clients & Chantiers',
    icon: Users,
    color: 'from-emerald-500/15 to-green-500/5 text-emerald-600',
    items: [
      {
        q: 'Comment ajouter un client ?',
        a: "Depuis Contacts > Nouveau contact. Vous pouvez aussi rechercher une entreprise par nom ou SIRET grâce à notre intégration Pappers : les informations se remplissent automatiquement.",
      },
      {
        q: 'Comment voir mes chantiers sur une carte ?',
        a: "Allez dans Carte (menu Chantiers). Tous vos chantiers géolocalisés s'affichent sur une carte interactive. Vous pouvez aussi rendre certains chantiers publics pour les afficher sur votre site web.",
      },
      {
        q: 'Comment partager un chantier avec mon équipe ?',
        a: "Depuis le chantier, ajoutez des membres d'équipe. Ils verront ensuite le chantier dans leur planning. Le drag and drop dans Planning permet d'attribuer rapidement.",
      },
    ],
  },
  {
    id: 'planning',
    title: 'Planning & Calendrier',
    icon: Calendar,
    color: 'from-violet-500/15 to-purple-500/5 text-violet-600',
    items: [
      {
        q: 'Puis-je synchroniser avec Google Calendar ?',
        a: "Oui, dans Calendrier cliquez sur « Connecter Google Calendar ». La sync est bidirectionnelle : vos événements Hellobat apparaissent dans Google et inversement.",
      },
      {
        q: 'Comment fonctionne le planning équipe ?',
        a: "Dans Planning, vue semaine ou mois. Glissez-déposez des créneaux pour assigner des chantiers, congés ou réunions à vos membres d'équipe. Vous-même apparaissez comme dirigeant.",
      },
    ],
  },
  {
    id: 'comptabilite',
    title: 'Comptabilité IA',
    icon: Calculator,
    color: 'from-rose-500/15 to-pink-500/5 text-rose-600',
    items: [
      {
        q: 'Comment fonctionne l\'OCR Maurice ?',
        a: "Prenez en photo ou importez un reçu/facture fournisseur. Maurice (notre OCR IA) extrait automatiquement le montant, la date, le fournisseur et la catégorie. Vous validez en un clic.",
      },
      {
        q: 'Puis-je faire la réconciliation bancaire ?',
        a: "Oui, dans Comptabilité > Flux. Importez votre relevé bancaire et l'IA propose les rapprochements avec vos dépenses et factures.",
      },
    ],
  },
  {
    id: 'communication',
    title: 'Boîte mail & Avis',
    icon: Mail,
    color: 'from-cyan-500/15 to-teal-500/5 text-cyan-600',
    items: [
      {
        q: 'Comment utiliser l\u2019Assistant email IA ?',
        a: "Dans Assistant email IA, collez l'email reçu de votre client. L'IA récupère automatiquement le contexte (devis, factures, chantiers) et génère une réponse personnalisée que vous pouvez copier-coller dans votre messagerie.",
      },
      {
        q: 'Comment gérer mes avis clients ?',
        a: "Dans Avis clients, collez le lien de votre fiche Google Maps pour importer vos avis Google automatiquement. Vous pouvez aussi envoyer un lien public à vos clients pour recueillir de nouveaux avis, ou leur demander par email en masse.",
      },
    ],
  },
  {
    id: 'site-web',
    title: 'Site web IA',
    icon: Globe,
    color: 'from-indigo-500/15 to-blue-500/5 text-indigo-600',
    items: [
      {
        q: 'Comment publier mon site vitrine ?',
        a: "Dans Site web IA, choisissez un thème, l'IA génère automatiquement le contenu (services, présentation) basé sur votre activité. Vos chantiers publics y apparaissent. Publication en un clic.",
      },
      {
        q: "Quelle est l'URL de mon site ?",
        a: "Votre site est publié sur votre-slug.hellobat.app. Vous pouvez aussi le brancher sur votre nom de domaine personnalisé.",
      },
    ],
  },
  {
    id: 'paiements',
    title: 'Abonnement & Paiements',
    icon: CreditCard,
    color: 'from-fuchsia-500/15 to-purple-500/5 text-fuchsia-600',
    items: [
      {
        q: 'Comment changer de plan ?',
        a: "Dans Paramètres > Abonnement, cliquez sur « Gérer mon abonnement ». Vous arrivez sur le portail Stripe où vous pouvez passer en Pro ou Business, ou annuler.",
      },
      {
        q: 'Comment bénéficier des 2 mois offerts du parrainage ?',
        a: "Allez dans Lien de parrainage (au-dessus de Paramètres). Partagez votre lien personnel : pour chaque artisan qui souscrit grâce à vous, vous gagnez 2 mois offerts et lui aussi.",
      },
    ],
  },
];

const SUGGESTIONS = [
  'Comment créer un devis ?',
  'Comment ajouter un chantier ?',
  'Je veux signaler un bug',
  'J\'ai une idée de fonctionnalité',
];

export default function AidePage() {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: "Bonjour ! Je suis l'assistant Hellobat. Je peux répondre à vos questions, vous guider dans l'utilisation, signaler un bug ou transmettre une demande de fonctionnalité à l'équipe. Comment puis-je vous aider ?",
    },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  const filteredFaq = FAQ.map(cat => ({
    ...cat,
    items: cat.items.filter(item =>
      search.trim() === '' ||
      item.q.toLowerCase().includes(search.toLowerCase()) ||
      item.a.toLowerCase().includes(search.toLowerCase())
    ),
  })).filter(cat => cat.items.length > 0);

  async function sendMessage(text?: string) {
    const message = (text ?? input).trim();
    if (!message || sending) return;

    setMessages(prev => [...prev, { role: 'user', content: message }]);
    setInput('');
    setSending(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Session expirée');
      }

      const res = await fetch('/api/support/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          message,
          history: messages,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erreur de communication');
      }

      setMessages(prev => [...prev, { role: 'assistant', content: data.response || '' }]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur';
      toast({ title: 'Erreur', description: msg, variant: 'destructive' });
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: "Désolé, je n'ai pas pu répondre. Réessayez dans un instant ou contactez-nous directement.",
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendMessage();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Centre d'aide"
        description="Consultez nos guides ou posez votre question à notre assistant"
      >
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
          <Bot className="h-3.5 w-3.5" /> Assistant IA disponible
        </div>
      </PageHeader>

      {/* Hero */}
      <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-amber-50/40 to-white p-5 sm:p-6">
        <div className="flex items-start gap-4 flex-col sm:flex-row">
          <div className="h-12 w-12 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
            <CircleHelp className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-foreground mb-1.5">
              Comment pouvons-nous vous aider ?
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Parcourez nos guides organisés par thème ci-dessous, ou discutez en direct avec notre assistant IA pour obtenir une réponse personnalisée, signaler un bug, ou suggérer une nouvelle fonctionnalité.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Documentation */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Documentation</h2>
          </div>

          {/* Recherche */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher dans l'aide…"
              className="pl-9"
            />
          </div>

          {filteredFaq.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-8 text-center">
              <Search className="h-8 w-8 mx-auto mb-3 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                Aucun résultat pour &laquo; {search} &raquo;. Posez votre question à l&apos;assistant ci-contre.
              </p>
            </div>
          ) : (
            filteredFaq.map(cat => {
              const Icon = cat.icon;
              return (
                <div key={cat.id} className="rounded-xl border border-border bg-card overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
                    <div className={cn('h-9 w-9 rounded-lg bg-gradient-to-br flex items-center justify-center', cat.color)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <h3 className="text-sm font-semibold text-foreground">{cat.title}</h3>
                    <span className="ml-auto text-[11px] text-muted-foreground">{cat.items.length}</span>
                  </div>
                  <Accordion type="multiple" className="px-4">
                    {cat.items.map((item, idx) => (
                      <AccordionItem key={idx} value={`${cat.id}-${idx}`} className="border-border last:border-b-0">
                        <AccordionTrigger className="text-sm text-left">{item.q}</AccordionTrigger>
                        <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                          {item.a}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </div>
              );
            })
          )}
        </div>

        {/* Chatbot */}
        <div className="lg:col-span-1">
          <div className="rounded-xl border border-border bg-card overflow-hidden flex flex-col h-[calc(100vh-12rem)] lg:sticky lg:top-6">
            <div className="px-4 py-3 border-b border-border bg-gradient-to-r from-primary/5 to-amber-50/50">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                  <Bot className="h-4 w-4 text-primary-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-foreground leading-tight">Assistant Hellobat</h3>
                  <p className="text-[11px] text-muted-foreground">En ligne · Réponse instantanée</p>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={cn(
                    'flex',
                    msg.role === 'user' ? 'justify-end' : 'justify-start',
                  )}
                >
                  <div
                    className={cn(
                      'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap',
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-br-sm'
                        : 'bg-muted text-foreground rounded-bl-sm',
                    )}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              {sending && (
                <div className="flex justify-start">
                  <div className="bg-muted text-muted-foreground rounded-2xl rounded-bl-sm px-3.5 py-2.5 text-sm flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    L&apos;assistant écrit…
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {messages.length <= 1 && (
              <div className="px-4 pb-2">
                <p className="text-[11px] text-muted-foreground mb-2">Suggestions :</p>
                <div className="flex flex-wrap gap-1.5">
                  {SUGGESTIONS.map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => sendMessage(s)}
                      disabled={sending}
                      className="text-[11px] px-2.5 py-1 rounded-full bg-muted hover:bg-muted/80 text-foreground transition-colors disabled:opacity-50"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="border-t border-border p-3 flex gap-2">
              <Input
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Posez votre question…"
                disabled={sending}
                className="flex-1"
              />
              <Button type="submit" size="icon" disabled={sending || !input.trim()}>
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
          </div>
        </div>
      </div>

      {/* Contact alternatif */}
      <div className="rounded-xl border border-border bg-card p-5 flex items-center gap-4 flex-col sm:flex-row text-center sm:text-left">
        <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
          <MessageCircle className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">Besoin de parler à quelqu&apos;un ?</p>
          <p className="text-xs text-muted-foreground">
            L&apos;assistant ci-contre transmet automatiquement les bugs et suggestions à notre équipe. Vous pouvez aussi nous écrire à contact@hellobat.app.
          </p>
        </div>
      </div>
    </div>
  );
}
