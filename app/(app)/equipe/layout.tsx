import { ProGuard } from '@/components/paywall/pro-guard';

export default function EquipeLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProGuard
      title="Équipe — fonctionnalité Pro"
      description="Gérez vos salariés et sous-traitants avec le plan Pro."
    >
      {children}
    </ProGuard>
  );
}
