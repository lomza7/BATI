// Server-side helper for AI image generation.
// Reads provider + API keys from `platform_secrets` (admin-managed via /admin)
// and dispatches to the active provider (OpenAI gpt-image-1 or Google Gemini).

import { createClient } from '@supabase/supabase-js';

export type ImageProvider = 'openai' | 'gemini';

export interface ImageGenerationConfig {
  provider: ImageProvider;
  openaiApiKey: string;
  openaiModel: string;
  geminiApiKey: string;
  geminiModel: string;
}

export interface ImageGenerationInput {
  prompt: string;
  // Base64-encoded source image (without data URL prefix). Optional — if missing,
  // we do pure text-to-image.
  sourceImageBase64?: string;
  sourceImageMime?: string; // e.g. 'image/jpeg'
  size?: '1024x1024' | '1024x1536' | '1536x1024' | 'auto';
}

export interface ImageGenerationResult {
  // Base64-encoded PNG (no data URL prefix)
  imageBase64: string;
  mimeType: string;
  provider: ImageProvider;
  model: string;
}

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function loadImageGenerationConfig(): Promise<ImageGenerationConfig> {
  const sb = getServiceClient();
  const { data } = await sb
    .from('platform_secrets')
    .select('key, value')
    .in('key', [
      'image_provider',
      'openai_api_key',
      'openai_image_model',
      'gemini_api_key',
      'gemini_image_model',
    ]);

  const map = new Map<string, string>();
  for (const row of data || []) map.set(row.key, row.value || '');

  const providerRaw = map.get('image_provider') || 'openai';
  const provider: ImageProvider = providerRaw === 'gemini' ? 'gemini' : 'openai';

  return {
    provider,
    openaiApiKey: map.get('openai_api_key') || '',
    openaiModel: map.get('openai_image_model') || 'gpt-image-1',
    geminiApiKey: map.get('gemini_api_key') || '',
    geminiModel: map.get('gemini_image_model') || 'gemini-2.5-flash-image',
  };
}

export async function generateImage(input: ImageGenerationInput): Promise<ImageGenerationResult> {
  const config = await loadImageGenerationConfig();

  if (config.provider === 'openai') {
    if (!config.openaiApiKey) {
      throw new Error('Cle API OpenAI manquante. Configure-la dans Administration.');
    }
    return generateWithOpenAI(input, config);
  }

  if (!config.geminiApiKey) {
    throw new Error('Cle API Gemini manquante. Configure-la dans Administration.');
  }
  return generateWithGemini(input, config);
}

// ---------- OpenAI gpt-image-1 ----------
async function generateWithOpenAI(
  input: ImageGenerationInput,
  config: ImageGenerationConfig
): Promise<ImageGenerationResult> {
  const size = input.size && input.size !== 'auto' ? input.size : '1024x1024';

  // If we have a source image, use the edits endpoint (image-to-image).
  // Otherwise use the generations endpoint.
  const url = input.sourceImageBase64
    ? 'https://api.openai.com/v1/images/edits'
    : 'https://api.openai.com/v1/images/generations';

  let response: Response;

  if (input.sourceImageBase64) {
    const form = new FormData();
    form.append('model', config.openaiModel);
    form.append('prompt', input.prompt);
    form.append('size', size);
    form.append('n', '1');

    const buffer = Buffer.from(input.sourceImageBase64, 'base64');
    const blob = new Blob([buffer], { type: input.sourceImageMime || 'image/png' });
    form.append('image', blob, 'source.png');

    response = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.openaiApiKey}` },
      body: form,
    });
  } else {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.openaiModel,
        prompt: input.prompt,
        size,
        n: 1,
      }),
    });
  }

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI image error (${response.status}): ${errText}`);
  }

  const data = await response.json() as {
    data?: Array<{ b64_json?: string; url?: string }>;
  };

  const first = data.data?.[0];
  if (!first?.b64_json) {
    throw new Error('OpenAI: aucune image renvoyee');
  }

  return {
    imageBase64: first.b64_json,
    mimeType: 'image/png',
    provider: 'openai',
    model: config.openaiModel,
  };
}

// ---------- Google Gemini (image generation) ----------
async function generateWithGemini(
  input: ImageGenerationInput,
  config: ImageGenerationConfig
): Promise<ImageGenerationResult> {
  // Gemini image-capable model: returns inline image data in response parts.
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.geminiModel}:generateContent?key=${encodeURIComponent(config.geminiApiKey)}`;

  const parts: Array<Record<string, unknown>> = [{ text: input.prompt }];
  if (input.sourceImageBase64) {
    parts.push({
      inlineData: {
        mimeType: input.sourceImageMime || 'image/png',
        data: input.sourceImageBase64,
      },
    });
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
      generationConfig: {
        responseModalities: ['IMAGE', 'TEXT'],
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini image error (${response.status}): ${errText}`);
  }

  const data = await response.json() as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          inlineData?: { mimeType?: string; data?: string };
          inline_data?: { mime_type?: string; data?: string };
        }>;
      };
    }>;
  };

  for (const candidate of data.candidates || []) {
    for (const part of candidate.content?.parts || []) {
      const inline = part.inlineData || part.inline_data;
      const b64 = inline?.data;
      if (b64) {
        return {
          imageBase64: b64,
          mimeType: (inline as { mimeType?: string; mime_type?: string }).mimeType
            || (inline as { mimeType?: string; mime_type?: string }).mime_type
            || 'image/png',
          provider: 'gemini',
          model: config.geminiModel,
        };
      }
    }
  }

  throw new Error('Gemini: aucune image renvoyee');
}
