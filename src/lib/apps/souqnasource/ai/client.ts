// src/lib/apps/souqnasource/ai/client.ts
import OpenAI from 'openai';

let _client: OpenAI | null = null;
export function aiClient(): OpenAI {
  if (_client) return _client;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');
  _client = new OpenAI({ apiKey });
  return _client;
}

export const DEFAULT_MODEL = 'gpt-4o-mini';

export async function chatJson(opts: {
  system: string;
  user: string;
  model?: string;
  maxTokens?: number;
}): Promise<string> {
  const client = aiClient();
  const r = await client.chat.completions.create({
    model: opts.model ?? DEFAULT_MODEL,
    messages: [
      { role: 'system', content: opts.system },
      { role: 'user', content: opts.user },
    ],
    response_format: { type: 'json_object' },
    max_tokens: opts.maxTokens ?? 1500,
    temperature: 0.2,
  });
  return r.choices[0]?.message?.content ?? '';
}

function stripFences(s: string): string {
  return s.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
}

export function safeJsonObject(raw: string): Record<string, unknown> | null {
  try {
    const out = JSON.parse(stripFences(raw));
    return out && typeof out === 'object' && !Array.isArray(out)
      ? (out as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export function safeJsonArray(raw: string): unknown[] | null {
  try {
    const out = JSON.parse(stripFences(raw));
    return Array.isArray(out) ? out : null;
  } catch {
    return null;
  }
}
