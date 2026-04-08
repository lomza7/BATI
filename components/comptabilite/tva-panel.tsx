'use client';

import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card } from '@/components/ui/card';

interface ExpenseRow {
  date: string;
  amount_ht: number | null;
  tva_amount: number | null;
  tva_rate: number | null;
  is_autoliquidation: boolean | null;
}

interface InvoiceRow {
  paid_at: string | null;
  issued_at: string | null;
  created_at: string;
  total_ht: number | null;
  total_ttc: number | null;
  tva_rate: number | null;
}

interface Props {
  expenses: ExpenseRow[];
  invoices: InvoiceRow[];
  tvaMethod: 'encaissements' | 'debits';
  vatRegime: string | null;
}

const TVA_RATES = [20, 10, 5.5, 2.1, 0];

function fmtEur(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n || 0);
}

function ymKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function buildPeriodOptions() {
  const out: { value: string; label: string }[] = [];
  const now = new Date();
  // Année courante
  out.push({ value: `year:${now.getFullYear()}`, label: `Année ${now.getFullYear()}` });
  out.push({ value: `year:${now.getFullYear() - 1}`, label: `Année ${now.getFullYear() - 1}` });
  // Trimestres courante année
  for (let q = 1; q <= 4; q += 1) {
    out.push({ value: `quarter:${now.getFullYear()}:${q}`, label: `T${q} ${now.getFullYear()}` });
  }
  // 12 derniers mois
  for (let i = 0; i < 12; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    out.push({ value: `month:${ymKey(d)}`, label: label.charAt(0).toUpperCase() + label.slice(1) });
  }
  return out;
}

function isInPeriod(dateStr: string | null | undefined, period: string): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  if (period.startsWith('year:')) {
    return d.getFullYear() === Number(period.split(':')[1]);
  }
  if (period.startsWith('quarter:')) {
    const [, y, q] = period.split(':');
    if (d.getFullYear() !== Number(y)) return false;
    const month = d.getMonth(); // 0-11
    const quarter = Math.floor(month / 3) + 1;
    return quarter === Number(q);
  }
  if (period.startsWith('month:')) {
    return ymKey(d) === period.split(':')[1];
  }
  return false;
}

