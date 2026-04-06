import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ChevronLeft,
  Building2,
  User,
  Phone,
  Mail,
  MapPin,
  FileText,
  Receipt,
  Pencil,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getClientWithHistory } from '@/lib/clients/service'
import { DeleteClientButton } from '@/components/features/clients/delete-client-button'

interface ClientPageProps {
  params: { id: string }
}

export async function generateMetadata({ params }: ClientPageProps): Promise<Metadata> {
  const client = await getClientWithHistory(params.id)
  return { title: client?.name ?? 'Client' }
}

export default async function ClientPage({ params }: ClientPageProps) {
  const client = await getClientWithHistory(params.id)

  if (!client) notFound()

  const displayName =
    client.client_type === 'professionnel' && client.company_name
      ? client.company_name
      : client.name

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Breadcrumb */}
      <Link
        href="/dashboard/clients"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground min-h-[44px] w-fit"
      >
        <ChevronLeft className="h-4 w-4" />
        Clients
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            {client.client_type === 'professionnel' ? (
              <Building2 className="h-6 w-6" />
            ) : (
              <User className="h-6 w-6" />
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold">{displayName}</h1>
            {client.client_type === 'professionnel' && client.company_name && (
              <p className="text-muted-foreground">{client.name}</p>
            )}
            <span className="inline-block rounded-full border px-2 py-0.5 text-xs capitalize text-muted-foreground">
              {client.client_type}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/dashboard/clients/${client.id}/edit`}>
            <Button variant="outline" size="icon" className="min-h-[44px] min-w-[44px]" aria-label="Modifier">
              <Pencil className="h-4 w-4" />
            </Button>
          </Link>
          <DeleteClientButton clientId={client.id} clientName={displayName} />
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <FileText className="h-4 w-4" />
              Devis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{client.devis_count}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Receipt className="h-4 w-4" />
              Factures
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{client.factures_count}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">CA Total TTC</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {client.total_facture_ttc.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Infos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Coordonnées</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {client.client_type === 'professionnel' && client.siret && (
            <div className="flex items-start gap-3">
              <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">SIRET</p>
                <p className="font-mono">{client.siret}</p>
              </div>
            </div>
          )}
          {client.email && (
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
              <a href={`mailto:${client.email}`} className="text-primary hover:underline">
                {client.email}
              </a>
            </div>
          )}
          {client.phone && (
            <div className="flex items-center gap-3">
              <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
              <a href={`tel:${client.phone}`} className="hover:underline">
                {client.phone}
              </a>
            </div>
          )}
          {(client.address || client.city) && (
            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div>
                {client.address && <p>{client.address}</p>}
                {(client.postal_code || client.city) && (
                  <p>{[client.postal_code, client.city].filter(Boolean).join(' ')}</p>
                )}
              </div>
            </div>
          )}
          {!client.email && !client.phone && !client.address && (
            <p className="text-sm text-muted-foreground">Aucune coordonnée renseignée</p>
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      {client.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm">{client.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Actions rapides */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link href={`/dashboard/devis/new?client=${client.id}`} className="flex-1">
          <Button variant="outline" size="lg" className="w-full min-h-[48px] gap-2">
            <FileText className="h-4 w-4" />
            Nouveau devis
          </Button>
        </Link>
        <Link href={`/dashboard/factures/new?client=${client.id}`} className="flex-1">
          <Button variant="outline" size="lg" className="w-full min-h-[48px] gap-2">
            <Receipt className="h-4 w-4" />
            Nouvelle facture
          </Button>
        </Link>
      </div>
    </div>
  )
}
