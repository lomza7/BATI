'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';
import {
  Bot,
  Plus,
  Pencil,
  Trash2,
  Upload,
  FileText,
  Loader2,
  X,
  GripVertical,
} from 'lucide-react';

interface AgentDoc {
  id: string;
  file_name: string;
  file_size: number;
  page_count: number;
  created_at: string;
}

interface AdminAgent {
  id: string;
  slug: string;
  name: string;
  icon: string;
  description: string;
  system_prompt: string;
  is_active: boolean;
  display_order: number;
  doc_count: number;
  doc_pages: number;
}

export default function AdminAgentsSection() {
  const [agents, setAgents] = useState<AdminAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<AdminAgent | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formIcon, setFormIcon] = useState('🤖');
  const [formDescription, setFormDescription] = useState('');
  const [formPrompt, setFormPrompt] = useState('');
  const [formOrder, setFormOrder] = useState(0);
  const [formActive, setFormActive] = useState(true);

  // Documents
  const [docs, setDocs] = useState<AgentDoc[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function getAuthHeaders(json = true): Promise<Record<string, string>> {
    const { data: { session } } = await supabase.auth.getSession();
    const headers: Record<string, string> = {
      Authorization: `Bearer ${session?.access_token || ''}`,
    };
    if (json) headers['Content-Type'] = 'application/json';
    return headers;
  }

  const loadAgents = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/admin/agents', {
        headers: {
          Authorization: `Bearer ${session?.access_token || ''}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await res.json();
      setAgents(data.agents || []);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  function openCreate() {
    setEditing(null);
    setFormName('');
    setFormSlug('');
    setFormIcon('🤖');
    setFormDescription('');
    setFormPrompt('');
    setFormOrder(agents.length);
    setFormActive(true);
    setDocs([]);
    setUploadError('');
    setShowDialog(true);
  }

  async function openEdit(agent: AdminAgent) {
    setEditing(agent);
    setFormName(agent.name);
    setFormSlug(agent.slug);
    setFormIcon(agent.icon || '🤖');
    setFormDescription(agent.description);
    setFormPrompt(agent.system_prompt);
    setFormOrder(agent.display_order);
    setFormActive(agent.is_active);
    setUploadError('');
    setShowDialog(true);

    // Load documents
    const res = await fetch('/api/admin/agents', {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ action: 'get_documents', agent_id: agent.id }),
    });
    const data = await res.json();
    setDocs(data.documents || []);
  }

  async function handleSave() {
    if (!formName.trim()) return;
    setSaving(true);

    try {
      const action = editing ? 'update_agent' : 'create_agent';
      const payload: Record<string, unknown> = {
        action,
        name: formName,
        slug: formSlug || formName.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
        icon: formIcon,
        description: formDescription,
        system_prompt: formPrompt,
        display_order: formOrder,
        is_active: formActive,
      };
      if (editing) payload.id = editing.id;

      await fetch('/api/admin/agents', {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      setShowDialog(false);
      loadAgents();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(agentId: string) {
    if (!confirm('Supprimer cet agent et tous ses documents ?')) return;
    setDeleting(agentId);
    try {
      await fetch('/api/admin/agents', {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({ action: 'delete_agent', id: agentId }),
      });
      loadAgents();
    } finally {
      setDeleting(null);
    }
  }

  async function handleToggleActive(agent: AdminAgent) {
    await fetch('/api/admin/agents', {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({
        action: 'update_agent',
        id: agent.id,
        is_active: !agent.is_active,
      }),
    });
    loadAgents();
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !editing) return;
    setUploading(true);
    setUploadError('');

    try {
      const formData = new FormData();
      formData.append('agent_id', editing.id);
      formData.append('file', file);

      const headers = await getAuthHeaders(false);
      const res = await fetch('/api/admin/agents/upload', {
        method: 'POST',
        headers,
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.error || 'Erreur upload');
      } else {
        setDocs(prev => [...prev, data.document]);
        loadAgents();
      }
    } catch {
      setUploadError('Erreur reseau');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleDeleteDoc(docId: string) {
    await fetch('/api/admin/agents', {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ action: 'delete_document', document_id: docId }),
    });
    setDocs(prev => prev.filter(d => d.id !== docId));
    loadAgents();
  }

  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  }

  return (
    <div className="rounded-xl border border-border p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-orange-500" />
          <h2 className="text-lg font-semibold">Agents IA plateforme</h2>
          <span className="text-sm text-muted-foreground">({agents.length})</span>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" />
          Creer un agent
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : agents.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          Aucun agent plateforme. Creez-en un pour commencer.
        </p>
      ) : (
        <div className="space-y-2">
          {agents.map(agent => (
            <div
              key={agent.id}
              className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                agent.is_active ? 'bg-card' : 'bg-muted/50 opacity-60'
              }`}
            >
              <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-2xl shrink-0">{agent.icon || '🤖'}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{agent.name}</span>
                  {!agent.is_active && (
                    <span className="text-xs bg-muted px-1.5 py-0.5 rounded">Inactif</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">{agent.description}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    {agent.doc_count} doc{agent.doc_count !== 1 ? 's' : ''}
                  </span>
                  {agent.doc_pages > 0 && <span>{agent.doc_pages} pages</span>}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Switch
                  checked={agent.is_active}
                  onCheckedChange={() => handleToggleActive(agent)}
                />
                <Button variant="ghost" size="icon" onClick={() => openEdit(agent)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(agent.id)}
                  disabled={deleting === agent.id}
                >
                  {deleting === agent.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 text-destructive" />
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Modifier l\'agent' : 'Creer un agent'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Row: icon + name + slug */}
            <div className="flex gap-3">
              <div className="w-20">
                <label className="text-sm font-medium text-muted-foreground">Icone</label>
                <Input
                  value={formIcon}
                  onChange={e => setFormIcon(e.target.value)}
                  className="text-center text-xl"
                  maxLength={4}
                />
              </div>
              <div className="flex-1">
                <label className="text-sm font-medium text-muted-foreground">Nom</label>
                <Input
                  value={formName}
                  onChange={e => {
                    setFormName(e.target.value);
                    if (!editing) {
                      setFormSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '_'));
                    }
                  }}
                  placeholder="Expert DTU"
                />
              </div>
              <div className="w-40">
                <label className="text-sm font-medium text-muted-foreground">Slug</label>
                <Input
                  value={formSlug}
                  onChange={e => setFormSlug(e.target.value)}
                  placeholder="expert_dtu"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="text-sm font-medium text-muted-foreground">Description</label>
              <Input
                value={formDescription}
                onChange={e => setFormDescription(e.target.value)}
                placeholder="Specialiste des Documents Techniques Unifies..."
              />
            </div>

            {/* System prompt */}
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Prompt systeme
              </label>
              <Textarea
                value={formPrompt}
                onChange={e => setFormPrompt(e.target.value)}
                placeholder="Tu es un expert en DTU (Documents Techniques Unifies). Tu connais toutes les normes de construction francaises..."
                className="min-h-[160px] font-mono text-sm"
              />
            </div>

            {/* Order + active */}
            <div className="flex items-center gap-4">
              <div className="w-32">
                <label className="text-sm font-medium text-muted-foreground">Ordre</label>
                <Input
                  type="number"
                  value={formOrder}
                  onChange={e => setFormOrder(parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="flex items-center gap-2 pt-5">
                <Switch checked={formActive} onCheckedChange={setFormActive} />
                <span className="text-sm">Actif</span>
              </div>
            </div>

            {/* Documents (only when editing) */}
            {editing && (
              <div className="border-t pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold flex items-center gap-1.5">
                    <FileText className="h-4 w-4" />
                    Documents PDF ({docs.length})
                  </h3>
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf"
                      onChange={handleUpload}
                      className="hidden"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                    >
                      {uploading ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      ) : (
                        <Upload className="h-4 w-4 mr-1" />
                      )}
                      {uploading ? 'Extraction...' : 'Ajouter un PDF'}
                    </Button>
                  </div>
                </div>

                {uploadError && (
                  <p className="text-sm text-destructive">{uploadError}</p>
                )}

                {docs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Aucun document. Uploadez des PDFs pour enrichir la base de connaissances.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {docs.map(doc => (
                      <div
                        key={doc.id}
                        className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 text-sm"
                      >
                        <FileText className="h-4 w-4 text-red-500 shrink-0" />
                        <span className="flex-1 truncate">{doc.file_name}</span>
                        <span className="text-muted-foreground shrink-0">
                          {doc.page_count} p.
                        </span>
                        <span className="text-muted-foreground shrink-0">
                          {formatSize(doc.file_size)}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0"
                          onClick={() => handleDeleteDoc(doc.id)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Save */}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowDialog(false)}>
                Annuler
              </Button>
              <Button onClick={handleSave} disabled={saving || !formName.trim()}>
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : null}
                {editing ? 'Enregistrer' : 'Creer'}
              </Button>
            </div>

            {!editing && (
              <p className="text-xs text-muted-foreground">
                Vous pourrez ajouter des documents PDF apres la creation de l&apos;agent.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
