// Thin OpenAI helpers shared by Edge Functions. Every paid-provider request is
// bounded so a provider outage never leaves a user request hanging indefinitely.

const OPENAI_BASE = 'https://api.openai.com/v1';
const DEFAULT_DEADLINE_MS = 10_000;

export const DEFAULT_CHAT_MODEL = 'gpt-5.4-mini';
export const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-small';
export const EMBEDDING_DIM = 1536;

export class OpenAIRequestError extends Error {
  readonly retryable: boolean;
  readonly status?: number;

  constructor(message: string, options: { retryable: boolean; status?: number; cause?: unknown }) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'OpenAIRequestError';
    this.retryable = options.retryable;
    this.status = options.status;
  }
}

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

function retryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function openAIFetch(
  path: string,
  init: RequestInit,
  options: { apiKey: string; deadlineMs?: number; maxAttempts?: number },
): Promise<Response> {
  const deadlineMs = Math.max(250, options.deadlineMs ?? DEFAULT_DEADLINE_MS);
  const maxAttempts = Math.max(1, Math.min(2, options.maxAttempts ?? 1));
  const deadlineAt = Date.now() + deadlineMs;
  let lastError: OpenAIRequestError | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const remainingMs = deadlineAt - Date.now();
    if (remainingMs <= 0) break;

    // Reserve part of the total deadline for the one allowed retry.
    const attemptsLeft = maxAttempts - attempt + 1;
    const attemptMs = Math.max(200, Math.floor(remainingMs / attemptsLeft));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), attemptMs);
    try {
      const response = await fetch(`${OPENAI_BASE}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${options.apiKey}`,
          'Content-Type': 'application/json',
          ...(init.headers ?? {}),
        },
        signal: controller.signal,
      });
      // Consume the body before clearing the abort timer. Returning the live
      // Response here would only bound time-to-headers and could still hang
      // forever while callers parse a stalled response stream.
      const responseBody = await response.text();
      if (response.ok) {
        return new Response(responseBody, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        });
      }

      const detail = responseBody.slice(0, 500);
      lastError = new OpenAIRequestError(
        `OpenAI request failed (${response.status})${detail ? `: ${detail}` : ''}`,
        { status: response.status, retryable: retryableStatus(response.status) },
      );
    } catch (error) {
      const timedOut = controller.signal.aborted;
      lastError = new OpenAIRequestError(
        timedOut ? 'OpenAI request timed out.' : 'OpenAI network request failed.',
        { retryable: true, cause: error },
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!lastError.retryable || attempt === maxAttempts) throw lastError;
    const backoffMs = Math.min(250 * attempt, Math.max(0, deadlineAt - Date.now() - 250));
    if (backoffMs > 0) await wait(backoffMs);
  }

  throw lastError ?? new OpenAIRequestError('OpenAI request deadline exceeded.', { retryable: true });
}

/** Calls the Responses API with a strict JSON schema and returns the parsed object. */
export async function structuredResponse(opts: {
  apiKey: string;
  model: string;
  system: string;
  user: unknown;
  schemaName: string;
  schema: unknown;
  deadlineMs?: number;
  maxAttempts?: number;
  maxOutputTokens?: number;
}): Promise<any> {
  const res = await openAIFetch('/responses', {
    method: 'POST',
    body: JSON.stringify({
      model: opts.model,
      input: [
        { role: 'system', content: opts.system },
        { role: 'user', content: typeof opts.user === 'string' ? opts.user : JSON.stringify(opts.user) },
      ],
      text: { format: { type: 'json_schema', name: opts.schemaName, strict: true, schema: opts.schema } },
      max_output_tokens: Math.max(128, Math.min(4_000, opts.maxOutputTokens ?? 3_000)),
    }),
  }, opts);
  const json = await res.json();
  const output = extractOutputText(json);
  if (!output) throw new OpenAIRequestError('OpenAI returned an empty structured response.', { retryable: false });
  try {
    return JSON.parse(output);
  } catch (error) {
    throw new OpenAIRequestError('OpenAI returned malformed structured JSON.', { retryable: false, cause: error });
  }
}

/**
 * Creates all non-empty embeddings in one provider request and preserves input order.
 * A malformed or wrong-dimensional vector rejects the whole response so callers never
 * persist incompatible pgvector values.
 */
export async function createEmbeddings(opts: {
  apiKey: string;
  model: string;
  inputs: string[];
  dimensions?: number;
  deadlineMs?: number;
  maxAttempts?: number;
}): Promise<Array<number[] | null>> {
  const dimensions = opts.dimensions ?? EMBEDDING_DIM;
  const populated = opts.inputs
    .map((input, originalIndex) => ({ input: input.trim(), originalIndex }))
    .filter(item => item.input.length > 0);
  const result: Array<number[] | null> = opts.inputs.map(() => null);
  if (populated.length === 0) return result;

  const res = await openAIFetch('/embeddings', {
    method: 'POST',
    body: JSON.stringify({
      model: opts.model,
      input: populated.map(item => item.input),
      dimensions,
    }),
  }, opts);
  const json = await res.json();
  const rows = Array.isArray(json.data) ? json.data : [];
  if (rows.length !== populated.length) {
    throw new OpenAIRequestError('OpenAI returned an unexpected embedding count.', { retryable: false });
  }

  for (const [position, item] of populated.entries()) {
    const embedding = rows.find((row: any) => row?.index === position)?.embedding ?? rows[position]?.embedding;
    if (!Array.isArray(embedding) || embedding.length !== dimensions || !embedding.every(Number.isFinite)) {
      throw new OpenAIRequestError(`OpenAI returned an invalid ${dimensions}-dimension embedding.`, { retryable: false });
    }
    result[item.originalIndex] = embedding;
  }
  return result;
}

/** Backward-compatible single-input adapter. */
export async function createEmbedding(opts: {
  apiKey: string;
  model: string;
  input: string;
  dimensions?: number;
  deadlineMs?: number;
  maxAttempts?: number;
}): Promise<number[] | null> {
  return (await createEmbeddings({ ...opts, inputs: [opts.input] }))[0] ?? null;
}
