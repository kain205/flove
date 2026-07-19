import { createEmbeddings, structuredResponse } from "./openai.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function rejects(action: () => Promise<unknown>, pattern: RegExp) {
  try {
    await action();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    assert(pattern.test(message), `Expected ${pattern}, received: ${message}`);
    return;
  }
  throw new Error(`Expected rejection matching ${pattern}.`);
}

function withFetch(mock: typeof fetch, run: () => Promise<void>) {
  const original = globalThis.fetch;
  globalThis.fetch = mock;
  return run().finally(() => {
    globalThis.fetch = original;
  });
}

Deno.test("embedding response rejects a wrong vector dimension before persistence", async () => {
  await withFetch(() =>
    Promise.resolve(
      new Response(
        JSON.stringify({
          data: [{ index: 0, embedding: [0.1, 0.2] }],
        }),
        { status: 200 },
      ),
    ), async () => {
    await rejects(() =>
      createEmbeddings({
        apiKey: "test",
        model: "test",
        inputs: ["profile"],
        dimensions: 3,
        deadlineMs: 500,
      }), /invalid 3-dimension embedding/i);
  });
});

Deno.test("malformed structured JSON falls back through a typed provider error", async () => {
  await withFetch(
    () =>
      Promise.resolve(
        new Response(JSON.stringify({ output_text: "{not-json" }), {
          status: 200,
        }),
      ),
    async () => {
      await rejects(() =>
        structuredResponse({
          apiKey: "test",
          model: "test",
          system: "test",
          user: {},
          schemaName: "test",
          schema: { type: "object" },
          deadlineMs: 500,
        }), /malformed structured JSON/i);
    },
  );
});

Deno.test("structured responses disable provider-side response storage", async () => {
  let requestBody: Record<string, unknown> = {};
  await withFetch(
    (_input, init) => {
      requestBody = JSON.parse(String(init?.body));
      return Promise.resolve(
        new Response(JSON.stringify({ output_text: JSON.stringify({ ok: true }) }), {
          status: 200,
        }),
      );
    },
    async () => {
      await structuredResponse({
        apiKey: "test",
        model: "configured-model",
        system: "test",
        user: {},
        schemaName: "test",
        schema: { type: "object" },
        deadlineMs: 500,
      });
    },
  );
  assert(requestBody.store === false, "Expected Responses API store=false.");
  assert(requestBody.model === "configured-model", "Expected the caller-configured model.");
});

Deno.test("structured responses expose an explicit provider refusal", async () => {
  await withFetch(
    () => Promise.resolve(new Response(JSON.stringify({
      status: "completed",
      output: [{
        type: "message",
        content: [{ type: "refusal", refusal: "I cannot help with that." }],
      }],
    }), { status: 200 })),
    async () => {
      await rejects(() => structuredResponse({
        apiKey: "test",
        model: "test",
        system: "test",
        user: {},
        schemaName: "test",
        schema: { type: "object" },
        deadlineMs: 500,
      }), /refused the structured response/i);
    },
  );
});

Deno.test("429 is retried at most once inside the deadline", async () => {
  let attempts = 0;
  await withFetch(() => {
    attempts += 1;
    if (attempts === 1) {
      return Promise.resolve(new Response("limited", { status: 429 }));
    }
    return Promise.resolve(
      new Response(
        JSON.stringify({ data: [{ index: 0, embedding: [0.1, 0.2, 0.3] }] }),
        { status: 200 },
      ),
    );
  }, async () => {
    const result = await createEmbeddings({
      apiKey: "test",
      model: "test",
      inputs: ["profile"],
      dimensions: 3,
      deadlineMs: 1_500,
      maxAttempts: 2,
    });
    assert(attempts === 2, `Expected two attempts, got ${attempts}.`);
    assert(result[0]?.length === 3, "Expected the second attempt vector.");
  });
});

Deno.test("deadline also aborts a response body that stalls after headers", async () => {
  const startedAt = Date.now();
  await withFetch((_input, init) => {
    const signal = init?.signal;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("{"));
        signal?.addEventListener(
          "abort",
          () => controller.error(new DOMException("Aborted", "AbortError")),
        );
      },
    });
    return Promise.resolve(new Response(stream, { status: 200 }));
  }, async () => {
    await rejects(() =>
      structuredResponse({
        apiKey: "test",
        model: "test",
        system: "test",
        user: {},
        schemaName: "test",
        schema: { type: "object" },
        deadlineMs: 250,
      }), /timed out|network request failed/i);
  });
  assert(
    Date.now() - startedAt < 1_000,
    "Stalled response body exceeded the bounded deadline.",
  );
});
