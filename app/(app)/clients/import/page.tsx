import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { CsvImporter } from '@/components/clients/csv-importer'

export default function ImportClientsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-6">
      <div className="flex items-center gap-3">
        <Link
          href="/clients"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground min-h-[44px]"
        >
          <ChevronLeft className="h-4 w-4" />
          Clients
        </Link>
      </div>
      <div>
        <h1 className="text-2xl font-bold">Importer des clients</h1>
        <p className="text-muted-foreground">
          Importez vos clients depuis un fichier CSV (EBP, Ciel Compta, ou format générique).
        </p>
      </div>
      <CsvImporter />
    </div>
  )
}
