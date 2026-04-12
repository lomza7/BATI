'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
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
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { QUOTE_UNITS, formatCurrency } from '@/lib/constants';
import { LINE_TVA_RATES, computeTvaBreakdown, formatTvaRate } from '@/lib/tva';
import { QUOTE_SECTIONS } from '@/lib/quote-sections';
import { getNextQuoteNumber } from '@/lib/document-numbers';
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
  is_recurring: boolean;
  frequency: string;
}

function getDefaultValidUntil(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function NouveauDevisPage() {
  const { user } = useAuth();
  const router = useRouter();
  const draftId = useRef<string | null>(null);
  const prefillProjectId = useRef<string | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string | null>(null);
  const [validUntil, setValidUntil] = useState(getDefaultValidUntil());
  const [lines, setLines] = useState<QuoteLine[]>([
    { description: '', quantity: 1, unit: 'u', unit_price: 0, tva_rate: 20, section: 'materiel' },
  ]);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Service catalog (inline sidebar)
  const [services, setServices] = useState<Service[]>([]);
  const [serviceSearch, setServiceSearch] = useState('');
  const [addedServiceIds, setAddedServiceIds] = useState<Set<string>>(new Set());
  const [showServicePanel, setShowServicePanel] = useState(true);
  const [isRecurringQuote, setIsRecurringQuote] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState('annuel');
  const serviceSearchRef = useRef<HTMLInputElement>(null);

  // Prefill from URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paramClientId = params.get('client_id');
    const paramProjectId = params.get('project_id');
    if (paramClientId) setSelectedClientId(paramClientId);
    if (paramProjectId) prefillProjectId.current = paramProjectId;
  }, []);

  // Load services for the sidebar
  useEffect(() => {
    loadServices();
  }, []);

  async function loadServices() {
    const { data } = await supabase
      .from('services')
      .select('id, name, description, unit, unit_price, category, tva_rate, is_recurring, frequency')
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('category')
      .order('name');
    setServices((data as Service[]) || []);
  }

  // Auto-save draft when client is selected
  async function autosaveDraft(clientId: string) {
    if (!user || draftId.current) return;
    const quoteNumber = await getNextQuoteNumber(supabase, user.id);
    const { data } = await supabase
      .from('quotes')
      .insert({
        user_id: user.id,
        quote_number: quoteNumber,
        client_id: clientId,
        project_id: prefillProjectId.current || null,
        bank_account_id: selectedBankAccountId,
        title: title || '',
        description: description || '',
        status: 'brouillon',
        total_ht: 0,
        total_ttc: 0,
        valid_until: validUntil,
      })
      .select('id')
      .single();
    if (data) draftId.current = data.id;
  }

  function handleClientSelect(clientId: string | null) {
    setSelectedClientId(clientId);
    if (clientId && !draftId.current) {
      autosaveDraft(clientId);
    }
  }

  function addLine() {
    setLines([...lines, { description: '', quantity: 1, unit: 'u', unit_price: 0, tva_rate: 20, section: 'materiel' }]);
  }

  function updateLine(index: number, field: keyof QuoteLine, value: string | number) {
    const updated = [...lines];
    (updated[index] as unknown as Record<string, string | number>)[field] = value;
    setLines(updated);
  }

  function removeLine(index: number) {
    if (lines.length > 1) {
      setLines(lines.filter((_, i) => i !== index));
    }
  }

  function pickService(s: Service) {
    // Heuristic: services with unit 'forfait' or 'h' or 'jour' are likely labor
    const isLabor = ['forfait', 'h', 'jour'].includes(s.unit);
    const newLine: QuoteLine = {
      description: s.name,
      detail: s.description || '',
      quantity: 1,
      unit: s.unit,
      unit_price: s.unit_price,
      tva_rate: s.tva_rate ?? 20,
      section: isLabor ? 'main_oeuvre' : 'materiel',
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
      let savedQuoteId: string | null = null;

      if (draftId.current) {
        await supabase
          .from('quotes')
          .update({
            client_id: selectedClientId,
            project_id: prefillProjectId.current || null,
            bank_account_id: selectedBankAccountId,
            title,
            description,
            total_ht: totalHt,
            total_tva: totalTva,
            total_ttc: totalTtc,
            tva_rate: tva.primary_rate,
            tva_breakdown: tva.tva_breakdown,
            valid_until: validUntil,
            is_recurring: isRecurringQuote,
            recurring_frequency: recurringFrequency,
            updated_at: new Date().toISOString(),
          })
          .eq('id', draftId.current);

        await supabase.from('quote_lines').delete().eq('quote_id', draftId.current);
        if (validLines.length > 0) {
          await supabase.from('quote_lines').insert(
            validLines.map((l, i) => ({
              user_id: user.id,
              quote_id: draftId.current!,
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

        savedQuoteId = draftId.current;

        const { data: existingLead } = await supabase
          .from('leads')
          .select('id')
          .eq('quote_id', draftId.current)
          .maybeSingle();

        if (!existingLead) {
          const { data: draftRow } = await supabase
            .from('quotes')
            .select('quote_number')
            .eq('id', draftId.current)
            .single();
          const draftQuoteNumber = draftRow?.quote_number || '';
          await supabase.from('leads').insert({
            user_id: user.id,
            name: title || `Devis ${draftQuoteNumber}`,
            client_id: selectedClientId || null,
            quote_id: draftId.current,
            stage: 'devis_envoye',
            source: 'devis',
            value: totalTtc,
            notes: description || '',
          });
        }
      } else {
        const quoteNumber = await getNextQuoteNumber(supabase, user.id);

        const { data: quote } = await supabase
          .from('quotes')
          .insert({
            user_id: user.id,
            quote_number: quoteNumber,
            client_id: selectedClientId,
            project_id: prefillProjectId.current || null,
            bank_account_id: selectedBankAccountId,
            title,
            description,
            total_ht: totalHt,
            total_tva: totalTva,
            total_ttc: totalTtc,
            tva_rate: tva.primary_rate,
            tva_breakdown: tva.tva_breakdown,
            valid_until: validUntil,
            is_recurring: isRecurringQuote,
            recurring_frequency: recurringFrequency,
          })
          .select('id')
          .single();

        if (quote) savedQuoteId = quote.id;

        if (quote && validLines.length > 0) {
          await supabase.from('quote_lines').insert(
            validLines.map((l, i) => ({
              user_id: user.id,
              quote_id: quote.id,
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

        if (quote) {
          await supabase.from('leads').insert({
            user_id: user.id,
            name: title || `Devis ${quoteNumber}`,
            client_id: selectedClientId || null,
            quote_id: quote.id,
            stage: 'devis_envoye',
            source: 'devis',
            value: totalTtc,
            notes: description || '',
          });
        }
      }

      // Auto-create recurring contract
      if (savedQuoteId && user) {
        const { data: existingContract } = await supabase
          .from('recurring_contracts')
          .select('id')
          .eq('quote_id', savedQuoteId)
          .maybeSingle();

        if (!existingContract) {
          const startDate = new Date().toISOString().split('T')[0];

          if (isRecurringQuote) {
            // Whole-quote recurring contract with line items
            const lineItems = validLines.map(l => ({
              description: l.description,
              detail: l.detail || '',
              quantity: l.quantity,
              unit: l.unit,
              unit_price: l.unit_price,
              tva_rate: l.tva_rate,
            }));

            await supabase.from('recurring_contracts').insert({
              user_id: user.id,
              client_id: selectedClientId || null,
              quote_id: savedQuoteId,
              title,
              contract_type: 'autre',
              amount: tva.total_ht,
              frequency: recurringFrequency,
              tva_rate: tva.primary_rate,
              status: 'en_attente',
              start_date: startDate,
              next_billing: startDate,
              auto_send: false,
              description,
              line_items: lineItems,
            });
          } else {
            // Legacy: per-line contracts for individual recurring services
            const recurringLines = validLines.filter(l => l.is_recurring);
            for (const line of recurringLines) {
              await supabase.from('recurring_contracts').insert({
                user_id: user.id,
                client_id: selectedClientId || null,
                quote_id: savedQuoteId,
                title: line.description,
                contract_type: 'autre',
                amount: line.quantity * line.unit_price,
                frequency: line.frequency || 'mensuel',
                tva_rate: 20,
                status: 'en_attente',
                start_date: startDate,
                next_billing: startDate,
                auto_send: false,
              });
            }
          }
        }
      }

      router.push('/devis');
    } finally {
      setSaving(false);
    }
  }

  // Service filtering
  const filteredServices = serviceSearch
    ? services.filter(s =>
        s.name.toLowerCase().includes(serviceSearch.toLowerCase()) ||
        s.description.toLowerCase().includes(serviceSearch.toLowerCase()) ||
        s.category.toLowerCase().includes(serviceSearch.toLowerCase())
      )
    : services;

  const groupedServices = new Map<string, Service[]>();
  for (const s of filteredServices) {
    const cat = s.category || 'Sans categorie';
    if (!groupedServices.has(cat)) groupedServices.set(cat, []);
    groupedServices.get(cat)!.push(s);
  }

  const linesTotals = computeTvaBreakdown(lines.filter(l => l.description.trim()));

  return (
    <div className="flex flex-col min-h-[100dvh] sm:h-[calc(100vh-3.5rem)]">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-2 px-3 sm:px-6 py-2.5 sm:py-3 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9 shrink-0" onClick={() => router.push('/devis')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-semibold text-foreground truncate">Nouveau devis</h1>
            <p className="text-[11px] sm:text-xs text-muted-foreground hidden sm:block">Remplissez les informations et ajoutez vos prestations</p>
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
            <span className="hidden sm:inline">{saving ? 'Enregistrement...' : draftId.current ? 'Enregistrer' : 'Creer le devis'}</span>
            <span className="sm:hidden">{saving ? '...' : 'Creer'}</span>
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col sm:flex-row sm:overflow-hidden">
        {/* Form */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6">
          <div className="max-w-3xl mx-auto space-y-4 sm:space-y-6">
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
                  onChange={handleClientSelect}
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
                    min={new Date().toISOString().split('T')[0]}
                    onChange={e => setValidUntil(e.target.value || getDefaultValidUntil())}
                  />
                  <span className="text-xs text-muted-foreground whitespace-nowrap">30 j.</span>
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
                          <Input
                            placeholder="Nom de la prestation"
                            value={line.description}
                            onChange={e => updateLine(i, 'description', e.target.value)}
                            className="text-sm"
                          />
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
                      <div>
                        <label className="text-[10px] text-muted-foreground mb-0.5 block">Section</label>
                        <Select value={line.section || 'materiel'} onValueChange={(val) => updateLine(i, 'section', val)}>
                          <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {QUOTE_SECTIONS.map((s) => (<SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                      {line.description.trim() && line.unit_price > 0 && (
                        <p className="text-right text-xs text-muted-foreground">{formatCurrency(line.quantity * line.unit_price)} HT</p>
                      )}
                    </div>

                    {/* Desktop: grid layout */}
                    <div className="hidden sm:block">
                      <div className="grid grid-cols-[1fr_60px_90px_100px_70px_110px_auto] gap-2 items-start">
                        <div className="space-y-1">
                          <Input placeholder="Nom de la prestation" value={line.description} onChange={e => updateLine(i, 'description', e.target.value)} />
                          <textarea
                            placeholder="Detail (optionnel) — ex: marque, couleur, specifications..."
                            value={line.detail || ''}
                            onChange={e => updateLine(i, 'detail', e.target.value)}
                            className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                            rows={1}
                          />
                        </div>
                        <div>
                          <Input type="number" placeholder="Qte" value={line.quantity || ''} onChange={e => updateLine(i, 'quantity', Number(e.target.value))} />
                        </div>
                        <div>
                          <Select value={line.unit || 'u'} onValueChange={(val) => updateLine(i, 'unit', val)}>
                            <SelectTrigger className="h-10"><SelectValue placeholder="Unite" /></SelectTrigger>
                            <SelectContent>
                              {QUOTE_UNITS.map((u) => (<SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Input type="number" placeholder="Prix HT" value={line.unit_price || ''} onChange={e => updateLine(i, 'unit_price', Number(e.target.value))} />
                        </div>
                        <div>
                          <Select value={String(line.tva_rate ?? 20)} onValueChange={(val) => updateLine(i, 'tva_rate', Number(val))}>
                            <SelectTrigger className="h-10" title="Taux de TVA"><SelectValue placeholder="TVA" /></SelectTrigger>
                            <SelectContent>
                              {LINE_TVA_RATES.map((r) => (<SelectItem key={r} value={String(r)}>{formatTvaRate(r)}</SelectItem>))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Select value={line.section || 'materiel'} onValueChange={(val) => updateLine(i, 'section', val)}>
                            <SelectTrigger className="h-10" title="Section"><SelectValue placeholder="Section" /></SelectTrigger>
                            <SelectContent>
                              {QUOTE_SECTIONS.map((s) => (<SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-center gap-1 pt-2 justify-end">
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
                {saving ? '...' : 'Creer le devis'}
              </Button>
            </div>
          </div>
        </div>

        {/* Service catalog sidebar — desktop: side panel, mobile: bottom sheet overlay */}
        {/* Desktop sidebar */}
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
      />
    </div>
  );
}

/* ── Shared service list used in both desktop sidebar and mobile bottom sheet ── */

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
