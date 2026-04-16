'use client';

import { useState, useEffect, useRef, useMemo, Fragment } from 'react';
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
  PanelRightClose,
  PanelRightOpen,
  Receipt,
  Layers,
  Pencil,
  Trash2,
  GripVertical,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { QUOTE_UNITS, formatCurrency } from '@/lib/constants';
import { LINE_TVA_RATES, computeTvaBreakdown, formatTvaRate } from '@/lib/tva';
import { SECTION_LABELS } from '@/lib/quote-sections';
import { getNextQuoteNumber } from '@/lib/document-numbers';
import { computeDepositAmount } from '@/lib/invoices/deposits';
import { ClientPicker } from '@/components/shared/client-picker';
import { BankAccountPicker } from '@/components/shared/bank-account-picker';
import { FirstBankAccountDialog } from '@/components/shared/first-bank-account-dialog';
import { DocumentPreviewDialog } from '@/components/shared/document-preview-dialog';
import { DetailTextarea } from '@/components/devis/detail-textarea';
import { generateQuoteDetail } from '@/lib/ai/generate-quote-detail';
import { lookupPrestationDetail, savePrestationDetail } from '@/lib/prestation-details';
import { useToast } from '@/hooks/use-toast';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface QuoteLine {
  description: string;
  detail?: string;
  quantity: number;
  unit: string;
  unit_price: number;
  tva_rate: number;
  section?: string;
  subsection?: string;
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
  const { toast } = useToast();

  async function handleGenerateDetail(idx: number): Promise<string> {
    const line = lines[idx];
    const detail = await generateQuoteDetail({
      description: line.description,
      existingDetail: line.detail || undefined,
      quoteTitle: title || undefined,
      otherLines: lines
        .filter((_, i) => i !== idx)
        .map((l) => ({
          description: l.description,
          detail: l.detail || null,
          quantity: l.quantity,
          unit: l.unit,
        })),
    });
    return detail;
  }

  function handleAiError(message: string) {
    toast({ title: 'Génération IA impossible', description: message, variant: 'destructive' });
  }

  async function handleDescriptionBlur(idx: number) {
    setTimeout(() => setAutocompleteIndex(null), 150);
    const current = lines[idx];
    if (!current || (current.detail || '').trim().length > 0) return;
    const cached = await lookupPrestationDetail(current.description);
    if (!cached) return;
    setLines(prev => {
      const next = [...prev];
      const target = next[idx];
      if (!target) return prev;
      if ((target.detail || '').trim().length > 0) return prev;
      if (target.description !== current.description) return prev;
      next[idx] = { ...target, detail: cached };
      return next;
    });
  }

  function handleDetailBlur(idx: number) {
    const line = lines[idx];
    if (!line) return;
    const title = (line.description || '').trim();
    const detail = (line.detail || '').trim();
    if (!title || !detail) return;
    savePrestationDetail(title, detail).catch(() => {});
  }

  const router = useRouter();
  const draftId = useRef<string | null>(null);
  const draftPromise = useRef<Promise<string | null> | null>(null);
  const prefillProjectId = useRef<string | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string | null>(null);
  // Gate "premier RIB" : bloque la soumission finale tant qu'aucun RIB
  // n'existe. L'entrée sur la page /devis autorise un "Plus tard".
  const [hasBankAccount, setHasBankAccount] = useState<boolean | null>(null);
  const [showFirstRibDialog, setShowFirstRibDialog] = useState(false);
  // Dès qu'un RIB est créé via la modale bloquante, on relance saveQuote.
  const pendingSaveAfterRib = useRef(false);
  const [validUntil, setValidUntil] = useState(getDefaultValidUntil());
  const [lines, setLines] = useState<QuoteLine[]>([
    { description: '', quantity: 1, unit: 'u', unit_price: 0, tva_rate: 20, section: 'materiel' },
  ]);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Service catalog (inline sidebar)
  const [services, setServices] = useState<Service[]>([]);
  const [serviceSearch, setServiceSearch] = useState('');
  const [serviceSectionFilter, setServiceSectionFilter] = useState<'all' | 'materiel' | 'main_oeuvre'>('all');
  const [addedServiceIds, setAddedServiceIds] = useState<Set<string>>(new Set());
  const [showServicePanel, setShowServicePanel] = useState(true);
  const [sectionDialog, setSectionDialog] = useState<{ mode: 'create' | 'rename'; oldName?: string; value: string } | null>(null);
  const [subsectionDialog, setSubsectionDialog] = useState<{
    mode: 'create' | 'rename';
    parentSection: string;
    oldName?: string;
    value: string;
  } | null>(null);
  const [showDesktopPanel, setShowDesktopPanel] = useState(true);
  const [isRecurringQuote, setIsRecurringQuote] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState('annuel');
  const [depositPercentage, setDepositPercentage] = useState<string>('');
  const serviceSearchRef = useRef<HTMLInputElement>(null);
  const [autocompleteIndex, setAutocompleteIndex] = useState<number | null>(null);
  const autocompleteRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [draggingSub, setDraggingSub] = useState<{ section: string; subsection: string } | null>(null);
  type DragOverTarget =
    | { kind: 'section-top'; section: string }
    | { kind: 'subsection'; section: string; subsection: string }
    | { kind: 'line'; lineIndex: number };
  const [dragOverTarget, setDragOverTarget] = useState<DragOverTarget | null>(null);

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

  // Charge le flag "a au moins un RIB" pour gater la soumission finale.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { count } = await supabase
        .from('bank_accounts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);
      if (!cancelled) setHasBankAccount((count ?? 0) > 0);
    })();
    return () => { cancelled = true; };
  }, [user]);

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

  // Auto-save draft when client is selected
  async function autosaveDraft(clientId: string): Promise<string | null> {
    if (!user || draftId.current) return draftId.current;
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
    return draftId.current;
  }

  function handleClientSelect(clientId: string | null) {
    setSelectedClientId(clientId);
    if (clientId && !draftId.current && !draftPromise.current) {
      draftPromise.current = autosaveDraft(clientId);
    }
  }

  function addLine() {
    // Inherit section AND subsection from the last line so the user keeps
    // typing inside the same group without re-selecting it.
    const last = lines.length > 0 ? lines[lines.length - 1] : null;
    setLines([
      ...lines,
      {
        description: '',
        quantity: 1,
        unit: 'u',
        unit_price: 0,
        tva_rate: 20,
        section: last?.section,
        subsection: last?.subsection,
      },
    ]);
  }

  function addSection() {
    setSectionDialog({ mode: 'create', value: '' });
  }

  function renameSection(oldName: string) {
    setSectionDialog({ mode: 'rename', oldName, value: oldName });
  }

  function confirmSectionDialog() {
    if (!sectionDialog) return;
    const name = sectionDialog.value.trim();
    if (!name) return;
    if (sectionDialog.mode === 'create') {
      // New section starts with no subsection so the artisan can either
      // start typing lines, or click "Sous-section" to nest one.
      setLines([...lines, { description: '', quantity: 1, unit: 'u', unit_price: 0, tva_rate: 20, section: name }]);
    } else if (sectionDialog.mode === 'rename' && sectionDialog.oldName && name !== sectionDialog.oldName) {
      setLines(lines.map(l => l.section === sectionDialog.oldName ? { ...l, section: name } : l));
    }
    setSectionDialog(null);
  }

  function deleteSection(sectionName: string) {
    // Remove the section assignment — lines keep their content but lose
    // the section AND any subsection (a subsection without a parent section
    // would be orphaned in the rendering).
    setLines(lines.map(l => l.section === sectionName ? { ...l, section: undefined, subsection: undefined } : l));
  }

  function addSubsection(parentSection: string) {
    setSubsectionDialog({ mode: 'create', parentSection, value: '' });
  }

  // Toolbar "Sous-section" button: target the most recent section in use.
  function addSubsectionFromToolbar() {
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].section) {
        setSubsectionDialog({ mode: 'create', parentSection: lines[i].section!, value: '' });
        return;
      }
    }
  }

  function renameSubsection(parentSection: string, oldName: string) {
    setSubsectionDialog({ mode: 'rename', parentSection, oldName, value: oldName });
  }

  function confirmSubsectionDialog() {
    if (!subsectionDialog) return;
    const name = subsectionDialog.value.trim();
    if (!name) return;
    if (subsectionDialog.mode === 'create') {
      // If the parent section already contains an empty placeholder line with
      // no subsection (typically the line auto-created when the section was
      // added), reuse it instead of inserting a new one — otherwise the editor
      // shows a phantom no-subsection block above the new subsection that
      // looks like a duplicated section.
      let reuseIdx = -1;
      for (let i = lines.length - 1; i >= 0; i--) {
        const l = lines[i];
        if (
          l.section === subsectionDialog.parentSection &&
          !l.subsection &&
          !l.description.trim() &&
          !l.unit_price
        ) {
          reuseIdx = i;
          break;
        }
      }
      if (reuseIdx !== -1) {
        setLines(lines.map((l, i) => (i === reuseIdx ? { ...l, subsection: name } : l)));
      } else {
        const newLine: QuoteLine = {
          description: '',
          quantity: 1,
          unit: 'u',
          unit_price: 0,
          tva_rate: 20,
          section: subsectionDialog.parentSection,
          subsection: name,
        };
        let lastIdx = -1;
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].section === subsectionDialog.parentSection) lastIdx = i;
        }
        if (lastIdx === -1) {
          setLines([...lines, newLine]);
        } else {
          setLines([...lines.slice(0, lastIdx + 1), newLine, ...lines.slice(lastIdx + 1)]);
        }
      }
    } else if (
      subsectionDialog.mode === 'rename' &&
      subsectionDialog.oldName &&
      name !== subsectionDialog.oldName
    ) {
      setLines(
        lines.map((l) =>
          l.section === subsectionDialog.parentSection && l.subsection === subsectionDialog.oldName
            ? { ...l, subsection: name }
            : l,
        ),
      );
    }
    setSubsectionDialog(null);
  }

  function deleteSubsection(parentSection: string, name: string) {
    setLines(
      lines.map((l) =>
        l.section === parentSection && l.subsection === name ? { ...l, subsection: undefined } : l,
      ),
    );
  }

  // Move an entire subsection block (header + its lines) to a new position.
  // dst.subsection === null → place at TOP of dst.section (just under header).
  function moveSubsection(
    src: { section: string; subsection: string },
    dst: { section: string; subsection: string | null },
  ) {
    if (src.section === dst.section && src.subsection === dst.subsection) return;

    const moved: QuoteLine[] = [];
    const remaining: QuoteLine[] = [];
    for (const l of lines) {
      if (l.section === src.section && l.subsection === src.subsection) {
        moved.push({ ...l, section: dst.section });
      } else {
        remaining.push(l);
      }
    }
    if (moved.length === 0) return;

    let insertAt: number;
    if (dst.subsection !== null) {
      insertAt = remaining.findIndex(
        (l) => l.section === dst.section && l.subsection === dst.subsection,
      );
      if (insertAt === -1) insertAt = remaining.length;
    } else {
      // Top of section: insert before the first line of dst.section
      insertAt = remaining.findIndex((l) => l.section === dst.section);
      if (insertAt === -1) insertAt = remaining.length;
    }

    setLines([...remaining.slice(0, insertAt), ...moved, ...remaining.slice(insertAt)]);
  }

  // Move a subsection block right BEFORE a specific line. The dragged
  // subsection inherits the target line's section so it lands inside the
  // section the user is hovering, regardless of where it came from.
  function moveSubsectionToLineIndex(
    src: { section: string; subsection: string },
    targetLineIndex: number,
  ) {
    const target = lines[targetLineIndex];
    if (!target) return;
    if (target.section === src.section && target.subsection === src.subsection) return;
    const dstSection = target.section ?? src.section;

    const moved: QuoteLine[] = [];
    const remaining: { line: QuoteLine; origIdx: number }[] = [];
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (l.section === src.section && l.subsection === src.subsection) {
        moved.push({ ...l, section: dstSection });
      } else {
        remaining.push({ line: l, origIdx: i });
      }
    }
    if (moved.length === 0) return;

    const newTargetIdx = remaining.findIndex((r) => r.origIdx === targetLineIndex);
    const insertAt = newTargetIdx === -1 ? remaining.length : newTargetIdx;

    setLines([
      ...remaining.slice(0, insertAt).map((r) => r.line),
      ...moved,
      ...remaining.slice(insertAt).map((r) => r.line),
    ]);
  }

  function updateLine(index: number, field: keyof QuoteLine, value: string | number) {
    const updated = [...lines];
    (updated[index] as unknown as Record<string, string | number>)[field] = value;
    setLines(updated);
    // Open autocomplete when typing description
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
    const current = updated[lineIndex];
    // Preserve the line's existing section/subsection — picking a prestation
    // suggestion must not yank the line out of the section the user just
    // created. Only fall back to the prestation's default when the line has
    // no section yet.
    updated[lineIndex] = {
      ...current,
      description: s.name,
      detail: s.description || current.detail || '',
      unit: s.unit,
      unit_price: s.unit_price,
      tva_rate: s.tva_rate ?? 20,
      section: current.section ?? s.section ?? 'materiel',
      subsection: current.subsection,
      is_recurring: s.is_recurring,
      frequency: s.frequency,
      _savedAsPrestation: true,
    };
    setLines(updated);
    setAutocompleteIndex(null);
    setAddedServiceIds(prev => new Set(prev).add(s.id));

    lookupPrestationDetail(s.name).then(cached => {
      if (!cached) return;
      setLines(prev => {
        const next = [...prev];
        const target = next[lineIndex];
        if (!target || target.description !== s.name) return prev;
        next[lineIndex] = { ...target, detail: cached };
        return next;
      });
    }).catch(() => {});
  }

  function removeLine(index: number) {
    if (lines.length > 1) {
      setLines(lines.filter((_, i) => i !== index));
    }
  }

  function pickService(s: Service) {
    // Picking a prestation must drop the line into the section the artisan is
    // currently editing, not force-move it to the prestation's stored section
    // — otherwise creating a custom section and then picking a prestation
    // would reshuffle the line into "materiel" and make the custom section
    // look like it disappeared.
    const last = lines.length > 0 ? lines[lines.length - 1] : null;
    const targetSection = last?.section ?? s.section ?? 'materiel';
    const inheritedSubsection =
      last && last.section === targetSection ? last.subsection : undefined;
    const newLine: QuoteLine = {
      description: s.name,
      detail: s.description || '',
      quantity: 1,
      unit: s.unit,
      unit_price: s.unit_price,
      tva_rate: s.tva_rate ?? 20,
      section: targetSection,
      subsection: inheritedSubsection,
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

    // Gate "premier RIB" : tant qu'aucun RIB n'est configuré, on bloque la
    // création effective et on ouvre la modale (sans "Plus tard"). Une fois
    // le RIB créé, on relance automatiquement saveQuote via l'effet.
    if (hasBankAccount === false) {
      pendingSaveAfterRib.current = true;
      setShowFirstRibDialog(true);
      return;
    }

    setSaving(true);

    try {
      // Wait for any in-flight draft creation so we don't create a duplicate
      if (draftPromise.current && !draftId.current) {
        try { await draftPromise.current; } catch { /* ignore */ }
      }

      const validLines = lines.filter(l => l.description.trim());
      // Structural lines: keep placeholders that carry section/subsection so the
      // editor's organization is preserved on reload (WYSIWYG with the preview).
      const persistedLines = lines.filter(
        l => l.description.trim() || l.section || l.subsection,
      );
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
            deposit_percentage: depositPercentage ? parseFloat(depositPercentage) : null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', draftId.current);

        await supabase.from('quote_lines').delete().eq('quote_id', draftId.current);
        if (persistedLines.length > 0) {
          await supabase.from('quote_lines').insert(
            persistedLines.map((l, i) => ({
              user_id: user.id,
              quote_id: draftId.current!,
              description: l.description,
              detail: l.detail || null,
              quantity: l.quantity,
              unit: l.unit,
              unit_price: l.unit_price,
              tva_rate: l.tva_rate,
              section: l.section || null,
              subsection: l.subsection || null,
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
            deposit_percentage: depositPercentage ? parseFloat(depositPercentage) : null,
          })
          .select('id')
          .single();

        if (quote) savedQuoteId = quote.id;

        if (quote && persistedLines.length > 0) {
          await supabase.from('quote_lines').insert(
            persistedLines.map((l, i) => ({
              user_id: user.id,
              quote_id: quote.id,
              description: l.description,
              detail: l.detail || null,
              quantity: l.quantity,
              unit: l.unit,
              unit_price: l.unit_price,
              tva_rate: l.tva_rate,
              section: l.section || null,
              subsection: l.subsection || null,
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
          const startDate = new Date().toLocaleDateString('fr-CA');

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

  // Autosave totals/lines on the existing draft so the list reflects real amounts
  // even if the user navigates away without clicking "Enregistrer". Uses a generation
  // counter to cancel stale autosaves and avoid racing with saveQuote.
  const autosaveGenRef = useRef(0);
  useEffect(() => {
    if (!user || !draftId.current || saving) return;
    const gen = ++autosaveGenRef.current;
    const timer = setTimeout(async () => {
      if (gen !== autosaveGenRef.current) return;
      const id = draftId.current;
      if (!id) return;
      const validLines = lines.filter(l => l.description.trim());
      const persistedLines = lines.filter(
        l => l.description.trim() || l.section || l.subsection,
      );
      const tva = computeTvaBreakdown(validLines);
      if (gen !== autosaveGenRef.current) return;
      await supabase
        .from('quotes')
        .update({
          title,
          description,
          total_ht: tva.total_ht,
          total_tva: tva.total_tva,
          total_ttc: tva.total_ttc,
          tva_rate: tva.primary_rate,
          tva_breakdown: tva.tva_breakdown,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (gen !== autosaveGenRef.current) return;
      await supabase.from('quote_lines').delete().eq('quote_id', id);
      if (gen !== autosaveGenRef.current) return;
      if (persistedLines.length > 0) {
        await supabase.from('quote_lines').insert(
          persistedLines.map((l, i) => ({
            user_id: user.id,
            quote_id: id,
            description: l.description,
            detail: l.detail || null,
            quantity: l.quantity,
            unit: l.unit,
            unit_price: l.unit_price,
            tva_rate: l.tva_rate,
            section: l.section || null,
            subsection: l.subsection || null,
            total: l.quantity * l.unit_price,
            position: i,
          }))
        );
      }
    }, 800);
    return () => {
      autosaveGenRef.current++;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, title, description, user, saving]);

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

  // Per-run subtotals keyed by the index of the FIRST line in each run.
  // Matches the per-run grouping used by the preview so the editor's running
  // totals stay consistent with what the client will see.
  const runSubtotals = useMemo(() => {
    const sectionByStart = new Map<number, { ht: number; ttc: number }>();
    const subsectionByStart = new Map<number, { ht: number; ttc: number }>();
    let secStart = -1;
    let subStart = -1;
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      const sKey = l.section ?? null;
      const subKey = l.subsection ?? null;
      const prev = i > 0 ? lines[i - 1] : null;
      const prevSection = prev ? prev.section ?? null : Symbol() as unknown as string | null;
      const prevSub = prev ? prev.subsection ?? null : Symbol() as unknown as string | null;

      if (sKey !== prevSection) {
        secStart = i;
        sectionByStart.set(secStart, { ht: 0, ttc: 0 });
      }
      if (sKey !== prevSection || subKey !== prevSub) {
        subStart = i;
        subsectionByStart.set(subStart, { ht: 0, ttc: 0 });
      }

      const ht = (l.quantity || 0) * (l.unit_price || 0);
      const ttc = ht * (1 + (l.tva_rate ?? 20) / 100);
      const sec = sectionByStart.get(secStart)!;
      sec.ht += ht;
      sec.ttc += ttc;
      const sub = subsectionByStart.get(subStart)!;
      sub.ht += ht;
      sub.ttc += ttc;
    }
    return { sectionByStart, subsectionByStart };
  }, [lines]);

  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 -my-5 lg:-my-8 flex flex-col min-h-[100dvh] sm:h-screen">
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
            onClick={() => setShowDesktopPanel(p => !p)}
            className="gap-1.5 hidden sm:flex"
            title={showDesktopPanel ? 'Masquer les prestations' : 'Afficher les prestations'}
          >
            {showDesktopPanel ? <PanelRightClose className="h-3.5 w-3.5" /> : <PanelRightOpen className="h-3.5 w-3.5" />}
            Prestations
          </Button>
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
                    min={new Date().toLocaleDateString('fr-CA')}
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
                  <Button variant="outline" size="sm" onClick={addSection} className="gap-1 text-xs">
                    <Layers className="h-3 w-3" /> Section
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addSubsectionFromToolbar}
                    disabled={!lines.some((l) => l.section)}
                    className="gap-1 text-xs"
                    title={
                      lines.some((l) => l.section)
                        ? 'Ajouter une sous-section dans la dernière section'
                        : 'Créez d\u2019abord une section'
                    }
                  >
                    <Layers className="h-3 w-3 opacity-60" /> Sous-section
                  </Button>
                  <Button variant="outline" size="sm" onClick={addLine} className="gap-1 text-xs">
                    <Plus className="h-3 w-3" /> Ligne
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                {lines.map((line, i) => (
                  <Fragment key={i}>
                  {/* Section header — shown when this line starts a new section */}
                  {line.section && (i === 0 || lines[i - 1].section !== line.section) && (
                    <div
                      className="flex items-center gap-2 pt-2 first:pt-0"
                      onDragOver={(e) => {
                        if (!draggingSub) return;
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                        setDragOverTarget({ kind: 'section-top', section: line.section! });
                      }}
                      onDragLeave={(e) => {
                        if (!draggingSub) return;
                        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                        setDragOverTarget(null);
                      }}
                      onDrop={(e) => {
                        if (!draggingSub) return;
                        e.preventDefault();
                        moveSubsection(draggingSub, { section: line.section!, subsection: null });
                        setDraggingSub(null);
                        setDragOverTarget(null);
                      }}
                    >
                      <div
                        className={cn(
                          'flex-1 flex items-center gap-2 rounded-lg bg-muted/70 border border-border px-3 py-2 transition-all',
                          draggingSub &&
                            dragOverTarget?.kind === 'section-top' &&
                            dragOverTarget.section === line.section &&
                            'border-b-2 border-b-[#d35400] shadow-[0_4px_0_-2px_#d35400]',
                        )}
                      >
                        <Layers className="h-3.5 w-3.5 text-[#d35400]" />
                        <span className="text-sm font-semibold text-foreground">{SECTION_LABELS[line.section!] || line.section}</span>
                        {runSubtotals.sectionByStart.has(i) && (
                          <span className="ml-auto text-xs font-medium tabular-nums text-[#d35400]">
                            {formatCurrency(runSubtotals.sectionByStart.get(i)!.ht)} HT · {formatCurrency(runSubtotals.sectionByStart.get(i)!.ttc)} TTC
                          </span>
                        )}
                      </div>
                      <button type="button" onClick={() => renameSection(line.section!)} className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground" title="Renommer la section">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => deleteSection(line.section!)} className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-destructive" title="Supprimer la section">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                  {/* Subsection header — shown when this line starts a new subsection within the current section */}
                  {line.section && line.subsection && (
                    i === 0 ||
                    lines[i - 1].section !== line.section ||
                    lines[i - 1].subsection !== line.subsection
                  ) && (
                    <div
                      draggable
                      onDragStart={(e) => {
                        setDraggingSub({ section: line.section!, subsection: line.subsection! });
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData('text/plain', line.subsection!);
                      }}
                      onDragEnd={() => {
                        setDraggingSub(null);
                        setDragOverTarget(null);
                      }}
                      onDragOver={(e) => {
                        if (!draggingSub) return;
                        if (
                          draggingSub.section === line.section &&
                          draggingSub.subsection === line.subsection
                        ) return;
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                        setDragOverTarget({
                          kind: 'subsection',
                          section: line.section!,
                          subsection: line.subsection!,
                        });
                      }}
                      onDragLeave={(e) => {
                        if (!draggingSub) return;
                        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                        setDragOverTarget(null);
                      }}
                      onDrop={(e) => {
                        if (!draggingSub) return;
                        e.preventDefault();
                        moveSubsection(draggingSub, {
                          section: line.section!,
                          subsection: line.subsection!,
                        });
                        setDraggingSub(null);
                        setDragOverTarget(null);
                      }}
                      className={cn(
                        'flex items-center gap-2 pl-4 group/sub transition-opacity',
                        draggingSub?.section === line.section &&
                          draggingSub?.subsection === line.subsection &&
                          'opacity-40',
                        dragOverTarget?.kind === 'subsection' &&
                          dragOverTarget.section === line.section &&
                          dragOverTarget.subsection === line.subsection &&
                          'border-t-2 border-[#d35400] -mt-0.5 pt-0.5',
                      )}
                    >
                      <div className="flex-1 flex items-center gap-2 rounded-lg bg-[#d35400]/[0.06] border border-[#d35400]/15 border-l-[3px] border-l-[#d35400] pl-2.5 pr-3 py-2 hover:bg-[#d35400]/[0.09] transition-colors">
                        <button
                          type="button"
                          className="cursor-grab active:cursor-grabbing text-[#d35400]/60 hover:text-[#d35400] touch-none"
                          title="Glisser pour déplacer la sous-section"
                          aria-label="Déplacer la sous-section"
                        >
                          <GripVertical className="h-4 w-4" />
                        </button>
                        <span className="text-sm font-semibold text-foreground tracking-tight">{line.subsection}</span>
                        {runSubtotals.subsectionByStart.has(i) && (
                          <span className="ml-auto text-xs font-medium tabular-nums text-[#d35400]">
                            {formatCurrency(runSubtotals.subsectionByStart.get(i)!.ht)} HT · {formatCurrency(runSubtotals.subsectionByStart.get(i)!.ttc)} TTC
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-0.5">
                        <button type="button" onClick={() => renameSubsection(line.section!, line.subsection!)} className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground" title="Renommer la sous-section">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" onClick={() => deleteSubsection(line.section!, line.subsection!)} className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-destructive" title="Supprimer la sous-section">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                  <div
                    key={i}
                    onDragOver={(e) => {
                      if (!draggingSub) return;
                      if (
                        line.section === draggingSub.section &&
                        line.subsection === draggingSub.subsection
                      ) return;
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      setDragOverTarget({ kind: 'line', lineIndex: i });
                    }}
                    onDragLeave={(e) => {
                      if (!draggingSub) return;
                      if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                      setDragOverTarget(null);
                    }}
                    onDrop={(e) => {
                      if (!draggingSub) return;
                      e.preventDefault();
                      moveSubsectionToLineIndex(draggingSub, i);
                      setDraggingSub(null);
                      setDragOverTarget(null);
                    }}
                    className={cn(
                      'rounded-lg border border-border bg-card p-2.5 sm:p-3 transition-all',
                      line.subsection && 'ml-4',
                      dragOverTarget?.kind === 'line' &&
                        dragOverTarget.lineIndex === i &&
                        'border-t-2 border-t-[#d35400] -mt-0.5',
                    )}
                  >
                    {/* Mobile: stacked layout */}
                    <div className="sm:hidden space-y-2">
                      <div className="flex items-start gap-2">
                        <div className="flex-1">
                          <div className="relative" ref={el => { autocompleteRefs.current[i] = el; }}>
                            <Input
                              placeholder="Nom de la prestation"
                              value={line.description}
                              onChange={e => updateLine(i, 'description', e.target.value)}
                              onFocus={() => { if (line.description.trim().length >= 1) setAutocompleteIndex(i); }}
                              onBlur={() => handleDescriptionBlur(i)}
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
                      <DetailTextarea
                        placeholder="Détail (optionnel) — appuyez sur Entrée pour créer une puce"
                        value={line.detail || ''}
                        onChange={(val) => updateLine(i, 'detail', val)}
                        onBlur={() => handleDetailBlur(i)}
                        onAiGenerate={line.description.trim() ? () => handleGenerateDetail(i) : undefined}
                        onAiError={handleAiError}
                      />
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
                        <p className="text-right text-xs text-muted-foreground">
                          {formatCurrency(line.quantity * line.unit_price)} HT · <span className="font-medium text-foreground">{formatCurrency(line.quantity * line.unit_price * (1 + (line.tva_rate ?? 20) / 100))} TTC</span>
                        </p>
                      )}
                    </div>

                    {/* Desktop: grid layout */}
                    <div className="hidden sm:block">
                      <div className="grid grid-cols-[1fr_60px_90px_100px_70px_auto] gap-2 items-start">
                        <div>
                          <div className="relative" ref={el => { autocompleteRefs.current[i + 1000] = el; }}>
                            <Input
                              placeholder="Nom de la prestation"
                              value={line.description}
                              onChange={e => updateLine(i, 'description', e.target.value)}
                              onFocus={() => { if (line.description.trim().length >= 1) setAutocompleteIndex(i); }}
                              onBlur={() => handleDescriptionBlur(i)}
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
                      <div className="mt-2">
                        <DetailTextarea
                          placeholder="Détail (optionnel) — appuyez sur Entrée pour créer une puce"
                          value={line.detail || ''}
                          onChange={(val) => updateLine(i, 'detail', val)}
                          onBlur={() => handleDetailBlur(i)}
                          onAiGenerate={line.description.trim() ? () => handleGenerateDetail(i) : undefined}
                          onAiError={handleAiError}
                        />
                      </div>
                      {line.description.trim() && line.unit_price > 0 && (
                        <div className="flex justify-end mt-1.5">
                          <span className="text-xs text-muted-foreground">
                            {formatCurrency(line.quantity * line.unit_price)} HT · <span className="font-medium text-foreground">{formatCurrency(line.quantity * line.unit_price * (1 + (line.tva_rate ?? 20) / 100))} TTC</span>
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  </Fragment>
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

            {/* Options */}
            <div className="space-y-3">
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
        {showDesktopPanel && <div className="hidden sm:flex flex-col w-[340px] lg:w-[380px] border-l border-border bg-card shrink-0 overflow-hidden">
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
        </div>}

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

      <Dialog open={!!sectionDialog} onOpenChange={(o) => !o && setSectionDialog(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{sectionDialog?.mode === 'rename' ? 'Renommer la section' : 'Nouvelle section'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="section-name">Nom de la section</Label>
            <Input
              id="section-name"
              value={sectionDialog?.value ?? ''}
              onChange={(e) => setSectionDialog(sectionDialog ? { ...sectionDialog, value: e.target.value } : null)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); confirmSectionDialog(); } }}
              placeholder="Ex. Salle de bain"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSectionDialog(null)}>Annuler</Button>
            <Button onClick={confirmSectionDialog} style={{ backgroundColor: '#D35400' }}>Valider</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!subsectionDialog} onOpenChange={(o) => !o && setSubsectionDialog(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {subsectionDialog?.mode === 'rename' ? 'Renommer la sous-section' : 'Nouvelle sous-section'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {subsectionDialog && (() => {
              const distinctSections = Array.from(
                new Set(lines.map((l) => l.section).filter((s): s is string => !!s)),
              );
              const showPicker = subsectionDialog.mode === 'create' && distinctSections.length > 1;
              if (showPicker) {
                return (
                  <div className="space-y-1.5">
                    <Label htmlFor="subsection-parent">Section parente</Label>
                    <Select
                      value={subsectionDialog.parentSection}
                      onValueChange={(val) =>
                        setSubsectionDialog(
                          subsectionDialog ? { ...subsectionDialog, parentSection: val } : null,
                        )
                      }
                    >
                      <SelectTrigger id="subsection-parent" className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {distinctSections.map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              }
              return (
                <p className="text-xs text-muted-foreground">
                  Dans la section <span className="font-medium text-foreground">{subsectionDialog.parentSection}</span>
                </p>
              );
            })()}
            <div className="space-y-1.5">
              <Label htmlFor="subsection-name">Nom de la sous-section</Label>
              <Input
                id="subsection-name"
                value={subsectionDialog?.value ?? ''}
                onChange={(e) => setSubsectionDialog(subsectionDialog ? { ...subsectionDialog, value: e.target.value } : null)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); confirmSubsectionDialog(); } }}
                placeholder="Ex. Matériel ou Main d'œuvre"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubsectionDialog(null)}>Annuler</Button>
            <Button onClick={confirmSubsectionDialog} style={{ backgroundColor: '#D35400' }}>Valider</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Gate bloquant : demande du RIB au moment de créer le devis. */}
      <FirstBankAccountDialog
        open={showFirstRibDialog}
        onOpenChange={(open) => {
          setShowFirstRibDialog(open);
          if (!open) pendingSaveAfterRib.current = false;
        }}
        context="devis"
        onSaved={(account) => {
          setHasBankAccount(true);
          setSelectedBankAccountId(account.id);
          setShowFirstRibDialog(false);
          // Relance automatique de la création du devis maintenant que le RIB existe.
          if (pendingSaveAfterRib.current) {
            pendingSaveAfterRib.current = false;
            setTimeout(() => { void saveQuote(); }, 0);
          }
        }}
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
