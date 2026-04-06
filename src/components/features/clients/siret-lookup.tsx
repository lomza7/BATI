'use client'

import { useState } from 'react'
import { Search, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface SiretResult {
  siret: string
  found: boolean
  company_name?: string | null
  address?: string | null
  postal_code?: string | null
  city?: string | null
  error?: string
}

interface SiretLookupProps {
  value: string
  onChange: (value: string) => void
  onFound?: (result: SiretResult) => void
  error?: string
}

export function SiretLookup({ value, onChange, onFound, error }: SiretLookupProps) {
  const [loading, setLoading] = useState(false)
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [found, setFound] = useState(false)

  async function handleLookup() {
    const cleaned = value.replace(/\s/g, '')
    if (cleaned.length !== 14) {
      setLookupError('Le SIRET doit contenir 14 chiffres')
      return
    }

    setLoading(true)
    setLookupError(null)
    setFound(false)

    try {
      const res = await fetch(`/api/clients/search-siret?siret=${cleaned}`)
      const data: SiretResult = await res.json()

      if (!res.ok) {
        setLookupError(data.error ?? 'Erreur lors de la recherche')
        return
      }

      if (data.found) {
        setFound(true)
        onFound?.(data)
      } else {
        setLookupError(data.error ?? 'SIRET introuvable dans la base Sirene')
      }
    } catch {
      setLookupError('Service temporairement indisponible')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="siret">SIRET</Label>
      <div className="flex gap-2">
        <Input
          id="siret"
          type="text"
          inputMode="numeric"
          placeholder="12345678901234"
          value={value}
          onChange={(e) => {
            onChange(e.target.value.replace(/\D/g, ''))
            setFound(false)
            setLookupError(null)
          }}
          maxLength={14}
          className="min-h-[48px] font-mono"
          aria-invalid={!!error || !!lookupError}
        />
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={handleLookup}
          disabled={loading || value.replace(/\s/g, '').length !== 14}
          className="min-h-[48px] shrink-0"
          aria-label="Rechercher dans la base Sirene"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
        </Button>
      </div>
      {found && (
        <p className="text-sm text-green-600">Entreprise trouvée — informations préremplies</p>
      )}
      {(error || lookupError) && (
        <p className="text-sm text-destructive">{error ?? lookupError}</p>
      )}
    </div>
  )
}
