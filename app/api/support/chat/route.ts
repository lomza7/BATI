import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkAiLimit, trackAiUsage } from '@/lib/ai-usage';
import { callOpenAI, OpenAIError, DEFAULT_OPENAI_MODEL, type AnthropicMessage } from '@/lib/ai/openai';

export const runtime = 'nodejs';

const SYSTEM_PROMPT = `Tu es l'assistant support de Hellobat, un SaaS tout-en-un pour les artisans du batiment en France. Tu reponds toujours en francais, de maniere chaleureuse, claire et concise.

A propos de Hellobat :
- Gestion complete : tableau de bord, calendrier, taches, contacts (clients, prospects, prestataires)
- Devis et factures avec assistant IA voix et photo, signature electronique DocuSeal, envoi par email
- Bibliotheque de prestations reutilisables
- Chantiers avec geolocalisation, photos, planning equipe (drag and drop), vue carte interactive
- Equipe et sous-traitants avec planning partage
- Catalogues produits partages aux clients via lien magique
- Prospection / CRM pipeline avec leads et stages personnalisables
- Generateur de site web vitrine par IA
- Assistant email IA (paste-based) : l'utilisateur colle un email recu, l'IA redige une reponse en tenant compte du contexte client (devis, factures, chantiers)
- Avis clients : import des avis Google via lien Maps, lien public pour recueillir de nouveaux avis, demande par email en masse
- Avant/Apres IA : transforme une photo de piece ou de facade en projection apres travaux
- 5 agents IA experts : pannes, DTU, chiffrage, juridique, RGE/CEE
- Paiements Stripe, contrats recurrents
- Comptabilite IA avec OCR Maurice (recus, factures fournisseurs) et reconciliation bancaire
- Sites artisans publies avec ISR
- Lien de parrainage : 2 mois offerts pour le parrain et le filleul
- Plans Stripe : Starter, Pro, Business

Ton role :
1. Repondre aux questions des artisans sur l'utilisation d'Hellobat
2. Les guider pas a pas pour realiser une action (creer un devis, ajouter un chantier, etc.)
3. Si l'utilisateur signale un bug, demande-lui les details (page concernee, ce qu'il faisait, message d'erreur eventuel) et termine ta reponse en lui confirmant que sa remontee a bien ete enregistree et sera transmise a l'equipe.
4. Si l'utilisateur demande une nouvelle fonctionnalite, remercie-le, demande-lui de preciser le besoin metier, et confirme que sa suggestion est transmise a l'equipe produit.
5. Pour les questions de facturation Stripe ou d'abonnement, oriente vers la page Parametres > Abonnement.
6. Reste toujours bienveillant et pratique. N'invente jamais de fonctionnalite qui n'existe pas dans la liste ci-dessus.
7. Reponses courtes (3 a 6 phrases maximum sauf si l'utilisateur demande un guide pas a pas).`;

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OPENAI_API_KEY manquante' }, { status: 503 });
  }

  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });
  }
  const token = authHeader.replace('Bearer ', '').trim();

  const userClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user }, error: authError } = await userClient.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });
  }

  const limitCheck = await checkAiLimit(user.id);
  if (!limitCheck.allowed) {
    return NextResponse.json({ error: limitCheck.reason }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.message || typeof body.message !== 'string') {
    return NextResponse.json({ error: 'message requis' }, { status: 400 });
  }

  const history: ChatMessage[] = Array.isArray(body.history) ? body.history.slice(-20) : [];
  const messages: AnthropicMessage[] = [
    ...history.map(m => ({ role: m.role, content: m.content })),
    { role: 'user' as const, content: body.message },
  ];

  try {
    const data = await callOpenAI({
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages,
    });
    const reply = data.content?.[0]?.text || '';

    await trackAiUsage({
      user_id: user.id,
      route: 'support/chat',
      model: process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL,
      input_tokens: data.usage?.input_tokens || 0,
      output_tokens: data.usage?.output_tokens || 0,
    });

    return NextResponse.json({ response: reply });
  } catch (error) {
    if (error instanceof OpenAIError) {
      return NextResponse.json({ error: `Erreur API IA: ${error.body}` }, { status: 502 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur generation IA' },
      { status: 500 },
    );
  }
}
