'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { FactureStatusBadge } from '@/components/factures/facture-status-badge'
import { FactureActions } from '@/components/factures/facture-actions'
import { formatMontant } from '@/lib/invoices/calculations'
import type { InvoiceWithDetails } from '@/types/invoices'

export default function FactureDetailPage() {
  const params = useParams<{ id: string }>()
  const [facture, setFacture] = useState<InvoiceWithDetails | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!params.id) return
    fetch(`/api/factures/${params.id}`)
      .then((r) => r.json())
      .then((data) => { setFacture(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [params.id])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    )
  }

  if (!facture || 'error' in (facture as object)) {
    return <div className="px-4 py-6 text-center text-muted-foreground">Facture introuvable</div>
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900">{facture.invoice_number}</h1>
            <FactureStatusBadge status={facture.status} type={facture.type} />
          </div>
          <p className="text-sm text-gray-600">{facture.title}</p>
          {facture.due_date && (
            <p className="mt-1 text-xs text-gray-500">
              Échéance : {new Intl.DateTimeFormat('fr-FR').format(new Date(facture.due_date))}
            </p>
          )}
        </div>
        <Link
          href="/factures"
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          style={{ minHeight: 44 }}
        >
          ← Retour
        </Link>
      </div>

      {/* Client */}
      {facture.client && (
        <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">Client</p>
          <p className="font-medium text-gray-900">
            {facture.client.company_name
              ? `${facture.client.company_name} — ${facture.client.name}`
              : facture.client.name}
          </p>
          {facture.client.email && <p className="text-sm text-gray-500">{facture.client.email}</p>}
          {facture.client.phone && <p className="text-sm text-gray-500">{facture.client.phone}</p>}
        </div>
      )}

      {/* Chantier */}
      {(facture.object || facture.site_address) && (
        <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
          {facture.object && (
            <p className="text-sm text-gray-700">
              <span className="font-medium">Objet :</span> {facture.object}
            </p>
          )}
          {facture.site_address && (
            <p className="mt-1 text-sm text-gray-500">
              Chantier : {facture.site_address}{facture.site_city ? `, ${facture.site_city}` : ''}
            </p>
          )}
        </div>
      )}

      {/* Lots */}
      <div className="mb-4 space-y-3">
        {facture.lots.map((lot) => (
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
                      {ligne.quantity} {ligne.unit} × {formatMontant(ligne.unit_price_ht)}
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
            <span>{formatMontant(facture.total_ht)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">TVA</span>
            <span>{formatMontant(facture.total_tva)}</span>
          </div>
          <div className="flex justify-between border-t border-gray-300 pt-1.5 text-base font-bold">
            <span>Total TTC</span>
            <span>{formatMontant(facture.total_ttc)}</span>
          </div>
          {facture.deposit_amount_deducted > 0 && (
            <>
              <div className="flex justify-between text-sm text-orange-600">
                <span>Acompte déduit</span>
                <span>− {formatMontant(facture.deposit_amount_deducted)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-gray-900">
                <span>Net à payer</span>
                <span>{formatMontant(facture.total_ttc - facture.deposit_amount_deducted)}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Actions */}
      <FactureActions facture={facture} />
    </div>
  )
}
