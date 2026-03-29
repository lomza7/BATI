'use client';

import { useState, useEffect, useRef } from 'react';
import { Bot, Send, ArrowLeft, Settings, Sparkles, MessageSquare } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface Agent {
  id: string;
  slug: string;
  name: string;
  description: string;
  is_active: boolean;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

const AGENT_ICONS: Record<string, string> = {
  pannes: '🔧',
  dtu: '📐',
  chiffreur: '🧮',
  juriste: '⚖️',
  rge_cee: '🌿',
};

const DEMO_RESPONSES: Record<string, string> = {
  pannes: 'D\'apres votre description, il pourrait s\'agir d\'un probleme de circulateur sur votre chaudiere. Verifiez d\'abord la pression du circuit (elle doit etre entre 1 et 1.5 bar). Si la pression est correcte, le circulateur est probablement en cause.',
  dtu: 'Selon le DTU 52.1 (Revetements de sol scelles), l\'epaisseur minimale de la chape est de 5 cm pour un plancher chauffant. La pose doit respecter un joint de fractionnement tous les 40 m2 maximum.',
  chiffreur: 'Pour une salle de bain de 6 m2 avec douche a l\'italienne :\n- Depose existant : ~800 EUR\n- Plomberie : ~1 500 EUR\n- Etancheite : ~600 EUR\n- Carrelage sol + murs (fourni + pose) : ~3 200 EUR\n- Meuble vasque + miroir : ~900 EUR\nTotal estime : 7 000 EUR HT',
  juriste: 'En cas de retard de paiement d\'un client, vous pouvez appliquer des penalites de retard (taux BCE + 10 points) et une indemnite forfaitaire de 40 EUR pour frais de recouvrement, conformement a l\'article L441-10 du Code de commerce.',
  rge_cee: 'Pour obtenir la certification RGE Qualibat, vous devez : 1) Justifier d\'au moins 2 ans d\'activite, 2) Avoir un referent technique forme, 3) Presenter 2 chantiers de reference. Le renouvellement est tous les 4 ans avec un audit de chantier.',
};

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [responding, setResponding] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadAgents(); }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function loadAgents() {
    const { data } = await supabase.from('ai_agents').select('id, slug, name, description, is_active').order('slug');
    setAgents((data as unknown as Agent[]) || []);
    setLoading(false);
  }

  function selectAgent(agent: Agent) {
    setSelectedAgent(agent);
    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: `Bonjour ! Je suis ${agent.name}. ${agent.description}. Comment puis-je vous aider ?`,
      created_at: new Date().toISOString(),
    }]);
  }

  function sendMessage() {
    if (!input.trim() || !selectedAgent) return;
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setResponding(true);

    setTimeout(() => {
      const response = DEMO_RESPONSES[selectedAgent.slug] || 'Je suis en cours de configuration. Cette fonctionnalite sera bientot disponible.';
      const assistantMsg: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response,
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, assistantMsg]);
      setResponding(false);
    }, 1500);
  }

  if (selectedAgent) {
    return (
      <div className="flex flex-col h-[calc(100vh-10rem)] sm:h-[calc(100vh-8rem)]">
        <div className="flex items-center gap-3 pb-4 border-b border-border">
          <Button variant="ghost" size="icon" onClick={() => setSelectedAgent(null)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-lg">
              {AGENT_ICONS[selectedAgent.slug] || '🤖'}
            </div>
            <div>
              <h2 className="font-semibold text-foreground">{selectedAgent.name}</h2>
              <p className="text-xs text-muted-foreground">{selectedAgent.description}</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {messages.map(msg => (
            <div key={msg.id} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
              <div className={cn(
                'max-w-[85%] sm:max-w-[70%] rounded-2xl px-4 py-3 text-sm',
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground rounded-br-sm'
                  : 'bg-muted text-foreground rounded-bl-sm'
              )}>
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}
          {responding && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3">
                <div className="flex gap-1">
                  <div className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="flex items-center gap-2 pt-4 border-t border-border">
          <Input
            placeholder={`Posez votre question a ${selectedAgent.name}...`}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
            className="flex-1"
          />
          <Button onClick={sendMessage} disabled={!input.trim() || responding} size="icon">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Agents IA experts" description="5 agents specialises pour vous assister au quotidien" />

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-48 animate-pulse rounded-xl bg-muted" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map(agent => (
            <button
              key={agent.id}
              onClick={() => selectAgent(agent)}
              className="rounded-xl border border-border bg-card p-6 text-left transition-all hover:shadow-md hover:border-primary/30 group"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-xl transition-transform group-hover:scale-110">
                  {AGENT_ICONS[agent.slug] || '🤖'}
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{agent.name}</h3>
                  <p className="text-xs text-muted-foreground">{agent.slug.toUpperCase()}</p>
                </div>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{agent.description}</p>
              <div className="mt-4 flex items-center gap-2 text-xs text-primary font-medium">
                <MessageSquare className="h-3 w-3" /> Demarrer une conversation
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
