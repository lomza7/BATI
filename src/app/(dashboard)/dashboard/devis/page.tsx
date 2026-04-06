import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { listDevis } from '@/lib/devis/service'
import { DevisStatusBadge } from '@/components/features/devis/devis-status-badge'
import { formatMontant } from '@/lib/devis/calculations'

export const metadata = { title: 'Mes devis — Hellobat' }

export default async function DevisListPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: devisList, total } = await listDevis({ page: 1, limit: 50 })

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Mes devis</h1>
          <p className="text-sm text-gray-500">{total} devis au total</p>
        </div>
        <Link
          href="/dashboard/devis/new"
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700"
          style={{ minHeight: 48 }}
        >
          + Nouveau devis
        </Link>
      </div>

      {/* Liste */}
      {devisList.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 py-16 text-center">
          <p className="mb-4 text-gray-500">Aucun devis pour l&apos;instant</p>
          <Link
            href="/dashboard/devis/new"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Créer mon premier devis
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {devisList.map((devis) => (
            <Link
              key={devis.id}
              href={`/dashboard/devis/${devis.id}`}
              className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-4 hover:border-blue-300 hover:shadow-sm"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">{devis.reference}</span>
                  <DevisStatusBadge status={devis.status} />
                </div>
                <p className="truncate text-sm text-gray-600">{devis.title}</p>
                {devis.valid_until && (
                  <p className="text-xs text-gray-400">
                    Valable jusqu&apos;au{' '}
                    {new Intl.DateTimeFormat('fr-FR').format(new Date(devis.valid_until))}
                  </p>
                )}
              </div>
              <div className="ml-4 shrink-0 text-right">
                <p className="text-base font-semibold text-gray-900">
                  {formatMontant(devis.total_ttc)}
                </p>
                <p className="text-xs text-gray-400">TTC</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
