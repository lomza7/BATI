'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import type { Facture, FactureListResult } from '@/types/factures'
import { FactureStatusBadge } from './facture-status-badge'

function formatEur(value: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value)
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR').format(new Date(iso))
}

function typeLabel(type: string): string {
  if (type === 'avoir') return 'AV'
  if (type === 'situation') return 'SIT'
  return 'FAC'
}

export function FactureList() {
  const [result, setResult] = useState<FactureListResult | null>(null)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: '20' })
    if (search) params.set('q', search)
    try {
      const res = await fetch(`/api/factures?${params}`)
      const data: FactureListResult = await res.json()
      setResult(data)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [page, search])

  useEffect(() => { load() }, [load])

  const totalPages = result ? Math.ceil(result.total / 20) : 1

  return (
    <div className="space-y-4">
      {/* Barre de recherche */}
      <div className="flex items-center gap-3">
        <input
          type="search"
          placeholder="Rechercher (référence, objet…)"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          className="min-h-[48px] w-full rounded-lg border border-gray-300 px-4 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <Link
          href="/dashboard/factures/new"
          className="flex min-h-[48px] items-center whitespace-nowrap rounded-lg bg-blue-600 px-5 text-sm font-medium text-white"
        >
          + Nouvelle facture
        </Link>
      </div>

      {/* Liste */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-100" />)}
        </div>
      ) : (
        <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
          {result?.data.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-gray-500">Aucune facture.</p>
          )}
          {result?.data.map((facture: Facture) => (
            <Link
              key={facture.id}
              href={`/dashboard/factures/${facture.id}`}
              className="flex items-center justify-between px-4 py-4 transition hover:bg-gray-50 active:bg-gray-100"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-500">
                    {typeLabel(facture.type)}
                  </span>
                  <span className="font-medium text-gray-900">{facture.reference}</span>
                  <FactureStatusBadge status={facture.status} type={facture.type} />
                </div>
                <p className="mt-0.5 truncate text-sm text-gray-500">{facture.title}</p>
              </div>
              <div className="ml-4 shrink-0 text-right">
                <p className="font-semibold text-gray-900">{formatEur(facture.total_ttc)}</p>
                {facture.due_date && (
                  <p className={`text-xs ${facture.status === 'en_retard' ? 'text-red-600' : 'text-gray-400'}`}>
                    {facture.status === 'en_retard' ? 'Retard' : 'Échéance'} {formatDate(facture.due_date)}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="min-h-[48px] min-w-[48px] rounded-lg border border-gray-200 px-4 text-sm disabled:opacity-40"
          >
            ←
          </button>
          <span className="flex min-h-[48px] items-center px-4 text-sm text-gray-600">
            {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="min-h-[48px] min-w-[48px] rounded-lg border border-gray-200 px-4 text-sm disabled:opacity-40"
          >
            →
          </button>
        </div>
      )}
    </div>
  )
}
