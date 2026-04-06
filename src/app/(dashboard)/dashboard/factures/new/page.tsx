'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface LotForm { name: string; postes: PosteForm[] }
interface PosteForm { description: string; quantity: number; unit: string; unit_price_ht: number; tva_rate: number }

const TVA_OPTIONS = [0, 5.5, 10, 20]

function newPoste(): PosteForm {
  return { description: '', quantity: 1, unit: 'u', unit_price_ht: 0, tva_rate: 20 }
}
function newLot(): LotForm {
  return { name: 'Lot 1', postes: [newPoste()] }
}

function formatEur(v: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v)
}

export default function NewFacturePage() {
  const router = useRouter()
  const [clientId, setClientId] = useState('')
  const [title, setTitle] = useState('')
  const [object, setObject] = useState('')
  const [discountPercent, setDiscountPercent] = useState(0)
  const [paymentTermsDays, setPaymentTermsDays] = useState(30)
  const [lots, setLots] = useState<LotForm[]>([newLot()])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function updatePoste(lotIdx: number, posteIdx: number, field: keyof PosteForm, value: string | number) {
    setLots((prev) => prev.map((lot, li) =>
      li === lotIdx ? {
        ...lot,
        postes: lot.postes.map((p, pi) => pi === posteIdx ? { ...p, [field]: value } : p),
      } : lot
    ))
  }

  function addPoste(lotIdx: number) {
    setLots((prev) => prev.map((lot, li) =>
      li === lotIdx ? { ...lot, postes: [...lot.postes, newPoste()] } : lot
    ))
  }

  function removePoste(lotIdx: number, posteIdx: number) {
    setLots((prev) => prev.map((lot, li) =>
      li === lotIdx ? { ...lot, postes: lot.postes.filter((_, pi) => pi !== posteIdx) } : lot
    ))
  }

  function addLot() {
    setLots((prev) => [...prev, { name: `Lot ${prev.length + 1}`, postes: [newPoste()] }])
  }

  function totalHt(): number {
    return lots.reduce((sum, lot) =>
      sum + lot.postes.reduce((s, p) => s + p.quantity * p.unit_price_ht, 0), 0
    )
  }

  function totalApresRemise(): number {
    return totalHt() * (1 - discountPercent / 100)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!clientId) { setError('Sélectionnez un client'); return }

    setLoading(true)
    setError(null)

    const body = {
      client_id: clientId,
      title: title || 'Facture travaux',
      object: object || undefined,
      discount_percent: discountPercent,
      payment_terms_days: paymentTermsDays,
      lots: lots.map((lot, li) => ({
        name: lot.name,
        sort_order: li,
        postes: lot.postes.map((p, pi) => ({ ...p, sort_order: pi })),
      })),
    }

    try {
      const res = await fetch('/api/factures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Erreur'); return }
      router.push(`/dashboard/factures/${data.id}`)
    } catch {
      setError('Erreur réseau')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Nouvelle facture</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Infos principales */}
        <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-5">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">ID Client *</label>
            <input
              type="text"
              placeholder="UUID du client"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              required
              className="w-full min-h-[48px] rounded-lg border border-gray-300 px-4 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Titre</label>
            <input
              type="text"
              placeholder="Facture travaux de rénovation"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full min-h-[48px] rounded-lg border border-gray-300 px-4 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Objet</label>
            <input
              type="text"
              placeholder="Rénovation salle de bain"
              value={object}
              onChange={(e) => setObject(e.target.value)}
              className="w-full min-h-[48px] rounded-lg border border-gray-300 px-4 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="mb-1 block text-sm font-medium text-gray-700">Remise (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={discountPercent}
                onChange={(e) => setDiscountPercent(Number(e.target.value))}
                className="w-full min-h-[48px] rounded-lg border border-gray-300 px-4 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-sm font-medium text-gray-700">Délai paiement (j)</label>
              <input
                type="number"
                min={0}
                max={365}
                value={paymentTermsDays}
                onChange={(e) => setPaymentTermsDays(Number(e.target.value))}
                className="w-full min-h-[48px] rounded-lg border border-gray-300 px-4 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Lots et postes */}
        {lots.map((lot, lotIdx) => (
          <div key={lotIdx} className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
            <input
              type="text"
              value={lot.name}
              onChange={(e) => setLots((prev) => prev.map((l, i) => i === lotIdx ? { ...l, name: e.target.value } : l))}
              className="min-h-[44px] w-full rounded-lg border border-gray-200 bg-gray-50 px-4 text-base font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Nom du lot"
            />

            {lot.postes.map((poste, posteIdx) => (
              <div key={posteIdx} className="space-y-2 border-t border-gray-100 pt-3">
                <input
                  type="text"
                  placeholder="Description du poste"
                  value={poste.description}
                  onChange={(e) => updatePoste(lotIdx, posteIdx, 'description', e.target.value)}
                  required
                  className="w-full min-h-[48px] rounded-lg border border-gray-300 px-4 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div>
                    <label className="text-xs text-gray-500">Qté</label>
                    <input
                      type="number"
                      value={poste.quantity}
                      min={-9999}
                      onChange={(e) => updatePoste(lotIdx, posteIdx, 'quantity', Number(e.target.value))}
                      className="w-full min-h-[48px] rounded-lg border border-gray-300 px-3 text-base focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Unité</label>
                    <input
                      type="text"
                      value={poste.unit}
                      onChange={(e) => updatePoste(lotIdx, posteIdx, 'unit', e.target.value)}
                      className="w-full min-h-[48px] rounded-lg border border-gray-300 px-3 text-base focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">PU HT (€)</label>
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      value={poste.unit_price_ht}
                      onChange={(e) => updatePoste(lotIdx, posteIdx, 'unit_price_ht', Number(e.target.value))}
                      className="w-full min-h-[48px] rounded-lg border border-gray-300 px-3 text-base focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">TVA %</label>
                    <select
                      value={poste.tva_rate}
                      onChange={(e) => updatePoste(lotIdx, posteIdx, 'tva_rate', Number(e.target.value))}
                      className="w-full min-h-[48px] rounded-lg border border-gray-300 px-3 text-base focus:outline-none"
                    >
                      {TVA_OPTIONS.map((t) => <option key={t} value={t}>{t}%</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">
                    = {formatEur(poste.quantity * poste.unit_price_ht)} HT
                  </span>
                  {lot.postes.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removePoste(lotIdx, posteIdx)}
                      className="text-sm text-red-500"
                    >
                      Supprimer
                    </button>
                  )}
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={() => addPoste(lotIdx)}
              className="min-h-[44px] w-full rounded-lg border border-dashed border-gray-300 text-sm text-gray-500"
            >
              + Ajouter un poste
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={addLot}
          className="min-h-[48px] w-full rounded-xl border border-dashed border-blue-300 text-sm font-medium text-blue-600"
        >
          + Ajouter un lot
        </button>

        {/* Récapitulatif */}
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-right space-y-1">
          <p className="text-sm text-gray-500">Total HT : {formatEur(totalHt())}</p>
          {discountPercent > 0 && (
            <p className="text-sm text-gray-500">Après remise {discountPercent}% : {formatEur(totalApresRemise())}</p>
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="min-h-[56px] w-full rounded-xl bg-blue-600 text-base font-semibold text-white disabled:opacity-50"
        >
          {loading ? 'Création en cours…' : 'Créer la facture'}
        </button>
      </form>
    </div>
  )
}
