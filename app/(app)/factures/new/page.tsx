'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { LotEditor } from '@/components/devis/lot-editor'
import { DevisSummary } from '@/components/devis/devis-summary'
import type { LotInput } from '@/lib/quotes/schemas'

interface ClientOption {
  id: string
  name: string
  company_name: string | null
}

function defaultLot(index: number): LotInput {
  return {
    name: `Lot ${index + 1}`,
    sort_order: index,
    postes: [{ description: '', quantity: 1, unit: 'u', unit_price_ht: 0, tva_rate: 20, sort_order: 0 }],
  }
}

export default function NewFacturePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedClient = searchParams.get('client') ?? ''

  const [clients, setClients] = useState<ClientOption[]>([])
  const [isAutoEntrepreneur, setIsAutoEntrepreneur] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [clientId, setClientId] = useState(preselectedClient)
  const [title, setTitle] = useState('Facture travaux')
  const [object, setObject] = useState('')
  const [siteAddress, setSiteAddress] = useState('')
  const [siteCity, setSiteCity] = useState('')
  const [discountPercent, setDiscountPercent] = useState(0)
  const [depositAmountDeducted, setDepositAmountDeducted] = useState(0)
  const [paymentTermsDays, setPaymentTermsDays] = useState(30)
  const [paymentConditions, setPaymentConditions] = useState('Paiement à 30 jours')
  const [lots, setLots] = useState<LotInput[]>([defaultLot(0)])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const [clientsRes, profileRes] = await Promise.all([
        (supabase as any).from('clients').select('id,name,company_name').is('deleted_at', null).order('name'),
        (supabase as any).from('profiles').select('is_auto_entrepreneur').eq('id', user.id).single(),
      ])

      setClients(clientsRes.data ?? [])
      setIsAutoEntrepreneur(profileRes.data?.is_auto_entrepreneur ?? false)
      setLoading(false)
    }
    load()
  }, [])

  function updateLot(i: number, updated: LotInput) { setLots((prev) => prev.map((l, idx) => idx === i ? updated : l)) }
  function removeLot(i: number) { setLots((prev) => prev.filter((_, idx) => idx !== i).map((l, idx) => ({ ...l, sort_order: idx }))) }
  function moveLot(i: number, dir: 'up' | 'down') {
    setLots((prev) => {
      const arr = [...prev]
      const target = dir === 'up' ? i - 1 : i + 1
      ;[arr[i], arr[target]] = [arr[target]!, arr[i]!]
      return arr.map((l, idx) => ({ ...l, sort_order: idx }))
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!clientId) { setError('Veuillez sélectionner un client'); return }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/factures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          title,
          object: object || undefined,
          site_address: siteAddress || undefined,
          site_city: siteCity || undefined,
          discount_percent: discountPercent,
          deposit_amount_deducted: depositAmountDeducted,
          payment_terms_days: paymentTermsDays,
          payment_conditions: paymentConditions,
          is_auto_entrepreneur_invoice: isAutoEntrepreneur,
          lots,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur')
      router.push(`/factures/${data.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-4">
        <Link href="/factures" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground min-h-[44px] w-fit">
          <ChevronLeft className="h-4 w-4" />
          Factures
        </Link>
      </div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Nouvelle facture</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <section className="space-y-4">
          <h2 className="text-base font-semibold text-gray-900">Informations générales</h2>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Client <span className="text-red-500">*</span></label>
            <select value={clientId} onChange={(e) => setClientId(e.target.value)} required className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" style={{ minHeight: 48 }}>
              <option value="">Sélectionner un client…</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.company_name ? `${c.company_name} — ${c.name}` : c.name}</option>)}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Titre</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" style={{ minHeight: 48 }} />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Objet</label>
            <input type="text" value={object} onChange={(e) => setObject(e.target.value)} placeholder="Ex : Rénovation salle de bain" className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" style={{ minHeight: 48 }} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <input type="text" value={siteAddress} onChange={(e) => setSiteAddress(e.target.value)} placeholder="Adresse chantier" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" style={{ minHeight: 44 }} />
            <input type="text" value={siteCity} onChange={(e) => setSiteCity(e.target.value)} placeholder="Ville chantier" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" style={{ minHeight: 44 }} />
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-gray-900">Lots et postes <span className="text-red-500">*</span></h2>
          {lots.map((lot, i) => (
            <LotEditor key={i} lot={lot} index={i} isFirst={i === 0} isLast={i === lots.length - 1} isAutoEntrepreneur={isAutoEntrepreneur} isRenovation2yr={false} onChange={(u) => updateLot(i, u)} onMoveUp={() => moveLot(i, 'up')} onMoveDown={() => moveLot(i, 'down')} onRemove={() => removeLot(i)} />
          ))}
          <button type="button" onClick={() => setLots((p) => [...p, defaultLot(p.length)])} className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-blue-400 py-4 text-sm font-medium text-blue-600 hover:bg-blue-50" style={{ minHeight: 56 }}>
            + Ajouter un lot
          </button>
        </section>

        <section className="space-y-4">
          <h2 className="text-base font-semibold text-gray-900">Conditions financières</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Remise (%)</label>
              <input type="number" min="0" max="100" step="0.5" value={discountPercent} onChange={(e) => setDiscountPercent(parseFloat(e.target.value) || 0)} className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm" style={{ minHeight: 48 }} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Acompte déduit (€)</label>
              <input type="number" min="0" step="0.01" value={depositAmountDeducted} onChange={(e) => setDepositAmountDeducted(parseFloat(e.target.value) || 0)} className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm" style={{ minHeight: 48 }} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Délai paiement (jours)</label>
              <input type="number" min="0" value={paymentTermsDays} onChange={(e) => setPaymentTermsDays(parseInt(e.target.value) || 30)} className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm" style={{ minHeight: 48 }} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Conditions de paiement</label>
              <input type="text" value={paymentConditions} onChange={(e) => setPaymentConditions(e.target.value)} className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm" style={{ minHeight: 48 }} />
            </div>
          </div>
        </section>

        <DevisSummary lots={lots} discountPercent={discountPercent} depositPercent={0} isAutoEntrepreneur={isAutoEntrepreneur} />

        <button type="submit" disabled={submitting} className="flex w-full items-center justify-center rounded-lg bg-blue-600 py-4 text-base font-semibold text-white hover:bg-blue-700 disabled:opacity-60" style={{ minHeight: 56 }}>
          {submitting ? 'Enregistrement…' : 'Créer la facture'}
        </button>
      </form>
    </div>
  )
}
