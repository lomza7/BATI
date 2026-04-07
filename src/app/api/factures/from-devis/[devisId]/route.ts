import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createFactureFromDevis } from '@/lib/factures/service'

interface Params { params: { devisId: string } }

export async function POST(_req: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  try {
    const facture = await createFactureFromDevis(params.devisId)
    return NextResponse.json(facture, { status: 201 })
  } catch (err) {
    const message = (err as Error).message
    const status = message.includes('accepté') ? 409 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
