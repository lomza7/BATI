'use client';

import { cn } from '@/lib/utils';

interface MemberAvatarProps {
  name: string;
  avatarUrl?: string;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-lg',
};

export function MemberAvatar({ name, avatarUrl, color = '#E97F2A', size = 'md', className }: MemberAvatarProps) {
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={cn('shrink-0 rounded-full object-cover', sizes[size], className)}
      />
    );
  }

  return (
    <div
      className={cn('flex shrink-0 items-center justify-center rounded-full text-white font-semibold', sizes[size], className)}
      style={{ backgroundColor: color }}
    >
      {initials}
    </div>
  );
}
