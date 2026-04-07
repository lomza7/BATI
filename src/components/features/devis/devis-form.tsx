'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { LotInput } from '@/lib/devis/schemas'
import type { DevisWithDetails } from '@/types/devis'
import { LotEditor } from './lot-editor'
import { DevisSummary } from './devis-summary'

interface ClientOption {
  id: string
  name: string
  company_name: string | null
}

interface DevisFormProps {
  clients: ClientOption[]
  initialValues?: DevisWithDetails
  isAutoEntrepreneur?: boolean
}

function defaultLot(index: number, isRenovation2yr: boolean, isAutoEntrepreneur: boolean): LotInput {
  return {
    name: `Lot ${index + 1}`,
    sort_order: index,
    postes: [
      {
        description: '',
        quantity: 1,
        unit: 'u',
        unit_price_ht: 0,
        tva_rate: isAutoEntrepreneur ? 0 : isRenovation2yr ? 10 : 20,
        sort_order: 0,
      },
    ],
  }
}

export function DevisForm({ clients, initialValues, isAutoEntrepreneur = false }: DevisFormProps) {
  const router = useRouter()
  const isEdit = !!initialValues

  const [clientId, setClientId] = useState(initialValues?.client_id ?? '')
  const [title, setTitle] = useState(initialValues?.title ?? 'Devis travaux')
  const [object, setObject] = useState(initialValues?.object ?? '')
  const [siteAddress, setSiteAddress] = useState(initialValues?.site_address ?? '')
  const [siteCity, setSiteCity] = useState(initialValues?.site_city ?? '')
  const [sitePostalCode, setSitePostalCode] = useState(initialValues?.site_postal_code ?? '')
  const [isRenovation2yr, setIsRenovation2yr] = useState(initialValues?.is_renovation_2yr ?? false)
  const [discountPercent, setDiscountPercent] = useState(initialValues?.discount_percent ?? 0)
  const [depositPercent, setDepositPercent] = useState(initialValues?.deposit_percent ?? 0)
  const [paymentConditions, setPaymentConditions] = useState(
    initialValues?.payment_conditions ?? 'Paiement à 30 jours'
  )
  const [validityDays, setValidityDays] = useState(initialValues?.validity_days ?? 30)
  const [lots, setLots] = useState<LotInput[]>(() => {
    if (initialValues?.lots?.length) {
      return initialValues.lots.map((lot) => ({
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
    }
    return [defaultLot(0, false, isAutoEntrepreneur)]
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function addLot() {
    setLots((prev) => [...prev, defaultLot(prev.length, isRenovation2yr, isAutoEntrepreneur)])
  }

  function updateLot(index: number, updated: LotInput) {
    setLots((prev) => prev.map((l, i) => (i === index ? updated : l)))
  }

  function removeLot(index: number) {
    setLots((prev) =>
      prev
        .filter((_, i) => i !== index)
        .map((l, i) => ({ ...l, sort_order: i }))
    )
  }

  function moveLot(index: number, direction: 'up' | 'down') {
    setLots((prev) => {
      const updated = [...prev]
      const target = direction === 'up' ? index - 1 : index + 1
      ;[updated[index], updated[target]] = [updated[target]!, updated[index]!]
      return updated.map((l, i) => ({ ...l, sort_order: i }))
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!clientId) {
      setError('Veuillez sélectionner un client')
      return
    }
    if (lots.some((l) => !l.name.trim() || l.postes.length === 0)) {
      setError('Chaque lot doit avoir un nom et au moins un poste')
      return
    }
    if (lots.some((l) => l.postes.some((p) => !p.description.trim()))) {
      setError('Chaque poste doit avoir une description')
      return
    }

    setLoading(true)
    setError(null)

    const payload = {
      client_id: clientId,
      title,
      object: object || undefined,
      site_address: siteAddress || undefined,
      site_city: siteCity || undefined,
      site_postal_code: sitePostalCode || undefined,
      is_renovation_2yr: isRenovation2yr,
      discount_percent: discountPercent,
      deposit_percent: depositPercent,
      payment_conditions: paymentConditions,
      validity_days: validityDays,
      lots,
    }

    try {
      const url = isEdit ? `/api/devis/${initialValues!.id}` : '/api/devis'
      const method = isEdit ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Erreur lors de la sauvegarde')
      }

      const saved: DevisWithDetails = await res.json()
      router.push(`/dashboard/devis/${saved.id}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Informations générales */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-gray-900">Informations générales</h2>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Client <span className="text-red-500">*</span>
          </label>
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            required
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            style={{ minHeight: 48 }}
          >
            <option value="">Sélectionner un client…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.company_name ? `${c.company_name} — ${c.name}` : c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Titre du devis</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Devis travaux"
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            style={{ minHeight: 48 }}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Objet des travaux</label>
          <input
            type="text"
            value={object}
            onChange={(e) => setObject(e.target.value)}
            placeholder="Ex : Rénovation salle de bain, Installation électrique…"
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            style={{ minHeight: 48 }}
          />
        </div>

        {/* Chantier */}
        <div className="rounded-lg border border-gray-200 p-3">
          <p className="mb-2 text-sm font-medium text-gray-700">Adresse du chantier (optionnel)</p>
          <div className="space-y-2">
            <input
              type="text"
              value={siteAddress}
              onChange={(e) => setSiteAddress(e.target.value)}
              placeholder="Adresse"
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{ minHeight: 44 }}
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={sitePostalCode}
                onChange={(e) => setSitePostalCode(e.target.value)}
                placeholder="Code postal"
                className="rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{ minHeight: 44 }}
              />
              <input
                type="text"
                value={siteCity}
                onChange={(e) => setSiteCity(e.target.value)}
                placeholder="Ville"
                className="rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{ minHeight: 44 }}
              />
            </div>
          </div>
        </div>

        {/* Rénovation > 2 ans */}
        <label className="flex items-center gap-3 rounded-lg border border-gray-200 p-3">
          <input
            type="checkbox"
            checked={isRenovation2yr}
            onChange={(e) => setIsRenovation2yr(e.target.checked)}
            className="h-5 w-5 rounded border-gray-300 text-blue-600"
          />
          <span className="text-sm text-gray-700">
            Rénovation de logement de plus de 2 ans{' '}
            <span className="text-gray-400">(TVA réduite 10% par défaut)</span>
          </span>
        </label>
      </section>

      {/* Lots et postes */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-gray-900">
          Lots et postes <span className="text-red-500">*</span>
        </h2>

        {lots.map((lot, i) => (
          <LotEditor
            key={i}
            lot={lot}
            index={i}
            isFirst={i === 0}
            isLast={i === lots.length - 1}
            isAutoEntrepreneur={isAutoEntrepreneur}
            isRenovation2yr={isRenovation2yr}
            onChange={(updated) => updateLot(i, updated)}
            onMoveUp={() => moveLot(i, 'up')}
            onMoveDown={() => moveLot(i, 'down')}
            onRemove={() => removeLot(i)}
          />
        ))}

        <button
          type="button"
          onClick={addLot}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-blue-400 py-4 text-sm font-medium text-blue-600 hover:bg-blue-50"
          style={{ minHeight: 56 }}
        >
          + Ajouter un lot
        </button>
      </section>

      {/* Conditions financières */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-gray-900">Conditions financières</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Remise globale (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.5"
              value={discountPercent}
              onChange={(e) => setDiscountPercent(parseFloat(e.target.value) || 0)}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{ minHeight: 48 }}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Acompte (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              step="5"
              value={depositPercent}
              onChange={(e) => setDepositPercent(parseFloat(e.target.value) || 0)}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{ minHeight: 48 }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Validité (jours)
            </label>
            <input
              type="number"
              min="1"
              max="365"
              value={validityDays}
              onChange={(e) => setValidityDays(parseInt(e.target.value) || 30)}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{ minHeight: 48 }}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Conditions de paiement
            </label>
            <input
              type="text"
              value={paymentConditions}
              onChange={(e) => setPaymentConditions(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{ minHeight: 48 }}
            />
          </div>
        </div>
      </section>

      {/* Récapitulatif */}
      <DevisSummary
        lots={lots}
        discountPercent={discountPercent}
        depositPercent={depositPercent}
        isAutoEntrepreneur={isAutoEntrepreneur}
      />

      {/* Submit */}
      <button
        type="submit"
        disabled={loading}
        className="flex w-full items-center justify-center rounded-lg bg-blue-600 py-4 text-base font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        style={{ minHeight: 56 }}
      >
        {loading
          ? 'Enregistrement…'
          : isEdit
          ? 'Enregistrer les modifications'
          : 'Créer le devis'}
      </button>
    </form>
  )
}
