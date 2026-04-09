'use client';

import { useEffect, useState } from 'react';
import { Landmark, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { maskIban, type BankAccountRow } from '@/lib/banks';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { BankAccountForm } from '@/components/shared/bank-account-form';
import { cn } from '@/lib/utils';

/**
 * CRUD card pour les coordonnees bancaires affichee dans l'onglet
 * Parametres > Banque. Liste les RIB actifs, permet d'en ajouter, d'en
 * editer un, de definir le compte par defaut ou de soft-delete un compte.
 */
export function BankAccountsCard() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<BankAccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<BankAccountRow | null>(null);
  const [deleting, setDeleting] = useState<BankAccountRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    load();
  }, [user]);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('bank_accounts')
      .select('id, label, bank_name, bank_slug, account_holder, iban, bic, is_default, created_at')
      .is('deleted_at', null)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });
    setAccounts((data as BankAccountRow[]) || []);
    setLoading(false);
  }

  async function setDefault(account: BankAccountRow) {
    if (account.is_default || !user) return;
    setBusyId(account.id);
    // Clear the old default first, then mark this one.
    await supabase
      .from('bank_accounts')
      .update({ is_default: false })
      .eq('user_id', user.id)
      .eq('is_default', true)
      .is('deleted_at', null);
    await supabase.from('bank_accounts').update({ is_default: true }).eq('id', account.id);
    setBusyId(null);
    await load();
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusyId(deleting.id);
    await supabase
      .from('bank_accounts')
      .update({ deleted_at: new Date().toISOString(), is_default: false })
      .eq('id', deleting.id);
    setBusyId(null);
    setDeleting(null);
    await load();
  }

  function handleSaved() {
    setShowForm(false);
    setEditing(null);
    load();
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-xl">Mes RIB</CardTitle>
          <CardDescription>
            Les coordonnées bancaires que tu peux joindre à tes devis et factures pour que tes clients te payent par virement.
          </CardDescription>
        </div>
        <Button
          size="sm"
          className="bg-[#d35400] text-white hover:bg-[#b94800]"
          onClick={() => { setEditing(null); setShowForm(true); }}
        >
          <Plus className="h-4 w-4 mr-1" /> Ajouter un RIB
        </Button>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Chargement…</div>
        ) : accounts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#d35400]/10 text-[#d35400]">
              <Landmark className="h-5 w-5" />
            </div>
            <p className="mt-3 text-sm font-medium">Aucun RIB enregistré</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Ajoute ton premier compte pour qu&apos;il apparaisse automatiquement sur tes documents.
            </p>
            <Button
              size="sm"
              className="mt-4 bg-[#d35400] text-white hover:bg-[#b94800]"
              onClick={() => { setEditing(null); setShowForm(true); }}
            >
              <Plus className="h-4 w-4 mr-1" /> Ajouter mon premier RIB
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {accounts.map((account) => (
              <div
                key={account.id}
                className={cn(
                  'rounded-xl border bg-card p-4 transition-colors',
                  account.is_default ? 'border-[#d35400]/40 bg-[#d35400]/5' : 'border-border hover:border-border/80',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#d35400]/10 text-[#d35400]">
                      <Landmark className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold">{account.label}</p>
                        {account.is_default && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#d35400] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white">
                            <Star className="h-2.5 w-2.5 fill-current" /> Par défaut
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {account.bank_name} — {account.account_holder}
                      </p>
                      <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                        {maskIban(account.iban)}
                      </p>
                      <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                        BIC : {account.bic}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {!account.is_default && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 gap-1 px-2 text-xs"
                        onClick={() => setDefault(account)}
                        disabled={busyId === account.id}
                      >
                        <Star className="h-3.5 w-3.5" /> Défaut
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      onClick={() => { setEditing(account); setShowForm(true); }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      onClick={() => setDeleting(account)}
                      disabled={busyId === account.id}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Add / edit dialog */}
      <Dialog open={showForm} onOpenChange={(o) => { if (!o) { setShowForm(false); setEditing(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Modifier le RIB' : 'Ajouter un RIB'}</DialogTitle>
            <DialogDescription>
              Ces coordonnées s&apos;afficheront sur tes devis et factures pour que le client puisse te payer par virement.
            </DialogDescription>
          </DialogHeader>
          <BankAccountForm
            variant="dialog"
            initialAccount={editing}
            forceDefault={!editing && accounts.length === 0}
            onSaved={handleSaved}
            onCancel={() => { setShowForm(false); setEditing(null); }}
          />
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Supprimer ce RIB ?</DialogTitle>
            <DialogDescription>
              {deleting?.label} — {deleting && maskIban(deleting.iban)}
              <br />
              Les devis et factures qui utilisent déjà ce compte continueront à l&apos;afficher, mais tu ne pourras plus le sélectionner sur de nouveaux documents.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleting(null)} disabled={busyId === deleting?.id}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={busyId === deleting?.id}
            >
              {busyId === deleting?.id ? 'Suppression…' : 'Supprimer'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
