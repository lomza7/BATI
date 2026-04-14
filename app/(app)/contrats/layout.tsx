import { ProGuard } from '@/components/paywall/pro-guard';

export default function ContratsLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProGuard
      title="Contrats récurrents — fonctionnalité Pro"
      description="Automatisez vos contrats de maintenance avec le plan Pro."
    >
      {children}
    </ProGuard>
  );
}
