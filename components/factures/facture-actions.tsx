'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { InvoiceWithDetails } from '@/types/invoices'
import { PaymentDialog } from './payment-dialog'

interface Props {
  facture: InvoiceWithDetails
}

export function FactureActions({ facture }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [showPayDialog, setShowPayDialog] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function action(path: string, method = 'POST', body?: object) {
    setLoading(path)
    setError(null)
    try {
      const res = await fetch(`/api/factures/${facture.id}/${path}`, {
        method,
        ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Erreur')
        return
      }
      router.refresh()
    } catch {
      setError('Erreur réseau')
    } finally {
      setLoading(null)
    }
  }

  async function downloadPdf() {
    setLoading('pdf')
    try {
      const res = await fetch(`/api/factures/${facture.id}/pdf`)
      if (!res.ok) { setError('Erreur génération PDF'); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)

      if (navigator.share && navigator.canShare?.({ files: [new File([blob], `${facture.invoice_number}.pdf`, { type: 'application/pdf' })] })) {
        await navigator.share({
          title: facture.invoice_number,
          files: [new File([blob], `${facture.invoice_number}.pdf`, { type: 'application/pdf' })],
        })
      } else {
        const a = document.createElement('a')
        a.href = url
        a.download = `${facture.invoice_number}.pdf`
        a.click()
      }
      URL.revokeObjectURL(url)
    } catch {
      setError('Erreur téléchargement')
    } finally {
      setLoading(null)
    }
  }

  async function emit() {
    setLoading('emit')
    setError(null)
    try {
      const res = await fetch(`/api/factures/${facture.id}/emit`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json()
        if (data.details) {
          setError(data.details.map((e: { message: string }) => e.message).join(' | '))
        } else {
          setError(data.error ?? 'Erreur émission')
        }
        return
      }
      router.refresh()
    } catch {
      setError('Erreur réseau')
    } finally {
      setLoading(null)
    }
  }

  async function createAvoir() {
    setLoading('avoir')
    setError(null)
    try {
      const res = await fetch(`/api/factures/${facture.id}/avoir`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Erreur'); return }
      router.push(`/factures/${data.id}`)
    } catch {
      setError('Erreur réseau')
    } finally {
      setLoading(null)
    }
  }

  const isLoading = (key: string) => loading === key

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      <button
        onClick={downloadPdf}
        disabled={!!loading}
        className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 text-base font-medium text-gray-700 disabled:opacity-50"
      >
        {isLoading('pdf') ? 'Génération…' : '⬇ Télécharger PDF'}
      </button>

      {facture.status === 'brouillon' && (
        <button
          onClick={emit}
          disabled={!!loading}
          className="flex min-h-[48px] w-full items-center justify-center rounded-xl bg-blue-600 px-4 text-base font-semibold text-white disabled:opacity-50"
        >
          {isLoading('emit') ? 'Émission en cours…' : 'Émettre la facture'}
        </button>
      )}

      {['émise', 'envoyée'].includes(facture.status) && facture.client?.email && (
        <button
          onClick={() => action('send', 'POST', { email: facture.client!.email })}
          disabled={!!loading}
          className="flex min-h-[48px] w-full items-center justify-center rounded-xl bg-indigo-600 px-4 text-base font-semibold text-white disabled:opacity-50"
        >
          {isLoading('send') ? 'Envoi…' : `Envoyer à ${facture.client.email}`}
        </button>
      )}

      {['émise', 'envoyée', 'en_retard'].includes(facture.status) && (
        <button
          onClick={() => setShowPayDialog(true)}
          disabled={!!loading}
          className="flex min-h-[48px] w-full items-center justify-center rounded-xl bg-green-600 px-4 text-base font-semibold text-white disabled:opacity-50"
        >
          Marquer comme payée
        </button>
      )}

      {facture.type === 'invoice' && ['brouillon', 'émise', 'envoyée', 'payée'].includes(facture.status) && (
        <button
          onClick={() => router.push(`/factures/${facture.id}/situation`)}
          disabled={!!loading}
          className="flex min-h-[48px] w-full items-center justify-center rounded-xl border border-blue-300 bg-blue-50 px-4 text-base font-medium text-blue-700 disabled:opacity-50"
        >
          Créer une situation de travaux
        </button>
      )}

      {facture.type !== 'credit_note' && ['émise', 'envoyée', 'payée', 'en_retard'].includes(facture.status) && (
        <button
          onClick={createAvoir}
          disabled={!!loading}
          className="flex min-h-[48px] w-full items-center justify-center rounded-xl border border-orange-300 bg-orange-50 px-4 text-base font-medium text-orange-700 disabled:opacity-50"
        >
          {isLoading('avoir') ? 'Création…' : 'Émettre un avoir'}
        </button>
      )}

      <PaymentDialog
        factureId={facture.id}
        totalTtc={facture.total_ttc}
        open={showPayDialog}
        onClose={() => setShowPayDialog(false)}
      />
    </div>
  )
}
