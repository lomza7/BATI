'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { Hexagon, Check, Package, ShoppingBag, Send, Loader as Loader2, Clock, TriangleAlert as AlertTriangle, CircleCheck as CheckCircle, X, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const anonClient = createClient(supabaseUrl, supabaseAnonKey);

const AVAILABILITY_MAP: Record<string, { label: string; dotColor: string; bgColor: string; textColor: string }> = {
  in_stock: { label: 'En stock', dotColor: 'bg-emerald-400', bgColor: 'bg-emerald-50', textColor: 'text-emerald-700' },
  on_order: { label: 'Sur commande', dotColor: 'bg-amber-400', bgColor: 'bg-amber-50', textColor: 'text-amber-700' },
  out_of_stock: { label: 'Indisponible', dotColor: 'bg-red-400', bgColor: 'bg-red-50', textColor: 'text-red-700' },
};

interface SendData {
  id: string;
  client_name: string;
  catalog_id: string;
  expires_at: string;
}

interface Collection {
  id: string;
  name: string;
  color: string;
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

interface Selection {
  product_id: string;
  note: string;
}

export default function ClientCatalogPage() {
  const params = useParams();
  const token = params.token as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sendData, setSendData] = useState<SendData | null>(null);
  const [catalogName, setCatalogName] = useState('');
  const [catalogDesc, setCatalogDesc] = useState('');
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selections, setSelections] = useState<Selection[]>([]);
  const [existingSelections, setExistingSelections] = useState<Selection[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [noteProduct, setNoteProduct] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');

  const fetchData = useCallback(async () => {
    const { data: payload, error: rpcError } = await anonClient
      .rpc('get_public_catalog_by_token', { p_token: token });

    if (rpcError || !payload) {
      setError('Ce lien est invalide ou a expire.');
      setLoading(false);
      return;
    }

    setSendData(payload.send);
    setCatalogName(payload.catalog?.name || '');
    setCatalogDesc(payload.catalog?.description || '');
    setCollections((payload.collections || []) as Collection[]);

    const existing = (payload.existing_selections || []) as Selection[];
    if (existing.length > 0) {
      setExistingSelections(existing);
      setSelections(existing);
      setSubmitted(true);
    }

    setLoading(false);
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function toggleSelection(productId: string) {
    if (submitted) return;
    setSelections((prev) => {
      const exists = prev.find((s) => s.product_id === productId);
      if (exists) return prev.filter((s) => s.product_id !== productId);
      return [...prev, { product_id: productId, note: '' }];
    });
  }

  function isSelected(productId: string) {
    return selections.some((s) => s.product_id === productId);
  }

  function openNote(productId: string) {
    const existing = selections.find((s) => s.product_id === productId);
    setNoteText(existing?.note || '');
    setNoteProduct(productId);
  }

  function saveNote() {
    if (!noteProduct) return;
    setSelections((prev) =>
      prev.map((s) => (s.product_id === noteProduct ? { ...s, note: noteText } : s))
    );
    setNoteProduct(null);
    setNoteText('');
  }

  async function handleSubmit() {
    if (!sendData || selections.length === 0) return;
    setSubmitting(true);

    const { data: ok, error: rpcErr } = await anonClient.rpc('record_catalog_selection', {
      p_token: token,
      p_selections: selections.map((s) => ({ product_id: s.product_id, note: s.note || '' })),
    });

    if (rpcErr || !ok) {
      setSubmitting(false);
      window.alert("Impossible d'enregistrer votre selection. Le lien est peut-etre expire ou deja utilise.");
      return;
    }

    setSubmitted(true);
    setSubmitting(false);
  }

  function formatPrice(price: number) {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(price);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#faf9f7] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#d35400]" />
          <p className="text-sm text-[#6b6560]">Chargement du catalogue...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#faf9f7] flex items-center justify-center px-6">
        <div className="max-w-md w-full text-center">
          <div className="h-16 w-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="h-8 w-8 text-red-500" />
          </div>
          <h1 className="text-xl font-semibold text-[#1a1a1a]">Lien invalide</h1>
          <p className="text-sm text-[#6b6560] mt-2">{error}</p>
        </div>
      </div>
    );
  }

  const totalSelected = selections.length;
  const totalPrice = selections.reduce((sum, s) => {
    const product = collections.flatMap((c) => c.products).find((p) => p.id === s.product_id);
    return sum + (product?.price || 0);
  }, 0);

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-[#e5e1da]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-[#d35400] flex items-center justify-center">
              <Hexagon className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-semibold text-[#1a1a1a]">Hellobat</span>
          </div>
          {sendData && (
            <div className="flex items-center gap-2 text-xs text-[#6b6560]">
              <Clock className="h-3.5 w-3.5" />
              Prepare pour {sendData.client_name}
            </div>
          )}
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="text-center mb-10">
          <h1 className="text-2xl sm:text-3xl font-semibold text-[#1a1a1a]">{catalogName}</h1>
          {catalogDesc && (
            <p className="text-sm sm:text-base text-[#6b6560] mt-2 max-w-2xl mx-auto leading-relaxed">{catalogDesc}</p>
          )}
          {!submitted && (
            <p className="text-xs text-[#6b6560]/60 mt-4">
              Cliquez sur les modeles qui vous interessent, puis validez votre selection.
            </p>
          )}
        </div>

        {submitted && existingSelections.length > 0 && (
          <div className="mb-8 p-5 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-start gap-4 animate-fade-up">
            <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
              <CheckCircle className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-emerald-800">Selection envoyee</h3>
              <p className="text-xs text-emerald-600 mt-1">
                Votre selection de {selections.length} modele{selections.length > 1 ? 's' : ''} a bien ete transmise. Votre artisan reviendra vers vous rapidement.
              </p>
            </div>
          </div>
        )}

        {collections.map((collection) => (
          <div key={collection.id} className="mb-10">
            <div className="flex items-center gap-3 mb-5">
              <div
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: collection.color }}
              />
              <h2 className="text-lg font-semibold text-[#1a1a1a]">{collection.name}</h2>
              <span className="text-xs text-[#6b6560]">
                {collection.products.length} modele{collection.products.length !== 1 ? 's' : ''}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {collection.products.map((product) => {
                const selected = isSelected(product.id);
                const avail = AVAILABILITY_MAP[product.availability] || AVAILABILITY_MAP.in_stock;
                const selection = selections.find((s) => s.product_id === product.id);

                return (
                  <div
                    key={product.id}
                    onClick={() => toggleSelection(product.id)}
                    className={cn(
                      'group rounded-2xl border overflow-hidden transition-all',
                      submitted ? 'cursor-default' : 'cursor-pointer',
                      selected
                        ? 'border-[#d35400] shadow-lg shadow-[#d35400]/10 ring-1 ring-[#d35400]/20'
                        : 'border-[#e5e1da] hover:shadow-md hover:border-[#d35400]/30',
                      submitted && !selected && 'opacity-40'
                    )}
                  >
                    <div className="relative aspect-[4/3] bg-[#f3f1ed] overflow-hidden">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className={cn(
                            'w-full h-full object-cover transition-transform duration-500',
                            !submitted && 'group-hover:scale-105'
                          )}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="h-12 w-12 text-[#e5e1da]" />
                        </div>
                      )}

                      {selected && (
                        <div className="absolute top-3 right-3 h-8 w-8 rounded-full bg-[#d35400] flex items-center justify-center shadow-lg animate-in zoom-in duration-200">
                          <Check className="h-4 w-4 text-white" />
                        </div>
                      )}

                      <div className={cn(
                        'absolute bottom-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
                        avail.bgColor, avail.textColor
                      )}>
                        <span className={cn('h-1.5 w-1.5 rounded-full', avail.dotColor)} />
                        {avail.label}
                      </div>
                    </div>

                    <div className="p-4">
                      <h3 className="text-sm font-semibold text-[#1a1a1a]">{product.name}</h3>
                      {product.description && (
                        <p className="text-xs text-[#6b6560] mt-1 line-clamp-2 leading-relaxed">{product.description}</p>
                      )}
                      <div className="flex items-center justify-between mt-3">
                        <span className="text-lg font-bold text-[#d35400]">{formatPrice(product.price)}</span>
                        {selected && !submitted && (
                          <button
                            onClick={(e) => { e.stopPropagation(); openNote(product.id); }}
                            className={cn(
                              'h-7 px-2.5 rounded-md text-xs font-medium flex items-center gap-1 transition-all',
                              selection?.note
                                ? 'bg-[#d35400]/10 text-[#d35400]'
                                : 'bg-[#f3f1ed] text-[#6b6560] hover:bg-[#e5e1da]'
                            )}
                          >
                            <MessageSquare className="h-3 w-3" />
                            {selection?.note ? 'Note' : 'Ajouter une note'}
                          </button>
                        )}
                        {selected && submitted && selection?.note && (
                          <span className="text-xs text-[#6b6560] italic max-w-[120px] truncate">
                            &ldquo;{selection.note}&rdquo;
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {!submitted && totalSelected > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-[#e5e1da] shadow-lg animate-in slide-in-from-bottom duration-300">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-[#d35400]/10 flex items-center justify-center">
                <ShoppingBag className="h-5 w-5 text-[#d35400]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#1a1a1a]">
                  {totalSelected} modele{totalSelected > 1 ? 's' : ''} selectionne{totalSelected > 1 ? 's' : ''}
                </p>
                <p className="text-xs text-[#6b6560]">
                  Total : {formatPrice(totalPrice)}
                </p>
              </div>
            </div>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="h-11 px-6 rounded-xl bg-[#d35400] text-white font-medium text-sm flex items-center gap-2 hover:bg-[#b94800] disabled:opacity-70 transition-all shadow-lg shadow-[#d35400]/20"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Valider ma selection
            </button>
          </div>
        </div>
      )}

      {noteProduct && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#1a1a1a]">Ajouter une note</h3>
              <button onClick={() => setNoteProduct(null)} className="text-[#6b6560] hover:text-[#1a1a1a]">
                <X className="h-4 w-4" />
              </button>
            </div>
            <textarea
              autoFocus
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Ex : Je préfère en blanc, ou une taille XL…"
              rows={3}
              className="w-full rounded-xl border border-[#e5e1da] p-3 text-sm text-[#1a1a1a] placeholder:text-[#6b6560]/40 outline-none focus:ring-2 focus:ring-[#d35400]/20 focus:border-[#d35400] resize-none"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setNoteProduct(null)}
                className="h-9 px-4 rounded-lg text-sm text-[#6b6560] hover:text-[#1a1a1a]"
              >
                Annuler
              </button>
              <button
                onClick={saveNote}
                className="h-9 px-5 rounded-lg bg-[#d35400] text-white text-sm font-medium hover:bg-[#b94800] transition-all"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="border-t border-[#e5e1da] py-6 mt-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded bg-[#d35400] flex items-center justify-center">
              <Hexagon className="h-3 w-3 text-white" />
            </div>
            <span className="text-xs font-medium text-[#6b6560]">Hellobat</span>
          </div>
          <p className="text-xs text-[#6b6560]/50">Catalogue professionnel</p>
        </div>
      </footer>
    </div>
  );
}
