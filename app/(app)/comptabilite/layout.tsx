import { ProGuard } from '@/components/paywall/pro-guard';

export default function ComptabiliteLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProGuard
      feature="ai"
      title="Comptabilité automatisée — fonctionnalité Pro"
      description="Scannez vos factures fournisseurs, rapprochez vos relevés bancaires et exportez votre FEC avec le plan Pro."
    >
      {children}
    </ProGuard>
  );
}
