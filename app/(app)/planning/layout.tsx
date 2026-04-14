import { ProGuard } from '@/components/paywall/pro-guard';

export default function PlanningLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProGuard
      title="Planning équipe — fonctionnalité Pro"
      description="Organisez le planning de votre équipe en drag & drop avec le plan Pro."
    >
      {children}
    </ProGuard>
  );
}
