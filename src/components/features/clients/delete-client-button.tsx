'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface DeleteClientButtonProps {
  clientId: string
  clientName: string
}

export function DeleteClientButton({ clientId, clientName }: DeleteClientButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    if (!confirm(`Supprimer le client "${clientName}" ? Cette action est irréversible.`)) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/clients/${clientId}`, { method: 'DELETE' })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Impossible de supprimer ce client')
        return
      }

      router.push('/dashboard/clients')
      router.refresh()
    } catch {
      setError('Erreur de connexion')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <Button
        variant="outline"
        size="icon"
        onClick={handleDelete}
        disabled={loading}
        className="min-h-[44px] min-w-[44px] text-destructive hover:bg-destructive hover:text-destructive-foreground"
        aria-label="Supprimer le client"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
      </Button>
      {error && (
        <p className="mt-2 text-xs text-destructive max-w-xs">{error}</p>
      )}
    </div>
  )
}
