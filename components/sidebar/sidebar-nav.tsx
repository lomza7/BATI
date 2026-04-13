'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Star, ChevronDown } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useWorkspace } from '@/hooks/use-workspace';
import { cn } from '@/lib/utils';
import { SidebarEmojiPicker } from './sidebar-emoji-picker';

interface NavItem {
  label: string;
  href: string;
  // Default emoji shown when the user hasn't picked a custom one. Chosen to
  // map directly to the feature so a craftsman scanning the sidebar can
  // recognize each item by glance, even with poor eyesight.
  emoji: string;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    title: 'Principal',
    items: [
      { label: 'Tableau de bord', href: '/dashboard', emoji: '📊' },
      { label: 'Calendrier', href: '/calendrier', emoji: '📅' },
      { label: 'Mes tâches', href: '/taches', emoji: '✅' },
      { label: 'Contacts', href: '/clients', emoji: '👤' },
      { label: 'Devis', href: '/devis', emoji: '📝' },
      { label: 'Factures', href: '/factures', emoji: '🧾' },
      { label: 'Mes prestations', href: '/prestations', emoji: '🛠️' },
      { label: 'Mes documents', href: '/documents', emoji: '📁' },
    ],
  },
  {
    title: 'Chantiers',
    items: [
      { label: 'Mes chantiers', href: '/chantiers', emoji: '🏗️' },
      { label: 'Planning', href: '/planning', emoji: '🗓️' },
      { label: 'Carte', href: '/carte', emoji: '🗺️' },
      { label: 'Équipe', href: '/equipe', emoji: '👷' },
    ],
  },
  {
    title: 'Commercial',
    items: [
      { label: 'Catalogues', href: '/catalogues', emoji: '📚' },
      { label: 'Prospection', href: '/prospection', emoji: '🎯' },
    ],
  },
  {
    title: 'Communication',
    items: [
      { label: 'Boîte mail', href: '/mail', emoji: '📧' },
      { label: 'Avis Google', href: '/avis', emoji: '⭐' },
    ],
  },
  {
    title: 'IA',
    items: [
      { label: 'Agents IA', href: '/agents', emoji: '🤖' },
      { label: 'Avant/Après IA', href: '/rendus', emoji: '🎨' },
      { label: 'Site web IA', href: '/site-web', emoji: '🌐' },
    ],
  },
  {
    title: 'Finance',
    items: [
      { label: 'Encaissement', href: '/encaissement', emoji: '📱' },
      { label: 'Paiement Stripe', href: '/paiements', emoji: '💳' },
      { label: 'Contrats récurrents', href: '/contrats', emoji: '🔄' },
      { label: 'Comptabilité IA', href: '/comptabilite', emoji: '🧮' },
    ],
  },
];

const FAVORITES_STORAGE_KEY = 'hellobat:sidebar:favorites';
const OPEN_GROUP_STORAGE_KEY = 'hellobat:sidebar:openGroup';
const EMOJIS_STORAGE_KEY = 'hellobat:sidebar:emojis';
const FAVORITES_GROUP_KEY = '__favorites__';
const DEFAULT_OPEN_GROUP = 'Principal';

function readFavorites(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function readOpenGroup(): string | null | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const raw = window.localStorage.getItem(OPEN_GROUP_STORAGE_KEY);
    if (raw === null) return undefined;
    if (raw === '') return null;
    return raw;
  } catch {
    return undefined;
  }
}

