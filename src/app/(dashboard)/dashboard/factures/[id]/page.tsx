import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getFacture } from '@/lib/factures/service'
import { FactureStatusBadge } from '@/components/features/factures/facture-status-badge'
import { FactureActions } from '@/components/features/factures/facture-actions'

interface Props { params: { id: string } }

function formatEur(v: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v)
}
function formatDate(iso: string) {
  return new Intl.DateTimeFormat('fr-FR').format(new Date(iso))
}

export async function generateMetadata({ params }: Props) {
  return { title: `Facture ${params.id} — Hellobat` }
}

export default async function FactureDetailPage({ params }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return notFound()

  const facture = await getFacture(params.id)
  if (!facture) return notFound()

  const typeLabel = facture.type === 'avoir' ? 'Avoir' : facture.type === 'situation' ? 'Situation de travaux' : 'Facture'

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      {/* Breadcrumb */}
      <Link href="/dashboard/factures" className="mb-4 inline-flex items-center text-sm text-gray-500">
        ← Factures
      </Link>

      {/* En-tête */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-gray-500">{typeLabel}</p>
          <h1 className="text-2xl font-bold text-gray-900">{facture.reference}</h1>
          <p className="mt-1 text-gray-600">{facture.title}</p>
        </div>
        <FactureStatusBadge status={facture.status} type={facture.type} />
      </div>

      {/* Client */}
      {facture.client && (
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-sm font-medium text-gray-500">Client</p>
          <p className="mt-1 font-semibold text-gray-900">
            {facture.client.company_name ?? facture.client.name}
          </p>
          {facture.client.siret && (
            <p className="text-sm text-gray-500">SIRET : {facture.client.siret}</p>
          )}
          {facture.client.billing_address && (
            <p className="text-sm text-gray-500">{facture.client.billing_address}, {facture.client.billing_city}</p>
          )}
        </div>
      )}

      {/* Dates */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-3 text-center">
          <p className="text-xs text-gray-500">Créée</p>
          <p className="mt-1 text-sm font-semibold">{formatDate(facture.created_at)}</p>
        </div>
        {facture.emitted_at && (
          <div className="rounded-xl border border-gray-200 bg-white p-3 text-center">
            <p className="text-xs text-gray-500">Émise</p>
            <p className="mt-1 text-sm font-semibold">{formatDate(facture.emitted_at)}</p>
          </div>
        )}
        {facture.due_date && (
          <div className={`rounded-xl border p-3 text-center ${facture.status === 'en_retard' ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'}`}>
            <p className="text-xs text-gray-500">Échéance</p>
            <p className={`mt-1 text-sm font-semibold ${facture.status === 'en_retard' ? 'text-red-700' : ''}`}>
              {formatDate(facture.due_date)}
            </p>
          </div>
        )}
        {facture.paid_at && (
          <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-center">
            <p className="text-xs text-gray-500">Payée</p>
            <p className="mt-1 text-sm font-semibold text-green-700">{formatDate(facture.paid_at)}</p>
          </div>
        )}
      </div>

      {/* Lignes */}
      <div className="mb-6 overflow-hidden rounded-xl border border-gray-200 bg-white">
        {facture.lots.map((lot) => (
          <div key={lot.id}>
            <div className="bg-blue-50 px-4 py-2">
              <p className="text-sm font-semibold text-blue-900">{lot.name}</p>
            </div>
            {(lot.lignes ?? []).map((ligne) => (
              <div key={ligne.id} className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-gray-900">{ligne.description}</p>
                  <p className="text-xs text-gray-400">
                    {ligne.quantity} {ligne.unit} × {formatEur(ligne.unit_price_ht)} — TVA {ligne.tva_rate}%
                  </p>
                </div>
                <p className="ml-3 shrink-0 text-sm font-medium text-gray-700">
                  {formatEur(ligne.total_ht)}
                </p>
              </div>
            ))}
          </div>
        ))}

        {/* Totaux */}
        <div className="border-t border-gray-200 bg-gray-50 px-4 py-3 space-y-1">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Total HT</span>
            <span>{formatEur(facture.total_ht)}</span>
          </div>
          {facture.discount_percent > 0 && (
            <div className="flex justify-between text-sm text-gray-500">
              <span>Remise {facture.discount_percent}%</span>
              <span>− {formatEur(facture.total_ht * facture.discount_percent / 100)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm text-gray-600">
            <span>TVA</span>
            <span>{formatEur(facture.total_tva)}</span>
          </div>
          {facture.deposit_amount_deducted > 0 && (
            <div className="flex justify-between text-sm text-gray-500">
              <span>Acompte déduit</span>
              <span>− {formatEur(facture.deposit_amount_deducted)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-gray-200 pt-2 text-base font-bold text-gray-900">
            <span>TOTAL TTC</span>
            <span>{formatEur(facture.total_ttc)}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <FactureActions facture={facture} />
    </div>
  )
}
