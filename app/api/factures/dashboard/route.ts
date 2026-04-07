import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getDashboard } from '@/lib/invoices/service'

export async function GET() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  try {
    const dashboard = await getDashboard()
    return NextResponse.json(dashboard)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur serveur' }, { status: 500 })
  }
}
