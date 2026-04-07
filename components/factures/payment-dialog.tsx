'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  factureId: string
  totalTtc: number
  open: boolean
  onClose: () => void
}

const METHODES = [
  { value: 'virement', label: 'Virement bancaire' },
  { value: 'chèque', label: 'Chèque' },
  { value: 'espèces', label: 'Espèces' },
  { value: 'carte', label: 'Carte bancaire' },
  { value: 'prélèvement', label: 'Prélèvement' },
] as const

function formatEur(value: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value)
}

export function PaymentDialog({ factureId, totalTtc, open, onClose }: Props) {
  const router = useRouter()
  const [method, setMethod] = useState<string>('virement')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  async function handlePay() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/factures/${factureId}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_method: method }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Erreur')
        return
      }
      router.refresh()
      onClose()
    } catch {
      setError('Erreur réseau')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="w-full rounded-t-2xl bg-white p-6 shadow-xl sm:max-w-sm sm:rounded-2xl">
        <h2 className="text-lg font-bold text-gray-900">Marquer comme payée</h2>
        <p className="mt-1 text-gray-600">Montant encaissé : <strong>{formatEur(totalTtc)}</strong></p>

        <div className="mt-5 space-y-2">
          {METHODES.map((m) => (
            <label key={m.value} className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 p-3">
              <input
                type="radio"
                name="method"
                value={m.value}
                checked={method === m.value}
                onChange={(e) => setMethod(e.target.value)}
                className="h-5 w-5 text-blue-600"
              />
              <span className="text-base">{m.label}</span>
            </label>
          ))}
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-gray-300 py-3 text-base font-medium text-gray-700"
          >
            Annuler
          </button>
          <button
            onClick={handlePay}
            disabled={loading}
            className="flex-1 rounded-xl bg-green-600 py-3 text-base font-medium text-white disabled:opacity-50"
          >
            {loading ? 'En cours…' : 'Confirmer'}
          </button>
        </div>
      </div>
    </div>
  )
}
