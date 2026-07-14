/**
 * Best-effort fast path for durable PGMQ jobs. The queue remains the source of
 * truth; a scheduled consumer will retry even when this background invocation
 * is cut short by the Edge runtime.
 */
export function kickAiWorker(): void {
  const url = Deno.env.get('SUPABASE_URL');
  const secret = Deno.env.get('AI_WORKER_SECRET');
  const edgeRuntime = (globalThis as typeof globalThis & {
    EdgeRuntime?: { waitUntil(promise: Promise<unknown>): void };
  }).EdgeRuntime;
  if (!url || !secret || !edgeRuntime) return;

  const request = fetch(`${url}/functions/v1/process-ai-jobs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Worker-Secret': secret,
    },
    body: JSON.stringify({ batchSize: 5 }),
  }).then(response => {
    if (!response.ok) throw new Error(`AI worker fast path returned ${response.status}.`);
  }).catch(error => {
    console.error(JSON.stringify({
      event: 'ai_worker_fast_path_failed',
      errorCode: error instanceof Error ? error.name : 'unknown',
    }));
  });
  edgeRuntime.waitUntil(request);
}
