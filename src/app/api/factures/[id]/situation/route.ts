import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createSituation } from '@/lib/factures/service'
import { situationInputSchema } from '@/lib/factures/schemas'

interface Params { params: { id: string } }

export async function POST(request: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  let body: unknown
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 }) }

  const parsed = situationInputSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  try {
    const situation = await createSituation(params.id, parsed.data)
    return NextResponse.json(situation, { status: 201 })
  } catch (err) {
    const message = (err as Error).message
    const status = message.includes('100%') || message.includes('introuvable') ? 422 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
