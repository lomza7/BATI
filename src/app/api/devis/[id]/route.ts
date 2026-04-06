import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@/lib/supabase/server'
import { devisUpdateSchema } from '@/lib/devis/schemas'
import { getDevis, updateDevis, deleteDevis } from '@/lib/devis/service'

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: Params) {
  const supabase = await createSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { id } = await params
  try {
    const devis = await getDevis(id)
    if (!devis) return NextResponse.json({ error: 'Devis introuvable' }, { status: 404 })
    return NextResponse.json(devis)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur serveur'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const supabase = await createSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { id } = await params
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 })
  }

  const parsed = devisUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten() }, { status: 422 })
  }

  try {
    const devis = await updateDevis(id, parsed.data)
    return NextResponse.json(devis)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur serveur'
    const status = message.includes('brouillon') ? 409 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const supabase = await createSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { id } = await params
  try {
    await deleteDevis(id)
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur serveur'
    const status = message.includes('brouillon') ? 409 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
