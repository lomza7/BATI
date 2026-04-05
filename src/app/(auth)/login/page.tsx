import type { Metadata } from 'next'
import Link from 'next/link'
import { LoginForm } from '@/components/features/auth/login-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const metadata: Metadata = {
  title: 'Connexion',
}

export default function LoginPage() {
  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mb-2 flex justify-center">
          <span className="text-2xl font-bold text-primary">Hellobat</span>
        </div>
        <CardTitle className="text-xl">Bienvenue</CardTitle>
        <CardDescription>Connectez-vous à votre espace artisan</CardDescription>
      </CardHeader>
      <CardContent>
        <LoginForm />
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Pas encore de compte ?{' '}
          <Link href="/signup" className="font-medium text-primary hover:underline">
            S&apos;inscrire
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
