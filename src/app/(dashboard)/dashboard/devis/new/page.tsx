import { createClient } from '@/lib/supabase/server'
import { DevisForm } from '@/components/features/devis/devis-form'
import { redirect } from 'next/navigation'

export const metadata = { title: 'Nouveau devis — Hellobat' }

export default async function NewDevisPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const [clientsResult, profileResult] = await Promise.all([
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
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const clients = (clientsResult.data ?? []) as Array<{
    id: string
    name: string
    company_name: string | null
  }>

  const isAutoEntrepreneur = profileResult.data?.is_auto_entrepreneur ?? false

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
