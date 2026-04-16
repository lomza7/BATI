'use client';

import { useRef, useEffect } from 'react';

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const BULLET = '• ';

export function DetailTextarea({ value, onChange, placeholder }: Props) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(el.scrollHeight, 76)}px`;
  }, [value]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== 'Enter' || e.shiftKey) return;
    e.preventDefault();
    const target = e.currentTarget;
    const start = target.selectionStart ?? value.length;
    const end = target.selectionEnd ?? value.length;

    const needsLeadingBullet = value.trim().length === 0 && start === 0;
    const insert = needsLeadingBullet ? `${BULLET}` : `\n${BULLET}`;

    const next = value.slice(0, start) + insert + value.slice(end);
    onChange(next);

    requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      const cursor = start + insert.length;
      el.focus();
      el.setSelectionRange(cursor, cursor);
    });
  }

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      rows={3}
      className="w-full min-h-[76px] rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
    />
  );
}
