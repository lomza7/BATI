'use client'

import { useState, useEffect } from 'react'
import { DevisForm } from '@/components/devis/devis-form'
import { supabase } from '@/lib/supabase'

interface ClientOption {
  id: string
  name: string
  company_name: string | null
}

export default function NewDevisPage() {
  const [clients, setClients] = useState<ClientOption[]>([])
  const [isAutoEntrepreneur, setIsAutoEntrepreneur] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const [clientsRes, profileRes] = await Promise.all([
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

      setClients(clientsRes.data ?? [])
      setIsAutoEntrepreneur(profileRes.data?.is_auto_entrepreneur ?? false)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Nouveau devis</h1>
        <p className="text-sm text-gray-500">Remplissez les informations ci-dessous</p>
      </div>
      <DevisForm clients={clients} isAutoEntrepreneur={isAutoEntrepreneur} />
    </div>
  )
}
