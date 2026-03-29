'use client';

import { useState, useCallback } from 'react';
import { ArrowLeft, Plus, Palette, Trash2, Package, GripVertical, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { ProductsGrid } from './products-grid';
import { EmojiPicker } from './emoji-picker';

const COLORS = [
  '#3b82f6', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#84cc16', '#6366f1',
];

interface Collection {
  id: string;
  name: string;
  description: string;
  color: string;
  emoji: string;
  sort_order: number;
  catalog_products: { count: number }[];
}

interface Props {
  collections: Collection[];
  onBack: () => void;
  onRefresh: () => void;
}

export function CollectionsPanel({ collections, onBack, onRefresh }: Props) {
  const { user } = useAuth();
  const [items, setItems] = useState<Collection[]>(collections);
  const [editing, setEditing] = useState<Collection | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#3b82f6');
  const [newEmoji, setNewEmoji] = useState('');
  const [activeCollection, setActiveCollection] = useState<Collection | null>(null);

  const productCount = useCallback((c: Collection) => {
    return c.catalog_products?.[0]?.count || 0;
  }, []);

  async function createCollection() {
    if (!user || !newName.trim()) return;
    const { data } = await supabase
      .from('catalog_collections')
      .insert({
        user_id: user.id,
        name: newName.trim(),
        color: newColor,
        emoji: newEmoji,
        sort_order: items.length,
      })
      .select('*, catalog_products(count)')
      .maybeSingle();
    if (data) {
      setItems((prev) => [...prev, data]);
      setNewName('');
      setShowNew(false);
      onRefresh();
    }
  }

  async function deleteCollection(id: string) {
    await supabase.from('catalog_collections').delete().eq('id', id);
    setItems((prev) => prev.filter((c) => c.id !== id));
    onRefresh();
  }

  if (activeCollection) {
    return (
      <ProductsGrid
        collection={activeCollection}
        onBack={() => {
          setActiveCollection(null);
          onRefresh();
          supabase
            .from('catalog_collections')
            .select('*, catalog_products(count)')
            .eq('user_id', user!.id)
            .order('sort_order')
            .then(({ data }) => { if (data) setItems(data as Collection[]); });
        }}
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
        <div className="flex-1">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Collections
          </h1>
          <p className="text-sm text-muted-foreground">
            Organisez vos produits par collections thematiques
          </p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium flex items-center gap-2 hover:bg-primary/90 transition-all"
        >
          <Plus className="h-3.5 w-3.5" />
          Collection
        </button>
      </div>

      {showNew && (
        <div className="rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 p-5 animate-fade-up">
          <div className="flex items-center gap-3">
            <EmojiPicker value={newEmoji} onChange={setNewEmoji} size="sm" />
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nom de la collection..."
              className="flex-1 text-base font-semibold text-foreground bg-transparent border-none outline-none placeholder:text-muted-foreground/50"
              onKeyDown={(e) => {
                if (e.key === 'Enter') createCollection();
                if (e.key === 'Escape') setShowNew(false);
              }}
            />
          </div>
          <div className="flex items-center gap-2 mt-3">
            <Palette className="h-4 w-4 text-muted-foreground" />
            <div className="flex gap-1.5">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setNewColor(c)}
                  className={`h-6 w-6 rounded-full transition-all ${
                    newColor === c ? 'ring-2 ring-offset-2 ring-primary scale-110' : 'hover:scale-110'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => setShowNew(false)}
              className="h-8 px-3 rounded-lg border border-border bg-white text-xs font-medium text-muted-foreground hover:text-foreground transition-all"
            >
              Annuler
            </button>
            <button
              onClick={createCollection}
              disabled={!newName.trim()}
              className="h-8 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-40 transition-all"
            >
              Creer
            </button>
          </div>
        </div>
      )}

      {items.length === 0 && !showNew ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <Package className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">Aucune collection</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Les collections vous permettent d&apos;organiser vos produits par theme (ex: Salles de bain, Cuisines, Chauffage...).
          </p>
          <button
            onClick={() => setShowNew(true)}
            className="h-10 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-medium flex items-center gap-2 hover:bg-primary/90 transition-all mt-6"
          >
            <Plus className="h-4 w-4" />
            Creer une collection
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((collection) => (
            <div
              key={collection.id}
              className="group flex items-center gap-4 rounded-xl border border-border bg-white p-4 hover:shadow-sm hover:border-primary/20 transition-all cursor-pointer"
              onClick={() => setActiveCollection(collection)}
            >
              <div className="text-muted-foreground/30">
                <GripVertical className="h-4 w-4" />
              </div>
              <div
                className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: collection.color + '15' }}
              >
                {collection.emoji ? (
                  <span className="text-xl">{collection.emoji}</span>
                ) : (
                  <Package className="h-5 w-5" style={{ color: collection.color }} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-foreground">{collection.name}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {productCount(collection)} produit{productCount(collection) !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); deleteCollection(collection.id); }}
                  className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-all opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
                <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
