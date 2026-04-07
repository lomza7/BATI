'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface DevisActionsProps {
  devisId: string
  canSend: boolean
  canAccept: boolean
  canRefuse: boolean
  sentToEmail: string | null
  clientEmail: string | null
}

export function DevisActions({
  devisId,
  canSend,
  canAccept,
  canRefuse,
  sentToEmail,
  clientEmail,
}: DevisActionsProps) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showSendModal, setShowSendModal] = useState(false)
  const [sendEmail, setSendEmail] = useState(sentToEmail ?? clientEmail ?? '')

  async function doAction(action: string, body?: Record<string, unknown>) {
    setLoading(action)
    setError(null)
    try {
      const res = await fetch(`/api/devis/${devisId}/${action}`, {
        method: 'POST',
        ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Erreur')
      }
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(null)
    }
  }

  async function handleDuplicate() {
    setLoading('duplicate')
    setError(null)
    try {
      const res = await fetch(`/api/devis/${devisId}/duplicate`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Erreur')
      }
      const copy = await res.json()
      router.push(`/dashboard/devis/${copy.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
      setLoading(null)
    }
  }

  async function handleSharePdf() {
    const pdfUrl = `/api/devis/${devisId}/pdf`
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        const res = await fetch(pdfUrl)
        const blob = await res.blob()
        const file = new File([blob], `devis.pdf`, { type: 'application/pdf' })
        await navigator.share({ files: [file], title: 'Devis Hellobat' })
        return
      } catch {
        // fallback to download
      }
    }
    // Fallback: download direct
    const a = document.createElement('a')
    a.href = pdfUrl
    a.download = 'devis.pdf'
    a.click()
  }

  return (
    <div className="mt-6 space-y-3">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Télécharger / Partager PDF */}
      <button
        type="button"
        onClick={handleSharePdf}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-4 text-sm font-semibold text-white hover:bg-blue-700"
        style={{ minHeight: 56 }}
      >
        Télécharger / Partager le PDF
      </button>

      {/* Envoyer par email */}
      {canSend && (
        <button
          type="button"
          onClick={() => setShowSendModal(true)}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-blue-600 py-4 text-sm font-semibold text-blue-600 hover:bg-blue-50"
          style={{ minHeight: 56 }}
        >
          Envoyer par email
        </button>
      )}

      {/* Modal envoi email */}
      {showSendModal && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40 sm:items-center sm:justify-center">
          <div className="w-full rounded-t-2xl bg-white p-6 shadow-xl sm:max-w-md sm:rounded-2xl">
            <h3 className="mb-4 text-base font-semibold text-gray-900">Envoyer le devis</h3>
            <input
              type="email"
              value={sendEmail}
              onChange={(e) => setSendEmail(e.target.value)}
              placeholder="Email du client"
              className="mb-4 w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{ minHeight: 48 }}
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowSendModal(false)}
                className="flex-1 rounded-lg border border-gray-300 py-3 text-sm font-medium text-gray-700"
                style={{ minHeight: 48 }}
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={loading === 'send' || !sendEmail}
                onClick={async () => {
                  await doAction('send', { email: sendEmail })
                  setShowSendModal(false)
                }}
                className="flex-1 rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white disabled:opacity-60"
                style={{ minHeight: 48 }}
              >
                {loading === 'send' ? 'Envoi…' : 'Envoyer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Accepter / Refuser */}
      <div className="grid grid-cols-2 gap-3">
        {canAccept && (
          <button
            type="button"
            disabled={loading === 'accept'}
            onClick={() => doAction('accept')}
            className="rounded-lg bg-green-600 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
            style={{ minHeight: 48 }}
          >
            {loading === 'accept' ? '…' : '✓ Accepté'}
          </button>
        )}
        {canRefuse && (
          <button
            type="button"
            disabled={loading === 'refuse'}
            onClick={() => doAction('refuse')}
            className="rounded-lg bg-red-50 py-3 text-sm font-semibold text-red-600 hover:bg-red-100 disabled:opacity-60"
            style={{ minHeight: 48 }}
          >
            {loading === 'refuse' ? '…' : '✕ Refusé'}
          </button>
        )}
      </div>

      {/* Dupliquer */}
      <button
        type="button"
        disabled={loading === 'duplicate'}
        onClick={handleDuplicate}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
        style={{ minHeight: 48 }}
      >
        {loading === 'duplicate' ? 'Duplication…' : 'Dupliquer ce devis'}
      </button>
    </div>
  )
}
