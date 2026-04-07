import { type NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import Papa from 'papaparse'
import { clientCreateSchema } from '@/lib/clients/schemas'
import { createClient_ } from '@/lib/clients/service'

export async function POST(request: NextRequest) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 })

    const text = await file.text()
    const { data: rows, errors } = Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, '_'),
    })

    if (errors.length > 0) {
      return NextResponse.json({ error: 'Fichier CSV invalide', details: errors }, { status: 400 })
    }

    const results = { imported: 0, skipped: 0, errors: [] as string[] }

    for (const [idx, row] of (rows as Record<string, string>[]).entries()) {
      const parsed = clientCreateSchema.safeParse({
        name: row.nom ?? row.name ?? '',
        email: row.email ?? undefined,
        phone: row.telephone ?? row.phone ?? undefined,
        address: row.adresse ?? row.address ?? undefined,
        city: row.ville ?? row.city ?? undefined,
        postal_code: row.code_postal ?? row.postal_code ?? undefined,
        client_type: row.type === 'professionnel' ? 'professionnel' : 'particulier',
        company_name: row.societe ?? row.company_name ?? undefined,
        siret: row.siret ?? undefined,
      })

      if (!parsed.success) {
        results.errors.push(`Ligne ${idx + 2}: ${parsed.error.errors[0]?.message ?? 'Données invalides'}`)
        results.skipped++
        continue
      }

      try {
        await createClient_(parsed.data)
        results.imported++
      } catch (err) {
        results.errors.push(`Ligne ${idx + 2}: ${err instanceof Error ? err.message : 'Erreur'}`)
        results.skipped++
      }
    }

    return NextResponse.json(results)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur serveur' }, { status: 500 })
  }
}
