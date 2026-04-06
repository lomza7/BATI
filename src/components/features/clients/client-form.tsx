'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SiretLookup } from './siret-lookup'
import type { Client } from '@/types/clients'
import type { ClientCreateInput } from '@/lib/clients/schemas'

interface ClientFormProps {
  client?: Client
  onSuccess?: (client: Client) => void
}

interface FieldErrors {
  [key: string]: string[] | undefined
}

export function ClientForm({ client, onSuccess }: ClientFormProps) {
  const router = useRouter()
  const isEdit = !!client

  const [clientType, setClientType] = useState<'particulier' | 'professionnel'>(
    client?.client_type ?? 'particulier'
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  const [form, setForm] = useState<Partial<ClientCreateInput>>({
    name: client?.name ?? '',
    email: client?.email ?? '',
    phone: client?.phone ?? '',
    address: client?.address ?? '',
    city: client?.city ?? '',
    postal_code: client?.postal_code ?? '',
    notes: client?.notes ?? '',
    company_name: client?.company_name ?? '',
    siret: client?.siret ?? '',
    billing_address: client?.billing_address ?? '',
    billing_city: client?.billing_city ?? '',
    billing_postal_code: client?.billing_postal_code ?? '',
  })

  function setField(field: keyof ClientCreateInput, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  function handleSiretFound(result: {
    company_name?: string | null
    address?: string | null
    postal_code?: string | null
    city?: string | null
  }) {
    setForm((prev) => ({
      ...prev,
      company_name: result.company_name ?? prev.company_name,
      address: result.address ?? prev.address,
      postal_code: result.postal_code ?? prev.postal_code,
      city: result.city ?? prev.city,
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setFieldErrors({})

    const payload: ClientCreateInput = {
      ...form,
      client_type: clientType,
      name: form.name ?? '',
    }

    try {
      const url = isEdit ? `/api/clients/${client.id}` : '/api/clients'
      const method = isEdit ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.details?.fieldErrors) {
          setFieldErrors(data.details.fieldErrors)
        } else {
          setError(data.error ?? 'Une erreur est survenue')
        }
        return
      }

      onSuccess?.(data as Client)
      router.push('/dashboard/clients')
      router.refresh()
    } catch {
      setError('Impossible de contacter le serveur')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Type de client */}
      <div className="space-y-2">
        <Label>Type de client</Label>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setClientType('particulier')}
            className={`flex-1 rounded-lg border-2 py-3 text-sm font-medium transition-colors min-h-[48px] ${
              clientType === 'particulier'
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-background hover:bg-accent'
            }`}
          >
            Particulier
          </button>
          <button
            type="button"
            onClick={() => setClientType('professionnel')}
            className={`flex-1 rounded-lg border-2 py-3 text-sm font-medium transition-colors min-h-[48px] ${
              clientType === 'professionnel'
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-background hover:bg-accent'
            }`}
          >
            Professionnel
          </button>
        </div>
      </div>

      {/* Nom */}
      <div className="space-y-2">
        <Label htmlFor="name">
          {clientType === 'professionnel' ? 'Nom du contact' : 'Nom complet'}{' '}
          <span className="text-destructive">*</span>
        </Label>
        <Input
          id="name"
          required
          value={form.name}
          onChange={(e) => setField('name', e.target.value)}
          placeholder={clientType === 'professionnel' ? 'Jean Martin' : 'Jean Martin'}
          className="min-h-[48px]"
          aria-invalid={!!fieldErrors['name']}
        />
        {fieldErrors['name'] && (
          <p className="text-sm text-destructive">{fieldErrors['name']![0]}</p>
        )}
      </div>

      {/* Champs pro */}
      {clientType === 'professionnel' && (
        <>
          <div className="space-y-2">
            <Label htmlFor="company_name">Raison sociale</Label>
            <Input
              id="company_name"
              value={form.company_name}
              onChange={(e) => setField('company_name', e.target.value)}
              placeholder="SARL Martin BTP"
              className="min-h-[48px]"
            />
          </div>

          <SiretLookup
            value={form.siret ?? ''}
            onChange={(v) => setField('siret', v)}
            onFound={handleSiretFound}
            error={fieldErrors['siret']?.[0]}
          />
        </>
      )}

      {/* Contact */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            inputMode="email"
            value={form.email}
            onChange={(e) => setField('email', e.target.value)}
            placeholder="jean@example.com"
            className="min-h-[48px]"
            aria-invalid={!!fieldErrors['email']}
          />
          {fieldErrors['email'] && (
            <p className="text-sm text-destructive">{fieldErrors['email']![0]}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Téléphone</Label>
          <Input
            id="phone"
            type="tel"
            inputMode="tel"
            value={form.phone}
            onChange={(e) => setField('phone', e.target.value)}
            placeholder="06 12 34 56 78"
            className="min-h-[48px]"
          />
        </div>
      </div>

      {/* Adresse principale */}
      <div className="space-y-2">
        <Label htmlFor="address">Adresse</Label>
        <Input
          id="address"
          value={form.address}
          onChange={(e) => setField('address', e.target.value)}
          placeholder="12 rue des Artisans"
          className="min-h-[48px]"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="postal_code">Code postal</Label>
          <Input
            id="postal_code"
            inputMode="numeric"
            value={form.postal_code}
            onChange={(e) => setField('postal_code', e.target.value)}
            placeholder="75001"
            maxLength={5}
            className="min-h-[48px]"
            aria-invalid={!!fieldErrors['postal_code']}
          />
          {fieldErrors['postal_code'] && (
            <p className="text-sm text-destructive">{fieldErrors['postal_code']![0]}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="city">Ville</Label>
          <Input
            id="city"
            value={form.city}
            onChange={(e) => setField('city', e.target.value)}
            placeholder="Paris"
            className="min-h-[48px]"
          />
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <textarea
          id="notes"
          value={form.notes}
          onChange={(e) => setField('notes', e.target.value)}
          placeholder="Informations complémentaires..."
          rows={3}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[80px]"
        />
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => router.back()}
          disabled={loading}
          className="min-h-[48px] flex-1 sm:flex-none"
        >
          Annuler
        </Button>
        <Button
          type="submit"
          size="lg"
          disabled={loading}
          className="min-h-[48px] flex-1"
        >
          {loading ? 'Enregistrement...' : isEdit ? 'Mettre à jour' : 'Créer le client'}
        </Button>
      </div>
    </form>
  )
}
