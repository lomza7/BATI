import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient as createSupabaseClient } from '@/lib/supabase/server'
import { sendDevis, getDevis } from '@/lib/devis/service'

type Params = { params: Promise<{ id: string }> }

const sendSchema = z.object({
  email: z.string().email('Email invalide'),
})

export async function POST(request: NextRequest, { params }: Params) {
  const supabase = await createSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { id } = await params
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 })
  }

  const parsed = sendSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Email invalide', details: parsed.error.flatten() }, { status: 422 })
  }

  try {
    await sendDevis(id, parsed.data.email)

    // Optionnel : envoyer l'email via Resend si RESEND_API_KEY configurée
    if (process.env.RESEND_API_KEY) {
      const devis = await getDevis(id)
      const { Resend } = await import('resend')
      const resend = new Resend(process.env.RESEND_API_KEY)
      await resend.emails.send({
        from: process.env.EMAIL_FROM ?? 'noreply@hellobat.app',
        to: parsed.data.email,
        subject: `Devis ${devis?.reference ?? id} — ${devis?.title ?? ''}`,
        html: `
          <p>Bonjour,</p>
          <p>Veuillez trouver ci-joint votre devis <strong>${devis?.reference}</strong>.</p>
          <p>Ce devis est valable jusqu'au ${devis?.valid_until ? new Intl.DateTimeFormat('fr-FR').format(new Date(devis.valid_until)) : '—'}.</p>
          <p>Pour l'accepter, répondez à cet email avec la mention "Bon pour accord".</p>
          <p>Cordialement</p>
        `,
      })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur serveur'
    const status = message.includes('SIRET') ? 422 : message.includes('déjà été envoyé') ? 409 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
