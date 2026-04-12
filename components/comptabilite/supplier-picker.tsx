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
 * Sources: unique supplier names from expenses + client names from clients table.
 * The user can also type a new name freely.
 */
export function SupplierPicker({ value, onChange, className, placeholder = 'Leroy Merlin' }: Props) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load all unique supplier names once
  useEffect(() => {
    async function load() {
      // Get unique suppliers from expenses
      const { data: expenses } = await supabase
        .from('expenses')
        .select('supplier')
        .neq('supplier', '')
        .order('supplier');

      const expenseNames = new Set<string>();
      (expenses || []).forEach((e) => {
        const name = (e.supplier || '').trim();
        if (name) expenseNames.add(name);
      });

      // Get client names (all contact types)
      const { data: clients } = await supabase
        .from('clients')
        .select('name')
        .is('deleted_at', null)
        .order('name');

      const clientNames = new Set<string>();
      (clients || []).forEach((c) => {
        const name = (c.name || '').trim();
        if (name) clientNames.add(name);
      });

      // Merge and deduplicate (case-insensitive)
      const seen = new Set<string>();
      const all: string[] = [];
      const merged = Array.from(expenseNames).concat(Array.from(clientNames));
      for (let i = 0; i < merged.length; i++) {
        const name = merged[i];
        const key = name.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          all.push(name);
        }
      }
      all.sort((a, b) => a.localeCompare(b, 'fr'));
      setSuggestions(all);
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
                onChange(search.trim());
                setOpen(false);
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              Nouveau : {search.trim()}
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
