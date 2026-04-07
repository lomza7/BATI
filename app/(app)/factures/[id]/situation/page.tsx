'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { SituationEditor } from '@/components/factures/situation-editor'
import type { InvoiceWithDetails } from '@/types/invoices'

export default function SituationPage() {
  const params = useParams<{ id: string }>()
  const [facture, setFacture] = useState<InvoiceWithDetails | null>(null)
  const [cumulsPrecedents, setCumulsPrecedents] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!params.id) return
    fetch(`/api/factures/${params.id}`)
      .then((r) => r.json())
      .then((data: InvoiceWithDetails) => {
        setFacture(data)
        // Build cumulsPrecedents from invoice_situations (not available here without a dedicated endpoint)
        // Default to 0 — the API will validate the max
        const cumuls: Record<string, number> = {}
        for (const lot of data.lots ?? []) {
          cumuls[lot.id] = 0
        }
        setCumulsPrecedents(cumuls)
        setLoading(false)
      })
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
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-4">
        <Link
          href={`/factures/${facture.id}`}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground min-h-[44px] w-fit"
        >
          <ChevronLeft className="h-4 w-4" />
          {facture.invoice_number}
        </Link>
      </div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Situation de travaux</h1>
        <p className="text-sm text-gray-500">
          Saisissez l&apos;avancement de chaque lot pour cette situation.
        </p>
      </div>
      <SituationEditor
        factureId={facture.id}
        lots={facture.lots}
        cumulsPrecedents={cumulsPrecedents}
      />
    </div>
  )
}
