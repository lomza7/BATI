'use client';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { RotateCcw } from 'lucide-react';

// Curated set of emojis relevant to a French BTP / craftsman SaaS.
// Kept short on purpose — a long list adds friction. Notion has 3000+
// because it's a generic note-taking tool; here we know the domain.
const EMOJI_CATEGORIES: { name: string; emojis: string[] }[] = [
  {
    name: 'Outils',
    emojis: ['🔨', '🛠️', '🪛', '🔧', '⚒️', '🪚', '🪜', '🧰', '🪣', '⚡', '💡', '🔌'],
  },
  {
    name: 'Bâtiment',
    emojis: ['🏠', '🏡', '🏢', '🏗️', '🚧', '🧱', '🛖', '🏘️', '🪟', '🚪', '🛁', '🚽'],
  },
  {
    name: 'Gestion',
    emojis: ['📋', '📊', '📈', '📉', '🗂️', '📁', '📂', '📝', '✅', '📌', '📎', '🗒️'],
  },
  {
    name: 'Calendrier',
    emojis: ['📅', '📆', '🗓️', '⏰', '⏱️', '🕐', '⌛'],
  },
  {
    name: 'Argent',
    emojis: ['💰', '💵', '💶', '💳', '💸', '🧾', '💼', '🏦'],
  },
  {
    name: 'Communication',
    emojis: ['📞', '📱', '📧', '💬', '✉️', '📨', '📫', '📣', '🔔'],
  },
  {
    name: 'Personnes',
    emojis: ['👷', '👥', '👤', '🧑‍🔧', '🧑‍💼', '🤝', '🙋'],
  },
  {
    name: 'IA & Tech',
    emojis: ['🤖', '⚙️', '🌐', '💻', '🎨', '✨', '🚀', '🧠'],
  },
  {
    name: 'Symboles',
    emojis: ['⭐', '🌟', '🎯', '🔥', '❤️', '💯', '🏆', '📍', '⚠️'],
  },
];

interface SidebarEmojiPickerProps {
  /** The trigger element — typically the icon/emoji button itself. */
  children: React.ReactNode;
  /** Effective emoji shown for this item — used to highlight the current
   *  pick in the grid. May be the route's default OR a user override. */
  current?: string;
  /** Whether the user has actually overridden the default. Drives the
   *  visibility of the "Réinitialiser" button. */
  canReset?: boolean;
  /** Called when the user picks an emoji. */
  onSelect: (emoji: string) => void;
  /** Called when the user resets back to the route's default emoji. */
  onClear: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SidebarEmojiPicker({
  children,
  current,
  canReset,
  onSelect,
  onClear,
  open,
  onOpenChange,
}: SidebarEmojiPickerProps) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        align="start"
        side="right"
        sideOffset={8}
        collisionPadding={16}
        className="w-60 p-0 overflow-hidden flex flex-col"
        style={{ maxHeight: 'min(300px, var(--radix-popover-content-available-height))' }}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
          <p className="text-xs font-semibold text-foreground">Choisir une icône</p>
          {canReset && (
            <button
              type="button"
              onClick={onClear}
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
              Réinitialiser
            </button>
          )}
        </div>

        <div
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-2 py-2 space-y-2.5"
          onWheel={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
        >
          {EMOJI_CATEGORIES.map((cat) => (
            <div key={cat.name}>
              <p className="px-1 mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
                {cat.name}
              </p>
              <div className="grid grid-cols-6 gap-0.5">
                {cat.emojis.map((emoji) => {
                  const isSelected = current === emoji;
                  return (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => onSelect(emoji)}
                      className={cn(
                        'h-8 w-8 flex items-center justify-center rounded-md text-lg leading-none transition-all duration-150',
                        isSelected
                          ? 'bg-sidebar-accent/15 ring-1 ring-sidebar-accent scale-105'
                          : 'hover:bg-muted hover:scale-110'
                      )}
                      aria-label={`Choisir ${emoji}`}
                      aria-pressed={isSelected}
                    >
                      {emoji}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
