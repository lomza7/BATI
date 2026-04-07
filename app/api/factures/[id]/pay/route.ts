import { type NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { paySchema } from '@/lib/invoices/schemas'
import { payInvoice } from '@/lib/invoices/service'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const parsed = paySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten() }, { status: 400 })
  }

  try {
    await payInvoice(id, parsed.data)
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur serveur' }, { status: 500 })
  }
}
