import type { Metadata } from 'next'
import Link from 'next/link'
import { Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ClientList } from '@/components/features/clients/client-list'

export const metadata: Metadata = {
  title: 'Clients',
}

export default function ClientsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Clients</h1>
          <p className="text-muted-foreground">Gérez vos clients particuliers et professionnels.</p>
        </div>
        <Link href="/dashboard/clients/import">
          <Button variant="outline" size="sm" className="min-h-[44px] gap-2 shrink-0">
            <Upload className="h-4 w-4" />
            <span className="hidden sm:inline">Importer CSV</span>
          </Button>
        </Link>
      </div>
      <ClientList />
    </div>
  )
}
