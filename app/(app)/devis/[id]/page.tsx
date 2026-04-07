'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { DevisStatusBadge } from '@/components/devis/devis-status-badge'
import { DevisActions } from '@/components/devis/devis-actions'
import { formatMontant } from '@/lib/quotes/calculations'
import type { QuoteWithDetails } from '@/types/quotes'
import type { LotInput } from '@/lib/quotes/schemas'
import { calculerTotaux } from '@/lib/quotes/calculations'

export default function DevisDetailPage() {
  const params = useParams<{ id: string }>()
  const [devis, setDevis] = useState<QuoteWithDetails | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!params.id) return
    fetch(`/api/devis/${params.id}`)
      .then((r) => r.json())
      .then((data) => { setDevis(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [params.id])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    )
  }

  if (!devis || 'error' in (devis as object)) {
    return <div className="px-4 py-6 text-center text-muted-foreground">Devis introuvable</div>
  }

  const canEdit = devis.status === 'brouillon'
  const canSend = devis.status === 'brouillon'
  const canAccept = devis.status === 'envoyé' || devis.status === 'brouillon'
  const canRefuse = devis.status === 'envoyé' || devis.status === 'brouillon'

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
  const totaux = calculerTotaux(lotsAsInput, devis.discount_percent, devis.deposit_percent, false)

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900">{devis.quote_number}</h1>
            <DevisStatusBadge status={devis.status} />
          </div>
          <p className="text-sm text-gray-600">{devis.title}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          {canEdit && (
            <Link
              href={`/devis/${devis.id}/edit`}
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
            <p className="mt-1 text-sm text-gray-500">
              Chantier : {devis.site_address}{devis.site_city ? `, ${devis.site_city}` : ''}
            </p>
          )}
        </div>
      )}

      {/* Lots */}
      <div className="mb-4 space-y-3">
        {devis.lots.map((lot) => (
          <div key={lot.id} className="rounded-xl border border-gray-200 bg-white">
            <div className="rounded-t-xl bg-blue-50 px-4 py-2">
              <p className="font-semibold text-blue-800">{lot.name}</p>
            </div>
            <div className="divide-y divide-gray-100">
              {(lot.lignes ?? []).map((ligne) => (
                <div key={ligne.id} className="flex items-center justify-between gap-4 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-900">{ligne.description}</p>
                    <p className="text-xs text-gray-500">
                      {ligne.quantity} {ligne.unit} × {formatMontant(ligne.unit_price_ht)} — TVA {ligne.tva_rate}%
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-medium text-gray-900">
                    {formatMontant(ligne.quantity * ligne.unit_price_ht)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Totaux */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-gray-50 p-4">
        <div className="space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Total HT</span>
            <span>{formatMontant(totaux.total_ht)}</span>
          </div>
          {totaux.tva_ventilation.map((tva) => (
            <div key={tva.rate} className="flex justify-between text-sm">
              <span className="text-gray-600">TVA {tva.rate}%</span>
              <span>{formatMontant(tva.montant_tva)}</span>
            </div>
          ))}
          <div className="flex justify-between border-t border-gray-300 pt-1.5 text-base font-bold">
            <span>Total TTC</span>
            <span>{formatMontant(totaux.total_ttc)}</span>
          </div>
          {totaux.acompte_amount > 0 && (
            <div className="flex justify-between text-sm text-blue-600">
              <span>Acompte ({devis.deposit_percent}%)</span>
              <span>{formatMontant(totaux.acompte_amount)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Validité */}
      {devis.valid_until && (
        <p className="mb-6 text-sm text-gray-500">
          Valable jusqu&apos;au{' '}
          {new Intl.DateTimeFormat('fr-FR').format(new Date(devis.valid_until))}
        </p>
      )}

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
