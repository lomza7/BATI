'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { ClientForm } from '@/components/clients/client-form'
import type { Client } from '@/types/clients'

export default function EditClientPage() {
  const params = useParams<{ id: string }>()
  const [client, setClient] = useState<Client | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!params.id) return
    fetch(`/api/clients/${params.id}`)
      .then((r) => r.json())
      .then((data) => {
        setClient(data)
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

  if (!client || 'error' in (client as object)) {
    return <div className="px-4 py-6 text-center text-muted-foreground">Client introuvable</div>
  }

  const displayName = client.company_name ?? client.name

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/clients/${client.id}`}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground min-h-[44px]"
        >
          <ChevronLeft className="h-4 w-4" />
          {displayName}
        </Link>
      </div>
      <div>
        <h1 className="text-2xl font-bold">Modifier le client</h1>
      </div>
      <ClientForm client={client} />
    </div>
  )
}
