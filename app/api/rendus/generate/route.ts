import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateImage } from '@/lib/ai/image-generation';

export const runtime = 'nodejs';
export const maxDuration = 120;

const STYLE_PROMPTS: Record<string, string> = {
  moderne: 'style moderne, lignes épurées, mobilier design contemporain, matériaux nobles (béton ciré, métal noir, verre), palette neutre sophistiquée',
  classique: 'style classique élégant, moulures, parquet en chevrons, mobilier traditionnel raffiné, tissus nobles, palette chaleureuse',
  industriel: 'style industriel, mur en brique apparente, poutres métalliques, béton brut, mobilier en métal et bois récupéré, ampoules Edison',
  scandinave: 'style scandinave, bois clair (chêne, bouleau), murs blancs, mobilier minimaliste, textiles naturels, lumière douce',
  mediterraneen: 'style méditerranéen, murs en pierre ou enduit chaulé, sol en terre cuite, mobilier en bois patiné, textiles écrus, ambiance chaleureuse ensoleillée',
  zen: 'style japandi/zen, bois naturel clair, lignes épurées, mobilier bas, plantes, tatamis, palette terreuse, atmosphère sereine et minimaliste',
};

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }
  const token = authHeader.replace('Bearer ', '').trim();

  const userClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user }, error: authError } = await userClient.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const incoming = await request.formData();
  const image = incoming.get('image');
  const style = String(incoming.get('style') || '').trim();
  const roomType = String(incoming.get('roomType') || '').trim();
  const context = String(incoming.get('context') || '').trim().slice(0, 500);

  if (!(image instanceof File)) {
    return NextResponse.json({ error: 'Photo manquante' }, { status: 400 });
  }
  if (!style || !STYLE_PROMPTS[style]) {
    return NextResponse.json({ error: 'Style invalide' }, { status: 400 });
  }
  if (image.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'Photo trop lourde (max 10 MB)' }, { status: 400 });
  }

  const room = roomType || 'pièce';
  const contextLine = context
    ? `\n\nDEMANDES SPÉCIFIQUES DE L'UTILISATEUR (à respecter en priorité absolue) : ${context}`
    : '';
  const prompt = `Tâche : édition photo intérieure réaliste — redécore cette ${room.toLowerCase()} en ${STYLE_PROMPTS[style]}.

CONTRAINTES NON NÉGOCIABLES (la sortie sera rejetée si elles ne sont pas respectées) :
- CONSERVER À L'IDENTIQUE l'architecture de la pièce : position, taille et proportions exactes des murs, du plafond, du sol, des fenêtres, des portes, des radiateurs, des prises, des interrupteurs, des poutres et de tout élément structurel.
- CONSERVER À L'IDENTIQUE le cadrage, l'angle de la caméra, la focale et la perspective de la photo source. Aucun zoom, aucune rotation, aucun changement de point de vue.
- CONSERVER À L'IDENTIQUE les dimensions de la pièce : ne pas l'agrandir, ne pas la rétrécir, ne pas modifier la hauteur sous plafond.
- CONSERVER À L'IDENTIQUE la lumière naturelle (direction et intensité depuis les fenêtres existantes) et les ombres cohérentes.

CE QUE TU PEUX MODIFIER : revêtements (peinture des murs, sol, plafond), mobilier, textiles, luminaires décoratifs, plantes, objets de décoration, palette de couleurs.

Rendu : photoréaliste niveau photo professionnelle d'architecture intérieure, grain photo naturel, sans artefact IA, sans déformation des lignes droites.${contextLine}`;

  const buffer = Buffer.from(await image.arrayBuffer());
  const sourceImageBase64 = buffer.toString('base64');
  const sourceImageMime = image.type || 'image/png';

  try {
    const result = await generateImage({
      prompt,
      sourceImageBase64,
      sourceImageMime,
      size: 'auto',
      quality: 'high',
      inputFidelity: 'high',
    });
    return NextResponse.json({
      image: `data:${result.mimeType};base64,${result.imageBase64}`,
      provider: result.provider,
      model: result.model,
    });
  } catch (err: any) {
    console.error('Rendu generation failed:', err);
    return NextResponse.json(
      { error: err?.message || 'La génération a échoué' },
      { status: 502 },
    );
  }
}
