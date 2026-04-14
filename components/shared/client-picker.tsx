'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, Plus, User, Phone, Mail, MapPin, Check, ChevronLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { CONTACT_TYPES } from '@/lib/constants';
import { DEFAULT_LEAD_SOURCES } from '@/lib/lead-sources';
import { AddressAutocomplete, type AddressResult } from '@/components/shared/address-autocomplete';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  postal_code: string;
  notes: string;
  source?: string;
  contact_type?: string;
}

interface ClientPickerProps {
  value: string | null; // client_id
  onChange: (clientId: string | null, client: Client | null) => void;
  className?: string;
}

const emptyForm = {
  name: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  postal_code: '',
  contact_type: 'client',
  source: '',
  notes: '',
};

export function ClientPicker({ value, onChange, className }: ClientPickerProps) {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(emptyForm);
  const [addressQuery, setAddressQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = clients.find(c => c.id === value);

  useEffect(() => {
    loadClients();
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node | null;
      if (!containerRef.current || !target) return;
      if (containerRef.current.contains(target)) return;
      // Ignore clicks inside Radix Popper portals (Select / Popover / DropdownMenu),
      // which are rendered at the body root and would otherwise be treated as
      // "outside" and close the create-client form mid-interaction.
      if (target instanceof Element && target.closest('[data-radix-popper-content-wrapper]')) {
        return;
      }
      setOpen(false);
      setShowCreate(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function loadClients() {
    const { data } = await supabase
      .from('clients')
      .select('*')
      .in('contact_type', ['client', 'prospect'])
      .is('deleted_at', null)
      .order('name');
    setClients((data as Client[]) || []);
  }

  async function createClient() {
    if (!createForm.name.trim() || !user) return;
    const { data } = await supabase.from('clients').insert({
      user_id: user.id,
      name: createForm.name.trim(),
      contact_type: createForm.contact_type,
      email: createForm.email,
      phone: createForm.phone,
      address: createForm.address,
      city: createForm.city,
      postal_code: createForm.postal_code,
      source: createForm.source,
      notes: createForm.notes,
    }).select().single();
    if (data) {
      await loadClients();
      onChange(data.id, data as Client);
      setSearch('');
      setShowCreate(false);
      setOpen(false);
      setCreateForm(emptyForm);
      setAddressQuery('');
    }
  }

  function handleAddressSelect(result: AddressResult) {
    setCreateForm(prev => ({
      ...prev,
      address: result.label,
      city: result.city || '',
      postal_code: result.postcode || '',
    }));
    setAddressQuery(result.label);
  }

  const filtered = search
    ? clients.filter(c =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.city.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search) ||
      c.email.toLowerCase().includes(search.toLowerCase())
    )
    : clients;

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* Selected client display / search input */}
      {selected && !open ? (
        <div
          className="flex items-center gap-3 rounded-md border border-input bg-card px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => setOpen(true)}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <User className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{selected.name}</p>
            <p className="text-xs text-muted-foreground truncate">
              {[selected.phone, selected.city].filter(Boolean).join(' — ') || 'Aucune info'}
            </p>
          </div>
          <button
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={(e) => { e.stopPropagation(); onChange(null, null); setOpen(true); }}
          >
            Changer
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => { setSearch(e.target.value); setOpen(true); setShowCreate(false); }}
            onFocus={() => setOpen(true)}
            placeholder="Rechercher ou créer un client…"
            className="pl-10"
          />
        </div>
      )}

      {/* Dropdown */}
      {open && !selected && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-popover shadow-lg overflow-hidden">
          {showCreate ? (
            <div className="p-4 space-y-3 max-h-[420px] overflow-y-auto">
              <div className="flex items-center gap-2 mb-1">
                <button
                  type="button"
                  className="p-1 rounded hover:bg-muted transition-colors"
                  onClick={() => setShowCreate(false)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <p className="text-sm font-semibold">Nouveau client</p>
              </div>

              {/* Nom */}
              <div>
                <label className="text-xs font-medium text-muted-foreground">Nom *</label>
                <Input
                  className="mt-1"
                  placeholder="Nom complet"
                  value={createForm.name}
                  onChange={e => setCreateForm({ ...createForm, name: e.target.value })}
                />
              </div>

              {/* Type de contact + Source */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Type</label>
                  <Select value={createForm.contact_type} onValueChange={v => setCreateForm({ ...createForm, contact_type: v })}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(CONTACT_TYPES).map(([key, val]) => (
                        <SelectItem key={key} value={key}>{val.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Source</label>
                  <Select value={createForm.source || 'none'} onValueChange={v => setCreateForm({ ...createForm, source: v === 'none' ? '' : v })}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Source…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Non renseigné</SelectItem>
                      {DEFAULT_LEAD_SOURCES.map(s => (
                        <SelectItem key={s.slug} value={s.slug}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Téléphone + Email */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Téléphone</label>
                  <Input className="mt-1" placeholder="06 12 34 56 78" value={createForm.phone} onChange={e => setCreateForm({ ...createForm, phone: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Email *</label>
                  <Input className="mt-1" placeholder="email@example.com" type="email" required value={createForm.email} onChange={e => setCreateForm({ ...createForm, email: e.target.value })} />
                </div>
              </div>

              {/* Adresse avec autocomplétion */}
              <div>
                <label className="text-xs font-medium text-muted-foreground">Adresse</label>
                <AddressAutocomplete
                  className="mt-1"
                  value={addressQuery}
                  onChange={setAddressQuery}
                  onSelect={handleAddressSelect}
                  placeholder="Tapez une adresse…"
                />
              </div>

              {/* CP + Ville (pré-remplis par l'autocomplétion) */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Code postal</label>
                  <Input className="mt-1" placeholder="75000" value={createForm.postal_code} onChange={e => setCreateForm({ ...createForm, postal_code: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Ville</label>
                  <Input className="mt-1" placeholder="Paris" value={createForm.city} onChange={e => setCreateForm({ ...createForm, city: e.target.value })} />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs font-medium text-muted-foreground">Notes</label>
                <textarea
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                  rows={2}
                  placeholder="Informations complémentaires…"
                  value={createForm.notes}
                  onChange={e => setCreateForm({ ...createForm, notes: e.target.value })}
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" size="sm" onClick={() => setShowCreate(false)}>Annuler</Button>
                <Button size="sm" onClick={createClient} disabled={!createForm.name.trim() || !createForm.email.trim()}>Créer le client</Button>
              </div>
            </div>
          ) : (
            <>
              <div className="max-h-[220px] overflow-y-auto">
                {filtered.length === 0 ? (
                  <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                    Aucun client trouvé
                  </div>
                ) : filtered.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    className={cn(
                      'flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-accent',
                      c.id === value && 'bg-accent'
                    )}
                    onClick={() => { onChange(c.id, c); setOpen(false); setSearch(''); }}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <User className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{c.name}</p>
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                        {c.phone && <span className="flex items-center gap-0.5"><Phone className="h-3 w-3" />{c.phone}</span>}
                        {c.city && <span className="flex items-center gap-0.5"><MapPin className="h-3 w-3" />{c.city}</span>}
                      </div>
                    </div>
                    {c.id === value && <Check className="h-4 w-4 text-primary shrink-0" />}
                  </button>
                ))}
              </div>
              <div className="border-t border-border p-2">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-primary hover:bg-primary/5 transition-colors"
                  onClick={() => { setShowCreate(true); setCreateForm({ ...emptyForm, name: search }); }}
                >
                  <Plus className="h-4 w-4" /> Créer un nouveau client{search ? ` "${search}"` : ''}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
