// Thin OpenAI helpers shared by the onboarding-analysis and matching Edge Functions.

const OPENAI_BASE = 'https://api.openai.com/v1';

export const DEFAULT_CHAT_MODEL = 'gpt-5.4-mini';
export const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-small';
export const EMBEDDING_DIM = 1536;

export function extractOutputText(response: any): string {
  if (typeof response.output_text === 'string') return response.output_text;
  for (const item of response.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === 'output_text' && typeof content.text === 'string') return content.text;
    }
  }
  return '';
}

export function clampScore(score: unknown, fallback: number): number {
  const numeric = typeof score === 'number' && Number.isFinite(score) ? Math.round(score) : fallback;
  return Math.max(45, Math.min(numeric, 96));
}

/** Calls the Responses API with a strict JSON schema and returns the parsed object. */
export async function structuredResponse(opts: {
  apiKey: string;
  model: string;
  system: string;
  user: unknown;
  schemaName: string;
  schema: unknown;
}): Promise<any> {
  const res = await fetch(`${OPENAI_BASE}/responses`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${opts.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: opts.model,
      input: [
        { role: 'system', content: opts.system },
        { role: 'user', content: typeof opts.user === 'string' ? opts.user : JSON.stringify(opts.user) },
      ],
      text: { format: { type: 'json_schema', name: opts.schemaName, strict: true, schema: opts.schema } },
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`OpenAI responses failed: ${res.status} ${detail}`);
  }
  const json = await res.json();
  return JSON.parse(extractOutputText(json));
}

/** Returns a single embedding vector (or null on empty input). */
export async function createEmbedding(opts: { apiKey: string; model: string; input: string }): Promise<number[] | null> {
  const input = opts.input.trim();
  if (!input) return null;
  const res = await fetch(`${OPENAI_BASE}/embeddings`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${opts.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: opts.model, input }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`OpenAI embeddings failed: ${res.status} ${detail}`);
  }
  const json = await res.json();
  const embedding = json.data?.[0]?.embedding;
  return Array.isArray(embedding) ? embedding : null;
}
