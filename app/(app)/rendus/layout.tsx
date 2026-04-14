import { ProGuard } from '@/components/paywall/pro-guard';

export default function RendusLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProGuard
      feature="ai"
      title="Avant/Après IA — fonctionnalité Pro"
      description="Générez des rendus avant/après de vos chantiers avec le plan Pro."
    >
      {children}
    </ProGuard>
  );
}
