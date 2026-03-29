'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Plus, Send, Check, Package, X, GripVertical, Eye, Layers } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { formatCurrency } from '@/lib/constants';

interface Catalog {
  id: string;
  name: string;
  description: string;
  status: string;
}

interface Collection {
  id: string;
  name: string;
  description: string;
  color: string;
}

interface LinkedCollection extends Collection {
  sort_order: number;
  products: Product[];
}

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image_url: string;
  availability: string;
}

interface Props {
  catalog: Catalog;
  collections: Collection[];
  onBack: () => void;
  onSend: () => void;
}

export function CatalogBuilder({ catalog, collections, onBack, onSend }: Props) {
  const { user } = useAuth();
  const [linked, setLinked] = useState<LinkedCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPicker, setShowPicker] = useState(false);
  const [preview, setPreview] = useState(false);
  const [name, setName] = useState(catalog.name);
  const [desc, setDesc] = useState(catalog.description);
  const [editingName, setEditingName] = useState(false);

  const fetchLinked = useCallback(async () => {
    const { data: links } = await supabase
      .from('catalog_catalog_collections')
      .select('collection_id, sort_order')
      .eq('catalog_id', catalog.id)
      .order('sort_order');

    if (!links || links.length === 0) {
      setLinked([]);
      setLoading(false);
      return;
    }

    const collectionIds = links.map((l: any) => l.collection_id);
    const { data: colData } = await supabase
      .from('catalog_collections')
      .select('*')
      .in('id', collectionIds);

    const { data: prodData } = await supabase
      .from('catalog_products')
      .select('*')
      .in('collection_id', collectionIds)
      .order('sort_order');

    const result: LinkedCollection[] = links.map((link: any) => {
      const col = colData?.find((c: any) => c.id === link.collection_id);
      const prods = prodData?.filter((p: any) => p.collection_id === link.collection_id) || [];
      return {
        ...col,
        sort_order: link.sort_order,
        products: prods,
      } as LinkedCollection;
    });

    setLinked(result);
    setLoading(false);
  }, [catalog.id]);

  useEffect(() => {
    fetchLinked();
  }, [fetchLinked]);

  async function addCollection(collectionId: string) {
    await supabase.from('catalog_catalog_collections').insert({
      catalog_id: catalog.id,
      collection_id: collectionId,
      sort_order: linked.length,
    });
    setShowPicker(false);
    fetchLinked();
  }

  async function removeCollection(collectionId: string) {
    await supabase
      .from('catalog_catalog_collections')
      .delete()
      .eq('catalog_id', catalog.id)
      .eq('collection_id', collectionId);
    setLinked((prev) => prev.filter((c) => c.id !== collectionId));
  }

  async function saveName() {
    await supabase
      .from('catalogs')
      .update({ name: name.trim(), description: desc.trim(), updated_at: new Date().toISOString() })
      .eq('id', catalog.id);
    setEditingName(false);
  }

  async function publishCatalog() {
    const newStatus = catalog.status === 'published' ? 'draft' : 'published';
    await supabase.from('catalogs').update({ status: newStatus }).eq('id', catalog.id);
    catalog.status = newStatus;
  }

  const availableCollections = collections.filter(
    (c) => !linked.find((l) => l.id === c.id)
  );

  const totalProducts = linked.reduce((sum, c) => sum + c.products.length, 0);

  if (preview) {
    return (
      <CatalogPreview
        name={name}
        description={desc}
        collections={linked}
        onClose={() => setPreview(false)}
      />
    );
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
        <div className="flex-1 min-w-0">
          {editingName ? (
            <div className="space-y-1">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') saveName(); }}
                className="text-xl font-semibold text-foreground bg-transparent border-b border-primary/30 pb-0.5 outline-none w-full"
              />
              <input
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="Description..."
                className="text-sm text-muted-foreground bg-transparent outline-none w-full"
                onKeyDown={(e) => { if (e.key === 'Enter') saveName(); }}
              />
            </div>
          ) : (
            <div onClick={() => setEditingName(true)} className="cursor-text">
              <h1 className="text-xl font-semibold tracking-tight text-foreground hover:text-primary transition-colors">
                {name}
              </h1>
              <p className="text-sm text-muted-foreground">
                {desc || 'Cliquez pour ajouter une description'}
              </p>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setPreview(true)}
            disabled={linked.length === 0}
            className="h-9 px-4 rounded-lg border border-border bg-white text-sm font-medium text-foreground flex items-center gap-2 hover:bg-muted/50 disabled:opacity-40 transition-all"
          >
            <Eye className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Apercu</span>
          </button>
          <button
            onClick={onSend}
            disabled={linked.length === 0}
            className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium flex items-center gap-2 hover:bg-primary/90 disabled:opacity-40 transition-all"
          >
            <Send className="h-3.5 w-3.5" />
            Envoyer
          </button>
        </div>
      </div>

      <div className="flex items-center gap-6 px-4 py-3 rounded-xl bg-muted/30 border border-border">
        <div>
          <p className="text-2xl font-bold text-foreground">{linked.length}</p>
          <p className="text-xs text-muted-foreground">collection{linked.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="h-8 w-px bg-border" />
        <div>
          <p className="text-2xl font-bold text-foreground">{totalProducts}</p>
          <p className="text-xs text-muted-foreground">produit{totalProducts !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex-1" />
        <button
          onClick={() => setShowPicker(true)}
          disabled={availableCollections.length === 0}
          className="h-9 px-4 rounded-lg border border-dashed border-primary/40 bg-primary/5 text-sm font-medium text-primary flex items-center gap-2 hover:bg-primary/10 disabled:opacity-40 transition-all"
        >
          <Plus className="h-3.5 w-3.5" />
          Ajouter une collection
        </button>
      </div>

      {showPicker && (
        <div className="rounded-xl border border-primary/20 bg-white p-4 shadow-lg animate-fade-up">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-foreground">Choisir une collection</p>
            <button onClick={() => setShowPicker(false)} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
          {availableCollections.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Toutes vos collections sont deja ajoutees.
            </p>
          ) : (
            <div className="space-y-1">
              {availableCollections.map((col) => (
                <button
                  key={col.id}
                  onClick={() => addCollection(col.id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-all text-left"
                >
                  <div
                    className="h-8 w-8 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: col.color + '15' }}
                  >
                    <Package className="h-4 w-4" style={{ color: col.color }} />
                  </div>
                  <span className="text-sm font-medium text-foreground">{col.name}</span>
                  <Plus className="h-4 w-4 text-muted-foreground ml-auto" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-32 bg-muted/50 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : linked.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <Layers className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">Catalogue vide</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Selectionnez les collections que vous souhaitez inclure dans ce catalogue.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {linked.map((collection) => (
            <div key={collection.id} className="rounded-xl border border-border bg-white overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-muted/20">
                <GripVertical className="h-4 w-4 text-muted-foreground/30 cursor-grab" />
                <div
                  className="h-8 w-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: collection.color + '15' }}
                >
                  <Package className="h-4 w-4" style={{ color: collection.color }} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">{collection.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {collection.products.length} produit{collection.products.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <button
                  onClick={() => removeCollection(collection.id)}
                  className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-all"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {collection.products.length > 0 ? (
                <div className="p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                  {collection.products.map((product) => (
                    <div key={product.id} className="rounded-lg border border-border/50 overflow-hidden bg-white">
                      <div className="aspect-square bg-muted/20">
                        {product.image_url ? (
                          <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="h-6 w-6 text-muted-foreground/20" />
                          </div>
                        )}
                      </div>
                      <div className="p-2">
                        <p className="text-xs font-medium text-foreground truncate">{product.name || 'Sans nom'}</p>
                        <p className="text-xs font-semibold text-primary mt-0.5">
                          {formatCurrency(product.price)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center">
                  <p className="text-sm text-muted-foreground">Cette collection est vide</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CatalogPreview({
  name,
  description,
  collections,
  onClose,
}: {
  name: string;
  description: string;
  collections: LinkedCollection[];
  onClose: () => void;
}) {
  const AVAILABILITY_MAP: Record<string, { label: string; color: string }> = {
    in_stock: { label: 'En stock', color: 'bg-emerald-50 text-emerald-700' },
    on_order: { label: 'Sur commande', color: 'bg-amber-50 text-amber-700' },
    out_of_stock: { label: 'Rupture', color: 'bg-red-50 text-red-700' },
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={onClose}
          className="h-9 w-9 rounded-lg border border-border bg-white flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1">
          <p className="text-xs font-medium text-primary uppercase tracking-wider">Apercu client</p>
          <h1 className="text-xl font-semibold text-foreground">{name}</h1>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-white overflow-hidden shadow-sm">
        <div className="px-8 py-10 text-center border-b border-border bg-gradient-to-b from-muted/30 to-white">
          <h2 className="text-2xl font-semibold text-foreground">{name}</h2>
          {description && (
            <p className="text-sm text-muted-foreground mt-2 max-w-lg mx-auto">{description}</p>
          )}
          <p className="text-xs text-muted-foreground/70 mt-4">
            Selectionnez les modeles qui vous interessent
          </p>
        </div>

        {collections.map((col) => (
          <div key={col.id} className="border-b border-border last:border-b-0">
            <div className="px-8 py-5 flex items-center gap-3">
              <div className="h-3 w-3 rounded-full" style={{ backgroundColor: col.color }} />
              <h3 className="text-lg font-semibold text-foreground">{col.name}</h3>
              <span className="text-sm text-muted-foreground">
                ({col.products.length} produit{col.products.length !== 1 ? 's' : ''})
              </span>
            </div>
            <div className="px-8 pb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {col.products.map((p) => {
                const avail = AVAILABILITY_MAP[p.availability] || AVAILABILITY_MAP.in_stock;
                return (
                  <div key={p.id} className="rounded-xl border border-border overflow-hidden hover:shadow-md transition-all">
                    <div className="aspect-[4/3] bg-muted/20">
                      {p.image_url ? (
                        <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="h-10 w-10 text-muted-foreground/15" />
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <h4 className="text-sm font-semibold text-foreground">{p.name}</h4>
                      {p.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.description}</p>
                      )}
                      <div className="flex items-center justify-between mt-3">
                        <span className="text-base font-bold text-primary">{formatCurrency(p.price)}</span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${avail.color}`}>
                          {avail.label}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
