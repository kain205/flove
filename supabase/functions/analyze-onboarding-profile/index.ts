import { jsonResponse, requireUser } from '../_shared/client.ts';
import { DEFAULT_CHAT_MODEL, structuredResponse } from '../_shared/openai.ts';
import {
  ANALYSIS_SCHEMA,
  ANALYSIS_SYSTEM_PROMPT,
  fallbackAnalysis,
  normalizeAnalysis,
  type BasicFields,
  type RawAnswer,
} from '../_shared/analysis.ts';

// Reads the raw onboarding answers and returns a structured AIProfileAnalysis for the
// review screen. Does NOT write to the database — the user confirms first, then the client
// calls confirm-onboarding-profile. Degrades to a deterministic analysis if OpenAI is missing.
Deno.serve(async req => {
  const { user, response } = await requireUser(req);
  if (response) return response;

  const body = await req.json().catch(() => ({}));
  const answers: RawAnswer[] = Array.isArray(body.answers) ? body.answers : [];
  const basic: BasicFields = body.basic ?? {};

  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) {
    return jsonResponse({ analysis: fallbackAnalysis(answers, basic), generatedBy: 'fallback' });
  }

  try {
    const model = Deno.env.get('OPENAI_MODEL') ?? DEFAULT_CHAT_MODEL;
    const raw = await structuredResponse({
      apiKey,
      model,
      system: ANALYSIS_SYSTEM_PROMPT,
      user: { answers, basic },
      schemaName: 'profile_analysis',
      schema: ANALYSIS_SCHEMA,
    });
    return jsonResponse({ analysis: normalizeAnalysis(raw), generatedBy: `openai-${model}` });
  } catch (error) {
    console.error('Profile analysis failed, using fallback.', error);
    return jsonResponse({ analysis: fallbackAnalysis(answers, basic), generatedBy: 'fallback' });
  }
});
