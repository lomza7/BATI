import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = 'claude-sonnet-4-20250514';

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY manquante' }, { status: 503 });
  }

  // Auth
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });
  }
  const token = authHeader.replace('Bearer ', '').trim();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const sb = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: authError } = await sb.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.emailBody || !body?.emailFrom || !body?.emailSubject) {
    return NextResponse.json({ error: 'emailBody, emailFrom et emailSubject requis' }, { status: 400 });
  }

  const { emailBody, emailFrom, emailSubject, emailTo, tone } = body as {
    emailBody: string;
    emailFrom: string;
    emailSubject: string;
    emailTo?: string;
    tone?: string;
  };

  // ─── Gather context ───────────────────────────────────────────────

  const sbAdmin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // Extract email address from "Name <email>" format
  const emailMatch = emailFrom.match(/<([^>]+)>/) || [null, emailFrom.split(' ')[0]];
  const senderEmail = (emailMatch[1] || '').trim().toLowerCase();

  let clientContext = '';

  if (senderEmail) {
    // Find client by email
    const { data: client } = await sbAdmin
      .from('clients')
      .select('id, name, email, phone, address, city, postal_code, company, contact_type, notes')
      .ilike('email', senderEmail)
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .maybeSingle();

    if (client) {
      clientContext += `\n## Client trouve : ${client.name}\n`;
      clientContext += `- Type : ${client.contact_type || 'client'}\n`;
      if (client.company) clientContext += `- Entreprise : ${client.company}\n`;
      if (client.phone) clientContext += `- Telephone : ${client.phone}\n`;
      if (client.address) clientContext += `- Adresse : ${client.address} ${client.postal_code || ''} ${client.city || ''}\n`;
      if (client.notes) clientContext += `- Notes : ${client.notes}\n`;

      // Fetch related quotes
      const { data: quotes } = await sbAdmin
        .from('quotes')
        .select('quote_number, title, status, total_ttc, created_at')
        .eq('client_id', client.id)
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(5);

      if (quotes?.length) {
        clientContext += `\n### Devis recents :\n`;
        for (const q of quotes) {
          clientContext += `- ${q.quote_number} : ${q.title} — ${q.status} — ${q.total_ttc}€ TTC (${new Date(q.created_at).toLocaleDateString('fr-FR')})\n`;
        }
      }

      // Fetch related invoices
      const { data: invoices } = await sbAdmin
        .from('invoices')
        .select('invoice_number, title, status, total_ttc, created_at')
        .eq('client_id', client.id)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (invoices?.length) {
        clientContext += `\n### Factures recentes :\n`;
        for (const inv of invoices) {
          clientContext += `- ${inv.invoice_number} : ${inv.title} — ${inv.status} — ${inv.total_ttc}€ TTC (${new Date(inv.created_at).toLocaleDateString('fr-FR')})\n`;
        }
      }

      // Fetch related projects
      const { data: projects } = await sbAdmin
        .from('projects')
        .select('name, status, budget, start_date, end_date, description')
        .eq('client_id', client.id)
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(5);

      if (projects?.length) {
        clientContext += `\n### Chantiers :\n`;
        for (const p of projects) {
          clientContext += `- ${p.name} — ${p.status} — budget ${p.budget}€`;
          if (p.start_date) clientContext += ` — debut ${new Date(p.start_date).toLocaleDateString('fr-FR')}`;
          clientContext += `\n`;
          if (p.description) clientContext += `  ${p.description.slice(0, 200)}\n`;
        }
      }
    }
  }

  // Get user's company profile for signature
  const { data: profile } = await sbAdmin
    .from('profiles')
    .select('full_name, company_name, company_activity')
    .eq('id', user.id)
    .maybeSingle();

  const userName = profile?.full_name || user.email?.split('@')[0] || '';
  const companyName = profile?.company_name || '';
  const companyActivity = profile?.company_activity || '';

  // ─── Build prompt ─────────────────────────────────────────────────

  const toneInstructions = tone === 'formal'
    ? 'Utilise un ton tres formel et professionnel.'
    : tone === 'friendly'
      ? 'Utilise un ton amical et chaleureux tout en restant professionnel.'
      : 'Utilise un ton professionnel mais accessible, comme un artisan qui connait bien son metier.';

  const systemPrompt = `Tu es l'assistant email de ${userName}${companyName ? `, gerant de ${companyName}` : ''}${companyActivity ? ` (${companyActivity})` : ''}.
Tu rediges des reponses email en francais pour un artisan du batiment.

Regles :
- Reponds de maniere naturelle et professionnelle
- ${toneInstructions}
- Sois concis et direct
- Si le contexte client est fourni, utilise-le pour personnaliser la reponse (reference aux devis, chantiers, etc.)
- Ne mens pas et n'invente pas d'informations — si tu ne sais pas, dis-le poliment
- Termine par une formule de politesse appropriee
- Signe avec : ${userName}${companyName ? `\n${companyName}` : ''}
- Ne mets pas de sujet, uniquement le corps du mail
- Reponds directement avec le texte du mail, sans explication`;

  const userMessage = `Email recu :
De : ${emailFrom}
Objet : ${emailSubject}
---
${emailBody.slice(0, 3000)}
---
${clientContext ? `\nContexte sur ce contact dans notre base :\n${clientContext}` : '\nAucun historique trouve pour ce contact dans notre base.'}

Redige une reponse appropriee a cet email.`;

  // ─── Call Claude ──────────────────────────────────────────────────

  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json({ error: `Erreur API IA: ${err}` }, { status: 502 });
    }

    const data = await response.json() as { content: { type: string; text: string }[] };
    const reply = data.content?.[0]?.text || '';

    return NextResponse.json({
      reply,
      clientFound: !!clientContext,
      senderEmail,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur generation IA' },
      { status: 500 },
    );
  }
}
