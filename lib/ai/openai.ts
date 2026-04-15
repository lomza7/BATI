// Thin wrapper around OpenAI Chat Completions that accepts Anthropic-style
// payloads (system + messages with text/image blocks) and returns a response
// shaped like Anthropic's so existing routes only swap the fetch call.

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

export const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';

type AnthropicTextBlock = { type: 'text'; text: string };
type AnthropicImageBlock = {
  type: 'image';
  source: { type: 'base64'; media_type: string; data: string };
};
type AnthropicContentBlock = AnthropicTextBlock | AnthropicImageBlock;

export type AnthropicMessage = {
  role: 'user' | 'assistant';
  content: string | AnthropicContentBlock[];
};

export interface CallOpenAIParams {
  system: string;
  messages: AnthropicMessage[];
  max_tokens?: number;
  temperature?: number;
  model?: string;
}

export interface AnthropicShapedResponse {
  content: { type: 'text'; text: string }[];
  usage?: { input_tokens?: number; output_tokens?: number };
}

function toOpenAIContent(content: AnthropicMessage['content']) {
  if (typeof content === 'string') return content;
  return content.map((block) => {
    if (block.type === 'text') return { type: 'text', text: block.text };
    return {
      type: 'image_url',
      image_url: { url: `data:${block.source.media_type};base64,${block.source.data}` },
    };
  });
}

export class OpenAIError extends Error {
  status: number;
  body: string;
  constructor(status: number, body: string) {
    super(`OpenAI API error ${status}: ${body.slice(0, 200)}`);
    this.status = status;
    this.body = body;
  }
}

export async function callOpenAI({
  system,
  messages,
  max_tokens,
  temperature,
  model,
}: CallOpenAIParams): Promise<AnthropicShapedResponse> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY manquante');

  const openaiMessages = [
    { role: 'system', content: system },
    ...messages.map((m) => ({ role: m.role, content: toOpenAIContent(m.content) })),
  ];

  const res = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model || process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL,
      messages: openaiMessages,
      ...(max_tokens !== undefined ? { max_tokens } : {}),
      ...(temperature !== undefined ? { temperature } : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new OpenAIError(res.status, body);
  }

  const data = (await res.json()) as {
    choices: { message: { content: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };

  const text = data.choices?.[0]?.message?.content ?? '';
  return {
    content: [{ type: 'text', text }],
    usage: {
      input_tokens: data.usage?.prompt_tokens,
      output_tokens: data.usage?.completion_tokens,
    },
  };
}
