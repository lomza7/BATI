'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft,
  Plus,
  X,
  Check,
  Eye,
  Package,
  BookmarkPlus,
  RefreshCw,
  Search,
  Save,
  Receipt,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { QUOTE_UNITS, formatCurrency } from '@/lib/constants';
import { LINE_TVA_RATES, computeTvaBreakdown, formatTvaRate } from '@/lib/tva';
import { computeDepositAmount } from '@/lib/invoices/deposits';
import { ClientPicker } from '@/components/shared/client-picker';
import { BankAccountPicker } from '@/components/shared/bank-account-picker';
import { DocumentPreviewDialog } from '@/components/shared/document-preview-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

interface QuoteLine {
  description: string;
  detail?: string;
  quantity: number;
  unit: string;
  unit_price: number;
  tva_rate: number;
  section?: string;
  is_recurring?: boolean;
  frequency?: string;
  _savedAsPrestation?: boolean;
  _savingAsPrestation?: boolean;
}

interface Service {
  id: string;
  name: string;
  description: string;
  unit: string;
  unit_price: number;
  category: string;
  tva_rate: number | null;
  section: string;
  is_recurring: boolean;
  frequency: string;
}

export default function ModifierDevisPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const quoteId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [quoteNumber, setQuoteNumber] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string | null>(null);
  const [validUntil, setValidUntil] = useState('');
  const [lines, setLines] = useState<QuoteLine[]>([]);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [isRecurringQuote, setIsRecurringQuote] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState('annuel');
  const [depositPercentage, setDepositPercentage] = useState<string>('');
  const [projectId, setProjectId] = useState<string | null>(null);

  // Service catalog
  const [services, setServices] = useState<Service[]>([]);
  const [serviceSearch, setServiceSearch] = useState('');
  const [serviceSectionFilter, setServiceSectionFilter] = useState<'all' | 'materiel' | 'main_oeuvre'>('all');
  const [addedServiceIds, setAddedServiceIds] = useState<Set<string>>(new Set());
  const [showServicePanel, setShowServicePanel] = useState(true);
  const serviceSearchRef = useRef<HTMLInputElement>(null);
  const [autocompleteIndex, setAutocompleteIndex] = useState<number | null>(null);
  const autocompleteRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    loadQuote();
    loadServices();
  }, [quoteId]);

  async function loadQuote() {
    if (!quoteId) return;

    const [quoteRes, linesRes] = await Promise.all([
      supabase
        .from('quotes')
        .select('*')
        .eq('id', quoteId)
        .single(),
      supabase
        .from('quote_lines')
        .select('*')
        .eq('quote_id', quoteId)
        .order('position'),
    ]);

    if (!quoteRes.data) {
      router.push('/devis');
      return;
    }

    const q = quoteRes.data;

    // Check if quote is signed — if so, redirect back
    const { data: signedSend } = await supabase
      .from('quote_sends')
      .select('signed_at')
      .eq('quote_id', quoteId)
      .not('signed_at', 'is', null)
      .limit(1);

    if (signedSend && signedSend.length > 0) {
      router.push('/devis');
      return;
    }

    setQuoteNumber(q.quote_number || '');
    setTitle(q.title || '');
    setDescription(q.description || '');
    setSelectedClientId(q.client_id || null);
    setSelectedBankAccountId(q.bank_account_id || null);
    setValidUntil(q.valid_until || '');
    setIsRecurringQuote(q.is_recurring || false);
    setRecurringFrequency(q.recurring_frequency || 'annuel');
    setDepositPercentage(q.deposit_percentage ? String(q.deposit_percentage) : '');
    setProjectId(q.project_id || null);

    const loadedLines: QuoteLine[] = (linesRes.data || []).map((l: Record<string, unknown>) => ({
      description: (l.description as string) || '',
      detail: (l.detail as string) || '',
      quantity: (l.quantity as number) || 1,
      unit: (l.unit as string) || 'u',
      unit_price: (l.unit_price as number) || 0,
      tva_rate: (l.tva_rate as number) ?? 20,
      section: (l.section as string) || undefined,
    }));

    if (loadedLines.length === 0) {
      loadedLines.push({ description: '', quantity: 1, unit: 'u', unit_price: 0, tva_rate: 20 });
    }

    setLines(loadedLines);
    setLoading(false);
  }

  async function loadServices() {
    const { data } = await supabase
      .from('services')
      .select('id, name, description, unit, unit_price, category, tva_rate, section, is_recurring, frequency')
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('category')
      .order('name');
    setServices((data as Service[]) || []);
  }

  function addLine() {
    setLines([...lines, { description: '', quantity: 1, unit: 'u', unit_price: 0, tva_rate: 20 }]);
  }

  function updateLine(index: number, field: keyof QuoteLine, value: string | number) {
    const updated = [...lines];
    (updated[index] as unknown as Record<string, string | number>)[field] = value;
    setLines(updated);
    if (field === 'description') {
      setAutocompleteIndex(typeof value === 'string' && value.trim().length >= 1 ? index : null);
    }
  }

  function getAutocompleteSuggestions(query: string): Service[] {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return services.filter(s => s.name.toLowerCase().includes(q)).slice(0, 6);
  }

  function applySuggestion(lineIndex: number, s: Service) {
    const updated = [...lines];
    updated[lineIndex] = {
      ...updated[lineIndex],
      description: s.name,
      detail: s.description || updated[lineIndex].detail || '',
      unit: s.unit,
      unit_price: s.unit_price,
      tva_rate: s.tva_rate ?? 20,
      section: s.section || 'materiel',
      is_recurring: s.is_recurring,
      frequency: s.frequency,
      _savedAsPrestation: true,
    };
    setLines(updated);
    setAutocompleteIndex(null);
    setAddedServiceIds(prev => new Set(prev).add(s.id));
  }

  function removeLine(index: number) {
    if (lines.length > 1) {
      setLines(lines.filter((_, i) => i !== index));
    }
  }

  function pickService(s: Service) {
    const newLine: QuoteLine = {
      description: s.name,
      detail: s.description || '',
      quantity: 1,
      unit: s.unit,
      unit_price: s.unit_price,
      tva_rate: s.tva_rate ?? 20,
      section: s.section || 'materiel',
      is_recurring: s.is_recurring,
      frequency: s.frequency,
      _savedAsPrestation: true,
    };
    setLines(prev => [...prev, newLine]);
    setAddedServiceIds(prev => new Set(prev).add(s.id));
  }

  async function saveLineAsPrestation(index: number) {
    if (!user) return;
    const line = lines[index];
    if (!line.description.trim() || line.unit_price <= 0 || line._savedAsPrestation || line._savingAsPrestation) return;

    setLines(prev => prev.map((l, i) => i === index ? { ...l, _savingAsPrestation: true } : l));

    const name = line.description.trim().slice(0, 80);
    const svcDescription = line.detail?.trim() || '';

    const { error } = await supabase.from('services').insert({
      user_id: user.id,
      name,
      description: svcDescription,
      unit: line.unit || 'u',
      unit_price: line.unit_price,
      category: '',
      section: line.section || 'materiel',
      tva_rate: 20,
      is_recurring: false,
      is_active: true,
    });

    setLines(prev => prev.map((l, i) => i === index
      ? { ...l, _savingAsPrestation: false, _savedAsPrestation: !error }
      : l
    ));

    if (!error) loadServices();
  }

  async function saveQuote() {
    if (!user || saving) return;
    setSaving(true);

    try {
      const validLines = lines.filter(l => l.description.trim());
      const tva = computeTvaBreakdown(validLines);
      const totalHt = tva.total_ht;
      const totalTva = tva.total_tva;
      const totalTtc = tva.total_ttc;

      await supabase
        .from('quotes')
        .update({
          client_id: selectedClientId,
          project_id: projectId,
          bank_account_id: selectedBankAccountId,
          title,
          description,
          total_ht: totalHt,
          total_tva: totalTva,
          total_ttc: totalTtc,
          tva_rate: tva.primary_rate,
          tva_breakdown: tva.tva_breakdown,
          valid_until: validUntil || null,
          is_recurring: isRecurringQuote,
          recurring_frequency: recurringFrequency,
          deposit_percentage: depositPercentage ? parseFloat(depositPercentage) : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', quoteId);

      // Replace all lines
      await supabase.from('quote_lines').delete().eq('quote_id', quoteId);
      if (validLines.length > 0) {
        await supabase.from('quote_lines').insert(
          validLines.map((l, i) => ({
            user_id: user.id,
            quote_id: quoteId,
            description: l.description,
            detail: l.detail || null,
            quantity: l.quantity,
            unit: l.unit,
            unit_price: l.unit_price,
            tva_rate: l.tva_rate,
            section: l.section || null,
            total: l.quantity * l.unit_price,
            position: i,
          }))
        );
      }

      // Update lead value if exists
      await supabase
        .from('leads')
        .update({ value: totalTtc, name: title || `Devis ${quoteNumber}`, updated_at: new Date().toISOString() })
        .eq('quote_id', quoteId);

      router.push('/devis');
    } finally {
      setSaving(false);
    }
  }

  // Service filtering
  let filteredServices = serviceSectionFilter !== 'all'
    ? services.filter(s => (s.section || 'materiel') === serviceSectionFilter)
    : services;
  if (serviceSearch) {
    const q = serviceSearch.toLowerCase();
    filteredServices = filteredServices.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.category.toLowerCase().includes(q)
    );
  }

  const groupedServices = new Map<string, Service[]>();
  for (const s of filteredServices) {
    const cat = s.category || 'Sans categorie';
    if (!groupedServices.has(cat)) groupedServices.set(cat, []);
    groupedServices.get(cat)!.push(s);
  }

  const linesTotals = computeTvaBreakdown(lines.filter(l => l.description.trim()));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Chargement du devis...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 -my-5 lg:-my-8 flex flex-col min-h-[100dvh] sm:h-screen">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-2 px-3 sm:px-6 py-2.5 sm:py-3 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9 shrink-0" onClick={() => router.push('/devis')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-semibold text-foreground truncate">Modifier le devis {quoteNumber}</h1>
            <p className="text-[11px] sm:text-xs text-muted-foreground hidden sm:block">Modifiez les informations et les prestations</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPreview(true)}
            disabled={!title.trim() && lines.every(l => !l.description.trim())}
            className="gap-1.5 hidden sm:flex"
          >
            <Eye className="h-3.5 w-3.5" />
            Apercu
          </Button>
          <Button size="sm" onClick={saveQuote} disabled={!title.trim() || saving} className="gap-1.5 text-xs sm:text-sm">
            <Save className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{saving ? 'Enregistrement...' : 'Enregistrer'}</span>
            <span className="sm:hidden">{saving ? '...' : 'Enregistrer'}</span>
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col sm:flex-row sm:overflow-hidden">
        {/* Form */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6">
          <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
            {/* Header fields */}
            <div className="space-y-3 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-4">
              <div>
                <label className="text-sm font-medium text-foreground">Titre du devis</label>
                <Input
                  className="mt-1"
                  placeholder="Ex: Renovation salle de bain"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Client</label>
                <ClientPicker
                  className="mt-1"
                  value={selectedClientId}
                  onChange={setSelectedClientId}
                />
              </div>
            </div>

            <div className="space-y-3 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-4">
              <div>
                <label htmlFor="quote-valid-until" className="text-sm font-medium text-foreground">
                  Valable jusqu&apos;au
                </label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    id="quote-valid-until"
                    type="date"
                    className="h-9 flex-1 sm:flex-none sm:w-auto sm:max-w-[180px]"
                    value={validUntil}
                    onChange={e => setValidUntil(e.target.value)}
                  />
                </div>
              </div>
              <BankAccountPicker
                value={selectedBankAccountId}
                onChange={setSelectedBankAccountId}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">Description</label>
              <textarea
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                rows={2}
                placeholder="Details supplementaires..."
                value={description}
                onChange={e => setDescription(e.target.value)}
              />
            </div>

            {/* Recurring contract toggle */}
            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-xl border border-border p-3">
                <div className="flex items-center gap-2.5">
                  <RefreshCw className="h-4 w-4 text-[#d35400]" />
                  <div>
                    <p className="text-sm font-medium">Contrat récurrent</p>
                    <p className="text-xs text-muted-foreground">Ce devis créera un contrat avec facturation automatique</p>
                  </div>
                </div>
                <Switch checked={isRecurringQuote} onCheckedChange={setIsRecurringQuote} />
              </div>
              {isRecurringQuote && (
                <div className="rounded-lg bg-orange-50/70 border border-orange-200/60 p-3 space-y-2">
                  <div className="flex items-center gap-3">
                    <label className="text-xs font-medium text-orange-800 whitespace-nowrap">Fréquence :</label>
                    <select
                      value={recurringFrequency}
                      onChange={e => setRecurringFrequency(e.target.value)}
                      className="h-8 rounded-md border border-orange-200 bg-white px-2 text-xs text-orange-900"
                    >
                      <option value="mensuel">Mensuel</option>
                      <option value="trimestriel">Trimestriel</option>
                      <option value="annuel">Annuel</option>
                    </select>
                  </div>
                  <p className="text-[11px] text-orange-700 leading-relaxed">
                    Une fois signé par le client, un contrat récurrent sera créé et des factures seront générées automatiquement à chaque échéance.
                  </p>
                </div>
              )}
            </div>

            {/* Acompte */}
            <div className="rounded-xl border border-border p-3 space-y-2">
              <div className="flex items-center gap-2.5">
                <Receipt className="h-4 w-4 text-[#d35400]" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Acompte à la signature</p>
                  <p className="text-xs text-muted-foreground">Le client verra le montant de l&apos;acompte sur le devis</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {[30, 40, 50].map(pct => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setDepositPercentage(depositPercentage === String(pct) ? '' : String(pct))}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                      depositPercentage === String(pct)
                        ? 'bg-[#d35400] text-white'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    )}
                  >
                    {pct}%
                  </button>
                ))}
                <div className="relative">
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    step="any"
                    placeholder="Autre %"
                    value={depositPercentage && ![30, 40, 50].includes(Number(depositPercentage)) ? depositPercentage : ''}
                    onChange={e => {
                      const v = e.target.value;
                      if (v === '' || (Number(v) > 0 && Number(v) <= 100)) setDepositPercentage(v);
                    }}
                    className="h-8 w-24 text-xs pr-6"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                </div>
                {depositPercentage && (
                  <button type="button" onClick={() => setDepositPercentage('')} className="text-muted-foreground hover:text-destructive transition-colors">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              {depositPercentage && Number(depositPercentage) > 0 && linesTotals.total_ht > 0 && (
                <p className="text-xs text-[#d35400] font-medium">
                  Soit {formatCurrency(computeDepositAmount('percentage', Number(depositPercentage), linesTotals.total_ht, linesTotals.tva_breakdown[0]?.rate ?? 20).total_ttc)} TTC à la signature
                </p>
              )}
            </div>

            {/* Lines */}
            <div>
              <div className="flex items-center justify-between mb-3 gap-2">
                <label className="text-sm font-medium text-foreground">Lignes du devis</label>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowServicePanel(true);
                      setTimeout(() => serviceSearchRef.current?.focus(), 100);
                    }}
                    className="gap-1 sm:hidden text-xs"
                  >
                    <Package className="h-3 w-3" /> Prestations
                  </Button>
                  <Button variant="outline" size="sm" onClick={addLine} className="gap-1 text-xs">
                    <Plus className="h-3 w-3" /> Ligne
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                {lines.map((line, i) => (
                  <div key={i} className="rounded-lg border border-border bg-card p-2.5 sm:p-3">
                    {/* Mobile: stacked layout */}
                    <div className="sm:hidden space-y-2">
                      <div className="flex items-start gap-2">
                        <div className="flex-1 space-y-1.5">
                          <div className="relative" ref={el => { autocompleteRefs.current[i] = el; }}>
                            <Input
                              placeholder="Nom de la prestation"
                              value={line.description}
                              onChange={e => updateLine(i, 'description', e.target.value)}
                              onFocus={() => { if (line.description.trim().length >= 1) setAutocompleteIndex(i); }}
                              onBlur={() => setTimeout(() => setAutocompleteIndex(null), 150)}
                              className="text-sm"
                            />
                            {autocompleteIndex === i && line.description.trim().length >= 1 && (
                              <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-md border border-border bg-popover shadow-md max-h-48 overflow-y-auto">
                                {getAutocompleteSuggestions(line.description).map(s => (
                                  <button
                                    key={s.id}
                                    type="button"
                                    onMouseDown={e => e.preventDefault()}
                                    onClick={() => applySuggestion(i, s)}
                                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors flex items-center justify-between gap-2"
                                  >
                                    <span className="truncate font-medium">{s.name}</span>
                                    <span className="text-xs text-muted-foreground shrink-0">{formatCurrency(s.unit_price)}/{s.unit}</span>
                                  </button>
                                ))}
                                {!line._savedAsPrestation && !services.some(s => s.name.toLowerCase() === line.description.trim().toLowerCase()) && (
                                  <button
                                    type="button"
                                    onMouseDown={e => e.preventDefault()}
                                    onClick={() => { setAutocompleteIndex(null); saveLineAsPrestation(i); }}
                                    className="w-full text-left px-3 py-2 text-sm border-t border-border hover:bg-muted transition-colors flex items-center gap-2 text-primary"
                                  >
                                    <BookmarkPlus className="h-3.5 w-3.5 shrink-0" />
                                    <span>Enregistrer &laquo;{line.description.trim().slice(0, 40)}&raquo; comme prestation</span>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                          <textarea
                            placeholder="Detail (optionnel) — ex: marque, couleur, specifications..."
                            value={line.detail || ''}
                            onChange={e => updateLine(i, 'detail', e.target.value)}
                            className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                            rows={1}
                          />
                        </div>
                        <div className="flex items-center gap-1 pt-1.5 shrink-0">
                          {line._savedAsPrestation ? (
                            <span className="text-emerald-600"><Check className="h-4 w-4" /></span>
                          ) : line.description.trim() && line.unit_price > 0 ? (
                            <button type="button" onClick={() => saveLineAsPrestation(i)} disabled={line._savingAsPrestation} className="text-muted-foreground hover:text-primary disabled:opacity-50">
                              {line._savingAsPrestation ? <RefreshCw className="h-4 w-4 animate-spin" /> : <BookmarkPlus className="h-4 w-4" />}
                            </button>
                          ) : null}
                          <button onClick={() => removeLine(i)} className="text-muted-foreground hover:text-destructive">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        <div>
                          <label className="text-[10px] text-muted-foreground mb-0.5 block">Qte</label>
                          <Input type="number" value={line.quantity || ''} onChange={e => updateLine(i, 'quantity', Number(e.target.value))} className="h-9 text-sm" />
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground mb-0.5 block">Unite</label>
                          <Select value={line.unit || 'u'} onValueChange={(val) => updateLine(i, 'unit', val)}>
                            <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {QUOTE_UNITS.map((u) => (<SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground mb-0.5 block">Prix HT</label>
                          <Input type="number" placeholder="0" value={line.unit_price || ''} onChange={e => updateLine(i, 'unit_price', Number(e.target.value))} className="h-9 text-sm" />
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground mb-0.5 block">TVA</label>
                          <Select value={String(line.tva_rate ?? 20)} onValueChange={(val) => updateLine(i, 'tva_rate', Number(val))}>
                            <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {LINE_TVA_RATES.map((r) => (<SelectItem key={r} value={String(r)}>{formatTvaRate(r)}</SelectItem>))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      {line.description.trim() && line.unit_price > 0 && (
                        <p className="text-right text-xs text-muted-foreground">{formatCurrency(line.quantity * line.unit_price)} HT</p>
                      )}
                    </div>

                    {/* Desktop: grid layout */}
                    <div className="hidden sm:block">
                      <div className="grid grid-cols-12 gap-2 items-start">
                        <div className="col-span-5 space-y-1">
                          <div className="relative" ref={el => { autocompleteRefs.current[i + 1000] = el; }}>
                            <Input
                              placeholder="Nom de la prestation"
                              value={line.description}
                              onChange={e => updateLine(i, 'description', e.target.value)}
                              onFocus={() => { if (line.description.trim().length >= 1) setAutocompleteIndex(i); }}
                              onBlur={() => setTimeout(() => setAutocompleteIndex(null), 150)}
                            />
                            {autocompleteIndex === i && line.description.trim().length >= 1 && (
                              <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-md border border-border bg-popover shadow-md max-h-52 overflow-y-auto">
                                {getAutocompleteSuggestions(line.description).map(s => (
                                  <button
                                    key={s.id}
                                    type="button"
                                    onMouseDown={e => e.preventDefault()}
                                    onClick={() => applySuggestion(i, s)}
                                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors flex items-center justify-between gap-3"
                                  >
                                    <div className="truncate">
                                      <span className="font-medium">{s.name}</span>
                                      {s.description && <span className="text-muted-foreground ml-2 text-xs">{s.description.slice(0, 50)}</span>}
                                    </div>
                                    <span className="text-xs text-muted-foreground shrink-0">{formatCurrency(s.unit_price)}/{s.unit}</span>
                                  </button>
                                ))}
                                {!line._savedAsPrestation && !services.some(s => s.name.toLowerCase() === line.description.trim().toLowerCase()) && (
                                  <button
                                    type="button"
                                    onMouseDown={e => e.preventDefault()}
                                    onClick={() => { setAutocompleteIndex(null); saveLineAsPrestation(i); }}
                                    className="w-full text-left px-3 py-2 text-sm border-t border-border hover:bg-muted transition-colors flex items-center gap-2 text-primary"
                                  >
                                    <BookmarkPlus className="h-3.5 w-3.5 shrink-0" />
                                    <span>Enregistrer &laquo;{line.description.trim().slice(0, 40)}&raquo; comme prestation</span>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                          <textarea
                            placeholder="Detail (optionnel) — ex: marque, couleur, specifications..."
                            value={line.detail || ''}
                            onChange={e => updateLine(i, 'detail', e.target.value)}
                            className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                            rows={1}
                          />
                        </div>
                        <div className="col-span-1">
                          <Input type="number" placeholder="Qte" value={line.quantity || ''} onChange={e => updateLine(i, 'quantity', Number(e.target.value))} />
                        </div>
                        <div className="col-span-2">
                          <Select value={line.unit || 'u'} onValueChange={(val) => updateLine(i, 'unit', val)}>
                            <SelectTrigger className="h-10"><SelectValue placeholder="Unite" /></SelectTrigger>
                            <SelectContent>
                              {QUOTE_UNITS.map((u) => (<SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-2">
                          <Input type="number" placeholder="Prix HT" value={line.unit_price || ''} onChange={e => updateLine(i, 'unit_price', Number(e.target.value))} />
                        </div>
                        <div className="col-span-1">
                          <Select value={String(line.tva_rate ?? 20)} onValueChange={(val) => updateLine(i, 'tva_rate', Number(val))}>
                            <SelectTrigger className="h-10" title="Taux de TVA"><SelectValue placeholder="TVA" /></SelectTrigger>
                            <SelectContent>
                              {LINE_TVA_RATES.map((r) => (<SelectItem key={r} value={String(r)}>{formatTvaRate(r)}</SelectItem>))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-1 flex items-center gap-1 pt-2 justify-end">
                          {line._savedAsPrestation ? (
                            <span title="Enregistree dans vos prestations" className="text-emerald-600"><Check className="h-4 w-4" /></span>
                          ) : line.description.trim() && line.unit_price > 0 ? (
                            <button type="button" onClick={() => saveLineAsPrestation(i)} disabled={line._savingAsPrestation} title="Enregistrer dans mes prestations" className="text-muted-foreground hover:text-primary transition-colors disabled:opacity-50">
                              {line._savingAsPrestation ? <RefreshCw className="h-4 w-4 animate-spin" /> : <BookmarkPlus className="h-4 w-4" />}
                            </button>
                          ) : null}
                          <button onClick={() => removeLine(i)} className="text-muted-foreground hover:text-destructive transition-colors">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      {line.description.trim() && line.unit_price > 0 && (
                        <div className="flex justify-end mt-1.5">
                          <span className="text-xs text-muted-foreground">{formatCurrency(line.quantity * line.unit_price)} HT</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <Button variant="outline" size="sm" onClick={addLine} className="gap-1 mt-3 w-full text-xs sm:text-sm">
                <Plus className="h-3 w-3" /> Ajouter une ligne
              </Button>
            </div>

            {/* Totals */}
            <div className="flex items-start justify-between gap-3 sm:gap-4 rounded-xl bg-muted/50 border border-border p-3 sm:p-5">
              <div className="text-xs sm:text-sm text-muted-foreground space-y-1 sm:space-y-1.5 flex-1 min-w-0">
                <p>HT : <span className="text-foreground font-medium">{formatCurrency(linesTotals.total_ht)}</span></p>
                {linesTotals.tva_breakdown.length === 0 ? (
                  <p>TVA : <span className="text-foreground font-medium">{formatCurrency(0)}</span></p>
                ) : linesTotals.tva_breakdown.length === 1 ? (
                  <p>
                    TVA {formatTvaRate(linesTotals.tva_breakdown[0].rate)} :{' '}
                    <span className="text-foreground font-medium">{formatCurrency(linesTotals.tva_breakdown[0].tva_amount)}</span>
                  </p>
                ) : (
                  <div className="space-y-0.5">
                    {linesTotals.tva_breakdown.map((b) => (
                      <p key={b.rate} className="text-[11px] sm:text-xs">
                        TVA {formatTvaRate(b.rate)} sur {formatCurrency(b.base_ht)} :{' '}
                        <span className="text-foreground font-medium">{formatCurrency(b.tva_amount)}</span>
                      </p>
                    ))}
                    <p className="text-[11px] sm:text-xs pt-0.5 border-t border-border/50 mt-1">
                      Total TVA : <span className="text-foreground font-medium">{formatCurrency(linesTotals.total_tva)}</span>
                    </p>
                  </div>
                )}
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-[10px] sm:text-xs text-muted-foreground">Total TTC</p>
                <p className="text-xl sm:text-3xl font-bold text-foreground">{formatCurrency(linesTotals.total_ttc)}</p>
              </div>
            </div>

            {/* Bottom actions (mobile) */}
            <div className="flex gap-2 sm:hidden pb-6">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 gap-1.5"
                onClick={() => setShowPreview(true)}
                disabled={!title.trim() && lines.every(l => !l.description.trim())}
              >
                <Eye className="h-3.5 w-3.5" />
                Apercu
              </Button>
              <Button size="sm" className="flex-1 gap-1.5" onClick={saveQuote} disabled={!title.trim() || saving}>
                <Save className="h-3.5 w-3.5" />
                {saving ? '...' : 'Enregistrer'}
              </Button>
            </div>
          </div>
        </div>

        {/* Service catalog sidebar — desktop */}
        <div className="hidden sm:flex flex-col w-[340px] lg:w-[380px] border-l border-border bg-card shrink-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2 mb-2">
              <Package className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Mes prestations</h2>
            </div>
            <p className="text-xs text-muted-foreground mb-2">Cliquez pour ajouter au devis</p>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={serviceSearchRef}
                placeholder="Rechercher..."
                value={serviceSearch}
                onChange={e => setServiceSearch(e.target.value)}
                className="pl-9 h-8 text-sm"
              />
            </div>
            <div className="flex gap-1 mt-2">
              {([['all', 'Tout'], ['materiel', 'Matériaux'], ['main_oeuvre', "Main d'oeuvre"]] as const).map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setServiceSectionFilter(val)}
                  className={cn(
                    'flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors',
                    serviceSectionFilter === val
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <ServiceList
            services={services}
            filteredServices={filteredServices}
            groupedServices={groupedServices}
            addedServiceIds={addedServiceIds}
            onPick={pickService}
          />
        </div>

        {/* Mobile: bottom sheet overlay */}
        {showServicePanel && (
          <div className="sm:hidden fixed inset-0 z-50 flex flex-col">
            <div className="flex-1 bg-black/40" onClick={() => setShowServicePanel(false)} />
            <div className="bg-card rounded-t-2xl border-t border-border max-h-[75dvh] flex flex-col animate-in slide-in-from-bottom duration-200">
              <div className="px-4 pt-3 pb-2 border-b border-border">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-primary" />
                    <h2 className="text-sm font-semibold text-foreground">Mes prestations</h2>
                  </div>
                  <button type="button" onClick={() => setShowServicePanel(false)} className="text-muted-foreground hover:text-foreground p-1">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mb-2">Touchez pour ajouter au devis</p>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher..."
                    value={serviceSearch}
                    onChange={e => setServiceSearch(e.target.value)}
                    className="pl-9 h-9 text-sm"
                    autoFocus
                  />
                </div>
                <div className="flex gap-1 mt-2">
                  {([['all', 'Tout'], ['materiel', 'Matériaux'], ['main_oeuvre', "Main d'oeuvre"]] as const).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setServiceSectionFilter(val)}
                      className={cn(
                        'flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
                        serviceSectionFilter === val
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <ServiceList
                services={services}
                filteredServices={filteredServices}
                groupedServices={groupedServices}
                addedServiceIds={addedServiceIds}
                onPick={(s) => { pickService(s); }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Preview dialog */}
      <DocumentPreviewDialog
        mode="quote"
        open={showPreview}
        onClose={() => setShowPreview(false)}
        title={title}
        description={description}
        lines={lines}
        clientId={selectedClientId}
        bankAccountId={selectedBankAccountId}
        depositPercentage={depositPercentage ? parseFloat(depositPercentage) : null}
      />
    </div>
  );
}

/* ── Shared service list ── */

function ServiceList({
  services,
  filteredServices,
  groupedServices,
  addedServiceIds,
  onPick,
}: {
  services: Service[];
  filteredServices: Service[];
  groupedServices: Map<string, Service[]>;
  addedServiceIds: Set<string>;
  onPick: (s: Service) => void;
}) {
  return (
    <div className="flex-1 overflow-y-auto px-2 py-2">
      {services.length === 0 ? (
        <div className="text-center py-10 text-sm text-muted-foreground">
          <Package className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p>Aucune prestation enregistree.</p>
          <p className="text-xs mt-1">Allez dans &quot;Mes prestations&quot; pour en creer.</p>
        </div>
      ) : filteredServices.length === 0 ? (
        <div className="text-center py-6 text-sm text-muted-foreground">Aucun resultat.</div>
      ) : (
        <div className="space-y-3">
          {Array.from(groupedServices.entries()).map(([category, items]) => (
            <div key={category}>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 px-2">
                {category}
              </p>
              <div className="space-y-0.5">
                {items.map(s => {
                  const isAdded = addedServiceIds.has(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 sm:py-2 text-left transition-colors ${
                        isAdded ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'hover:bg-accent active:bg-accent'
                      }`}
                      onClick={() => onPick(s)}
                    >
                      <div className={`flex h-8 w-8 sm:h-7 sm:w-7 shrink-0 items-center justify-center rounded-md ${
                        isAdded ? 'bg-emerald-100 text-emerald-600' : 'bg-primary/10 text-primary'
                      }`}>
                        {isAdded ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium truncate">{s.name}</p>
                          {s.is_recurring && (
                            <Badge variant="outline" className="gap-0.5 text-[9px] px-1 py-0 border-primary/30 text-primary shrink-0">
                              <RefreshCw className="h-2 w-2" /> {s.frequency === 'mensuel' ? '/mois' : s.frequency === 'trimestriel' ? '/trim.' : '/an'}
                            </Badge>
                          )}
                        </div>
                        {s.description && (
                          <p className="text-[11px] text-muted-foreground truncate">{s.description}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-semibold">{formatCurrency(s.unit_price)}</p>
                        <p className="text-[9px] text-muted-foreground">/ {s.unit}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
