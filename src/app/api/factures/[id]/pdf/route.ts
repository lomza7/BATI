import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFacture } from '@/lib/factures/service'
import { generateFacturePdf } from '@/lib/pdf/facture-pdf'
import type { ArtisanProfile } from '@/lib/pdf/facture-pdf'

interface Params { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  try {
    const facture = await getFacture(params.id)
    if (!facture) return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any
    const { data: profile } = await supabaseAny
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (!profile) return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 })

    const artisanProfile: ArtisanProfile = {
      full_name: profile.full_name,
      company_name: profile.company_name,
      siret: profile.siret,
      tva_number: profile.tva_number ?? null,
      address: profile.address,
      city: profile.city,
      postal_code: profile.postal_code,
      phone: profile.phone,
      email: profile.email,
      insurance_decennale_number: profile.insurance_decennale_number ?? null,
      insurance_decennale_company: profile.insurance_decennale_company ?? null,
      rge_number: profile.rge_number ?? null,
      is_auto_entrepreneur: profile.is_auto_entrepreneur ?? false,
    }

    const pdfBytes = await generateFacturePdf(facture, artisanProfile)
    const filename = `${facture.reference}.pdf`

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(pdfBytes.length),
      },
    })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
