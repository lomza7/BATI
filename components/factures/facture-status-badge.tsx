import type { InvoiceStatus, InvoiceType } from '@/types/invoices'

interface Props {
  status: InvoiceStatus
  type?: InvoiceType
}

const STATUS_CONFIG: Record<InvoiceStatus, { label: string; className: string }> = {
  brouillon: { label: 'Brouillon', className: 'bg-gray-100 text-gray-700' },
  'émise': { label: 'Émise', className: 'bg-blue-100 text-blue-700' },
  'envoyée': { label: 'Envoyée', className: 'bg-indigo-100 text-indigo-700' },
  'payée': { label: 'Payée', className: 'bg-green-100 text-green-700' },
  en_retard: { label: 'En retard', className: 'bg-red-100 text-red-700' },
  'annulée': { label: 'Annulée', className: 'bg-gray-100 text-gray-400 line-through' },
}

export function FactureStatusBadge({ status, type }: Props) {
  const config = STATUS_CONFIG[status]
  const label = type === 'credit_note' && status === 'brouillon' ? 'Avoir (brouillon)' : config.label

  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${config.className}`}>
      {label}
    </span>
  )
}
