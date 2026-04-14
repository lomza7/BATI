import { ProGuard } from '@/components/paywall/pro-guard';

export default function SiteWebLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProGuard
      feature="ai"
      title="Site web IA — fonctionnalité Pro"
      description="Générez et publiez votre site web avec le plan Pro."
    >
      {children}
    </ProGuard>
  );
}
