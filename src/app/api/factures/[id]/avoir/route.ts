import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAvoir } from '@/lib/factures/service'

interface Params { params: { id: string } }

export async function POST(_req: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  try {
    const avoir = await createAvoir(params.id)
    return NextResponse.json(avoir, { status: 201 })
  } catch (err) {
    const message = (err as Error).message
    const status = message.includes('émise') || message.includes('payée') ? 409 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
