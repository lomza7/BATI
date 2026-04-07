import { type NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { quoteUpdateSchema } from '@/lib/quotes/schemas'
import { getQuote, updateQuote, deleteQuote } from '@/lib/quotes/service'

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: Params) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { id } = await params
  try {
    const quote = await getQuote(id)
    if (!quote) return NextResponse.json({ error: 'Devis introuvable' }, { status: 404 })
    return NextResponse.json(quote)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur serveur' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const parsed = quoteUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const quote = await updateQuote(id, parsed.data)
    return NextResponse.json(quote)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur serveur' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { id } = await params
  try {
    await deleteQuote(id)
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur serveur' }, { status: 500 })
  }
}
