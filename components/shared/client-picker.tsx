'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, Plus, User, Phone, Mail, MapPin, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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
}

interface ClientPickerProps {
  value: string | null; // client_id
  onChange: (clientId: string | null, client: Client | null) => void;
  className?: string;
}

export function ClientPicker({ value, onChange, className }: ClientPickerProps) {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', email: '', phone: '', address: '', city: '', postal_code: '' });
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = clients.find(c => c.id === value);

  useEffect(() => {
    loadClients();
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setShowCreate(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function loadClients() {
    const { data } = await supabase.from('clients').select('*').order('name');
    setClients((data as Client[]) || []);
  }

  async function createClient() {
    if (!createForm.name.trim() || !user) return;
    const { data } = await supabase.from('clients').insert({
      user_id: user.id,
      name: createForm.name.trim(),
      email: createForm.email,
      phone: createForm.phone,
      address: createForm.address,
      city: createForm.city,
      postal_code: createForm.postal_code,
    }).select().single();
    if (data) {
      await loadClients();
      onChange(data.id, data as Client);
      setSearch('');
      setShowCreate(false);
      setOpen(false);
      setCreateForm({ name: '', email: '', phone: '', address: '', city: '', postal_code: '' });
    }
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
            placeholder="Rechercher ou creer un client..."
            className="pl-10"
          />
        </div>
      )}

      {/* Dropdown */}
      {open && !selected && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-popover shadow-lg overflow-hidden">
          {showCreate ? (
            <div className="p-3 space-y-3">
              <p className="text-sm font-medium">Nouveau client</p>
              <Input placeholder="Nom *" value={createForm.name} onChange={e => setCreateForm({ ...createForm, name: e.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Telephone" value={createForm.phone} onChange={e => setCreateForm({ ...createForm, phone: e.target.value })} />
                <Input placeholder="Email" value={createForm.email} onChange={e => setCreateForm({ ...createForm, email: e.target.value })} />
              </div>
              <Input placeholder="Adresse" value={createForm.address} onChange={e => setCreateForm({ ...createForm, address: e.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Code postal" value={createForm.postal_code} onChange={e => setCreateForm({ ...createForm, postal_code: e.target.value })} />
                <Input placeholder="Ville" value={createForm.city} onChange={e => setCreateForm({ ...createForm, city: e.target.value })} />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowCreate(false)}>Retour</Button>
                <Button size="sm" onClick={createClient} disabled={!createForm.name.trim()}>Creer</Button>
              </div>
            </div>
          ) : (
            <>
              <div className="max-h-[220px] overflow-y-auto">
                {filtered.length === 0 ? (
                  <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                    Aucun client trouve
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
                  onClick={() => { setShowCreate(true); setCreateForm({ ...createForm, name: search }); }}
                >
                  <Plus className="h-4 w-4" /> Creer un nouveau client{search ? ` "${search}"` : ''}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
