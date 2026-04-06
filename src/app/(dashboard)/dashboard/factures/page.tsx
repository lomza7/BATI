import { FactureDashboardKpis } from '@/components/features/factures/facture-dashboard'
import { FactureList } from '@/components/features/factures/facture-list'

export const metadata = { title: 'Factures — Hellobat' }

export default function FacturesPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <h1 className="text-2xl font-bold text-gray-900">Factures</h1>
      <FactureDashboardKpis />
      <FactureList />
    </div>
  )
}
