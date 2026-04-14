'use client';

import { useAccessState } from '@/hooks/use-access-state';
import { LockedSection } from './locked-section';

interface ProGuardProps {
  children: React.ReactNode;
  feature?: 'pro' | 'ai';
  title?: string;
  description?: string;
}

export function ProGuard({ children, feature = 'pro', title, description }: ProGuardProps) {
  const { state, loading } = useAccessState();

  if (loading || !state) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
      </div>
    );
  }

  if (!state.hasProAccess) {
    return <LockedSection feature={feature} title={title} description={description} />;
  }

  return <>{children}</>;
}
