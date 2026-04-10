'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, Plus, Trash2, GripVertical, ImagePlus, Euro, Check, X, Package } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { formatCurrency } from '@/lib/constants';
import { ImageUpload } from './image-upload';

const AVAILABILITY_OPTIONS = [
  { value: 'in_stock', label: 'En stock', color: 'bg-emerald-50 text-emerald-700' },
  { value: 'on_order', label: 'Sur commande', color: 'bg-amber-50 text-amber-700' },
  { value: 'out_of_stock', label: 'Rupture', color: 'bg-red-50 text-red-700' },
];

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image_url: string;
  availability: string;
  sort_order: number;
}

interface Props {
  collection: { id: string; name: string; color: string };
  onBack: () => void;
}

export function ProductsGrid({ collection, onBack }: Props) {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const fetchProducts = useCallback(async () => {
    const { data } = await supabase
      .from('catalog_products')
      .select('*')
      .eq('collection_id', collection.id)
      .order('sort_order');
    if (data) setProducts(data);
    setLoading(false);
  }, [collection.id]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  async function addProduct() {
    if (!user) return;
    const { data } = await supabase
      .from('catalog_products')
      .insert({
        collection_id: collection.id,
        user_id: user.id,
        name: '',
        sort_order: products.length,
      })
      .select()
      .maybeSingle();
    if (data) {
      setProducts((prev) => [...prev, data]);
      setShowNew(false);
    }
  }

  async function updateProduct(id: string, updates: Partial<Product>) {
    await supabase
      .from('catalog_products')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
  }

  async function deleteProduct(id: string) {
    await supabase.from('catalog_products').delete().eq('id', id);
    setProducts((prev) => prev.filter((p) => p.id !== id));
  }

  function handleDragStart(index: number) {
    setDragIndex(index);
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    setDragOverIndex(index);
  }

  async function handleDrop(index: number) {
    if (dragIndex === null || dragIndex === index) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }

    const updated = [...products];
    const [moved] = updated.splice(dragIndex, 1);
    updated.splice(index, 0, moved);

    const reordered = updated.map((p, i) => ({ ...p, sort_order: i }));
    setProducts(reordered);
    setDragIndex(null);
    setDragOverIndex(null);

    const updates = reordered.map((p) =>
      supabase.from('catalog_products').update({ sort_order: p.sort_order }).eq('id', p.id)
    );
    await Promise.all(updates);
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
        <div className="flex items-center gap-3 flex-1">
          <div
            className="h-9 w-9 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: collection.color + '15' }}
          >
            <Package className="h-4 w-4" style={{ color: collection.color }} />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              {collection.name}
            </h1>
            <p className="text-xs text-muted-foreground">
              {products.length} produit{products.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <button
          onClick={addProduct}
          className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium flex items-center gap-2 hover:bg-primary/90 transition-all"
        >
          <Plus className="h-3.5 w-3.5" />
          Produit
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 bg-muted/50 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <ImagePlus className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">Aucun produit</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Ajoutez des produits à cette collection avec leurs photos, prix et disponibilité.
          </p>
          <button
            onClick={addProduct}
            className="h-10 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-medium flex items-center gap-2 hover:bg-primary/90 transition-all mt-6"
          >
            <Plus className="h-4 w-4" />
            Ajouter un produit
          </button>
        </div>
      ) : (
        <div ref={gridRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((product, index) => (
            <ProductCard
              key={product.id}
              product={product}
              index={index}
              isDragging={dragIndex === index}
              isDragOver={dragOverIndex === index}
              collectionColor={collection.color}
              onUpdate={(updates) => updateProduct(product.id, updates)}
              onDelete={() => deleteProduct(product.id)}
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={() => handleDrop(index)}
              onDragEnd={() => { setDragIndex(null); setDragOverIndex(null); }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface ProductCardProps {
  product: Product;
  index: number;
  isDragging: boolean;
  isDragOver: boolean;
  collectionColor: string;
  onUpdate: (updates: Partial<Product>) => void;
  onDelete: () => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
  onDragEnd: () => void;
}

function ProductCard({
  product,
  isDragging,
  isDragOver,
  collectionColor,
  onUpdate,
  onDelete,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: ProductCardProps) {
  const [editingName, setEditingName] = useState(!product.name);
  const [name, setName] = useState(product.name);
  const [desc, setDesc] = useState(product.description);
  const [price, setPrice] = useState(product.price.toString());

  const availability = AVAILABILITY_OPTIONS.find((a) => a.value === product.availability) || AVAILABILITY_OPTIONS[0];

  function saveName() {
    if (name.trim()) {
      onUpdate({ name: name.trim() });
      setEditingName(false);
    }
  }

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`group rounded-xl border bg-white overflow-hidden transition-all ${
        isDragging ? 'opacity-40 scale-95' : ''
      } ${isDragOver ? 'border-primary shadow-lg scale-[1.02]' : 'border-border hover:shadow-md hover:border-primary/20'}`}
    >
      <div className="relative">
        <ImageUpload
          value={product.image_url}
          onChange={(url) => onUpdate({ image_url: url })}
        />
        <div
          className="absolute top-2 left-2 h-7 w-7 rounded-lg bg-white/80 backdrop-blur-sm flex items-center justify-center cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-all z-10"
        >
          <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      </div>

      <div className="p-4 space-y-3">
        {editingName ? (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nom du produit…"
              className="flex-1 text-sm font-semibold text-foreground bg-transparent border-b border-primary/30 pb-0.5 outline-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveName();
                if (e.key === 'Escape') { setName(product.name); setEditingName(false); }
              }}
            />
            <button onClick={saveName} className="text-primary"><Check className="h-4 w-4" /></button>
          </div>
        ) : (
          <h3
            onClick={() => setEditingName(true)}
            className="text-sm font-semibold text-foreground cursor-text hover:text-primary transition-colors"
          >
            {product.name || 'Sans nom'}
          </h3>
        )}

        <textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          onBlur={() => onUpdate({ description: desc })}
          placeholder="Description…"
          rows={2}
          className="w-full text-xs text-muted-foreground bg-transparent border-none outline-none resize-none placeholder:text-muted-foreground/40 leading-relaxed"
        />

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Euro className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              onBlur={() => onUpdate({ price: parseFloat(price) || 0 })}
              placeholder="0"
              className="w-full h-9 pl-8 pr-3 rounded-lg border border-border bg-muted/20 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>
          <select
            value={product.availability}
            onChange={(e) => onUpdate({ availability: e.target.value })}
            className="h-9 px-2 rounded-lg border border-border bg-muted/20 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all appearance-none cursor-pointer"
          >
            {AVAILABILITY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border/50">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${availability.color}`}>
            {availability.label}
          </span>
          <button
            onClick={onDelete}
            className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-all opacity-0 group-hover:opacity-100"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
