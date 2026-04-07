import { type NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@/lib/supabase/server'
import { validateSiret } from '@/lib/siret'

interface SireneEstablishment {
  siret: string
  siren: string
  denominationUniteLegale: string | null
  nomUsageUniteLegale: string | null
  prenom1UniteLegale: string | null
  nomUniteLegale: string | null
  adresseEtablissement: {
    numeroVoieEtablissement: string | null
    typeVoieEtablissement: string | null
    libelleVoieEtablissement: string | null
    codePostalEtablissement: string | null
    libelleCommuneEtablissement: string | null
  }
}

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const siret = request.nextUrl.searchParams.get('siret')

  if (!siret) {
    return NextResponse.json({ error: 'Paramètre siret manquant' }, { status: 400 })
  }

  const cleaned = siret.replace(/\s/g, '')

  if (!validateSiret(cleaned)) {
    return NextResponse.json({ error: 'SIRET invalide (format ou checksum)' }, { status: 422 })
  }

  try {
    const response = await fetch(
      `https://api.insee.fr/entreprises/sirene/V3.11/siret/${cleaned}`,
      {
        headers: {
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(5000),
      }
    )

    if (!response.ok) {
      // Graceful fallback: return partial data with just the SIRET
      if (response.status === 404) {
        return NextResponse.json({ siret: cleaned, found: false })
      }
      // Rate limit or other error → graceful degradation
      return NextResponse.json({ siret: cleaned, found: false, error: 'Service indisponible' })
    }

    const data = (await response.json()) as { etablissement: SireneEstablishment }
    const etab = data.etablissement
    const addr = etab.adresseEtablissement

    const companyName =
      etab.denominationUniteLegale ??
      (etab.prenom1UniteLegale && etab.nomUniteLegale
        ? `${etab.prenom1UniteLegale} ${etab.nomUniteLegale}`
        : null)

    const streetParts = [
      addr.numeroVoieEtablissement,
      addr.typeVoieEtablissement,
      addr.libelleVoieEtablissement,
    ].filter(Boolean)

    return NextResponse.json({
      siret: cleaned,
      found: true,
      company_name: companyName,
      address: streetParts.join(' ') || null,
      postal_code: addr.codePostalEtablissement,
      city: addr.libelleCommuneEtablissement,
    })
  } catch {
    // Network timeout or parse error → graceful degradation
    return NextResponse.json({ siret: cleaned, found: false, error: 'Service temporairement indisponible' })
  }
}
