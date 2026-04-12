'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, Plus, Building2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface Props {
  value: string;
  onChange: (name: string) => void;
  className?: string;
  placeholder?: string;
}

/**
 * Autocomplete for supplier names.
 * Sources: contacts with contact_type = 'fournisseur'.
 * When the user picks a new name, it is auto-created as a fournisseur contact.
 */
export function SupplierPicker({ value, onChange, className, placeholder = 'Leroy Merlin' }: Props) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load supplier names from contacts (fournisseur type only)
  useEffect(() => {
    async function load() {
      const { data: clients } = await supabase
        .from('clients')
        .select('name')
        .eq('contact_type', 'fournisseur')
        .is('deleted_at', null)
        .order('name');

      const names: string[] = [];
      const seen = new Set<string>();
      (clients || []).forEach((c) => {
        const name = (c.name || '').trim();
        const key = name.toLowerCase();
        if (name && !seen.has(key)) {
          seen.add(key);
          names.push(name);
        }
      });
      names.sort((a, b) => a.localeCompare(b, 'fr'));
      setSuggestions(names);
    }
    load();
  }, []);

  // Sync external value
  useEffect(() => {
    setSearch(value);
  }, [value]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function createSupplierContact(name: string) {
    const { data: existing } = await supabase
      .from('clients')
      .select('id')
      .eq('contact_type', 'fournisseur')
      .ilike('name', name)
      .is('deleted_at', null)
      .maybeSingle();

    if (!existing) {
      await supabase.from('clients').insert({
        name,
        contact_type: 'fournisseur',
        email: '',
        phone: '',
        address: '',
        city: '',
        postal_code: '',
        notes: '',
      });
      // Update suggestions list
      setSuggestions((prev) => {
        const next = [...prev, name];
        next.sort((a, b) => a.localeCompare(b, 'fr'));
        return next;
      });
    }
  }

  const filtered = search.trim()
    ? suggestions.filter((s) => s.toLowerCase().includes(search.toLowerCase()))
    : suggestions;

  const showNew = search.trim() && !suggestions.some((s) => s.toLowerCase() === search.trim().toLowerCase());

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="pl-8"
        />
      </div>

      {open && (filtered.length > 0 || showNew) && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border bg-popover shadow-lg max-h-48 overflow-y-auto">
          {showNew && (
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50 text-[#D35400] font-medium"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                const name = search.trim();
                onChange(name);
                setOpen(false);
                createSupplierContact(name);
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              Nouveau fournisseur : {search.trim()}
            </button>
          )}
          {filtered.slice(0, 20).map((name) => (
            <button
              key={name}
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setSearch(name);
                onChange(name);
                setOpen(false);
              }}
            >
              <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
              {name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
