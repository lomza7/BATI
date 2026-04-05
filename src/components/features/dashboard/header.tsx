'use client'

import { useRouter } from 'next/navigation'
import { LogOut, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import type { User as SupabaseUser } from '@supabase/supabase-js'

interface HeaderProps {
  user: SupabaseUser
}

export function Header({ user }: HeaderProps) {
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const displayName = (user.user_metadata?.['full_name'] as string | undefined) ?? user.email ?? 'Artisan'

  return (
    <header className="flex h-16 items-center justify-between border-b bg-background px-6">
      <div className="flex items-center gap-2">
        <User className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">{displayName}</span>
      </div>
      <Button variant="ghost" size="sm" onClick={handleSignOut} className="gap-2">
        <LogOut className="h-4 w-4" />
        Déconnexion
      </Button>
    </header>
  )
}
