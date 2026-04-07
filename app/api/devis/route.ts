import { type NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { quoteCreateSchema, quoteListQuerySchema } from '@/lib/quotes/schemas'
import { listQuotes, createQuote } from '@/lib/quotes/service'

export async function GET(request: NextRequest) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { searchParams } = request.nextUrl
  const parsed = quoteListQuerySchema.safeParse(Object.fromEntries(searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Paramètres invalides', details: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const result = await listQuotes(parsed.data)
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const parsed = quoteCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const quote = await createQuote(parsed.data)
    return NextResponse.json(quote, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur serveur' }, { status: 500 })
  }
}
