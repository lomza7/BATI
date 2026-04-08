'use client';

import { useState } from 'react';
import { Mail } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface AccountantInviteValues {
  accountant_email: string;
  accountant_name: string;
  scope: 'full' | 'fiscal_year' | 'period';
  scope_year: number | null;
  scope_start: string | null;
  scope_end: string | null;
  duration_days: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: AccountantInviteValues) => Promise<void>;
}

export function AccountantInviteDialog({ open, onOpenChange, onSubmit }: Props) {
  const currentYear = new Date().getFullYear();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [scope, setScope] = useState<'full' | 'fiscal_year' | 'period'>('fiscal_year');
  const [scopeYear, setScopeYear] = useState(currentYear);
  const [scopeStart, setScopeStart] = useState('');
  const [scopeEnd, setScopeEnd] = useState('');
  const [duration, setDuration] = useState(90);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setEmail('');
    setName('');
    setScope('fiscal_year');
    setScopeYear(currentYear);
    setScopeStart('');
    setScopeEnd('');
    setDuration(90);
    setError(null);
  }

  async function handleSubmit() {
    setError(null);
    if (!email.trim() || !email.includes('@')) {
      setError('Adresse email invalide');
      return;
    }
    if (scope === 'period' && (!scopeStart || !scopeEnd)) {
      setError('Renseignez la période');
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({
        accountant_email: email.trim(),
        accountant_name: name.trim(),
        scope,
        scope_year: scope === 'fiscal_year' ? scopeYear : null,
        scope_start: scope === 'period' ? scopeStart : null,
        scope_end: scope === 'period' ? scopeEnd : null,
        duration_days: duration,
      });
      reset();
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible d'envoyer l'invitation");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-[#D35400]" />
            Inviter votre comptable
          </DialogTitle>
          <DialogDescription>
            Votre comptable recevra un lien sécurisé en lecture seule pour consulter et exporter vos
            données comptables.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="cabinet@expert-comptable.fr"
              />
            </div>
            <div>
              <Label htmlFor="name">Nom (optionnel)</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Cabinet Dupont"
              />
            </div>
          </div>

          <div>
            <Label>Périmètre des données partagées</Label>
            <Select value={scope} onValueChange={(v) => setScope(v as typeof scope)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="full">Toutes mes données comptables</SelectItem>
                <SelectItem value="fiscal_year">Année fiscale précise</SelectItem>
                <SelectItem value="period">Période personnalisée</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {scope === 'fiscal_year' && (
            <div>
              <Label htmlFor="year">Année</Label>
              <Select value={String(scopeYear)} onValueChange={(v) => setScopeYear(Number(v))}>
                <SelectTrigger id="year">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[currentYear, currentYear - 1, currentYear - 2, currentYear - 3].map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {scope === 'period' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="start">Du</Label>
                <Input
                  id="start"
                  type="date"
                  value={scopeStart}
                  onChange={(e) => setScopeStart(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="end">Au</Label>
                <Input
                  id="end"
                  type="date"
                  value={scopeEnd}
                  onChange={(e) => setScopeEnd(e.target.value)}
                />
              </div>
            </div>
          )}

          <div>
            <Label>Durée d&apos;accès</Label>
            <Select value={String(duration)} onValueChange={(v) => setDuration(Number(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30 jours</SelectItem>
                <SelectItem value="90">90 jours</SelectItem>
                <SelectItem value="180">6 mois</SelectItem>
                <SelectItem value="365">1 an</SelectItem>
              </SelectContent>
            </Select>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Vous pouvez révoquer l&apos;accès à tout moment.
            </p>
          </div>

          {error && (
            <p className="rounded-md bg-red-50 p-2 text-xs text-red-600">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !email.trim()}
            className="bg-[#D35400] hover:bg-[#b8470a]"
          >
            {submitting ? 'Envoi…' : "Envoyer l'invitation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
