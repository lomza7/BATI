'use client'

import { useEffect, useState } from 'react'
import type { FactureDashboard } from '@/types/factures'

function formatEur(value: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value)
}

export function FactureDashboardKpis() {
  const [data, setData] = useState<FactureDashboard | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/factures/dashboard')
      .then((r) => r.json())
      .then((d: FactureDashboard) => setData(d))
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl bg-gray-100" />
        ))}
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <p className="text-sm text-gray-500">CA du mois</p>
        <p className="mt-1 text-2xl font-bold text-gray-900">{formatEur(data.ca_du_mois)}</p>
      </div>

      <div className={`rounded-xl border p-5 ${data.factures_en_retard_count > 0 ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'}`}>
        <p className="text-sm text-gray-500">Factures en retard</p>
        <p className={`mt-1 text-2xl font-bold ${data.factures_en_retard_count > 0 ? 'text-red-700' : 'text-gray-900'}`}>
          {data.factures_en_retard_count}
        </p>
        {data.factures_en_retard_montant > 0 && (
          <p className="mt-1 text-sm text-red-600">{formatEur(data.factures_en_retard_montant)}</p>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <p className="text-sm text-gray-500">Encaissements attendus</p>
        <p className="mt-1 text-2xl font-bold text-gray-900">{formatEur(data.encaissements_attendus)}</p>
      </div>
    </div>
  )
}
