import { ProGuard } from '@/components/paywall/pro-guard';

export default function CataloguesLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProGuard
      title="Catalogues — fonctionnalité Pro"
      description="Créez et partagez des catalogues produits avec le plan Pro."
    >
      {children}
    </ProGuard>
  );
}