export function TvaPanel({ expenses, invoices, tvaMethod, vatRegime }: Props) {
  const [period, setPeriod] = useState(() => `year:${new Date().getFullYear()}`);
  const periodOptions = useMemo(() => buildPeriodOptions(), []);

  const isFranchise = vatRegime === 'franchise_en_base';

  const computed = useMemo(() => {
    // TVA collectée : depuis les factures dans la période (selon méthode)
    const collected: Record<string, { ht: number; tva: number }> = {};
    for (const r of TVA_RATES) collected[String(r)] = { ht: 0, tva: 0 };

    for (const inv of invoices) {
      const refDate = tvaMethod === 'encaissements' ? inv.paid_at : inv.issued_at || inv.created_at;
      if (!refDate) continue;
      if (!isInPeriod(refDate, period)) continue;
      const ht = Number(inv.total_ht || 0);
      const ttc = Number(inv.total_ttc || 0);
      const tva = Math.max(0, ttc - ht);
      const rate = inv.tva_rate != null ? Number(inv.tva_rate) : 20;
      const key = String(rate in collected ? rate : 20);
      collected[key] = collected[key] || { ht: 0, tva: 0 };
      collected[key].ht += ht;
      collected[key].tva += tva;
    }

    // TVA déductible : depuis les dépenses dans la période (toujours date pièce)
    const deductible: Record<string, { ht: number; tva: number }> = {};
    for (const r of TVA_RATES) deductible[String(r)] = { ht: 0, tva: 0 };

    for (const exp of expenses) {
      if (!isInPeriod(exp.date, period)) continue;
      if (exp.is_autoliquidation) continue;
      const ht = Number(exp.amount_ht || 0);
      const tva = Number(exp.tva_amount || 0);
      const rate = exp.tva_rate != null ? Number(exp.tva_rate) : 20;
      const key = String(rate in deductible ? rate : 20);
      deductible[key] = deductible[key] || { ht: 0, tva: 0 };
      deductible[key].ht += ht;
      deductible[key].tva += tva;
    }

    const totalCollected = Object.values(collected).reduce((s, v) => s + v.tva, 0);
    const totalDeductible = Object.values(deductible).reduce((s, v) => s + v.tva, 0);
    const balance = totalCollected - totalDeductible;

    return { collected, deductible, totalCollected, totalDeductible, balance };
  }, [expenses, invoices, period, tvaMethod]);

  function handleExportCsv() {
    const rows: string[] = [];
    rows.push(['Section', 'Taux', 'Base HT', 'TVA'].join(';'));
    for (const r of TVA_RATES) {
      const c = computed.collected[String(r)];
      if (c.ht > 0 || c.tva > 0) {
        rows.push(['TVA collectée', `${r}%`, c.ht.toFixed(2), c.tva.toFixed(2)].join(';'));
      }
    }
    for (const r of TVA_RATES) {
      const d = computed.deductible[String(r)];
      if (d.ht > 0 || d.tva > 0) {
        rows.push(['TVA déductible', `${r}%`, d.ht.toFixed(2), d.tva.toFixed(2)].join(';'));
      }
    }
    rows.push(['Total collectée', '', '', computed.totalCollected.toFixed(2)].join(';'));
    rows.push(['Total déductible', '', '', computed.totalDeductible.toFixed(2)].join(';'));
    rows.push([
      computed.balance >= 0 ? 'TVA à reverser' : 'Crédit de TVA',
      '',
      '',
      Math.abs(computed.balance).toFixed(2),
    ].join(';'));

    const csv = '\uFEFF' + rows.join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tva-${period.replace(/:/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (isFranchise) {
    return (
      <Card className="p-6">
        <h3 className="text-base font-semibold">Vous êtes en franchise de TVA</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          En tant que micro-entrepreneur ou en franchise en base, vous ne facturez pas la TVA et n&apos;avez
          pas de déclaration à effectuer. Vous pouvez modifier votre régime fiscal dans les paramètres
          si votre situation a changé.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <Label htmlFor="period">Période</Label>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger id="period" className="w-full sm:w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {periodOptions.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground">
            Méthode : {tvaMethod === 'encaissements' ? 'TVA sur encaissements' : 'TVA sur débits'}
          </p>
        </div>
        <Button variant="outline" onClick={handleExportCsv} className="gap-2">
          <Download className="h-4 w-4" />
          Exporter CSV
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-border bg-muted/30 px-4 py-2 text-xs font-semibold uppercase text-muted-foreground">
          TVA collectée (sur recettes)
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="px-4 py-2 text-left font-medium">Taux</th>
                <th className="px-4 py-2 text-right font-medium">Base HT</th>
                <th className="px-4 py-2 text-right font-medium">TVA</th>
              </tr>
            </thead>
            <tbody>
              {TVA_RATES.map((r) => {
                const c = computed.collected[String(r)];
                if (!c || (c.ht === 0 && c.tva === 0)) return null;
                return (
                  <tr key={r} className="border-b border-border/60">
                    <td className="px-4 py-2">{r}%</td>
                    <td className="px-4 py-2 text-right tabular-nums">{fmtEur(c.ht)}</td>
                    <td className="px-4 py-2 text-right tabular-nums font-medium">{fmtEur(c.tva)}</td>
                  </tr>
                );
              })}
              {computed.totalCollected === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-4 text-center text-xs text-muted-foreground">
                    Aucune recette sur la période
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="bg-muted/30">
                <td className="px-4 py-2 text-xs font-semibold uppercase text-muted-foreground">Total</td>
                <td />
                <td className="px-4 py-2 text-right tabular-nums font-semibold">
                  {fmtEur(computed.totalCollected)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-border bg-muted/30 px-4 py-2 text-xs font-semibold uppercase text-muted-foreground">
          TVA déductible (sur dépenses)
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="px-4 py-2 text-left font-medium">Taux</th>
                <th className="px-4 py-2 text-right font-medium">Base HT</th>
                <th className="px-4 py-2 text-right font-medium">TVA</th>
              </tr>
            </thead>
            <tbody>
              {TVA_RATES.map((r) => {
                const d = computed.deductible[String(r)];
                if (!d || (d.ht === 0 && d.tva === 0)) return null;
                return (
                  <tr key={r} className="border-b border-border/60">
                    <td className="px-4 py-2">{r}%</td>
                    <td className="px-4 py-2 text-right tabular-nums">{fmtEur(d.ht)}</td>
                    <td className="px-4 py-2 text-right tabular-nums font-medium">{fmtEur(d.tva)}</td>
                  </tr>
                );
              })}
              {computed.totalDeductible === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-4 text-center text-xs text-muted-foreground">
                    Aucune dépense déductible sur la période
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="bg-muted/30">
                <td className="px-4 py-2 text-xs font-semibold uppercase text-muted-foreground">Total</td>
                <td />
                <td className="px-4 py-2 text-right tabular-nums font-semibold">
                  {fmtEur(computed.totalDeductible)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      <Card
        className={`p-4 ${
          computed.balance >= 0
            ? 'border-[#D35400]/40 bg-orange-50/40'
            : 'border-emerald-300/40 bg-emerald-50/40'
        }`}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {computed.balance >= 0 ? 'TVA à reverser' : 'Crédit de TVA'}
            </p>
            <p
              className={`mt-1 text-2xl font-bold tabular-nums ${
                computed.balance >= 0 ? 'text-[#D35400]' : 'text-emerald-700'
              }`}
            >
              {fmtEur(Math.abs(computed.balance))}
            </p>
          </div>
          <div className="text-right text-[11px] text-muted-foreground">
            <p>Collectée : {fmtEur(computed.totalCollected)}</p>
            <p>− Déductible : {fmtEur(computed.totalDeductible)}</p>
          </div>
        </div>
      </Card>

      <p className="text-[11px] text-muted-foreground">
        Estimation indicative. La déclaration officielle (CA3 / CA12) doit être validée par votre
        comptable. Les dépenses en autoliquidation TVA ne sont pas comptées comme déductibles côté
        artisan.
      </p>
    </div>
  );
}
