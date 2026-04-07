import { type NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { invoiceCreateSchema, invoiceListQuerySchema } from '@/lib/invoices/schemas'
import { listInvoices, createInvoice } from '@/lib/invoices/service'

export async function GET(request: NextRequest) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { searchParams } = request.nextUrl
  const parsed = invoiceListQuerySchema.safeParse(Object.fromEntries(searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Paramètres invalides', details: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const result = await listInvoices(parsed.data)
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const parsed = invoiceCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const invoice = await createInvoice(parsed.data)
    return NextResponse.json(invoice, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur serveur' }, { status: 500 })
  }
}
