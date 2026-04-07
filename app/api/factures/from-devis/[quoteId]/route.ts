import { type NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { createInvoiceFromQuote } from '@/lib/invoices/service'

type Params = { params: Promise<{ quoteId: string }> }

export async function POST(_request: NextRequest, { params }: Params) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { quoteId } = await params
  try {
    const invoice = await createInvoiceFromQuote(quoteId)
    return NextResponse.json(invoice, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur serveur' }, { status: 500 })
  }
}
