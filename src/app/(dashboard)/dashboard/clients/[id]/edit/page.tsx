import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { ClientForm } from '@/components/features/clients/client-form'
import { getClient } from '@/lib/clients/service'

interface EditClientPageProps {
  params: { id: string }
}

export async function generateMetadata({ params }: EditClientPageProps): Promise<Metadata> {
  const client = await getClient(params.id)
  return { title: client ? `Modifier — ${client.name}` : 'Modifier client' }
}

export default async function EditClientPage({ params }: EditClientPageProps) {
  const client = await getClient(params.id)

  if (!client) notFound()

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/dashboard/clients/${client.id}`}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground min-h-[44px]"
        >
          <ChevronLeft className="h-4 w-4" />
          {client.company_name ?? client.name}
        </Link>
      </div>
      <div>
        <h1 className="text-2xl font-bold">Modifier le client</h1>
      </div>
      <ClientForm client={client} />
    </div>
  )
}
