'use client';

import { useState } from 'react';
import { Sparkles, Check, Trash2, HardHat } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { OcrLineItem } from '@/lib/ai/expense-ocr-schema';

interface OcrReviewData {
  supplier: string;
  date: string;
  payment_method: string | null;
  is_autoliquidation: boolean;
  confidence: number;
  receipt_storage_path: string | null;
  amount_ht: number;
  amount_ttc: number;
  tva_total: number;
  lines: OcrLineItem[];
}

interface Project {
  id: string;
  name: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: OcrReviewData;
  projects: Project[];
  onConfirm: (selectedLines: OcrLineItem[], projectId: string | null) => void;
}

function formatEur(n: number) {
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
}

export function OcrReviewDialog({ open, onOpenChange, data, projects, onConfirm }: Props) {
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(data.lines.map((_, i) => i)),
  );
  const [projectId, setProjectId] = useState<string | null>(null);

  function toggle(idx: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === data.lines.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(data.lines.map((_, i) => i)));
    }
  }

  const selectedLines = data.lines.filter((_, i) => selected.has(i));
  const selectedHT = selectedLines.reduce((s, l) => s + l.amount_ht, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#D35400]" />
            Ticket analysé — {data.lines.length} ligne{data.lines.length > 1 ? 's' : ''}
          </DialogTitle>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{data.supplier}</span>
            {data.date && <span>· {data.date}</span>}
            <Badge variant="secondary" className="text-[10px]">
              {Math.round(data.confidence * 100)}% confiance
            </Badge>
          </div>
        </DialogHeader>

        {projects.length > 0 && (
          <div className="flex items-center gap-2">
            <HardHat className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Select
              value={projectId || 'none'}
              onValueChange={(v) => setProjectId(v === 'none' ? null : v)}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Attribuer à un chantier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Aucun chantier</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-1">
          <div className="flex items-center justify-between px-2 py-1.5 text-xs font-medium text-muted-foreground border-b">
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={selected.size === data.lines.length}
                onCheckedChange={toggleAll}
              />
              Tout sélectionner
            </label>
            <span>Montant HT</span>
          </div>

          {data.lines.map((line, i) => (
            <label
              key={i}
              className="flex items-start gap-3 rounded-lg px-2 py-2 hover:bg-muted/50 cursor-pointer transition-colors"
            >
              <Checkbox
                checked={selected.has(i)}
                onCheckedChange={() => toggle(i)}
                className="mt-0.5"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-tight">{line.description}</p>
                <p className="text-xs text-muted-foreground">
                  {line.quantity > 1 && `${line.quantity} × ${formatEur(line.unit_price_ht)} · `}
                  TVA {line.tva_rate}%
                </p>
              </div>
              <span className="text-sm font-semibold tabular-nums whitespace-nowrap">
                {formatEur(line.amount_ht)}
              </span>
            </label>
          ))}
        </div>

        <div className="flex items-center justify-between border-t pt-3 text-sm">
          <span className="text-muted-foreground">
            {selected.size} ligne{selected.size > 1 ? 's' : ''} sélectionnée{selected.size > 1 ? 's' : ''}
          </span>
          <span className="font-bold">{formatEur(selectedHT)} HT</span>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            disabled={selected.size === 0}
            onClick={() => onConfirm(selectedLines, projectId)}
            className="gap-2 bg-[#D35400] text-white hover:bg-[#b8470a]"
          >
            <Check className="h-4 w-4" />
            Importer {selected.size} dépense{selected.size > 1 ? 's' : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export type { OcrReviewData };
