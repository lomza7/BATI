import { ProGuard } from '@/components/paywall/pro-guard';

export default function ProspectionLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProGuard
      title="Prospection CRM — fonctionnalité Pro"
      description="Gérez votre pipeline commercial avec le plan Pro."
    >
      {children}
    </ProGuard>
  );
}
