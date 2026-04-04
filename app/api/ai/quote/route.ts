import { NextResponse } from 'next/server';
import { aiQuoteAnalysisSchema } from '@/lib/ai/quote-schema';

export const runtime = 'nodejs';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = 'claude-sonnet-4-20250514';

function extractJsonFromText(content: string) {
  const fenced = content.match(/```json\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');

  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Aucune reponse JSON exploitable n a ete trouvee.');
  }

  return content.slice(start, end + 1);
}

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY est absente dans l'environnement du serveur." },
      { status: 503 }
    );
  }

  try {
    const formData = await request.formData();
    const transcript = String(formData.get('transcript') || '').trim();
    const servicesCatalog = String(formData.get('services_catalog') || '').trim();
    const photoEntries = formData.getAll('photos').filter((value): value is File => value instanceof File);

    if (!transcript) {
      return NextResponse.json({ error: 'La transcription vocale est vide.' }, { status: 400 });
    }

    const imageBlocks = await Promise.all(
      photoEntries.map(async (photo) => {
        const arrayBuffer = await photo.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');

        return {
          type: 'image',
          source: {
            type: 'base64',
            media_type: photo.type || 'image/jpeg',
            data: base64,
          },
        };
      })
    );

    const prompt = [
      'Tu aides un artisan francais du BTP a preparer un brouillon de devis.',
      'Analyse la transcription vocale et les photos du chantier.',
      'Retourne uniquement un JSON valide, sans markdown, sans commentaire, sans texte avant ou apres.',
      'Le JSON doit respecter exactement cette forme:',
      JSON.stringify(
        {
          title: 'string',
          clientName: 'string',
          description: 'string',
          confidence: 85,
          summary: 'string',
          assumptions: ['string'],
          lines: [
            {
              description: 'string',
              quantity: 1,
              unit: 'forfait',
              unit_price: 0,
            },
          ],
        },
        null,
        2
      ),
      'Consignes:',
      '- Reponds en francais.',
      '- Le titre doit etre court et exploitable pour un devis.',
      '- clientName peut etre vide si aucun nom n est identifiable.',
      "- description doit resumer le besoin et indiquer qu'il s'agit d'un brouillon IA a valider.",
      '- confidence doit etre un entier de 0 a 100.',
      '- assumptions doit contenir seulement des hypotheses utiles.',
      '- lines doit contenir des lignes concretes de devis avec quantites et prix unitaires plausibles.',
      '- Si un prix est incertain, propose une estimation raisonnable pour un brouillon.',
      ...(servicesCatalog ? [
        '',
        'IMPORTANT: L\'artisan a une bibliotheque de prestations avec ses propres prix et descriptions.',
        'Utilise EN PRIORITE les prestations de ce catalogue pour les lignes du devis.',
        'Reprends exactement les noms, descriptions, unites et prix unitaires du catalogue.',
        'Ne modifie les prix que si la transcription mentionne explicitement un tarif different.',
        `Catalogue de prestations de l'artisan: ${servicesCatalog}`,
      ] : []),
      '',
      `Transcription: ${transcript}`,
      `Nombre de photos: ${photoEntries.length}`,
    ].join('\n');

    const anthropicResponse = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
        max_tokens: 2000,
        temperature: 0.2,
        messages: [
          {
            role: 'user',
            content: [
              ...imageBlocks,
              {
                type: 'text',
                text: prompt,
              },
            ],
          },
        ],
      }),
    });

    if (!anthropicResponse.ok) {
      const errorText = await anthropicResponse.text();
      return NextResponse.json(
        { error: `Anthropic a renvoye une erreur: ${errorText.slice(0, 400)}` },
        { status: anthropicResponse.status }
      );
    }

    const responseJson = (await anthropicResponse.json()) as {
      content?: Array<{ type?: string; text?: string }>;
    };

    const textContent = responseJson.content
      ?.filter((block) => block.type === 'text' && block.text)
      .map((block) => block.text)
      .join('\n')
      .trim();

    if (!textContent) {
      return NextResponse.json({ error: "La reponse d'Anthropic est vide." }, { status: 502 });
    }

    const parsed = aiQuoteAnalysisSchema.parse(JSON.parse(extractJsonFromText(textContent)));

    return NextResponse.json({ analysis: parsed });
  } catch (error) {
    const message = error instanceof Error ? error.message : "L'analyse IA a echoue.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
