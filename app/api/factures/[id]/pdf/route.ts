import { type NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getInvoice } from '@/lib/invoices/service'
import { generateFacturePdf } from '@/lib/pdf/facture-pdf'

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: Params) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { id } = await params

  try {
    const invoice = await getInvoice(id)
    if (!invoice) return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile } = await (supabase as any)
      .from('profiles')
      .select('full_name,company_name,siret,address,city,postal_code,phone,email,tva_number,is_auto_entrepreneur')
      .eq('id', user.id)
      .single()

    if (!profile) return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 })

    const pdfBytes = await generateFacturePdf(invoice, profile)
    const filename = `${invoice.invoice_number}.pdf`

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(pdfBytes.length),
      },
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur serveur' }, { status: 500 })
  }
}
