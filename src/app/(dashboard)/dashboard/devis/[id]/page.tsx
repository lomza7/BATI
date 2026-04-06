import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getDevis } from '@/lib/devis/service'
import { DevisStatusBadge } from '@/components/features/devis/devis-status-badge'
import { DevisSummary } from '@/components/features/devis/devis-summary'
import { formatMontant } from '@/lib/devis/calculations'
import type { LotInput } from '@/lib/devis/schemas'
import { DevisActions } from '@/components/features/devis/devis-actions'

type Params = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Params) {
  const { id } = await params
  const devis = await getDevis(id)
  return { title: devis ? `${devis.reference} — Hellobat` : 'Devis introuvable' }
}

export default async function DevisDetailPage({ params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { id } = await params
  const devis = await getDevis(id)
  if (!devis) notFound()

  const lotsAsInput: LotInput[] = devis.lots.map((lot) => ({
    name: lot.name,
    sort_order: lot.sort_order,
    postes: (lot.lignes ?? []).map((l) => ({
      description: l.description,
      quantity: l.quantity,
      unit: l.unit,
      unit_price_ht: l.unit_price_ht,
      tva_rate: l.tva_rate,
      sort_order: l.sort_order,
    })),
  }))

  const canEdit = devis.status === 'brouillon'
  const canSend = devis.status === 'brouillon'
  const canAccept = devis.status === 'envoyé' || devis.status === 'brouillon'
  const canRefuse = devis.status === 'envoyé' || devis.status === 'brouillon'

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900">{devis.reference}</h1>
            <DevisStatusBadge status={devis.status} />
          </div>
          <p className="text-sm text-gray-600">{devis.title}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          {canEdit && (
            <Link
              href={`/dashboard/devis/${devis.id}/edit`}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              style={{ minHeight: 44 }}
            >
              Modifier
            </Link>
          )}
          <a
            href={`/api/devis/${devis.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-blue-300 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50"
            style={{ minHeight: 44 }}
          >
            PDF
          </a>
        </div>
      </div>

      {/* Client */}
      {devis.client && (
        <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">Client</p>
          <p className="font-medium text-gray-900">
            {devis.client.company_name
              ? `${devis.client.company_name} — ${devis.client.name}`
              : devis.client.name}
          </p>
          {devis.client.email && <p className="text-sm text-gray-500">{devis.client.email}</p>}
          {devis.client.phone && <p className="text-sm text-gray-500">{devis.client.phone}</p>}
        </div>
      )}

      {/* Chantier */}
      {(devis.object || devis.site_address) && (
        <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
          {devis.object && (
            <p className="text-sm text-gray-700">
              <span className="font-medium">Objet :</span> {devis.object}
            </p>
          )}
          {devis.site_address && (
            <p className="text-sm text-gray-600">
              <span className="font-medium">Chantier :</span> {devis.site_address}
              {devis.site_city && `, ${devis.site_city}`}
              {devis.site_postal_code && ` ${devis.site_postal_code}`}
            </p>
          )}
        </div>
      )}

      {/* Lots et postes */}
      <div className="mb-4 space-y-3">
        {devis.lots.map((lot) => (
          <div key={lot.id} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <div className="border-b border-gray-100 bg-blue-50 px-4 py-2">
              <p className="text-sm font-semibold text-blue-700">{lot.name}</p>
            </div>
            <div className="divide-y divide-gray-50">
              {(lot.lignes ?? []).map((ligne) => (
                <div key={ligne.id} className="flex items-center justify-between px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-gray-900">{ligne.description}</p>
                    <p className="text-xs text-gray-400">
                      {ligne.quantity} {ligne.unit} × {formatMontant(ligne.unit_price_ht)} — TVA{' '}
                      {ligne.tva_rate}%
                    </p>
                  </div>
                  <p className="ml-4 shrink-0 text-sm font-medium text-gray-900">
                    {formatMontant(ligne.quantity * ligne.unit_price_ht)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Récapitulatif */}
      <DevisSummary
        lots={lotsAsInput}
        discountPercent={devis.discount_percent}
        depositPercent={devis.deposit_percent}
      />

      {/* Validité + conditions */}
      <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600">
        <p>
          <span className="font-medium">Validité :</span>{' '}
          {devis.validity_days} jours
          {devis.valid_until && (
            <span>
              {' '}
              (jusqu&apos;au{' '}
              {new Intl.DateTimeFormat('fr-FR').format(new Date(devis.valid_until))})
            </span>
          )}
        </p>
        <p className="mt-1">
          <span className="font-medium">Paiement :</span> {devis.payment_conditions}
        </p>
      </div>

      {/* Actions */}
      <DevisActions
        devisId={devis.id}
        canSend={canSend}
        canAccept={canAccept}
        canRefuse={canRefuse}
        sentToEmail={devis.sent_to_email}
        clientEmail={devis.client?.email ?? null}
      />
    </div>
  )
}