function readEmojis(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(EMOJIS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return Object.fromEntries(
        Object.entries(parsed).filter(
          ([k, v]) => typeof k === 'string' && typeof v === 'string'
        )
      ) as Record<string, string>;
    }
    return {};
  } catch {
    return {};
  }
}

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const { hasPermission } = useWorkspace();
  const isAdmin = user?.email === 'louis@maaza.pro';

  const [favorites, setFavorites] = useState<string[]>([]);
  // Accordion: a single non-favorites group is open at a time. `null` means
  // everything is collapsed. Default at first load = "Principal".
  const [openGroup, setOpenGroup] = useState<string | null>(DEFAULT_OPEN_GROUP);
  // Favoris is INDEPENDENT from the accordion: it always defaults to open on
  // every page load (state intentionally NOT persisted so a refresh reopens
  // it), but the user can still close it temporarily during a session.
  const [favOpen, setFavOpen] = useState(true);
  const [emojis, setEmojis] = useState<Record<string, string>>({});
  const [pickerOpenFor, setPickerOpenFor] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setFavorites(readFavorites());
    setEmojis(readEmojis());
    const stored = readOpenGroup();
    if (stored !== undefined) {
      setOpenGroup(stored);
    }
    setHydrated(true);
  }, []);

  function toggleFavorite(href: string) {
    setFavorites((prev) => {
      const next = prev.includes(href) ? prev.filter((h) => h !== href) : [...prev, href];
      try {
        window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore quota errors — favorites just won't persist
      }
      return next;
    });
  }

  function toggleGroup(key: string) {
    setOpenGroup((prev) => {
      const next = prev === key ? null : key;
      try {
        window.localStorage.setItem(OPEN_GROUP_STORAGE_KEY, next ?? '');
      } catch {
        // ignore
      }
      return next;
    });
  }

  function setEmoji(href: string, emoji: string) {
    setEmojis((prev) => {
      const next = { ...prev, [href]: emoji };
      try {
        window.localStorage.setItem(EMOJIS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
    setPickerOpenFor(null);
  }

  function clearEmoji(href: string) {
    setEmojis((prev) => {
      const next = { ...prev };
      delete next[href];
      try {
        window.localStorage.setItem(EMOJIS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
    setPickerOpenFor(null);
  }

  const filteredGroups = useMemo(() => {
    const allGroups = isAdmin
      ? [...navGroups, { title: 'Admin', items: [{ label: 'Administration', href: '/admin', emoji: '🛡️' }] }]
      : navGroups;

    return allGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => hasPermission(item.href)),
      }))
      .filter((group) => group.items.length > 0);
  }, [hasPermission, isAdmin]);

  // Build the favorites pseudo-group from filtered items so permission/admin
  // checks still apply. Order is preserved from the favorites array (insertion
  // order = the order the user starred them).
  const favoriteItems = useMemo<NavItem[]>(() => {
    if (!hydrated || favorites.length === 0) return [];
    const allItems = filteredGroups.flatMap((g) => g.items);
    return favorites
      .map((href) => allItems.find((it) => it.href === href))
      .filter((it): it is NavItem => Boolean(it));
  }, [favorites, filteredGroups, hydrated]);

  function renderItem(item: NavItem) {
    const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
    const isFav = favorites.includes(item.href);
    const customEmoji = emojis[item.href];
    // Effective emoji = user override OR the route's default emoji.
    const effectiveEmoji = customEmoji ?? item.emoji;
    const hasCustom = Boolean(customEmoji);
    const isPickerOpen = pickerOpenFor === item.href;

    return (
      <li key={item.href} className="group/item relative">
        <Link
          href={item.href}
          onClick={onNavigate}
          className={cn(
            'flex items-center rounded-lg pl-10 pr-9 py-2 text-[15px] transition-all duration-200 ease-out',
            isActive
              ? 'bg-white text-foreground font-medium shadow-sm translate-x-0'
              : 'text-muted-foreground hover:bg-white/60 hover:text-foreground hover:translate-x-0.5'
          )}
        >
          <span className="flex-1 truncate">{item.label}</span>
        </Link>

        {/* Active indicator: vertical accent bar that scales in */}
        <span
          aria-hidden
          className={cn(
            'absolute right-0 top-1/2 -translate-y-1/2 w-[2px] h-5 rounded-l-full bg-sidebar-accent transition-transform duration-200 ease-out origin-center',
            isActive ? 'scale-y-100' : 'scale-y-0'
          )}
        />

        {/* Emoji button — opens the picker. Always shows an emoji (default or
            custom). The "Réinitialiser" action only appears when there's a
            custom override to revert. */}
        <SidebarEmojiPicker
          open={isPickerOpen}
          onOpenChange={(o) => setPickerOpenFor(o ? item.href : null)}
          current={effectiveEmoji}
          canReset={hasCustom}
          onSelect={(e) => setEmoji(item.href, e)}
          onClear={() => clearEmoji(item.href)}
        >
          <button
            type="button"
            aria-label={`Modifier l'icône de ${item.label}`}
            className={cn(
              'absolute left-1.5 top-1/2 -translate-y-1/2 h-7 w-7 flex items-center justify-center rounded-md transition-all duration-200 ease-out',
              'hover:bg-black/5 hover:scale-110 active:scale-95',
              isPickerOpen && 'bg-black/5 scale-105'
            )}
          >
            <span className="text-[17px] leading-none select-none">{effectiveEmoji}</span>
          </button>
        </SidebarEmojiPicker>

        {/* Favorite star — visible on hover, sticky once starred */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleFavorite(item.href);
          }}
          aria-label={isFav ? `Retirer ${item.label} des favoris` : `Ajouter ${item.label} aux favoris`}
          aria-pressed={isFav}
          className={cn(
            'absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded transition-all duration-200 ease-out hover:scale-125',
            isFav
              ? 'opacity-100 text-amber-500 hover:text-amber-600'
              : 'opacity-0 pointer-events-none group-hover/item:opacity-100 group-hover/item:pointer-events-auto text-muted-foreground/60 hover:text-amber-500'
          )}
        >
          <Star className={cn('h-3.5 w-3.5 transition-all', isFav && 'fill-amber-500')} />
        </button>
      </li>
    );
  }

  function renderGroup(group: NavGroup, groupKey: string) {
    // Favoris is independent from the accordion: its own state, default open,
    // not persisted (so a refresh always reopens it). All other groups follow
    // the single-open accordion rule with persistence.
    const isFavoritesGroup = groupKey === FAVORITES_GROUP_KEY;
    const isCollapsed = isFavoritesGroup ? !favOpen : openGroup !== groupKey;
    const handleToggle = isFavoritesGroup
      ? () => setFavOpen((prev) => !prev)
      : () => toggleGroup(groupKey);
    return (
      <div key={groupKey}>
        <button
          type="button"
          onClick={handleToggle}
          aria-expanded={!isCollapsed}
          className="w-full px-3 mb-1.5 flex items-center justify-between text-[12px] font-semibold uppercase tracking-wider text-muted-foreground/70 hover:text-foreground transition-colors group/group"
        >
          <span className="group-hover/group:translate-x-0.5 transition-transform duration-200">
            {group.title}
          </span>
          <ChevronDown
            className={cn(
              'h-3 w-3 transition-transform duration-300 ease-out',
              isCollapsed && '-rotate-90'
            )}
          />
        </button>
        {!isCollapsed && (
          <ul className="space-y-0.5 animate-in fade-in slide-in-from-top-1 duration-200">
            {group.items.map(renderItem)}
          </ul>
        )}
      </div>
    );
  }

  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
      {favoriteItems.length > 0 &&
        renderGroup({ title: 'Favoris', items: favoriteItems }, FAVORITES_GROUP_KEY)}
      {filteredGroups.map((group) => renderGroup(group, group.title))}
    </nav>
  );
}
