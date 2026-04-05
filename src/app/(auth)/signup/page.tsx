import type { Metadata } from 'next'
import Link from 'next/link'
import { SignupForm } from '@/components/features/auth/signup-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const metadata: Metadata = {
  title: 'Créer un compte',
}

export default function SignupPage() {
  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mb-2 flex justify-center">
          <span className="text-2xl font-bold text-primary">Hellobat</span>
        </div>
        <CardTitle className="text-xl">Créer un compte</CardTitle>
        <CardDescription>Démarrez votre essai gratuit dès aujourd&apos;hui</CardDescription>
      </CardHeader>
      <CardContent>
        <SignupForm />
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Déjà un compte ?{' '}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Se connecter
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
