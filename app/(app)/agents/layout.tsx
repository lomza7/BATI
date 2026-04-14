import { ProGuard } from '@/components/paywall/pro-guard';

export default function AgentsLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProGuard
      feature="ai"
      title="Agents IA — fonctionnalité Pro"
      description="Accédez aux 5 agents IA (pannes, DTU, chiffrage, juridique, RGE/CEE) avec le plan Pro."
    >
      {children}
    </ProGuard>
  );
}
