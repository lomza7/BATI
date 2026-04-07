import { type NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@/lib/supabase/server'
import Papa from 'papaparse'
import { clientCreateSchema } from '@/lib/clients/schemas'
import { isDuplicateClient } from '@/lib/clients/schemas'

const ASYNC_THRESHOLD = 200

interface ImportReport {
  created: number
  skipped: number
  errors: Array<{ row: number; message: string }>
}

// Column mapping: CSV header variations → DB field names
const COLUMN_MAP: Record<string, string> = {
  // Generic
  nom: 'name',
  name: 'name',
  'nom client': 'name',
  email: 'email',
  'e-mail': 'email',
  telephone: 'phone',
  téléphone: 'phone',
  phone: 'phone',
  tel: 'phone',
  adresse: 'address',
  address: 'address',
  ville: 'city',
  city: 'city',
  'code postal': 'postal_code',
  cp: 'postal_code',
  'postal code': 'postal_code',
  notes: 'notes',
  remarques: 'notes',
  siret: 'siret',
  'raison sociale': 'company_name',
  'company name': 'company_name',
  entreprise: 'company_name',
  type: 'client_type',
  // EBP specific
  'nom ou raison sociale': 'name',
  'type tiers': 'client_type',
  'code postal (livraison)': 'postal_code',
  'ville (livraison)': 'city',
  'adresse (livraison)': 'address',
  // Ciel Compta specific
  intitule: 'name',
  'n° siret': 'siret',
}

function normalizeHeader(header: string): string {
  return header.toLowerCase().trim().replace(/[^a-zéèêëàâùûüîïôçœæ0-9 ]/g, '')
}

function mapRow(row: Record<string, string>): Record<string, string> {
  const mapped: Record<string, string> = {}
  for (const [key, value] of Object.entries(row)) {
    const normalized = normalizeHeader(key)
    const field = COLUMN_MAP[normalized]
    if (field && value?.trim()) {
      mapped[field] = value.trim()
    }
  }
  return mapped
}

function normalizeClientType(value: string): 'particulier' | 'professionnel' {
  const lower = value.toLowerCase()
  if (lower.includes('pro') || lower.includes('entreprise') || lower.includes('société')) {
    return 'professionnel'
  }
  return 'particulier'
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get('file')

  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'Fichier CSV manquant' }, { status: 400 })
  }

  const text = await (file as Blob).text()

  // Parse CSV with papaparse (auto-detect separator and encoding)
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  })

  if (parsed.errors.length > 0 && parsed.data.length === 0) {
    return NextResponse.json({ error: 'Fichier CSV invalide', details: parsed.errors }, { status: 422 })
  }

  const rows = parsed.data
  const isAsync = rows.length > ASYNC_THRESHOLD

  if (isAsync) {
    // For large imports, return immediately and process in background
    // In production this would use a queue; here we process synchronously but signal async
    processImport(rows, user.id).catch(() => {
      // Background error — would be tracked via monitoring
    })
    return NextResponse.json(
      { message: `Import de ${rows.length} lignes lancé en arrière-plan.`, async: true },
      { status: 202 }
    )
  }

  const report = await processImport(rows, user.id)
  return NextResponse.json(report, { status: 200 })
}

async function processImport(
  rows: Record<string, string>[],
  userId: string
): Promise<ImportReport> {
  const supabase = await createSupabaseClient()
  const report: ImportReport = { created: 0, skipped: 0, errors: [] }

  // Fetch existing clients for duplicate detection
  const { data: existingClients } = await supabase
    .from('clients')
    .select('email,phone,siret')
    .eq('user_id', userId)
    .is('deleted_at', null)

  const existing: Array<{ email?: string | null; phone?: string | null; siret?: string | null }> = existingClients ?? []

  for (let i = 0; i < rows.length; i++) {
    const rawRow = rows[i]!
    const mapped = mapRow(rawRow)

    if (!mapped['name']) {
      report.errors.push({ row: i + 2, message: 'Nom obligatoire manquant' })
      continue
    }

    // Normalize client_type
    if (mapped['client_type']) {
      mapped['client_type'] = normalizeClientType(mapped['client_type'])
    }

    const validation = clientCreateSchema.safeParse(mapped)
    if (!validation.success) {
      report.errors.push({
        row: i + 2,
        message: validation.error.issues.map((e) => e.message).join(', '),
      })
      continue
    }

    const input = validation.data

    // Duplicate detection
    const candidate = { ...(input.email !== undefined ? { email: input.email } : {}), ...(input.phone !== undefined ? { phone: input.phone } : {}), ...(input.siret !== undefined ? { siret: input.siret } : {}) }
    const isDuplicate = existing.some((ex) => isDuplicateClient(candidate, ex))
    if (isDuplicate) {
      report.skipped++
      continue
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from('clients').insert({
      ...input,
      user_id: userId,
    })

    if (error) {
      if (error.code === '23505') {
        report.skipped++
      } else {
        report.errors.push({ row: i + 2, message: error.message })
      }
      continue
    }

    report.created++
    // Add to in-memory dedup list for remainder of batch
    existing.push({ email: input.email ?? null, phone: input.phone ?? null, siret: input.siret ?? null })
  }

  return report
}
