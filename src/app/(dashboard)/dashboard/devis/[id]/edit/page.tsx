import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getDevis } from '@/lib/devis/service'
import { DevisForm } from '@/components/features/devis/devis-form'

type Params = { params: Promise<{ id: string }> }

export const metadata = { title: 'Modifier le devis — Hellobat' }

export default async function EditDevisPage({ params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { id } = await params
  const devis = await getDevis(id)
  if (!devis) notFound()

  if (devis.status !== 'brouillon') {
    redirect(`/dashboard/devis/${id}`)
  }

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
        <h1 className="text-xl font-bold text-gray-900">Modifier {devis.reference}</h1>
        <p className="text-sm text-gray-500">Brouillon — modifications enregistrées immédiatement</p>
      </div>

      <DevisForm
        clients={clients}
        initialValues={devis}
        isAutoEntrepreneur={isAutoEntrepreneur}
      />
    </div>
  )
}
