import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FileText, Receipt, Users, TrendingUp } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Tableau de bord',
}

const stats = [
  {
    label: 'Devis en cours',
    value: '—',
    description: 'Sprint 2',
    icon: FileText,
  },
  {
    label: 'Factures impayées',
    value: '—',
    description: 'Sprint 3',
    icon: Receipt,
  },
  {
    label: 'Clients actifs',
    value: '—',
    description: 'Sprint 2',
    icon: Users,
  },
  {
    label: "Chiffre d'affaires",
    value: '—',
    description: 'Sprint 4',
    icon: TrendingUp,
  },
]

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const displayName =
    (user?.user_metadata?.['full_name'] as string | undefined) ?? user?.email ?? 'Artisan'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Bonjour, {displayName.split(' ')[0]} 👋</h1>
        <p className="text-muted-foreground">Voici un aperçu de votre activité.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.label}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{stat.label}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <CardDescription>Disponible en {stat.description}</CardDescription>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sprint 1 — Fondations</CardTitle>
          <CardDescription>
            Le projet Hellobat est en cours de construction. Les fonctionnalités seront disponibles
            progressivement.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <span className="text-green-500">✓</span> Authentification Supabase
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-500">✓</span> Layout dashboard
            </li>
            <li className="flex items-center gap-2">
              <span className="text-muted-foreground/40">○</span> Devis (Sprint 2)
            </li>
            <li className="flex items-center gap-2">
              <span className="text-muted-foreground/40">○</span> Facturation (Sprint 3)
            </li>
            <li className="flex items-center gap-2">
              <span className="text-muted-foreground/40">○</span> Paiements Stripe (Sprint 4)
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
