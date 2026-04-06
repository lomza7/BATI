import Link from 'next/link'
import { Building2, User, Phone, Mail, MapPin, ChevronRight } from 'lucide-react'
import type { Client } from '@/types/clients'

interface ClientCardProps {
  client: Client
}

export function ClientCard({ client }: ClientCardProps) {
  const displayName = client.client_type === 'professionnel' && client.company_name
    ? client.company_name
    : client.name

  const subtitle = client.client_type === 'professionnel' && client.company_name
    ? client.name
    : null

  return (
    <Link
      href={`/dashboard/clients/${client.id}`}
      className="flex items-center gap-4 rounded-lg border bg-card p-4 transition-colors hover:bg-accent min-h-[72px]"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        {client.client_type === 'professionnel' ? (
          <Building2 className="h-5 w-5" />
        ) : (
          <User className="h-5 w-5" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{displayName}</p>
        {subtitle && (
          <p className="truncate text-sm text-muted-foreground">{subtitle}</p>
        )}
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
          {client.phone && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Phone className="h-3 w-3" />
              {client.phone}
            </span>
          )}
          {client.email && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Mail className="h-3 w-3" />
              <span className="truncate max-w-[160px]">{client.email}</span>
            </span>
          )}
          {client.city && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              {client.postal_code ? `${client.postal_code} ` : ''}{client.city}
            </span>
          )}
        </div>
      </div>

      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>
  )
}
