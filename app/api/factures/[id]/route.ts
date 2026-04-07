import { type NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { invoiceUpdateSchema } from '@/lib/invoices/schemas'
import { getInvoice, updateInvoice, deleteInvoice } from '@/lib/invoices/service'

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: Params) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { id } = await params
  try {
    const invoice = await getInvoice(id)
    if (!invoice) return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 })
    return NextResponse.json(invoice)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur serveur' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const parsed = invoiceUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const invoice = await updateInvoice(id, parsed.data)
    return NextResponse.json(invoice)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur serveur' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { id } = await params
  try {
    await deleteInvoice(id)
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur serveur' }, { status: 500 })
  }
}
