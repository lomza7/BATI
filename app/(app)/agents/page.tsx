'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Bot, Send, ArrowLeft, MessageSquare, Loader2, Crown } from 'lucide-react';
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
  icon: string;
  is_active: boolean;
  is_global: boolean;
  display_order: number;
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

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [responding, setResponding] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadAgents(); }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function loadAgents() {
    const { data } = await supabase
      .from('ai_agents')
      .select('id, slug, name, description, icon, is_active, is_global, display_order')
      .eq('is_active', true)
      .order('display_order', { ascending: true });
    setAgents((data as unknown as Agent[]) || []);
    setLoading(false);
  }

  function getAgentIcon(agent: Agent): string {
    return agent.icon || AGENT_ICONS[agent.slug] || '🤖';
  }

  function selectAgent(agent: Agent) {
    setSelectedAgent(agent);
    setConversationId(null);
    setError('');
    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: `Bonjour ! Je suis ${agent.name}. ${agent.description}. Comment puis-je vous aider ?`,
      created_at: new Date().toISOString(),
    }]);
  }

  function goBack() {
    setSelectedAgent(null);
    setConversationId(null);
    setMessages([]);
    setError('');
  }

  async function sendMessage() {
    if (!input.trim() || !selectedAgent || responding) return;
    const text = input.trim();

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setResponding(true);
    setError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Session expiree, reconnectez-vous');
      }

      const res = await fetch('/api/ai/agent-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          agent_id: selectedAgent.id,
          message: text,
          conversation_id: conversationId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Erreur ${res.status}`);
      }

      if (data.conversation_id && !conversationId) {
        setConversationId(data.conversation_id);
      }

      const assistantMsg: Message = {
        id: data.message_id || `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.response,
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(message);
    } finally {
      setResponding(false);
    }
  }

  // Sort: global agents first, then personal
  const sortedAgents = [...agents].sort((a, b) => {
    if (a.is_global !== b.is_global) return a.is_global ? -1 : 1;
    return (a.display_order || 0) - (b.display_order || 0);
  });

  if (selectedAgent) {
    return (
      <div className="flex flex-col h-[calc(100vh-10rem)] sm:h-[calc(100vh-8rem)]">
        <div className="flex items-center gap-3 pb-4 border-b border-border">
          <Button variant="ghost" size="icon" onClick={goBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-lg">
              {getAgentIcon(selectedAgent)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-foreground">{selectedAgent.name}</h2>
                {selectedAgent.is_global && (
                  <span className="text-[10px] bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 px-1.5 py-0.5 rounded-full font-medium">
                    Plateforme
                  </span>
                )}
              </div>
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
          {error && (
            <div className="flex justify-center">
              <p className="text-sm text-destructive bg-destructive/10 px-4 py-2 rounded-lg">{error}</p>
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
            {responding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Agents IA experts" description="Des agents specialises pour vous assister au quotidien" />

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-48 animate-pulse rounded-xl bg-muted" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedAgents.map(agent => (
            <button
              key={agent.id}
              onClick={() => selectAgent(agent)}
              className="rounded-xl border border-border bg-card p-6 text-left transition-all hover:shadow-md hover:border-primary/30 group"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-xl transition-transform group-hover:scale-110">
                  {getAgentIcon(agent)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-foreground truncate">{agent.name}</h3>
                    {agent.is_global && (
                      <span className="text-[10px] bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 px-1.5 py-0.5 rounded-full font-medium shrink-0">
                        Plateforme
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <p className="mt-3 text-sm text-muted-foreground line-clamp-2">{agent.description}</p>
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
