'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { FactureWithDetails } from '@/types/factures'
import { PaymentDialog } from './payment-dialog'

interface Props {
  facture: FactureWithDetails
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
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
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

      // Web Share API si disponible (mobile)
      if (navigator.share && navigator.canShare?.({ files: [new File([blob], `${facture.reference}.pdf`, { type: 'application/pdf' })] })) {
        await navigator.share({
          title: facture.reference,
          files: [new File([blob], `${facture.reference}.pdf`, { type: 'application/pdf' })],
        })
      } else {
        const a = document.createElement('a')
        a.href = url
        a.download = `${facture.reference}.pdf`
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
      router.push(`/dashboard/factures/${data.id}`)
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

      {/* PDF — toujours disponible */}
      <button
        onClick={downloadPdf}
        disabled={!!loading}
        className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 text-base font-medium text-gray-700 disabled:opacity-50"
      >
        {isLoading('pdf') ? 'Génération…' : '⬇ Télécharger PDF'}
      </button>

      {/* Émettre — brouillon uniquement */}
      {facture.status === 'brouillon' && (
        <button
          onClick={emit}
          disabled={!!loading}
          className="flex min-h-[48px] w-full items-center justify-center rounded-xl bg-blue-600 px-4 text-base font-semibold text-white disabled:opacity-50"
        >
          {isLoading('emit') ? 'Émission en cours…' : 'Émettre la facture'}
        </button>
      )}

      {/* Envoyer par email */}
      {['émise', 'envoyée'].includes(facture.status) && facture.client?.email && (
        <button
          onClick={() => action('send', 'POST', { email: facture.client!.email })}
          disabled={!!loading}
          className="flex min-h-[48px] w-full items-center justify-center rounded-xl bg-indigo-600 px-4 text-base font-semibold text-white disabled:opacity-50"
        >
          {isLoading('send') ? 'Envoi…' : `Envoyer à ${facture.client.email}`}
        </button>
      )}

      {/* Marquer payée */}
      {['émise', 'envoyée', 'en_retard'].includes(facture.status) && (
        <button
          onClick={() => setShowPayDialog(true)}
          disabled={!!loading}
          className="flex min-h-[48px] w-full items-center justify-center rounded-xl bg-green-600 px-4 text-base font-semibold text-white disabled:opacity-50"
        >
          Marquer comme payée
        </button>
      )}

      {/* Créer situation */}
      {facture.type === 'facture' && ['brouillon', 'émise', 'envoyée', 'payée'].includes(facture.status) && (
        <button
          onClick={() => router.push(`/dashboard/factures/${facture.id}/situation`)}
          disabled={!!loading}
          className="flex min-h-[48px] w-full items-center justify-center rounded-xl border border-blue-300 bg-blue-50 px-4 text-base font-medium text-blue-700 disabled:opacity-50"
        >
          Créer une situation de travaux
        </button>
      )}

      {/* Créer avoir */}
      {facture.type !== 'avoir' && ['émise', 'envoyée', 'payée', 'en_retard'].includes(facture.status) && (
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
