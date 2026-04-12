'use client';

import { useEffect, useRef, useState } from 'react';
import { Sparkles, Camera, Upload, FileCheck2, X, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { SupplierPicker } from '@/components/comptabilite/supplier-picker';

export interface ExpenseFormValues {
  id?: string;
  description: string;
  supplier: string;
  date: string;
  amount_ht: number;
  tva_rate: number;
  tva_amount: number;
  amount: number;
  expense_category_id: string | null;
  payment_method: string | null;
  is_autoliquidation: boolean;
  project_id: string | null;
  source: 'manual' | 'ocr' | 'recurring';
  ocr_confidence?: number | null;
  receipt_storage_path?: string | null;
}

interface Category {
  id: string;
  slug: string;
  name: string;
}

interface Project {
  id: string;
  name: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialValues?: Partial<ExpenseFormValues> | null;
  categories: Category[];
  projects: Project[];
  onSubmit: (values: ExpenseFormValues, newReceiptFile: File | null) => Promise<void>;
}

const ACCEPTED_RECEIPT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_RECEIPT_SIZE = 10 * 1024 * 1024;

const EMPTY: ExpenseFormValues = {
  description: '',
  supplier: '',
  date: new Date().toISOString().split('T')[0],
  amount_ht: 0,
  tva_rate: 20,
  tva_amount: 0,
  amount: 0,
  expense_category_id: null,
  payment_method: null,
  is_autoliquidation: false,
  project_id: null,
  source: 'manual',
};

const TVA_RATES = [0, 2.1, 5.5, 10, 20];
const PAYMENT_METHODS = [
  { value: 'cb', label: 'Carte bancaire' },
  { value: 'virement', label: 'Virement' },
  { value: 'especes', label: 'Espèces' },
  { value: 'cheque', label: 'Chèque' },
  { value: 'prelevement', label: 'Prélèvement' },
  { value: 'autre', label: 'Autre' },
];

export function ExpenseFormDialog({ open, onOpenChange, initialValues, categories, projects, onSubmit }: Props) {
  const [values, setValues] = useState<ExpenseFormValues>({ ...EMPTY, ...initialValues });
  const [submitting, setSubmitting] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setValues({ ...EMPTY, ...initialValues });
      setReceiptFile(null);
      setReceiptError(null);
    }
  }, [open, initialValues]);

  function handleReceiptSelected(file: File | null) {
    setReceiptError(null);
    if (!file) {
      setReceiptFile(null);
      return;
    }
    if (!ACCEPTED_RECEIPT_TYPES.includes(file.type)) {
      setReceiptError('Format non supporté (JPG, PNG, WebP ou PDF uniquement)');
      return;
    }
    if (file.size > MAX_RECEIPT_SIZE) {
      setReceiptError('Fichier trop volumineux (max 10 Mo)');
      return;
    }
    setReceiptFile(file);
  }

  function update<K extends keyof ExpenseFormValues>(key: K, value: ExpenseFormValues[K]) {
    setValues((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'amount_ht' || key === 'tva_rate') {
        const ht = Number(next.amount_ht || 0);
        const rate = Number(next.tva_rate || 0);
        const tva = next.is_autoliquidation ? 0 : +(ht * (rate / 100)).toFixed(2);
        next.tva_amount = tva;
        next.amount = +(ht + tva).toFixed(2);
      }
      if (key === 'is_autoliquidation') {
        const ht = Number(next.amount_ht || 0);
        const tva = (value as boolean) ? 0 : +(ht * (Number(next.tva_rate || 0) / 100)).toFixed(2);
        next.tva_amount = tva;
        next.amount = +(ht + tva).toFixed(2);
      }
      return next;
    });
  }

  const hasExistingReceipt = Boolean(values.receipt_storage_path);
  const hasReceipt = hasExistingReceipt || receiptFile != null;

  async function handleSubmit() {
    if (!values.description.trim() || !values.supplier.trim() || values.amount_ht <= 0) {
      return;
    }
    if (!hasReceipt) {
      setReceiptError('Un justificatif (photo ou PDF) est obligatoire pour chaque dépense');
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(values, receiptFile);
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  const isOcr = values.source === 'ocr';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isOcr && <Sparkles className="h-4 w-4 text-[#D35400]" />}
            {values.id ? 'Modifier la dépense' : isOcr ? 'Vérifier la dépense extraite' : 'Nouvelle dépense'}
          </DialogTitle>
          {isOcr && values.ocr_confidence != null && (
            <p className="text-xs text-muted-foreground">
              Confiance IA :{' '}
              <Badge variant="secondary" className="ml-1">
                {Math.round(values.ocr_confidence * 100)}%
              </Badge>
              {' — Vérifiez et corrigez si besoin'}
            </p>
          )}
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="supplier">Fournisseur *</Label>
              <SupplierPicker
                value={values.supplier}
                onChange={(name) => update('supplier', name)}
              />
            </div>
            <div>
              <Label htmlFor="date">Date *</Label>
              <Input
                id="date"
                type="date"
                value={values.date}
                onChange={(e) => update('date', e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              value={values.description}
              onChange={(e) => update('description', e.target.value)}
              placeholder="Achat matériaux placo"
              rows={2}
            />
          </div>

          <div>
            <Label>Catégorie</Label>
            <Select
              value={values.expense_category_id || ''}
              onValueChange={(v) => update('expense_category_id', v || null)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choisir une catégorie" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="amount_ht">Montant HT *</Label>
              <Input
                id="amount_ht"
                type="number"
                step="0.01"
                min="0"
                value={values.amount_ht || ''}
                onChange={(e) => update('amount_ht', parseFloat(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label>TVA</Label>
              <Select
                value={String(values.tva_rate)}
                onValueChange={(v) => update('tva_rate', parseFloat(v))}
                disabled={values.is_autoliquidation}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TVA_RATES.map((r) => (
                    <SelectItem key={r} value={String(r)}>
                      {r}%
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Montant TTC</Label>
              <Input value={values.amount.toFixed(2)} readOnly className="bg-muted" />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
            <div className="space-y-0.5">
              <Label htmlFor="autoliq" className="cursor-pointer">
                Autoliquidation TVA
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Cochez si &laquo;&nbsp;TVA due par le preneur&nbsp;&raquo; (sous-traitance BTP)
              </p>
            </div>
            <Switch
              id="autoliq"
              checked={values.is_autoliquidation}
              onCheckedChange={(c) => update('is_autoliquidation', c)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Mode de paiement</Label>
              <Select
                value={values.payment_method || ''}
                onValueChange={(v) => update('payment_method', v || null)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Non précisé" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Chantier (optionnel)</Label>
              <Select
                value={values.project_id || 'none'}
                onValueChange={(v) => update('project_id', v === 'none' ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Aucun" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Justificatif obligatoire */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1">
                Justificatif <span className="text-red-500">*</span>
              </Label>
              {hasReceipt && !receiptError && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                  <FileCheck2 className="h-3 w-3" /> Joint
                </span>
              )}
            </div>

            {hasExistingReceipt && !receiptFile ? (
              <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <FileCheck2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-emerald-900">Justificatif en place</p>
                    <p className="truncate text-[11px] text-emerald-700/80">
                      {values.receipt_storage_path?.split('/').pop()}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-7 text-[11px]"
                >
                  Remplacer
                </Button>
              </div>
            ) : receiptFile ? (
              <div className="flex items-center justify-between rounded-lg border border-[#D35400]/30 bg-orange-50/40 px-3 py-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <FileCheck2 className="h-4 w-4 shrink-0 text-[#D35400]" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{receiptFile.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {(receiptFile.size / 1024).toFixed(0)} Ko
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleReceiptSelected(null)}
                  className="h-7 w-7 p-0"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <div
                className={`rounded-lg border-2 border-dashed p-3 ${
                  receiptError ? 'border-red-300 bg-red-50/40' : 'border-border bg-muted/20'
                }`}
              >
                <p className="text-center text-[11px] text-muted-foreground mb-2">
                  Photo ou PDF de la facture — obligatoire
                </p>
                <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => cameraInputRef.current?.click()}
                    className="gap-1.5 bg-[#D35400] text-white hover:bg-[#b8470a]"
                  >
                    <Camera className="h-3.5 w-3.5" />
                    Photographier
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="gap-1.5"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    Choisir un fichier
                  </Button>
                </div>
              </div>
            )}

            {receiptError && (
              <p className="flex items-center gap-1 text-[11px] text-red-600">
                <AlertCircle className="h-3 w-3" /> {receiptError}
              </p>
            )}

            <input
              ref={cameraInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              capture="environment"
              className="hidden"
              onChange={(e) => handleReceiptSelected(e.target.files?.[0] || null)}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="hidden"
              onChange={(e) => handleReceiptSelected(e.target.files?.[0] || null)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !values.description.trim() || !values.supplier.trim() || values.amount_ht <= 0 || !hasReceipt}
            className="bg-[#D35400] hover:bg-[#b8470a]"
          >
            {submitting ? 'Enregistrement…' : values.id ? 'Mettre à jour' : 'Enregistrer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
