import type { QuoteStatus } from '@/types/quotes'

const STATUS_CONFIG: Record<QuoteStatus, { label: string; className: string }> = {
  brouillon: { label: 'Brouillon', className: 'bg-gray-100 text-gray-700' },
  'envoyé': { label: 'Envoyé', className: 'bg-blue-100 text-blue-700' },
  'accepté': { label: 'Accepté', className: 'bg-green-100 text-green-700' },
  'refusé': { label: 'Refusé', className: 'bg-red-100 text-red-700' },
  'expiré': { label: 'Expiré', className: 'bg-orange-100 text-orange-700' },
  'facturé': { label: 'Facturé', className: 'bg-purple-100 text-purple-700' },
}

interface DevisStatusBadgeProps {
  status: QuoteStatus
}

export function DevisStatusBadge({ status }: DevisStatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.brouillon
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${config.className}`}>
      {config.label}
    </span>
  )
}
