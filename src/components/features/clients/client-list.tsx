'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Search, X, Filter, UserPlus, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ClientCard } from './client-card'
import type { Client, ClientListResult } from '@/types/clients'

const PAGE_SIZE = 20

export function ClientList() {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'particulier' | 'professionnel'>('all')
  const [page, setPage] = useState(1)
  const [result, setResult] = useState<ClientListResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchClients = useCallback(async (q: string, type: string, currentPage: number) => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: String(PAGE_SIZE),
      })
      if (q.trim()) params.set('q', q.trim())
      if (type !== 'all') params.set('type', type)

      const res = await fetch(`/api/clients?${params}`)
      if (!res.ok) throw new Error('Erreur lors du chargement')
      const data: ClientListResult = await res.json()
      setResult(data)
    } catch {
      setError('Impossible de charger les clients')
    } finally {
      setLoading(false)
    }
  }, [])

  // Debounce search
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => {
      setPage(1)
      fetchClients(search, typeFilter, 1)
    }, 250)
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current)
    }
  }, [search, typeFilter, fetchClients])

  useEffect(() => {
    fetchClients(search, typeFilter, page)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  const clients: Client[] = result?.data ?? []
  const total = result?.total ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="space-y-4">
      {/* Search + actions */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Rechercher un client..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-h-[48px] pl-9 pr-9"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Effacer la recherche"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Link href="/dashboard/clients/new">
          <Button size="lg" className="w-full min-h-[48px] sm:w-auto gap-2">
            <UserPlus className="h-4 w-4" />
            Nouveau client
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTypeFilter('all')}
          className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors min-h-[36px] ${
            typeFilter === 'all'
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border hover:bg-accent'
          }`}
        >
          <Filter className="h-3 w-3" />
          Tous
          {total > 0 && <span className="ml-1 rounded-full bg-primary/20 px-1.5 text-xs">{total}</span>}
        </button>
        <button
          type="button"
          onClick={() => setTypeFilter('particulier')}
          className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors min-h-[36px] ${
            typeFilter === 'particulier'
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border hover:bg-accent'
          }`}
        >
          Particuliers
        </button>
        <button
          type="button"
          onClick={() => setTypeFilter('professionnel')}
          className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors min-h-[36px] ${
            typeFilter === 'professionnel'
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border hover:bg-accent'
          }`}
        >
          Professionnels
        </button>
      </div>

      {/* List */}
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && clients.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed py-16 text-center">
          <div className="rounded-full bg-muted p-4">
            <UserPlus className="h-8 w-8 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium">
              {search ? 'Aucun client trouvé' : "Aucun client pour l'instant"}
            </p>
            <p className="text-sm text-muted-foreground">
              {search
                ? 'Essayez un autre terme de recherche'
                : 'Créez votre premier client pour commencer'}
            </p>
          </div>
          {!search && (
            <Link href="/dashboard/clients/new">
              <Button>Créer un client</Button>
            </Link>
          )}
        </div>
      )}

      {!loading && clients.length > 0 && (
        <>
          <div className="space-y-2">
            {clients.map((client) => (
              <ClientCard key={client.id} client={client} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-muted-foreground">
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} sur {total} clients
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="min-h-[44px]"
                >
                  Précédent
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="min-h-[44px]"
                >
                  Suivant
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
