import { ProGuard } from '@/components/paywall/pro-guard';

export default function CarteLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProGuard
      title="Carte interactive — fonctionnalité Pro"
      description="Visualisez tous vos chantiers sur une carte avec le plan Pro."
    >
      {children}
    </ProGuard>
  );
}
