import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getFacture } from '@/lib/factures/service'
import { SituationEditor } from '@/components/features/factures/situation-editor'

interface Props { params: { id: string } }

export const metadata = { title: 'Situation de travaux — Hellobat' }

export default async function SituationPage({ params }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return notFound()

  const facture = await getFacture(params.id)
  if (!facture) return notFound()

  // Récupérer les cumuls précédents par lot
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabaseAny = supabase as any
  const { data: previousSituations } = await supabaseAny
    .from('facture_situations')
    .select('lot_id, avancement_percent')
    .eq('facture_mere_id', params.id)

  const cumulsPrecedents: Record<string, number> = {}
  for (const s of previousSituations ?? []) {
    cumulsPrecedents[s.lot_id] = (cumulsPrecedents[s.lot_id] ?? 0) + s.avancement_percent
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <Link href={`/dashboard/factures/${params.id}`} className="mb-4 inline-flex items-center text-sm text-gray-500">
        ← Retour à la facture
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Situation de travaux</h1>
        <p className="mt-1 text-gray-500">{facture.reference} — {facture.title}</p>
      </div>

      {facture.lots.length === 0 ? (
        <p className="rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-700">
          La facture mère ne contient aucun lot. Ajoutez des lots pour créer une situation.
        </p>
      ) : (
        <SituationEditor
          factureId={params.id}
          lots={facture.lots}
          cumulsPrecedents={cumulsPrecedents}
        />
      )}
    </div>
  )
}
