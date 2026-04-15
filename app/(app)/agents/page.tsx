'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import {
  ArrowUp,
  Check,
  ChevronDown,
  ImagePlus,
  ImageIcon,
  Loader as Loader2,
  Menu,
  MessageSquarePlus,
  MoveHorizontal as MoreHorizontal,
  Pencil,
  Trash2,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

interface Agent {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string | null;
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

interface Conversation {
  id: string;
  agent_id: string;
  title: string;
  created_at: string;
}

const AGENT_ICONS: Record<string, string> = {
  pannes: '🔧',
  dtu: '📐',
  chiffreur: '🧮',
  juriste: '⚖️',
  rge_cee: '🌿',
};

function getAgentIcon(agent: Agent | null): string {
  if (!agent) return '🤖';
  return agent.icon || AGENT_ICONS[agent.slug] || '🤖';
}

function bucketFor(dateStr: string): string {
  const now = new Date();
  const d = new Date(dateStr);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffMs = startOfToday.getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.floor(diffMs / 86400000);
  if (days <= 0) return "Aujourd'hui";
  if (days === 1) return 'Hier';
  if (days <= 7) return '7 derniers jours';
  if (days <= 30) return '30 derniers jours';
  return 'Plus ancien';
}

const BUCKET_ORDER = ["Aujourd'hui", 'Hier', '7 derniers jours', '30 derniers jours', 'Plus ancien'];

export default function AgentsPage() {
  const { user } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(true);
  const [loadingConvos, setLoadingConvos] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [activeConvoId, setActiveConvoId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [input, setInput] = useState('');
  const [responding, setResponding] = useState(false);
  const [error, setError] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [pendingImage, setPendingImage] = useState<{ mediaType: string; base64: string; previewUrl: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadAgents();
  }, []);

  useEffect(() => {
    if (user) loadConversations();
  }, [user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function loadAgents() {
    const { data } = await supabase
      .from('ai_agents')
      .select('id, slug, name, description, icon, is_active, is_global, display_order')
      .eq('is_active', true)
      .order('display_order', { ascending: true });
    const list = ((data as unknown as Agent[]) || []).sort((a, b) => {
      if (a.is_global !== b.is_global) return a.is_global ? -1 : 1;
      return (a.display_order || 0) - (b.display_order || 0);
    });
    setAgents(list);
    setSelectedAgent((current) => current || list[0] || null);
    setLoadingAgents(false);
  }

  async function loadConversations() {
    setLoadingConvos(true);
    const { data } = await supabase
      .from('ai_conversations')
      .select('id, agent_id, title, created_at')
      .order('created_at', { ascending: false })
      .limit(200);
    setConversations((data as unknown as Conversation[]) || []);
    setLoadingConvos(false);
  }

  async function openConversation(convo: Conversation) {
    setActiveConvoId(convo.id);
    const agent = agents.find((a) => a.id === convo.agent_id) || null;
    if (agent) setSelectedAgent(agent);
    setLoadingMessages(true);
    setError('');
    setSidebarOpen(false);
    const { data } = await supabase
      .from('ai_messages')
      .select('id, role, content, created_at')
      .eq('conversation_id', convo.id)
      .order('created_at', { ascending: true });
    setMessages(((data as unknown as Message[]) || []));
    setLoadingMessages(false);
  }

  function startNewConversation() {
    setActiveConvoId(null);
    setMessages([]);
    setError('');
    setInput('');
    setSidebarOpen(false);
    setTimeout(() => textareaRef.current?.focus(), 50);
  }

  async function deleteConversation(convo: Conversation) {
    if (!confirm(`Supprimer la conversation "${convo.title}" ?`)) return;
    await supabase.from('ai_messages').delete().eq('conversation_id', convo.id);
    await supabase.from('ai_conversations').delete().eq('id', convo.id);
    setConversations((prev) => prev.filter((c) => c.id !== convo.id));
    if (activeConvoId === convo.id) startNewConversation();
  }

  function startRename(convo: Conversation) {
    setRenamingId(convo.id);
    setRenameValue(convo.title);
  }

  async function commitRename(convoId: string) {
    const trimmed = renameValue.trim();
    if (!trimmed) {
      setRenamingId(null);
      return;
    }
    await supabase.from('ai_conversations').update({ title: trimmed }).eq('id', convoId);
    setConversations((prev) => prev.map((c) => (c.id === convoId ? { ...c, title: trimmed } : c)));
    setRenamingId(null);
  }

  async function handleImageSelected(file: File | null | undefined) {
    if (!file) return;
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.type)) {
      setError('Format non supporté. Utilisez JPEG, PNG, WebP ou GIF.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image trop volumineuse (max 5 Mo).');
      return;
    }
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1] || '');
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const previewUrl = URL.createObjectURL(file);
    setPendingImage((prev) => {
      if (prev) URL.revokeObjectURL(prev.previewUrl);
      return { mediaType: file.type, base64, previewUrl };
    });
    setError('');
  }

  function clearPendingImage() {
    setPendingImage((prev) => {
      if (prev) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function sendMessage() {
    const text = input.trim();
    if ((!text && !pendingImage) || !selectedAgent || responding) return;

    const messageText = text || (pendingImage ? 'Analyse cette image.' : '');
    const attachedImage = pendingImage;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: attachedImage ? `[Image jointe]\n${messageText}` : messageText,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    clearPendingImage();
    setResponding(true);
    setError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Session expirée, reconnectez-vous.');

      const res = await fetch('/api/ai/agent-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          agent_id: selectedAgent.id,
          message: messageText,
          conversation_id: activeConvoId,
          image: attachedImage ? { media_type: attachedImage.mediaType, data: attachedImage.base64 } : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);

      if (data.conversation_id && !activeConvoId) {
        setActiveConvoId(data.conversation_id);
        loadConversations();
      }

      const assistantMsg: Message = {
        id: data.message_id || `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.response,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setResponding(false);
    }
  }

  const grouped = useMemo(() => {
    const map = new Map<string, Conversation[]>();
    for (const c of conversations) {
      const key = bucketFor(c.created_at);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return BUCKET_ORDER.filter((k) => map.has(k)).map((k) => ({ label: k, items: map.get(k)! }));
  }, [conversations]);

  const sidebar = (
    <div className="flex h-full flex-col bg-muted/30 border-r border-border">
      <div className="p-3 space-y-2 border-b border-border">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="w-full flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm hover:bg-muted transition-colors"
              disabled={loadingAgents}
            >
              <span className="text-lg">{getAgentIcon(selectedAgent)}</span>
              <span className="flex-1 text-left truncate font-medium">
                {selectedAgent?.name || 'Choisir un agent'}
              </span>
              <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[260px]">
            {agents.map((agent) => (
              <DropdownMenuItem
                key={agent.id}
                onClick={() => {
                  setSelectedAgent(agent);
                  startNewConversation();
                }}
                className="gap-2"
              >
                <span className="text-base">{getAgentIcon(agent)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium truncate">{agent.name}</span>
                    {agent.is_global && (
                      <span className="text-[9px] bg-orange-100 text-orange-700 px-1 py-0.5 rounded-full">
                        Plateforme
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{agent.description}</p>
                </div>
                {selectedAgent?.id === agent.id && <Check className="h-4 w-4 text-primary" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          onClick={startNewConversation}
          variant="outline"
          className="w-full justify-start gap-2"
          disabled={!selectedAgent}
        >
          <MessageSquarePlus className="h-4 w-4" />
          Nouvelle conversation
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {loadingConvos ? (
          <div className="space-y-1 p-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-8 rounded-md bg-muted animate-pulse" />
            ))}
          </div>
        ) : grouped.length === 0 ? (
          <p className="p-3 text-xs text-muted-foreground text-center">
            Aucune conversation. Démarrez-en une.
          </p>
        ) : (
          grouped.map((group) => (
            <div key={group.label} className="mb-3">
              <p className="px-2 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map((c) => {
                  const agent = agents.find((a) => a.id === c.agent_id);
                  const isActive = activeConvoId === c.id;
                  const isRenaming = renamingId === c.id;
                  return (
                    <div
                      key={c.id}
                      className={cn(
                        'group flex items-center gap-1 rounded-md px-2 py-1.5 text-sm cursor-pointer transition-colors',
                        isActive ? 'bg-background shadow-sm' : 'hover:bg-background/60',
                      )}
                      onClick={() => !isRenaming && openConversation(c)}
                    >
                      <span className="text-sm flex-shrink-0">{getAgentIcon(agent || null)}</span>
                      {isRenaming ? (
                        <Input
                          autoFocus
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onBlur={() => commitRename(c.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitRename(c.id);
                            if (e.key === 'Escape') setRenamingId(null);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="h-6 text-sm px-1 py-0"
                        />
                      ) : (
                        <>
                          <span className="flex-1 truncate">{c.title}</span>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                onClick={(e) => e.stopPropagation()}
                                className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-muted flex-shrink-0 transition-opacity"
                              >
                                <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                              <DropdownMenuItem onClick={() => startRename(c)}>
                                <Pencil className="h-3.5 w-3.5 mr-2" /> Renommer
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => deleteConversation(c)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="h-3.5 w-3.5 mr-2" /> Supprimer
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-[calc(100dvh-60px)] lg:h-screen -mx-4 sm:-mx-6 lg:-mx-8 -my-5 lg:-my-8 border-t border-border">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-72 lg:w-80 flex-shrink-0">
        {sidebar}
      </aside>

      {/* Mobile sidebar */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="p-0 w-[85vw] max-w-sm">
          <SheetHeader className="sr-only">
            <SheetTitle>Conversations</SheetTitle>
          </SheetHeader>
          <div className="h-full">{sidebar}</div>
        </SheetContent>
      </Sheet>

      {/* Chat area */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          {selectedAgent ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-2 min-w-0 flex-1 rounded-lg px-2 py-1 -mx-1 hover:bg-muted transition-colors md:cursor-default md:hover:bg-transparent"
                >
                  <span className="text-lg">{getAgentIcon(selectedAgent)}</span>
                  <div className="min-w-0 flex-1 text-left">
                    <div className="flex items-center gap-1.5">
                      <h2 className="text-sm font-semibold text-foreground truncate">
                        {selectedAgent.name}
                      </h2>
                      {selectedAgent.is_global && (
                        <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full font-medium flex-shrink-0">
                          Plateforme
                        </span>
                      )}
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 md:hidden" />
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {selectedAgent.description}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[260px]">
                {agents.map((agent) => (
                  <DropdownMenuItem
                    key={agent.id}
                    onClick={() => {
                      setSelectedAgent(agent);
                      startNewConversation();
                    }}
                    className="gap-2"
                  >
                    <span className="text-base">{getAgentIcon(agent)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium truncate">{agent.name}</span>
                        {agent.is_global && (
                          <span className="text-[9px] bg-orange-100 text-orange-700 px-1 py-0.5 rounded-full">
                            Plateforme
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{agent.description}</p>
                    </div>
                    {selectedAgent?.id === agent.id && <Check className="h-4 w-4 text-primary" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <h2 className="text-sm font-semibold">Agents IA</h2>
          )}
        </header>

        <div className="flex-1 overflow-y-auto">
          {loadingMessages ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full px-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-3xl mb-4">
                {getAgentIcon(selectedAgent)}
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-1">
                {selectedAgent ? selectedAgent.name : 'Choisissez un agent'}
              </h3>
              <p className="text-sm text-muted-foreground max-w-md">
                {selectedAgent?.description || 'Sélectionnez un agent dans la barre latérale pour démarrer.'}
              </p>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto w-full px-4 py-6 space-y-5">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn('flex gap-3', msg.role === 'user' ? 'justify-end' : 'justify-start')}
                >
                  {msg.role === 'assistant' && (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-base flex-shrink-0">
                      {getAgentIcon(selectedAgent)}
                    </div>
                  )}
                  <div
                    className={cn(
                      'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm',
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-br-sm'
                        : 'bg-muted text-foreground rounded-bl-sm',
                    )}
                  >
                    <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  </div>
                </div>
              ))}
              {responding && (
                <div className="flex gap-3 justify-start">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-base flex-shrink-0">
                    {getAgentIcon(selectedAgent)}
                  </div>
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
          )}
        </div>

        <div className="border-t border-border p-3 sm:p-4">
          <div className="max-w-3xl mx-auto w-full">
            <div className="rounded-2xl border border-border bg-background shadow-sm focus-within:border-primary/50 transition-colors">
              {pendingImage && (
                <div className="flex items-start gap-2 p-2 border-b border-border">
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={pendingImage.previewUrl}
                      alt="Pièce jointe"
                      className="h-16 w-16 rounded-lg object-cover border border-border"
                    />
                    <button
                      type="button"
                      onClick={clearPendingImage}
                      className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-foreground text-background flex items-center justify-center hover:bg-foreground/80"
                      aria-label="Retirer l'image"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground pt-1">
                    <ImageIcon className="h-3.5 w-3.5" /> Image jointe
                  </div>
                </div>
              )}
              <div className="flex items-end gap-1.5 p-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => handleImageSelected(e.target.files?.[0])}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-full flex-shrink-0"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!selectedAgent || responding}
                  title="Joindre une image"
                >
                  <ImagePlus className="h-4 w-4" />
                </Button>
                <textarea
                  ref={textareaRef}
                  placeholder={selectedAgent ? `Message à ${selectedAgent.name}…` : 'Choisissez un agent'}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  disabled={!selectedAgent || responding}
                  rows={1}
                  className="flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50 max-h-40"
                  style={{ minHeight: '36px' }}
                />
                <Button
                  onClick={sendMessage}
                  disabled={(!input.trim() && !pendingImage) || responding || !selectedAgent}
                  size="icon"
                  className="h-9 w-9 rounded-full flex-shrink-0"
                >
                  {responding ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-center text-muted-foreground">
              L&apos;IA peut faire des erreurs. Vérifiez les informations importantes.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
