'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { InvoiceLot } from '@/types/invoices'

interface Props {
  factureId: string
  lots: InvoiceLot[]
  // Map lot_id → cumul précédent en %
  cumulsPrecedents: Record<string, number>
}

function formatEur(value: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value)
}

export function SituationEditor({ factureId, lots, cumulsPrecedents }: Props) {
  const router = useRouter()
  const [avancements, setAvancements] = useState<Record<string, number>>(
    Object.fromEntries(lots.map((l) => [l.id, 0]))
  )
  const [isFinal, setIsFinal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function setAvancement(lotId: string, value: number) {
    const cumulPrecedent = cumulsPrecedents[lotId] ?? 0
    const maxAllowed = 100 - cumulPrecedent
    const clamped = Math.min(Math.max(0, value), maxAllowed)
    setAvancements((prev) => ({ ...prev, [lotId]: clamped }))
  }

  function montantSituationLot(lot: InvoiceLot): number {
    const av = avancements[lot.id] ?? 0
    return parseFloat(((av / 100) * lot.montant_lot_ht).toFixed(2))
  }

  const totalSituationHt = lots.reduce((sum, lot) => sum + montantSituationLot(lot), 0)

  async function handleCreate() {
    const avsInput = lots.map((lot) => ({
      lot_id: lot.id,
      avancement_percent: avancements[lot.id] ?? 0,
    })).filter((av) => av.avancement_percent > 0)

    if (avsInput.length === 0) {
      setError('Saisissez au moins un avancement > 0%')
      return
    }

    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/factures/${factureId}/situation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avancements: avsInput, is_final: isFinal }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Erreur')
        return
      }
      router.push(`/factures/${data.id}`)
    } catch {
      setError('Erreur réseau')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {lots.map((lot) => {
          const cumulPrecedent = cumulsPrecedents[lot.id] ?? 0
          const avancement = avancements[lot.id] ?? 0
          const cumulTotal = cumulPrecedent + avancement
          const montant = montantSituationLot(lot)

          return (
            <div key={lot.id} className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-gray-900">{lot.name}</p>
                  <p className="text-sm text-gray-500">
                    Montant lot : {formatEur(lot.montant_lot_ht)} HT
                    {cumulPrecedent > 0 && ` — Déjà facturé : ${cumulPrecedent}%`}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-medium text-blue-700">{formatEur(montant)}</p>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={100 - cumulPrecedent}
                  value={avancement}
                  onChange={(e) => setAvancement(lot.id, Number(e.target.value))}
                  className="flex-1"
                />
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    max={100 - cumulPrecedent}
                    value={avancement}
                    onChange={(e) => setAvancement(lot.id, Number(e.target.value))}
                    className="w-20 rounded-lg border border-gray-300 py-2 pl-3 pr-6 text-right text-base"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-gray-500">%</span>
                </div>
              </div>

              {/* Barre de progression */}
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full bg-gray-300"
                  style={{ width: `${cumulPrecedent}%` }}
                />
                <div
                  className="-mt-2 h-full bg-blue-500"
                  style={{ marginLeft: `${cumulPrecedent}%`, width: `${avancement}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-gray-400">
                Cumul après cette situation : {cumulTotal}%
              </p>
            </div>
          )
        })}
      </div>

      {/* Résumé */}
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
        <div className="flex items-center justify-between">
          <span className="font-medium text-gray-700">Total situation HT</span>
          <span className="text-lg font-bold text-gray-900">{formatEur(totalSituationHt)}</span>
        </div>
      </div>

      {/* Situation finale */}
      <label className="flex cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          checked={isFinal}
          onChange={(e) => setIsFinal(e.target.checked)}
          className="h-5 w-5 rounded text-blue-600"
        />
        <span className="text-base text-gray-700">Situation finale (100% des travaux terminés)</span>
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        onClick={handleCreate}
        disabled={loading || totalSituationHt === 0}
        className="min-h-[56px] w-full rounded-xl bg-blue-600 text-base font-semibold text-white disabled:opacity-50"
      >
        {loading ? 'Création en cours…' : 'Créer la situation de travaux'}
      </button>
    </div>
  )
}
