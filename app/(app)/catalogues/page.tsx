'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, FolderOpen, Send, Eye, MoveHorizontal as MoreHorizontal, Trash2, Pencil, Package, Layers } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { CollectionsPanel } from '@/components/catalogs/collections-panel';
import { CatalogBuilder } from '@/components/catalogs/catalog-builder';
import { SendCatalogDialog } from '@/components/catalogs/send-catalog-dialog';
import { SendsHistory } from '@/components/catalogs/sends-history';
import { EmojiPicker } from '@/components/catalogs/emoji-picker';
import { formatDate } from '@/lib/constants';

interface Catalog {
  id: string;
  name: string;
  description: string;
  emoji: string;
  status: string;
  created_at: string;
  collections_count?: number;
}

type View = 'list' | 'collections' | 'builder' | 'sends';

export default function CataloguesPage() {
  const { user } = useAuth();
  const [catalogs, setCatalogs] = useState<Catalog[]>([]);
  const [collections, setCollections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>('list');
  const [editingCatalog, setEditingCatalog] = useState<Catalog | null>(null);
  const [sendCatalog, setSendCatalog] = useState<Catalog | null>(null);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newEmoji, setNewEmoji] = useState('');
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const fetchCatalogs = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('catalogs')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (data) setCatalogs(data);
  }, [user]);

  const fetchCollections = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('catalog_collections')
      .select('*, catalog_products(count)')
      .eq('user_id', user.id)
      .order('sort_order');
    if (data) setCollections(data);
  }, [user]);

  useEffect(() => {
    Promise.all([fetchCatalogs(), fetchCollections()]).then(() => setLoading(false));
  }, [fetchCatalogs, fetchCollections]);

  async function createCatalog() {
    if (!user || !newName.trim()) return;
    const { data } = await supabase
      .from('catalogs')
      .insert({ user_id: user.id, name: newName.trim(), description: newDesc.trim(), emoji: newEmoji })
      .select()
      .maybeSingle();
    if (data) {
      setCatalogs((prev) => [data, ...prev]);
      setNewName('');
      setNewDesc('');
      setShowNewDialog(false);
      setEditingCatalog(data);
      setView('builder');
    }
  }

  async function deleteCatalog(id: string) {
    await supabase.from('catalogs').delete().eq('id', id);
    setCatalogs((prev) => prev.filter((c) => c.id !== id));
    setMenuOpen(null);
  }

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 bg-muted/50 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (view === 'collections') {
    return (
      <CollectionsPanel
        collections={collections}
        onBack={() => { setView('list'); fetchCollections(); }}
        onRefresh={fetchCollections}
      />
    );
  }

  if (view === 'builder' && editingCatalog) {
    return (
      <CatalogBuilder
        catalog={editingCatalog}
        collections={collections}
        onBack={() => { setView('list'); fetchCatalogs(); fetchCollections(); }}
        onSend={() => setSendCatalog(editingCatalog)}
      />
    );
  }

  if (view === 'sends') {
    return <SendsHistory onBack={() => setView('list')} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
            Catalogues
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Creez des catalogues produits et envoyez-les a vos clients
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setView('sends')}
            className="h-9 px-4 rounded-lg border border-border bg-white text-sm font-medium text-foreground flex items-center gap-2 hover:bg-muted/50 transition-all"
          >
            <Send className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Envois</span>
          </button>
          <button
            onClick={() => setView('collections')}
            className="h-9 px-4 rounded-lg border border-border bg-white text-sm font-medium text-foreground flex items-center gap-2 hover:bg-muted/50 transition-all"
          >
            <Layers className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Collections</span>
          </button>
          <button
            onClick={() => setShowNewDialog(true)}
            className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium flex items-center gap-2 hover:bg-primary/90 transition-all"
          >
            <Plus className="h-3.5 w-3.5" />
            Nouveau
          </button>
        </div>
      </div>

      {catalogs.length === 0 && !showNewDialog ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <Package className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">Aucun catalogue</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Commencez par creer des collections de produits, puis assemblez-les en catalogues personnalises pour vos clients.
          </p>
          <div className="flex gap-3 mt-6">
            <button
              onClick={() => setView('collections')}
              className="h-10 px-5 rounded-lg border border-border bg-white text-sm font-medium text-foreground flex items-center gap-2 hover:bg-muted/50 transition-all"
            >
              <Layers className="h-4 w-4" />
              Creer des collections
            </button>
            <button
              onClick={() => setShowNewDialog(true)}
              className="h-10 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-medium flex items-center gap-2 hover:bg-primary/90 transition-all"
            >
              <Plus className="h-4 w-4" />
              Creer un catalogue
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {showNewDialog && (
            <div className="rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 p-5 animate-fade-up">
              <div className="flex items-center gap-3">
                <EmojiPicker value={newEmoji} onChange={setNewEmoji} size="sm" />
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Nom du catalogue..."
                  className="flex-1 text-base font-semibold text-foreground bg-transparent border-none outline-none placeholder:text-muted-foreground/50"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') createCatalog();
                    if (e.key === 'Escape') setShowNewDialog(false);
                  }}
                />
              </div>
              <textarea
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Description (optionnel)..."
                rows={2}
                className="w-full mt-2 text-sm text-muted-foreground bg-transparent border-none outline-none resize-none placeholder:text-muted-foreground/40"
              />
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => setShowNewDialog(false)}
                  className="h-8 px-3 rounded-lg border border-border bg-white text-xs font-medium text-muted-foreground hover:text-foreground transition-all"
                >
                  Annuler
                </button>
                <button
                  onClick={createCatalog}
                  disabled={!newName.trim()}
                  className="h-8 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-40 transition-all"
                >
                  Creer
                </button>
              </div>
            </div>
          )}

          {catalogs.map((catalog) => (
            <div
              key={catalog.id}
              className="group rounded-xl border border-border bg-white p-5 hover:shadow-md hover:border-primary/20 transition-all cursor-pointer relative"
              onClick={() => { setEditingCatalog(catalog); setView('builder'); }}
            >
              <div className="flex items-start justify-between">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  {catalog.emoji ? (
                    <span className="text-xl">{catalog.emoji}</span>
                  ) : (
                    <FolderOpen className="h-5 w-5 text-primary" />
                  )}
                </div>
                <div className="relative">
                  <button
                    onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === catalog.id ? null : catalog.id); }}
                    className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-all opacity-0 group-hover:opacity-100"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                  {menuOpen === catalog.id && (
                    <div className="absolute right-0 top-9 z-10 w-40 rounded-lg border border-border bg-white shadow-lg py-1 animate-in fade-in slide-in-from-top-1 duration-150">
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditingCatalog(catalog); setView('builder'); setMenuOpen(null); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted/50 transition-colors"
                      >
                        <Pencil className="h-3.5 w-3.5" /> Modifier
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setSendCatalog(catalog); setMenuOpen(null); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted/50 transition-colors"
                      >
                        <Send className="h-3.5 w-3.5" /> Envoyer
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteCatalog(catalog.id); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/5 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Supprimer
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <h3 className="text-base font-semibold text-foreground mt-3">{catalog.name}</h3>
              {catalog.description && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{catalog.description}</p>
              )}

              <div className="flex items-center gap-3 mt-4 pt-3 border-t border-border">
                <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${
                  catalog.status === 'published'
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-slate-100 text-slate-600'
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${
                    catalog.status === 'published' ? 'bg-emerald-500' : 'bg-slate-400'
                  }`} />
                  {catalog.status === 'published' ? 'Publie' : 'Brouillon'}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDate(catalog.created_at)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {sendCatalog && (
        <SendCatalogDialog
          catalog={sendCatalog}
          onClose={() => setSendCatalog(null)}
        />
      )}
    </div>
  );
}
