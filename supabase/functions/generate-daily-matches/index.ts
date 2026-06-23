import { createServiceClient, jsonResponse, requireUser } from '../_shared/client.ts';

function todayKey() {
  return new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function pairKeyFor(a: string, b: string) {
  return [a, b].sort().join('_');
}

function scoreCandidate(self: any, candidate: any) {
  const selfInterests = new Set(self?.interests ?? []);
  const shared = (candidate.interests ?? []).filter((interest: string) => selfInterests.has(interest));
  let score = 58 + Math.min(shared.length * 10, 24);
  if (self?.campus === candidate.campus) score += 10;
  if (self?.major === candidate.major) score += 6;
  return Math.max(45, Math.min(score, 96));
}

function compatibilityLabel(score: number) {
  if (score >= 86) return 'High intent fit';
  if (score >= 74) return 'Strong potential';
  if (score >= 64) return 'Worth exploring';
  return 'Fresh perspective';
}

Deno.serve(async req => {
  const { client, user, response } = await requireUser(req);
  if (response) return response;
  const admin = createServiceClient();

  const body = await req.json().catch(() => ({}));
  const date = typeof body.date === 'string' ? body.date : todayKey();
  const batchId = `${user!.id}_${date}`;

  const { data: existing, error: existingError } = await client
    .from('daily_match_batches')
    .select('id')
    .eq('id', batchId)
    .maybeSingle();
  if (existingError) return jsonResponse({ error: existingError.message }, 400);
  if (existing) return jsonResponse({ ok: true, batchId, reused: true });

  const { data: self, error: selfError } = await client
    .from('profiles')
    .select('*')
    .eq('id', user!.id)
    .single();
  if (selfError) return jsonResponse({ error: 'Complete your profile before AI Picks.' }, 412);

  const { data: blockedRows } = await admin
    .from('blocks')
    .select('blocked_user_id')
    .eq('blocker_id', user!.id);
  const blocked = new Set((blockedRows ?? []).map(row => row.blocked_user_id));

  const { data: candidates, error: candidatesError } = await client
    .from('public_profiles')
    .select('*')
    .neq('id', user!.id)
    .limit(40);
  if (candidatesError) return jsonResponse({ error: candidatesError.message }, 400);

  const selected = (candidates ?? [])
    .filter(candidate => !blocked.has(candidate.id))
    .map(candidate => ({ candidate, score: scoreCandidate(self, candidate) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const { error: batchError } = await admin.from('daily_match_batches').insert({
    id: batchId,
    user_id: user!.id,
    date,
    target_count: selected.length,
    generated_by: 'edge-curation-fallback',
  });
  if (batchError) return jsonResponse({ error: batchError.message }, 400);

  if (selected.length > 0) {
    const { error: matchesError } = await admin.from('curated_matches').insert(
      selected.map(({ candidate, score }) => ({
        id: `${batchId}_${candidate.id}`,
        batch_id: batchId,
        user_id: user!.id,
        candidate_id: candidate.id,
        candidate_snapshot: candidate,
        pair_key: pairKeyFor(user!.id, candidate.id),
        ai_reason: `AI chon ${candidate.name} vi profile co nhieu tin hieu phu hop voi ban.`,
        compatibility_label: compatibilityLabel(score),
        compatibility_score: score,
      }))
    );
    if (matchesError) return jsonResponse({ error: matchesError.message }, 400);
  }

  return jsonResponse({
    ok: true,
    batchId,
    generatedBy: 'edge-curation-fallback',
    matchCount: selected.length,
  });
});
