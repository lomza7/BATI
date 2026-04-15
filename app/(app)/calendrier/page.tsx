'use client';

import { ProGuard } from '@/components/paywall/pro-guard';
import { CalendrierView } from './calendrier-view';
import { PlanningView } from '../planning/planning-view';

export default function CalendrierPage() {
  return (
    <div className="flex flex-col gap-8 sm:gap-12">
      <CalendrierView />
      <ProGuard
        title="Planning équipe — fonctionnalité Pro"
        description="Organisez le planning de votre équipe en drag & drop avec le plan Pro."
      >
        <PlanningView />
      </ProGuard>
    </div>
  );
}
