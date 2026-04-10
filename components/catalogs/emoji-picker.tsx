'use client';

import { useState, useRef, useEffect } from 'react';

const EMOJI_CATEGORIES: { label: string; emojis: string[] }[] = [
  {
    label: 'Bâtiment',
    emojis: ['🏠', '🏗️', '🧱', '🪵', '🔨', '🪚', '⚒️', '🛠️', '🔧', '🪛', '🏡', '🏢', '🏘️', '🏰', '🪟', '🚪', '🪑', '🛋️', '🛏️', '🚿', '🛁', '🚰', '💡', '🔌', '🪜'],
  },
  {
    label: 'Matériaux',
    emojis: ['🪨', '💎', '🪩', '🧊', '🔩', '⚙️', '🧲', '🪣', '🎨', '🖌️', '🪣', '📐', '📏', '🧰', '🔑', '🗝️', '🪝', '📎', '🧲', '🛡️'],
  },
  {
    label: 'Nature',
    emojis: ['🌿', '🌱', '🪴', '🌳', '🌲', '🌻', '🌺', '🍀', '🍃', '🌾', '💧', '🔥', '☀️', '⚡', '🌊', '❄️', '🌈', '🌙', '⭐', '✨'],
  },
  {
    label: 'Formes',
    emojis: ['🔵', '🟢', '🔴', '🟡', '🟠', '🟣', '⚪', '⚫', '🟤', '💠', '🔶', '🔷', '🔸', '🔹', '▪️', '▫️', '◾', '◽', '🔲', '🔳'],
  },
  {
    label: 'Objets',
    emojis: ['🏷️', '📦', '📋', '📑', '🗂️', '💼', '🎯', '🏆', '🥇', '🎁', '🎀', '💰', '💳', '📱', '💻', '🖥️', '📸', '🗓️', '📊', '📈'],
  },
  {
    label: 'Visages',
    emojis: ['😊', '👍', '🤝', '💪', '👷', '👨‍🔧', '👩‍🔧', '🧑‍🏭', '👨‍💼', '👩‍💼', '🫡', '🤩', '😎', '🥰', '🔥', '💯', '✅', '❤️', '💙', '🧡'],
  },
];

interface Props {
  value: string;
  onChange: (emoji: string) => void;
  size?: 'sm' | 'md';
}

export function EmojiPicker({ value, onChange, size = 'md' }: Props) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const btnSize = size === 'sm' ? 'h-9 w-9' : 'h-11 w-11';
  const emojiSize = size === 'sm' ? 'text-lg' : 'text-2xl';

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`${btnSize} rounded-xl border border-border bg-white flex items-center justify-center hover:bg-muted/50 hover:border-primary/30 transition-all`}
      >
        {value ? (
          <span className={emojiSize}>{value}</span>
        ) : (
          <span className="text-muted-foreground/40 text-xs">+</span>
        )}
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 z-50 w-[320px] rounded-xl border border-border bg-white shadow-xl animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="flex border-b border-border overflow-x-auto scrollbar-none">
            {EMOJI_CATEGORIES.map((cat, i) => (
              <button
                key={cat.label}
                onClick={() => setActiveTab(i)}
                className={`px-3 py-2 text-xs font-medium whitespace-nowrap transition-all ${
                  activeTab === i
                    ? 'text-primary border-b-2 border-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
          <div className="p-3 grid grid-cols-8 gap-1 max-h-[200px] overflow-y-auto">
            {EMOJI_CATEGORIES[activeTab].emojis.map((emoji, i) => (
              <button
                key={`${emoji}-${i}`}
                onClick={() => { onChange(emoji); setOpen(false); }}
                className="h-9 w-9 rounded-lg flex items-center justify-center text-xl hover:bg-muted/60 transition-all hover:scale-110"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
