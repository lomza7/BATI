import { type NextRequest, NextResponse } from 'next/server'
import { validateSiret } from '@/lib/siret'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const siret = searchParams.get('siret')?.replace(/\s/g, '')

  if (!siret) {
    return NextResponse.json({ error: 'Paramètre siret requis' }, { status: 400 })
  }

  const valid = validateSiret(siret)

  if (!valid) {
    return NextResponse.json({ valid: false, error: 'SIRET invalide (Luhn check failed)' })
  }

  // Optionally enrich with Pappers if API key is available
  const apiKey = process.env.PAPPERS_API_KEY
  if (apiKey) {
    try {
      const siren = siret.slice(0, 9)
      const res = await fetch(
        `https://api.pappers.fr/v2/entreprise?api_token=${apiKey}&siren=${siren}`,
        { cache: 'no-store' }
      )
      if (res.ok) {
        const data = await res.json()
        return NextResponse.json({
          valid: true,
          company: {
            name: data.nom_entreprise ?? data.denomination ?? '',
            address: data.siege?.adresse_ligne_1 ?? '',
            city: data.siege?.ville ?? '',
            postal_code: data.siege?.code_postal ?? '',
            naf_code: data.code_naf ?? '',
            legal_form: data.forme_juridique ?? '',
          },
        })
      }
    } catch {
      // Pappers unavailable — return valid without enrichment
    }
  }

  return NextResponse.json({ valid: true })
}
