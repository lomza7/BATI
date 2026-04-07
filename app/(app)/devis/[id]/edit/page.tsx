'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { DevisForm } from '@/components/devis/devis-form'
import type { QuoteWithDetails } from '@/types/quotes'
import { supabase } from '@/lib/supabase'

interface ClientOption {
  id: string
  name: string
  company_name: string | null
}

export default function EditDevisPage() {
  const params = useParams<{ id: string }>()
  const [devis, setDevis] = useState<QuoteWithDetails | null>(null)
  const [clients, setClients] = useState<ClientOption[]>([])
  const [isAutoEntrepreneur, setIsAutoEntrepreneur] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      if (!params.id) return
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const [devisRes, clientsRes, profileRes] = await Promise.all([
        fetch(`/api/devis/${params.id}`).then((r) => r.json()),
        (supabase as any)
          .from('clients')
          .select('id,name,company_name')
          .is('deleted_at', null)
          .order('name', { ascending: true }),
        (supabase as any)
          .from('profiles')
          .select('is_auto_entrepreneur')
          .eq('id', user.id)
          .single(),
      ])

      setDevis(devisRes)
      setClients(clientsRes.data ?? [])
      setIsAutoEntrepreneur(profileRes.data?.is_auto_entrepreneur ?? false)
      setLoading(false)
    }
    load()
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

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-4">
        <Link
          href={`/devis/${devis.id}`}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground min-h-[44px] w-fit"
        >
          <ChevronLeft className="h-4 w-4" />
          {devis.quote_number}
        </Link>
      </div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Modifier le devis</h1>
      </div>
      <DevisForm clients={clients} initialValues={devis} isAutoEntrepreneur={isAutoEntrepreneur} />
    </div>
  )
}
