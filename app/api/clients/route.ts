import { type NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { clientCreateSchema, clientListQuerySchema } from '@/lib/clients/schemas'
import { listClients, createClient_ } from '@/lib/clients/service'

export async function GET(request: NextRequest) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { searchParams } = request.nextUrl
  const parsed = clientListQuerySchema.safeParse(Object.fromEntries(searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Paramètres invalides', details: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const result = await listClients(parsed.data)
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const parsed = clientCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const client = await createClient_(parsed.data)
    return NextResponse.json(client, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur serveur' }, { status: 500 })
  }
}
