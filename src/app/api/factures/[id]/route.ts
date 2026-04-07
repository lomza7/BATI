import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFacture, updateFacture, deleteFacture } from '@/lib/factures/service'
import { factureUpdateSchema } from '@/lib/factures/schemas'

interface Params { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  try {
    const facture = await getFacture(params.id)
    if (!facture) return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 })
    return NextResponse.json(facture)
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  let body: unknown
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 }) }

  const parsed = factureUpdateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  try {
    const facture = await updateFacture(params.id, parsed.data)
    return NextResponse.json(facture)
  } catch (err) {
    const message = (err as Error).message
    const status = message.includes('brouillon') ? 409 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  try {
    await deleteFacture(params.id)
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    const message = (err as Error).message
    const status = message.includes('brouillon') ? 409 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
