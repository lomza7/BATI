import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { apiError } from '@/lib/api-errors';
import { consumeAi } from '@/lib/credits';
import { callOpenAI, OpenAIError } from '@/lib/ai/openai';
import {
  claimedTtc,
  fetchCreditNotesByInvoice,
  fetchDepositsNetTtc,
  isCreditNote,
  isIssuedCreditNote,
  netDueTtc,
  sumCreditNotesTtc,
} from '@/lib/invoices/credit-notes';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OPENAI_API_KEY manquante' }, { status: 503 });
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

  // Burst protection (sliding window) — per-user
  const rl = checkRateLimit(`ai-email-reply:${user.id}`, 20, 60_000);
  if (!rl.ok) return rateLimitResponse(rl);

  const gate = await consumeAi(user.id, 'email_ai');
  if (!gate.ok) {
    if (gate.reason === 'no_pro_access') {
      return NextResponse.json({ error: 'Abonnement Pro requis pour l\u2019IA.' }, { status: 403 });
    }
    return NextResponse.json(
      { error: 'Cr\u00e9dits IA insuffisants.', balance: gate.balance, required: gate.required },
      { status: 402 },
    );
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

      // Fetch related invoices.
      //
      // `invoice_type` est indispensable : un avoir remonte ici comme une
      // ligne de `invoices` avec un montant negatif. Sans le type, le modele
      // le lit comme une facture ordinaire et ecrit au client des phrases du
      // genre « votre facture payee de -1200 € » — ou pire, lui reclame le
      // montant d'un avoir qui est a son credit.
      const { data: invoices } = await sbAdmin
        .from('invoices')
        .select('id, invoice_number, title, status, total_ttc, created_at, invoice_type, quote_id, credited_invoice_id')
        .eq('client_id', client.id)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (invoices?.length) {
        // Numeros des factures rectifiees : elles ne sont pas forcement dans
        // les 5 dernieres lignes, on va chercher celles qui manquent.
        const knownNumbers = new Map<string, string>();
        for (const inv of invoices) {
          if (inv.id && inv.invoice_number) knownNumbers.set(inv.id, inv.invoice_number);
        }
        const missingCreditedIds = invoices
          .map((inv) => inv.credited_invoice_id as string | null)
          .filter((id): id is string => !!id && !knownNumbers.has(id));

        if (missingCreditedIds.length) {
          const { data: credited } = await sbAdmin
            .from('invoices')
            .select('id, invoice_number')
            .eq('user_id', user.id)
            .in('id', Array.from(new Set(missingCreditedIds)));
          for (const row of credited || []) {
            if (row.id && row.invoice_number) knownNumbers.set(row.id, row.invoice_number);
          }
        }

        // Avoirs emis sur les factures listees, pour annoncer un reste du
        // juste plutot que le TTC brut d'une facture deja creditee.
        const invoiceIds = invoices
          .filter((inv) => !isCreditNote(inv))
          .map((inv) => inv.id as string)
          .filter(Boolean);
        const creditNotesByInvoice = await fetchCreditNotesByInvoice(sbAdmin, invoiceIds);

        // Une facture de SOLDE stocke le total BRUT du devis : ce qu'elle
        // reclame reellement au client, c'est ce total moins les acomptes deja
        // factures, eux-memes nets de leurs propres avoirs. Sans cette
        // deduction, le modele annonce au client des acomptes qu'il a deja
        // regles. Un seul aller-retour par devis distinct, aucun si le client
        // n'a pas de facture de solde.
        const soldeQuoteIds = Array.from(
          new Set(
            invoices
              .filter((inv) => !isCreditNote(inv) && inv.invoice_type === 'solde' && inv.quote_id)
              .map((inv) => inv.quote_id as string),
          ),
        );
        const depositsByQuote = new Map<string, number>();
        if (soldeQuoteIds.length) {
          const nets = await Promise.all(
            soldeQuoteIds.map((quoteId) => fetchDepositsNetTtc(sbAdmin, quoteId)),
          );
          soldeQuoteIds.forEach((quoteId, index) => depositsByQuote.set(quoteId, nets[index]));
        }

        clientContext += `\n### Factures recentes :\n`;
        for (const inv of invoices) {
          const date = new Date(inv.created_at).toLocaleDateString('fr-FR');

          if (isCreditNote(inv)) {
            const creditedNumber = inv.credited_invoice_id
              ? knownNumbers.get(inv.credited_invoice_id) || 'facture inconnue'
              : 'facture inconnue';
            // Un avoir en brouillon n'est pas emis : il ne deduit rien et le
            // client n'en a jamais entendu parler. Ne jamais le citer comme un
            // document existant.
            if (!isIssuedCreditNote(inv)) {
              clientContext += `- Avoir ${inv.invoice_number} rattache a la facture ${creditedNumber} : BROUILLON non emis — ne rien en dire au client, il ne deduit rien\n`;
              continue;
            }
            clientContext += `- Avoir ${inv.invoice_number} rattache a la facture ${creditedNumber} : ${inv.title} — ${inv.status} — ${inv.total_ttc}€ TTC (${date}) — montant a DEDUIRE, jamais a reclamer au client\n`;
            continue;
          }

          // Seuls les avoirs emis comptent, comme dans `sumCreditNotesTtc` et
          // `netDueTtc` : sans ce filtre on annoncerait un avoir de 0 € ou le
          // numero d'un document jamais envoye.
          const notes = (creditNotesByInvoice.get(inv.id as string) || []).filter(isIssuedCreditNote);

          // Ordre canonique : d'abord ce que la facture reclame vraiment
          // (acomptes deduits pour un solde), puis les avoirs emis dessus.
          const depositsTtc =
            inv.invoice_type === 'solde' && inv.quote_id
              ? depositsByQuote.get(inv.quote_id as string) || 0
              : 0;
          const claimed = claimedTtc(inv, depositsTtc);

          clientContext += `- ${inv.invoice_number} : ${inv.title} — ${inv.status} — ${claimed}€ TTC (${date})`;
          if (depositsTtc > 0) {
            clientContext += ` [facture de solde : total du devis ${inv.total_ttc}€ moins ${depositsTtc}€ d'acomptes deja factures — ne jamais reclamer les acomptes une seconde fois]`;
          }
          if (notes.length) {
            const credited = Math.abs(sumCreditNotesTtc(notes));
            const numbers = notes.map((n) => n.invoice_number).filter(Boolean).join(', ');
            const prefix = notes.length > 1 ? 'les avoirs' : 'l\'avoir';
            clientContext += ` — ${credited}€ credites par ${prefix} ${numbers}, reste du ${netDueTtc({ total_ttc: claimed }, notes)}€ TTC`;
          }
          clientContext += `\n`;
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
- Les lignes commencant par "Avoir" (numeros AV-...) sont des AVOIRS : des factures rectificatives emises en faveur du client. Leur montant est negatif et vient EN DEDUCTION de la facture qu'elles rectifient.
- Un avoir ne se reclame JAMAIS au client : ce n'est pas une somme due, c'est une somme a son credit. Ne parle jamais d'un avoir comme d'une facture impayee, d'une facture payee ou d'un montant a regler.
- N'ecris jamais un montant negatif au client. Si tu dois citer un avoir, formule-le comme un montant deduit ou credite (exemple : "un avoir de 1 200 € a votre credit").
- Les montants "€ TTC" indiques pour chaque facture sont deja ceux reellement reclames au client (pour une facture de solde, les acomptes deja factures sont deduits). Ne recalcule rien, ne rajoute aucun acompte.
- Quand une facture porte un "reste du", c'est ce montant-la qu'il faut annoncer au client, jamais le total TTC brut deja credite.
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
    const data = await callOpenAI({
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });
    const reply = data.content?.[0]?.text || '';

    return NextResponse.json({
      reply,
      clientFound: !!clientContext,
      senderEmail,
    });
  } catch (error) {
    if (error instanceof OpenAIError) {
      return apiError('AI_FAILED', {
        cause: error.body,
        context: { route: 'ai/email-reply', user_id: user.id, status: error.status },
      });
    }
    return apiError('INTERNAL', {
      cause: error,
      context: { route: 'ai/email-reply', user_id: user.id },
    });
  }
}
