import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { ClientForm } from '@/components/features/clients/client-form'

export const metadata: Metadata = {
  title: 'Nouveau client',
}

export default function NewClientPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/clients"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground min-h-[44px]"
        >
          <ChevronLeft className="h-4 w-4" />
          Clients
        </Link>
      </div>
      <div>
        <h1 className="text-2xl font-bold">Nouveau client</h1>
        <p className="text-muted-foreground">Ajoutez un nouveau client à votre CRM.</p>
      </div>
      <ClientForm />
    </div>
  )
}
