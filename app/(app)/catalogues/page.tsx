'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, FolderOpen, Send, Eye, MoveHorizontal as MoreHorizontal, Trash2, Pencil, Package, Layers, FileText, Upload, ExternalLink } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { moveEntityToTrash } from '@/lib/recycle-bin';
import { CollectionsPanel } from '@/components/catalogs/collections-panel';
import { CatalogBuilder } from '@/components/catalogs/catalog-builder';
import { SendCatalogDialog } from '@/components/catalogs/send-catalog-dialog';
import { SendsHistory } from '@/components/catalogs/sends-history';
import { EmojiPicker } from '@/components/catalogs/emoji-picker';
import { UploadSupplierPdfDialog } from '@/components/catalogs/upload-supplier-pdf-dialog';
import { formatDate } from '@/lib/constants';

interface Catalog {
  id: string;
  name: string;
  description: string;
  emoji: string;
  status: string;
  created_at: string;
  collections_count?: number;
  catalog_type?: 'custom' | 'supplier_pdf';
  supplier_name?: string | null;
  pdf_file_url?: string | null;
  pdf_file_name?: string | null;
  pdf_file_size?: number | null;
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
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
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
      .is('deleted_at', null)
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
    if (!user) return;
    await moveEntityToTrash('catalog', id, user.id);
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
            Créez des catalogues produits et envoyez-les à vos clients
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
          <div className="relative">
            <button
              onClick={() => setShowCreateMenu((v) => !v)}
              className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium flex items-center gap-2 hover:bg-primary/90 transition-all"
            >
              <Plus className="h-3.5 w-3.5" />
              Nouveau
            </button>
            {showCreateMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowCreateMenu(false)} />
                <div className="absolute right-0 top-10 z-20 w-72 rounded-xl border border-border bg-white shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                  <button
                    onClick={() => { setShowCreateMenu(false); setShowNewDialog(true); }}
                    className="w-full flex items-start gap-3 p-3 text-left hover:bg-muted/40 transition-colors"
                  >
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Layers className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">Créer un catalogue</p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                        Assemblez vos propres produits en collections
                      </p>
                    </div>
                  </button>
                  <div className="h-px bg-border" />
                  <button
                    onClick={() => { setShowCreateMenu(false); setShowImportDialog(true); }}
                    className="w-full flex items-start gap-3 p-3 text-left hover:bg-muted/40 transition-colors"
                  >
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <FileText className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">Importer un PDF fournisseur</p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                        Leroy Merlin, Saint-Gobain, Point P…
                      </p>
                    </div>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {catalogs.length === 0 && !showNewDialog ? (
        <div className="py-10 sm:py-14">
          <div className="text-center mb-8">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Package className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">Aucun catalogue</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              Créez votre propre catalogue ou importez un PDF de votre fournisseur pour l&apos;envoyer à vos clients.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl mx-auto">
            <button
              onClick={() => setShowNewDialog(true)}
              className="group rounded-xl border border-border bg-white p-5 text-left hover:border-primary/40 hover:shadow-md transition-all"
            >
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                <Layers className="h-5 w-5 text-primary" />
              </div>
              <p className="text-sm font-semibold text-foreground">Créer un catalogue</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Composez vos produits en collections et envoyez-les à vos clients pour qu&apos;ils sélectionnent leurs modèles.
              </p>
            </button>
            <button
              onClick={() => setShowImportDialog(true)}
              className="group rounded-xl border border-border bg-white p-5 text-left hover:border-primary/40 hover:shadow-md transition-all"
            >
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <p className="text-sm font-semibold text-foreground">Importer un PDF fournisseur</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Transmettez les catalogues de Leroy Merlin, Saint-Gobain, Point P et d&apos;autres fournisseurs à vos clients.
              </p>
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
                  placeholder="Nom du catalogue…"
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
                placeholder="Description (optionnel)…"
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
                  Créer
                </button>
              </div>
            </div>
          )}

          {catalogs.map((catalog) => {
            const isPdf = catalog.catalog_type === 'supplier_pdf';
            const handleOpen = () => {
              if (isPdf && catalog.pdf_file_url) {
                window.open(catalog.pdf_file_url, '_blank', 'noopener,noreferrer');
              } else {
                setEditingCatalog(catalog);
                setView('builder');
              }
            };
            return (
              <div
                key={catalog.id}
                className="group rounded-xl border border-border bg-white p-5 hover:shadow-md hover:border-primary/20 transition-all cursor-pointer relative"
                onClick={handleOpen}
              >
                <div className="flex items-start justify-between">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    {isPdf ? (
                      <FileText className="h-5 w-5 text-primary" />
                    ) : catalog.emoji ? (
                      <span className="text-xl">{catalog.emoji}</span>
                    ) : (
                      <FolderOpen className="h-5 w-5 text-primary" />
                    )}
                  </div>
                  <div className="relative">
                    <button
                      onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === catalog.id ? null : catalog.id); }}
                      className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-all sm:opacity-0 sm:group-hover:opacity-100"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                    {menuOpen === catalog.id && (
                      <div className="absolute right-0 top-9 z-10 w-44 rounded-lg border border-border bg-white shadow-lg py-1 animate-in fade-in slide-in-from-top-1 duration-150">
                        {isPdf ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); if (catalog.pdf_file_url) window.open(catalog.pdf_file_url, '_blank', 'noopener,noreferrer'); setMenuOpen(null); }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted/50 transition-colors"
                          >
                            <ExternalLink className="h-3.5 w-3.5" /> Ouvrir le PDF
                          </button>
                        ) : (
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditingCatalog(catalog); setView('builder'); setMenuOpen(null); }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted/50 transition-colors"
                          >
                            <Pencil className="h-3.5 w-3.5" /> Modifier
                          </button>
                        )}
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
                {isPdf && catalog.supplier_name && (
                  <p className="text-xs text-muted-foreground mt-0.5">Fournisseur · {catalog.supplier_name}</p>
                )}
                {catalog.description && (
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{catalog.description}</p>
                )}

                <div className="flex items-center flex-wrap gap-2 mt-4 pt-3 border-t border-border">
                  {isPdf ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                      <FileText className="h-3 w-3" />
                      PDF fournisseur
                    </span>
                  ) : (
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${
                      catalog.status === 'published'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${
                        catalog.status === 'published' ? 'bg-emerald-500' : 'bg-slate-400'
                      }`} />
                      {catalog.status === 'published' ? 'Publié' : 'Brouillon'}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {formatDate(catalog.created_at)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {sendCatalog && (
        <SendCatalogDialog
          catalog={sendCatalog}
          onClose={() => setSendCatalog(null)}
        />
      )}

      <UploadSupplierPdfDialog
        open={showImportDialog}
        onClose={() => setShowImportDialog(false)}
        onCreated={(cat) => { setCatalogs((prev) => [cat, ...prev]); setShowImportDialog(false); }}
      />
    </div>
  );
}
