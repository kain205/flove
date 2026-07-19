begin;

select plan(104);

-- Isolated, fully-ready users for backend state-machine tests. UUIDs are kept
-- outside the product seed range, and the enclosing transaction rolls them back.
insert into auth.users (
  id, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, role, aud
)
select
  ('90000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  format('backend-test-%s@fpt.edu.vn', n),
  crypt('backend-test-only', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('name', format('Backend Test %s', n)),
  'authenticated',
  'authenticated'
from generate_series(1, 28) n;

insert into public.profiles (
  id, email, name, age, major, campus, bio, interests,
  personality_tags, dating_goals, preferred_vibes, profile_text,
  ai_profile_analysis, gender, looking_for_gender, profile_confirmed,
  profile_confirmed_at, onboarding_answers, onboarding_version
)
select
  u.id,
  u.email,
  coalesce(u.raw_user_meta_data ->> 'name', 'Backend Test'),
  21,
  'SE',
  'HCM',
  'A complete backend behavior test profile.',
  array['coffee', 'music', 'testing'],
  array['curious'],
  array['slow connection'],
  array['clear communication'],
  '{"bio":"A complete backend behavior test profile."}'::jsonb,
  '{"matchingSignals":{"selfTraits":["curious"]}}'::jsonb,
  'prefer_not_to_show',
  '{}'::text[],
  true,
  now(),
  '[]'::jsonb,
  2
from auth.users u
where u.id::text like '90000000-0000-0000-0000-%';

-- Repeated claim is the observable equivalent of a concurrent loser: only the
-- first request owns the fence token and one generation-attempt row exists.
create temporary table br_claim_first as
select *
from public.claim_daily_match_batch(
  '90000000-0000-0000-0000-000000000001',
  'behavior-v2',
  120
);

create temporary table br_claim_repeat as
select *
from public.claim_daily_match_batch(
  '90000000-0000-0000-0000-000000000001',
  'behavior-v2',
  120
);

select is(
  (select result from br_claim_first),
  'claimed',
  'the first daily request owns the generation claim'
);
select is(
  (select result from br_claim_repeat),
  'processing',
  'a repeated request observes processing instead of generating again'
);
select ok(
  (select batch_id from br_claim_first) = (select batch_id from br_claim_repeat)
    and (select attempt_count from br_claim_first) = 1
    and (select attempt_count from br_claim_repeat) = 1
    and (select claim_token from br_claim_repeat) is null,
  'the repeated request sees the same batch and cannot obtain its fence token'
);
select is(
  (
    select count(*)
    from public.daily_match_batches
    where user_id = '90000000-0000-0000-0000-000000000001'
      and date = public.flove_business_date()
  ),
  1::bigint,
  'daily uniqueness leaves exactly one batch'
);
select is(
  (
    select count(*)
    from public.match_generation_attempts
    where user_id = '90000000-0000-0000-0000-000000000001'
  ),
  1::bigint,
  'a processing response does not create another attempt record'
);

-- A rejected finalize is one SQL statement: its delete/insert work must roll
-- back, leaving the fenced claim recoverable and no ready/orphan batch.
select throws_ok(
  format(
    $sql$
      select * from public.finalize_daily_match_batch(
        %L,
        '90000000-0000-0000-0000-000000000001',
        %L,
        '[{"candidate_id":"ffffffff-ffff-ffff-ffff-ffffffffffff"}]'::jsonb,
        'behavior-v2', null, 900, 1, 10
      )
    $sql$,
    (select batch_id from br_claim_first),
    (select claim_token from br_claim_first)
  ),
  '22023',
  'No valid selected candidates',
  'invalid finalization fails atomically'
);
select ok(
  exists (
    select 1
    from public.daily_match_batches b
    join br_claim_first claim on claim.batch_id = b.id
    where b.status = 'generating'
      and b.claim_token = claim.claim_token
  ),
  'failed finalize preserves the active generation fence'
);
select is(
  (
    select count(*)
    from public.curated_matches
    where batch_id = (select batch_id from br_claim_first)
  ),
  0::bigint,
  'failed finalize leaves no partial match rows'
);
select is(
  (
    select outcome
    from public.match_generation_attempts
    where batch_id = (select batch_id from br_claim_first)
      and attempt_no = 1
  ),
  'generating',
  'failed finalize does not falsely finish the generation attempt'
);

select *
from public.fail_daily_match_batch(
  (select batch_id from br_claim_first),
  (select claim_token from br_claim_first),
  'behavior_finalize_failed',
  60,
  1,
  12
);

select ok(
  exists (
    select 1
    from public.daily_match_batches
    where id = (select batch_id from br_claim_first)
      and status = 'failed'
      and claim_token is null
      and error_code = 'behavior_finalize_failed'
  ),
  'the owner can explicitly recover the claim into a retryable failed state'
);
select ok(
  not exists (
    select 1
    from public.daily_match_batches b
    where b.status = 'ready'
      and not exists (
        select 1 from public.curated_matches m where m.batch_id = b.id
      )
  ),
  'no ready batch exists without finalized match rows'
);

-- Empty batches respect backoff while the pool is unchanged, then reclaim as
-- soon as a profile revision advances the monotonic pool revision.
create temporary table br_empty_claim as
select *
from public.claim_daily_match_batch(
  '90000000-0000-0000-0000-000000000002',
  'behavior-v2',
  120
);

select *
from public.finalize_daily_match_batch(
  (select batch_id from br_empty_claim),
  '90000000-0000-0000-0000-000000000002',
  (select claim_token from br_empty_claim),
  '[]'::jsonb,
  'behavior-v2',
  'no_eligible_candidates',
  3600,
  0,
  8
);

select ok(
  exists (
    select 1
    from public.daily_match_batches
    where id = (select batch_id from br_empty_claim)
      and status = 'empty'
      and empty_reason = 'no_eligible_candidates'
      and retry_after > now()
      and attempt_count = 1
  ),
  'an empty outcome has an explicit reason and future retry time'
);

create temporary table br_empty_repeat as
select *
from public.claim_daily_match_batch(
  '90000000-0000-0000-0000-000000000002',
  'behavior-v2',
  120
);

select ok(
  (select result from br_empty_repeat) = 'empty'
    and (select attempt_count from br_empty_repeat) = 1
    and (select claim_token from br_empty_repeat) is null,
  'unchanged candidate pool keeps the empty result inside backoff'
);

create temporary table br_pool_before as
select pool.revision as pool_revision,
       profile.profile_revision
from public.candidate_pool_state pool
cross join public.profiles profile
where pool.singleton
  and profile.id = '90000000-0000-0000-0000-000000000003';

update public.profiles
set preferred_vibes = preferred_vibes || array['pool revision advanced']
where id = '90000000-0000-0000-0000-000000000003';

select ok(
  (select revision from public.candidate_pool_state where singleton)
    > (select pool_revision from br_pool_before),
  'an eligibility-affecting profile revision advances the pool revision'
);
select ok(
  exists (
    select 1
    from public.profiles profile
    where profile.id = '90000000-0000-0000-0000-000000000003'
      and profile.profile_revision = (select profile_revision + 1 from br_pool_before)
      and profile.embedding_status = 'pending'
  ),
  'the BEFORE trigger advances profile revision and invalidates embeddings'
);
select ok(
  exists (
    select 1
    from public.ai_job_registry job
    join public.profiles profile
      on job.idempotency_key = 'profile_embedding:' || profile.id::text
        || ':' || profile.profile_revision::text
    where profile.id = '90000000-0000-0000-0000-000000000003'
      and job.job_type = 'profile_embedding'
      and job.status = 'queued'
      and job.msg_id is not null
  ),
  'the AFTER trigger observes the revised row and enqueues its embedding job'
);

create temporary table br_empty_reclaim as
select *
from public.claim_daily_match_batch(
  '90000000-0000-0000-0000-000000000002',
  'behavior-v2',
  120
);

select ok(
  (select result from br_empty_reclaim) = 'claimed'
    and (select attempt_count from br_empty_reclaim) = 2
    and (select claim_token from br_empty_reclaim) is not null,
  'pool revision change reclaims an empty batch before its time backoff'
);
select ok(
  (
    select count(*) = 2
      and count(*) filter (where outcome = 'empty') = 1
      and count(*) filter (where outcome = 'generating') = 1
    from public.match_generation_attempts
    where batch_id = (select batch_id from br_empty_claim)
  ),
  'empty reclaim records a distinct fenced attempt'
);

-- Stale non-null vectors must never be read. They stay in the deterministic
-- fallback pool, with every vector-derived similarity forced to zero.
update public.profiles
set self_vector = array_fill(0.01::real, array[1536])::vector(1536),
    need_vector = array_fill(0.01::real, array[1536])::vector(1536),
    preference_vector = array_fill(0.01::real, array[1536])::vector(1536),
    communication_vector = array_fill(0.01::real, array[1536])::vector(1536),
    lifestyle_vector = array_fill(0.01::real, array[1536])::vector(1536),
    embedding_status = 'ready',
    embedding_revision = 0
where id in (
  '90000000-0000-0000-0000-000000000004',
  '90000000-0000-0000-0000-000000000005'
);

create temporary table br_stale_vectors as
select *
from public.get_match_candidates_v2(
  '90000000-0000-0000-0000-000000000004',
  300,
  0
)
where id = '90000000-0000-0000-0000-000000000005';

select is(
  (select count(*) from br_stale_vectors),
  1::bigint,
  'a stale-vector candidate remains available to deterministic fallback'
);
select ok(
  exists (
    select 1
    from br_stale_vectors
    where self_similarity = 0
      and need_similarity = 0
      and preference_to_candidate = 0
      and candidate_to_preference = 0
      and communication_similarity = 0
      and lifestyle_similarity = 0
  ),
  'all stale vector similarities are zero'
);
select ok(
  exists (
    select 1
    from br_stale_vectors
    where coarse_score is not null
      and coarse_score between -0.15 and 1.0
  ),
  'structured fallback still produces a finite bounded coarse score'
);

-- Explicit gender consent is strict. Only empty/everyone/depends is broad;
-- other/prefer_not_to_show cannot silently satisfy an explicit male/female ask.
update public.profiles
set gender = 'male', looking_for_gender = array['female']
where id = '90000000-0000-0000-0000-000000000004';
update public.profiles
set gender = 'other', looking_for_gender = '{}'::text[]
where id = '90000000-0000-0000-0000-000000000005';

create temporary table br_strict_gender as
select id
from public.get_match_candidates_v2(
  '90000000-0000-0000-0000-000000000004', 300, 0
)
where id = '90000000-0000-0000-0000-000000000005';

update public.profiles
set looking_for_gender = array['everyone']
where id = '90000000-0000-0000-0000-000000000004';

create temporary table br_broad_gender as
select id
from public.get_match_candidates_v2(
  '90000000-0000-0000-0000-000000000004', 300, 0
)
where id = '90000000-0000-0000-0000-000000000005';

select ok(
  not exists (select 1 from br_strict_gender)
    and exists (select 1 from br_broad_gender),
  'explicit gender excludes other while everyone preserves broad consent'
);

-- A missing height cannot satisfy a concrete hard constraint. Selecting hard
-- with no actual bound/direction remains a no-op and must not shrink the pool.
update public.profiles
set height_cm = 170,
    appearance_preference = '{"heightPreference":{"importance":"hard","minHeightCm":160}}'::jsonb
where id = '90000000-0000-0000-0000-000000000004';

select is(
  public.profile_height_hard_compatible(
    (
      select profile from public.profiles profile
      where profile.id = '90000000-0000-0000-0000-000000000004'
    ),
    (
      select profile from public.profiles profile
      where profile.id = '90000000-0000-0000-0000-000000000005'
    )
  ),
  false,
  'a NULL target height cannot satisfy a hard numeric height bound'
);

update public.profiles
set appearance_preference = '{"heightPreference":{"importance":"hard","prefersTallerThanSelf":true}}'::jsonb
where id = '90000000-0000-0000-0000-000000000004';

select is(
  public.profile_height_hard_compatible(
    (
      select profile from public.profiles profile
      where profile.id = '90000000-0000-0000-0000-000000000004'
    ),
    (
      select profile from public.profiles profile
      where profile.id = '90000000-0000-0000-0000-000000000005'
    )
  ),
  false,
  'a NULL target height cannot satisfy a hard directional preference'
);

update public.profiles
set appearance_preference = '{"heightPreference":{"importance":"hard"}}'::jsonb
where id = '90000000-0000-0000-0000-000000000004';

select is(
  public.profile_height_hard_compatible(
    (
      select profile from public.profiles profile
      where profile.id = '90000000-0000-0000-0000-000000000004'
    ),
    (
      select profile from public.profiles profile
      where profile.id = '90000000-0000-0000-0000-000000000005'
    )
  ),
  true,
  'hard importance with no concrete height constraint allows a NULL target height'
);

update public.profiles
set dealbreakers = jsonb_build_array(
  'legacy string is soft',
  jsonb_build_object('trait', 'legacy object is soft'),
  jsonb_build_object('trait', 'Explicit hard only', 'severity', 'hard')
)
where id = '90000000-0000-0000-0000-000000000004';

select is(
  public.profile_hard_dealbreakers((
    select profile from public.profiles profile
    where profile.id = '90000000-0000-0000-0000-000000000004'
  )),
  array['explicit hard only']::text[],
  'legacy dealbreakers stay soft unless an object explicitly says severity hard'
);

-- Enrichment is fenced by generation attempt. A late attempt-1 provider result
-- cannot overwrite prose created by attempt 2.
create temporary table br_enrich_claim_1 as
select *
from public.claim_daily_match_batch(
  '90000000-0000-0000-0000-000000000006',
  'behavior-v2',
  120
);

select *
from public.finalize_daily_match_batch(
  (select batch_id from br_enrich_claim_1),
  '90000000-0000-0000-0000-000000000006',
  (select claim_token from br_enrich_claim_1),
  jsonb_build_array(jsonb_build_object(
    'candidate_id', '90000000-0000-0000-0000-000000000007',
    'candidate_snapshot', '{}'::jsonb,
    'ai_reason', 'attempt one reason',
    'suggested_opener', 'attempt one opener',
    'compatibility_label', 'Good',
    'compatibility_score', 70
  )),
  'behavior-v2', null, 900, 1, 10
);

update public.profiles
set preferred_vibes = preferred_vibes || array['new owner revision']
where id = '90000000-0000-0000-0000-000000000006';

create temporary table br_enrich_claim_2 as
select *
from public.claim_daily_match_batch(
  '90000000-0000-0000-0000-000000000006',
  'behavior-v2',
  120
);

select ok(
  (select result from br_enrich_claim_2) = 'claimed'
    and (select attempt_count from br_enrich_claim_2) = 2,
  'a newer profile revision creates enrichment attempt 2'
);

select *
from public.finalize_daily_match_batch(
  (select batch_id from br_enrich_claim_2),
  '90000000-0000-0000-0000-000000000006',
  (select claim_token from br_enrich_claim_2),
  jsonb_build_array(jsonb_build_object(
    'candidate_id', '90000000-0000-0000-0000-000000000007',
    'candidate_snapshot', '{}'::jsonb,
    'ai_reason', 'attempt two reason',
    'suggested_opener', 'attempt two opener',
    'compatibility_label', 'Great',
    'compatibility_score', 82
  )),
  'behavior-v2', null, 900, 1, 9
);

select is(
  public.complete_daily_match_enrichment(
    (select batch_id from br_enrich_claim_1),
    1,
    jsonb_build_array(jsonb_build_object(
      'candidate_id', '90000000-0000-0000-0000-000000000007',
      'ai_reason', 'stale provider overwrite',
      'suggested_opener', 'stale provider opener'
    )),
    null
  ),
  'skipped'::public.match_enrichment_status,
  'stale enrichment completion is acknowledged as skipped'
);
select ok(
  exists (
    select 1
    from public.curated_matches
    where batch_id = (select batch_id from br_enrich_claim_2)
      and ai_reason = 'attempt two reason'
      and suggested_opener = 'attempt two opener'
  ),
  'stale enrichment cannot mutate replacement prose'
);
select ok(
  exists (
    select 1
    from public.daily_match_batches
    where id = (select batch_id from br_enrich_claim_2)
      and attempt_count = 2
      and enrichment_status = 'pending'
  ),
  'stale enrichment cannot mutate replacement batch state'
);

-- Reciprocal feedback uses one idempotent row per action. A profile-revision
-- claim after the first decision must repair/cache the ready batch, never delete
-- a decision while the reciprocal side is accepting.
create temporary table br_feedback_claim_a as
select *
from public.claim_daily_match_batch(
  '90000000-0000-0000-0000-000000000008',
  'behavior-v2',
  120
);

select *
from public.finalize_daily_match_batch(
  (select batch_id from br_feedback_claim_a),
  '90000000-0000-0000-0000-000000000008',
  (select claim_token from br_feedback_claim_a),
  jsonb_build_array(jsonb_build_object(
    'candidate_id', '90000000-0000-0000-0000-000000000009',
    'candidate_snapshot', '{}'::jsonb,
    'ai_reason', 'reciprocal A',
    'compatibility_label', 'Great',
    'compatibility_score', 88
  )),
  'behavior-v2', null, 900, 1, 8
);

create temporary table br_feedback_claim_b as
select *
from public.claim_daily_match_batch(
  '90000000-0000-0000-0000-000000000009',
  'behavior-v2',
  120
);

select *
from public.finalize_daily_match_batch(
  (select batch_id from br_feedback_claim_b),
  '90000000-0000-0000-0000-000000000009',
  (select claim_token from br_feedback_claim_b),
  jsonb_build_array(jsonb_build_object(
    'candidate_id', '90000000-0000-0000-0000-000000000008',
    'candidate_snapshot', '{}'::jsonb,
    'ai_reason', 'reciprocal B',
    'compatibility_label', 'Great',
    'compatibility_score', 88
  )),
  'behavior-v2', null, 900, 1, 8
);

select set_config(
  'request.jwt.claim.sub',
  '90000000-0000-0000-0000-000000000008',
  true
);
create temporary table br_feedback_first as
select *
from public.submit_match_feedback_atomic(
  (select batch_id from br_feedback_claim_a) || '_90000000-0000-0000-0000-000000000009',
  'accepted',
  'behavior-feedback-a',
  array['clear communication'],
  'first accept'
);

select ok(
  (select applied from br_feedback_first)
    and (select status from br_feedback_first) = 'accepted'
    and not (select is_mutual from br_feedback_first),
  'the first reciprocal accept is applied once and is not yet mutual'
);

create temporary table br_feedback_retry as
select *
from public.submit_match_feedback_atomic(
  (select batch_id from br_feedback_claim_a) || '_90000000-0000-0000-0000-000000000009',
  'accepted',
  'behavior-feedback-a',
  array['clear communication'],
  'first accept'
);

select ok(
  not (select applied from br_feedback_retry)
    and (select status from br_feedback_retry) = 'accepted',
  'retrying the same feedback key is a no-op'
);
select is(
  (
    select count(*)
    from public.match_feedback
    where user_id = '90000000-0000-0000-0000-000000000008'
      and idempotency_key = 'behavior-feedback-a'
  ),
  1::bigint,
  'idempotent feedback creates one durable feedback row'
);

create temporary table br_feedback_payload_conflict(
  returned_sqlstate text
);
do $$
declare
  v_state text;
begin
  perform *
  from public.submit_match_feedback_atomic(
    (select batch_id from br_feedback_claim_a)
      || '_90000000-0000-0000-0000-000000000009',
    'accepted',
    'behavior-feedback-a',
    array['different retry tag'],
    'different retry note'
  );
  insert into br_feedback_payload_conflict values (null);
exception when others then
  get stacked diagnostics v_state = returned_sqlstate;
  insert into br_feedback_payload_conflict values (v_state);
end;
$$;

select ok(
  (select returned_sqlstate from br_feedback_payload_conflict) = '22023'
    and (
      select count(*) = 1
      from public.match_feedback
      where user_id = '90000000-0000-0000-0000-000000000008'
        and idempotency_key = 'behavior-feedback-a'
        and tags = array['clear communication']
        and note = 'first accept'
    ),
  'feedback idempotency key rejects changed tags or note without mutating the original row'
);

update public.profiles
set preferred_vibes = preferred_vibes || array['revision after decision']
where id = '90000000-0000-0000-0000-000000000008';

create temporary table br_decided_reclaim as
select *
from public.claim_daily_match_batch(
  '90000000-0000-0000-0000-000000000008',
  'behavior-v2',
  120
);

select is(
  (select result from br_decided_reclaim),
  'cached',
  'a profile revision cannot reclaim a batch containing a user decision'
);
select ok(
  exists (
    select 1
    from public.curated_matches m
    join public.daily_match_batches b on b.id = m.batch_id
    where m.id = (select batch_id from br_feedback_claim_a)
      || '_90000000-0000-0000-0000-000000000009'
      and m.status = 'accepted'
      and b.status = 'ready'
      and b.claim_token is null
  ),
  'claim repair preserves the decided row and a ready parent batch'
);

select set_config(
  'request.jwt.claim.sub',
  '90000000-0000-0000-0000-000000000009',
  true
);
create temporary table br_feedback_mutual as
select *
from public.submit_match_feedback_atomic(
  (select batch_id from br_feedback_claim_b) || '_90000000-0000-0000-0000-000000000008',
  'accepted',
  'behavior-feedback-b',
  '{}'::text[],
  ''
);

select ok(
  (select applied from br_feedback_mutual)
    and (select status from br_feedback_mutual) = 'matched'
    and (select is_mutual from br_feedback_mutual)
    and (select conversation_id from br_feedback_mutual) is not null,
  'the reciprocal accept atomically creates the mutual match'
);
select is(
  (
    select count(*)
    from public.matches
    where pair_key = public.pair_key_for(
      '90000000-0000-0000-0000-000000000008',
      '90000000-0000-0000-0000-000000000009'
    )
  ),
  1::bigint,
  'reciprocal accepts create exactly one official match'
);
select ok(
  (
    select count(*) = 1
    from public.conversations
    where pair_key = public.pair_key_for(
      '90000000-0000-0000-0000-000000000008',
      '90000000-0000-0000-0000-000000000009'
    )
  ) and (
    select count(*) = 2
    from public.conversation_participants
    where conversation_id = (select conversation_id from br_feedback_mutual)
  ),
  'mutual accept creates one conversation with both participants'
);
select is(
  (
    select count(*)
    from public.curated_matches
    where pair_key = public.pair_key_for(
      '90000000-0000-0000-0000-000000000008',
      '90000000-0000-0000-0000-000000000009'
    )
      and status = 'matched'
  ),
  2::bigint,
  'both reciprocal curated rows converge to matched'
);

create temporary table br_feedback_mutual_retry as
select *
from public.submit_match_feedback_atomic(
  (select batch_id from br_feedback_claim_b) || '_90000000-0000-0000-0000-000000000008',
  'accepted',
  'behavior-feedback-b',
  '{}'::text[],
  ''
);

select ok(
  not (select applied from br_feedback_mutual_retry)
    and (select is_mutual from br_feedback_mutual_retry)
    and (
      select count(*) = 1
      from public.matches
      where pair_key = public.pair_key_for(
        '90000000-0000-0000-0000-000000000008',
        '90000000-0000-0000-0000-000000000009'
      )
    ),
  'retry after mutual match remains idempotent'
);

-- Blind Date claims serialize the queue and reload to the same opaque session.
select set_config(
  'request.jwt.claim.sub',
  '90000000-0000-0000-0000-000000000010',
  true
);
create temporary table br_blind_wait as
select * from public.find_blind_date_partner_atomic('Masked Ten');

select ok(
  (select waiting from br_blind_wait)
    and (select session_id from br_blind_wait) is null,
  'the first Blind Date participant waits without a session'
);

select set_config(
  'request.jwt.claim.sub',
  '90000000-0000-0000-0000-000000000011',
  true
);
create temporary table br_blind_pair as
select * from public.find_blind_date_partner_atomic('Masked Eleven');

select ok(
  not (select waiting from br_blind_pair)
    and (select session_id from br_blind_pair) is not null
    and (select conversation_id from br_blind_pair) is not null,
  'the second Blind Date participant atomically creates a session'
);

select set_config(
  'flove.test_conversation_id',
  (select conversation_id from br_blind_pair),
  true
);
set local role authenticated;
select throws_like(
  $$
    insert into public.messages(conversation_id, sender_id, content)
    values (
      current_setting('flove.test_conversation_id'),
      auth.uid(),
      'anonymous direct insert must fail'
    )
  $$,
  '%row-level security policy for table "messages"%',
  'anonymous Blind Date messages cannot bypass the safe send RPC'
);
reset role;

create temporary table br_blind_pair_retry as
select * from public.find_blind_date_partner_atomic('Masked Eleven');

select ok(
  not (select waiting from br_blind_pair_retry)
    and (select session_id from br_blind_pair_retry) = (select session_id from br_blind_pair),
  'a paired participant reloads the same Blind Date session'
);

select set_config(
  'request.jwt.claim.sub',
  '90000000-0000-0000-0000-000000000010',
  true
);
create temporary table br_blind_first_retry as
select * from public.find_blind_date_partner_atomic('Masked Ten');

select is(
  (select session_id from br_blind_first_retry),
  (select session_id from br_blind_pair),
  'the original waiter also reloads the same session'
);
select ok(
  (
    select count(*) = 1
    from public.blind_date_sessions
    where '90000000-0000-0000-0000-000000000010' = any(user_ids)
  ) and (
    select count(*) = 1
    from public.blind_date_sessions
    where '90000000-0000-0000-0000-000000000011' = any(user_ids)
  ),
  'neither Blind Date participant can be claimed into a second session'
);
select is(
  (
    select count(*)
    from public.blind_date_queue
    where user_id in (
      '90000000-0000-0000-0000-000000000010',
      '90000000-0000-0000-0000-000000000011'
    )
      and status = 'matched'
  ),
  2::bigint,
  'both claimed queue records transition to matched'
);

select set_config(
  'request.jwt.claim.sub',
  '90000000-0000-0000-0000-000000000012',
  true
);
create temporary table br_blind_third as
select * from public.find_blind_date_partner_atomic('Masked Twelve');

select ok(
  (select waiting from br_blind_third)
    and (select session_id from br_blind_third) is null,
  'a third participant cannot claim either already-paired user'
);
select throws_ok(
  $$
    update public.blind_date_queue
    set status = 'waiting'
    where user_id = '90000000-0000-0000-0000-000000000010'
  $$,
  '23514',
  'A Blind Date participant with an existing session cannot rejoin the queue',
  'the queue invariant rejects a paired user returning to waiting'
);

-- Reveal is an atomic JSON merge: retries preserve the first request, and only
-- the second distinct participant reveals identities and the official match.
select set_config(
  'request.jwt.claim.sub',
  '90000000-0000-0000-0000-000000000010',
  true
);
create temporary table br_reveal_first as
select *
from public.request_reveal_atomic((select session_id from br_blind_pair));

select ok(
  not (select accepted from br_reveal_first)
    and not (select is_revealed from br_reveal_first)
    and (select requested_by_me from br_reveal_first)
    and not (select requested_by_partner from br_reveal_first)
    and (select partner_id from br_reveal_first) is null,
  'the first reveal request records consent without exposing identity'
);

create temporary table br_reveal_first_retry as
select *
from public.request_reveal_atomic((select session_id from br_blind_pair));

select ok(
  not (select accepted from br_reveal_first_retry)
    and (
      select count(*) = 1
      from public.blind_date_sessions s
      cross join lateral jsonb_object_keys(s.reveal_requests) request_key
      where s.id = (select session_id from br_blind_pair)
    ),
  'repeating one participant reveal remains a single consent key'
);

select set_config(
  'request.jwt.claim.sub',
  '90000000-0000-0000-0000-000000000011',
  true
);
create temporary table br_reveal_second as
select *
from public.request_reveal_atomic((select session_id from br_blind_pair));

select ok(
  (select accepted from br_reveal_second)
    and (select is_revealed from br_reveal_second)
    and (select requested_by_me from br_reveal_second)
    and (select requested_by_partner from br_reveal_second)
    and (select partner_id from br_reveal_second)
      = '90000000-0000-0000-0000-000000000010',
  'the reciprocal reveal atomically exposes only the partner identity'
);
select ok(
  exists (
    select 1
    from public.blind_date_sessions s
    where s.id = (select session_id from br_blind_pair)
      and s.is_revealed
      and (
        select count(*) from jsonb_object_keys(s.reveal_requests)
      ) = 2
  ),
  'the revealed session retains both consent keys without lost updates'
);
select ok(
  (
    select count(*) = 1
    from public.matches
    where pair_key = public.pair_key_for(
      '90000000-0000-0000-0000-000000000010',
      '90000000-0000-0000-0000-000000000011'
    )
      and source = 'blind-date'
      and is_revealed
  ) and exists (
    select 1
    from public.conversations c
    where c.id = (select conversation_id from br_blind_pair)
      and not c.is_anonymous
      and c.pair_key = public.pair_key_for(
        '90000000-0000-0000-0000-000000000010',
        '90000000-0000-0000-0000-000000000011'
      )
  ),
  'mutual reveal creates one revealed match and de-anonymizes its conversation'
);

set local role authenticated;
select lives_ok(
  $$
    insert into public.messages(conversation_id, sender_id, content)
    values (
      current_setting('flove.test_conversation_id'),
      auth.uid(),
      'revealed legacy direct message'
    )
  $$,
  'a revealed participant can use the one-release direct-message adapter'
);
select throws_like(
  $$
    insert into public.messages(
      conversation_id, sender_id, content, client_message_id
    ) values (
      current_setting('flove.test_conversation_id'),
      auth.uid(),
      'idempotency keys are RPC-only',
      'legacy-direct-key'
    )
  $$,
  '%row-level security policy for table "messages"%',
  'the compatibility policy rejects direct inserts with an idempotency key'
);
reset role;

select ok(
  exists (
    select 1
    from public.messages message
    where message.conversation_id = (select conversation_id from br_blind_pair)
      and message.sender_id = '90000000-0000-0000-0000-000000000011'
      and message.content = 'revealed legacy direct message'
      and message.client_message_id is null
  )
    and exists (
      select 1
      from public.conversations conversation
      where conversation.id = (select conversation_id from br_blind_pair)
        and conversation.last_message ->> 'content' = 'revealed legacy direct message'
    )
    and exists (
      select 1
      from public.conversation_participants participant
      where participant.conversation_id = (select conversation_id from br_blind_pair)
        and participant.user_id = '90000000-0000-0000-0000-000000000010'
        and participant.unread_count = 1
    ),
  'the legacy compatibility trigger updates summary and unread state atomically'
);

create temporary table br_reveal_second_retry as
select *
from public.request_reveal_atomic((select session_id from br_blind_pair));

select ok(
  (select accepted from br_reveal_second_retry)
    and (
      select count(*) = 1
      from public.matches
      where pair_key = public.pair_key_for(
        '90000000-0000-0000-0000-000000000010',
        '90000000-0000-0000-0000-000000000011'
      )
    )
    and (
      select count(*) = 2
      from public.blind_date_sessions s
      cross join lateral jsonb_object_keys(s.reveal_requests) request_key
      where s.id = (select session_id from br_blind_pair)
    ),
  'repeating mutual reveal cannot duplicate the match or consent state'
);

-- Read receipts reset only the caller's unread counter and only mark messages
-- authored by the counterpart. The second call is an idempotent no-op.
select set_config(
  'request.jwt.claim.sub',
  '90000000-0000-0000-0000-000000000010',
  true
);
create temporary table br_read_own_message as
select *
from public.send_message_atomic(
  (select conversation_id from br_blind_pair),
  'caller own unread message',
  'behavior-read-own-message',
  '90000000-0000-0000-0000-000000000010'
);

create temporary table br_mark_read_first as
select *
from public.mark_conversation_read((select conversation_id from br_blind_pair));

select ok(
  (select applied from br_mark_read_first)
    and (select unread_count from br_mark_read_first) = 0
    and (select marked_read_count from br_mark_read_first) = 1
    and exists (
      select 1
      from public.conversation_participants participant
      where participant.conversation_id = (select conversation_id from br_blind_pair)
        and participant.user_id = '90000000-0000-0000-0000-000000000010'
        and participant.unread_count = 0
    )
    and exists (
      select 1 from public.messages message
      where message.conversation_id = (select conversation_id from br_blind_pair)
        and message.sender_id = '90000000-0000-0000-0000-000000000011'
        and message.is_read
    )
    and exists (
      select 1 from public.messages message
      where message.id = (select message_id from br_read_own_message)
        and message.sender_id = '90000000-0000-0000-0000-000000000010'
        and not message.is_read
    ),
  'mark read resets caller state and never marks the caller own messages'
);

create temporary table br_mark_read_retry as
select *
from public.mark_conversation_read((select conversation_id from br_blind_pair));

select ok(
  not (select applied from br_mark_read_retry)
    and (select marked_read_count from br_mark_read_retry) = 0,
  'repeating mark read is an idempotent no-op'
);

select set_config(
  'request.jwt.claim.sub',
  '90000000-0000-0000-0000-000000000012',
  true
);
select throws_ok(
  format(
    'select * from public.mark_conversation_read(%L)',
    (select conversation_id from br_blind_pair)
  ),
  '42501',
  'Conversation access denied',
  'a non-participant cannot mark a conversation read'
);

-- Confirmation returns a client-safe JSON projection. Populate real vectors
-- first so this catches accidental serialization of private embedding columns,
-- not merely omission of null values.
update public.profiles
set self_vector = array_fill(0.01::real, array[1536])::vector(1536),
    need_vector = array_fill(0.01::real, array[1536])::vector(1536),
    preference_vector = array_fill(0.01::real, array[1536])::vector(1536),
    communication_vector = array_fill(0.01::real, array[1536])::vector(1536),
    lifestyle_vector = array_fill(0.01::real, array[1536])::vector(1536),
    embedding_revision = profile_revision,
    embedding_status = 'ready',
    embedding_updated_at = now()
where id = '90000000-0000-0000-0000-000000000013';

insert into public.onboarding_drafts(
  user_id, draft, draft_revision, analysis, analysis_revision,
  analysis_source, onboarding_version
) values (
  '90000000-0000-0000-0000-000000000013',
  '{"answers":[]}'::jsonb,
  1,
  '{"summary":"server canonical analysis"}'::jsonb,
  1,
  'fallback',
  2
);

create temporary table br_confirm_response as
select to_jsonb(public.confirm_onboarding_profile_atomic(
  '90000000-0000-0000-0000-000000000013',
  1,
  1,
  jsonb_build_object(
    'email', 'backend-test-13@fpt.edu.vn',
    'name', 'Confirmed Safe Profile',
    'age', 21,
    'major', 'SE',
    'campus', 'HCM',
    'gender', 'prefer_not_to_show',
    'looking_for_gender', '[]'::jsonb,
    'bio', 'A confirmed client-safe profile.',
    'interests', '["coffee","music","testing"]'::jsonb,
    'personality_tags', '["curious"]'::jsonb,
    'dating_goals', '["slow connection"]'::jsonb,
    'preferred_vibes', '["clear communication"]'::jsonb,
    'profile_text', '{"bio":"A confirmed client-safe profile."}'::jsonb,
    'ai_profile_analysis', '{"matchingSignals":{"selfTraits":["curious"]}}'::jsonb,
    'onboarding_answers', '[]'::jsonb,
    'onboarding_version', 2,
    'profile_completeness', 100
  )
)) as profile;

select ok(
  exists (
    select 1
    from br_confirm_response
    where jsonb_typeof(profile) = 'object'
      and not profile ?| array[
        'self_vector', 'need_vector', 'preference_vector',
        'communication_vector', 'lifestyle_vector'
      ]
  ),
  'confirmation returns JSON without any private embedding keys'
);

-- A worker cannot steal a fresh in-flight embedding claim, but the same
-- revision becomes reclaimable when processing has exceeded its lease.
create temporary table br_embedding_revision as
select profile_revision
from public.profiles
where id = '90000000-0000-0000-0000-000000000013';

update public.profiles
set embedding_status = 'processing',
    embedding_updated_at = now()
where id = '90000000-0000-0000-0000-000000000013';

select is(
  public.mark_profile_embedding_processing(
    '90000000-0000-0000-0000-000000000013',
    (select profile_revision from br_embedding_revision)
  ),
  false,
  'a fresh processing embedding claim cannot be reclaimed'
);

update public.profiles
set embedding_updated_at = now() - interval '1 hour'
where id = '90000000-0000-0000-0000-000000000013';

create temporary table br_embedding_stale_claim as
select public.mark_profile_embedding_processing(
  '90000000-0000-0000-0000-000000000013',
  (select profile_revision from br_embedding_revision)
) as claimed;

select ok(
  (select claimed from br_embedding_stale_claim)
    and exists (
      select 1
      from public.profiles
      where id = '90000000-0000-0000-0000-000000000013'
        and embedding_status = 'processing'
        and embedding_updated_at > now() - interval '1 minute'
    ),
  'a stale processing embedding claim is reclaimed at the same revision'
);

-- Request idempotency is bound to the original user content. Reusing a key for
-- a different prompt must fail instead of returning another turn's response.
select set_config(
  'request.jwt.claim.sub',
  '90000000-0000-0000-0000-000000000013',
  true
);
create temporary table br_preference_first as
select *
from public.save_preference_chat_turn_atomic(
  'I prefer calm weekend plans.',
  array['calm', 'weekend'],
  'I will prioritize calm weekend compatibility.',
  'behavior-preference-request'
);

select ok(
  (select applied from br_preference_first),
  'the first preference request is applied'
);

create temporary table br_preference_conflict(
  returned_sqlstate text,
  returned_message text
);
do $$
declare
  v_state text;
  v_message text;
begin
  perform *
  from public.save_preference_chat_turn_atomic(
    'I now prefer loud late-night parties.',
    array['nightlife'],
    'I will prioritize nightlife compatibility.',
    'behavior-preference-request'
  );
  insert into br_preference_conflict values (null, null);
exception when others then
  get stacked diagnostics
    v_state = returned_sqlstate,
    v_message = message_text;
  insert into br_preference_conflict values (v_state, v_message);
end;
$$;

select is(
  (select returned_sqlstate from br_preference_conflict),
  '22023',
  'reusing a preference request id with different user content is rejected'
);
select is(
  (
    select count(*)
    from public.preference_chat_messages
    where user_id = '90000000-0000-0000-0000-000000000013'
      and client_request_id = 'behavior-preference-request'
  ),
  2::bigint,
  'a conflicting preference retry cannot append or replace transcript rows'
);

-- Cached rows are revalidated against live blocks and moderation. If every
-- still-pending row becomes unsafe, the claim deletes it and reclaims the now
-- empty ready batch instead of serving an unsafe card forever.
create temporary table br_unsafe_claim as
select *
from public.claim_daily_match_batch(
  '90000000-0000-0000-0000-000000000014',
  'behavior-v2',
  120
);

select *
from public.finalize_daily_match_batch(
  (select batch_id from br_unsafe_claim),
  '90000000-0000-0000-0000-000000000014',
  (select claim_token from br_unsafe_claim),
  jsonb_build_array(jsonb_build_object(
    'candidate_id', '90000000-0000-0000-0000-000000000015',
    'candidate_snapshot', '{}'::jsonb,
    'ai_reason', 'pending card that later becomes blocked',
    'compatibility_label', 'Good',
    'compatibility_score', 72
  )),
  'behavior-v2', null, 900, 1, 5
);

insert into public.blocks(blocker_id, blocked_user_id, reason)
values (
  '90000000-0000-0000-0000-000000000015',
  '90000000-0000-0000-0000-000000000014',
  'behavior live-safety test'
);

create temporary table br_unsafe_reclaim as
select *
from public.claim_daily_match_batch(
  '90000000-0000-0000-0000-000000000014',
  'behavior-v2',
  120
);

select ok(
  (select result from br_unsafe_reclaim) = 'claimed'
    and (select attempt_count from br_unsafe_reclaim) = 2
    and (select claim_token from br_unsafe_reclaim) is not null
    and not exists (
      select 1 from public.curated_matches
      where batch_id = (select batch_id from br_unsafe_claim)
    )
    and exists (
      select 1 from public.daily_match_batches
      where id = (select batch_id from br_unsafe_claim)
        and status = 'generating'
        and target_count = 5
    ),
  'claim removes newly unsafe pending rows and reclaims a zero-row ready batch'
);

-- A candidate profile deletion cascades its pending row. The next claim must
-- likewise reclaim the zero-row batch rather than returning a cached orphan.
create temporary table br_cascade_claim as
select *
from public.claim_daily_match_batch(
  '90000000-0000-0000-0000-000000000016',
  'behavior-v2',
  120
);

select *
from public.finalize_daily_match_batch(
  (select batch_id from br_cascade_claim),
  '90000000-0000-0000-0000-000000000016',
  (select claim_token from br_cascade_claim),
  jsonb_build_array(jsonb_build_object(
    'candidate_id', '90000000-0000-0000-0000-000000000017',
    'candidate_snapshot', '{}'::jsonb,
    'ai_reason', 'candidate that will be deleted',
    'compatibility_label', 'Good',
    'compatibility_score', 71
  )),
  'behavior-v2', null, 900, 1, 5
);

delete from public.profiles
where id = '90000000-0000-0000-0000-000000000017';

create temporary table br_cascade_reclaim as
select *
from public.claim_daily_match_batch(
  '90000000-0000-0000-0000-000000000016',
  'behavior-v2',
  120
);

select ok(
  (select result from br_cascade_reclaim) = 'claimed'
    and (select attempt_count from br_cascade_reclaim) = 2
    and (select claim_token from br_cascade_reclaim) is not null
    and not exists (
      select 1 from public.curated_matches
      where batch_id = (select batch_id from br_cascade_claim)
    ),
  'claim reclaims a ready batch whose last row was cascade-deleted'
);

-- Decisions are durable history. Live invalidation may hide a decided pair,
-- but a subsequent claim must preserve both the row and its ready parent.
create temporary table br_decided_safety_claim as
select *
from public.claim_daily_match_batch(
  '90000000-0000-0000-0000-000000000018',
  'behavior-v2',
  120
);

select *
from public.finalize_daily_match_batch(
  (select batch_id from br_decided_safety_claim),
  '90000000-0000-0000-0000-000000000018',
  (select claim_token from br_decided_safety_claim),
  jsonb_build_array(jsonb_build_object(
    'candidate_id', '90000000-0000-0000-0000-000000000019',
    'candidate_snapshot', '{}'::jsonb,
    'ai_reason', 'decision durability card',
    'compatibility_label', 'Good',
    'compatibility_score', 70
  )),
  'behavior-v2', null, 900, 1, 5
);

select set_config(
  'request.jwt.claim.sub',
  '90000000-0000-0000-0000-000000000018',
  true
);

select *
from public.submit_match_feedback_atomic(
  (select batch_id from br_decided_safety_claim)
    || '_90000000-0000-0000-0000-000000000019',
  'declined',
  'behavior-decided-safety',
  '{}'::text[],
  ''
);

insert into public.blocks(blocker_id, blocked_user_id, reason)
values (
  '90000000-0000-0000-0000-000000000018',
  '90000000-0000-0000-0000-000000000019',
  'behavior preserve decision test'
);

create temporary table br_decided_safety_reload as
select *
from public.claim_daily_match_batch(
  '90000000-0000-0000-0000-000000000018',
  'behavior-v2',
  120
);

select ok(
  (select result from br_decided_safety_reload) = 'cached'
    and exists (
      select 1
      from public.curated_matches match
      join public.daily_match_batches batch on batch.id = match.batch_id
      where match.id = (select batch_id from br_decided_safety_claim)
          || '_90000000-0000-0000-0000-000000000019'
        and match.status = 'declined'
        and batch.status = 'ready'
        and batch.claim_token is null
    ),
  'live invalidation preserves decided rows and repairs their batch to ready'
);

-- The service reader exposes only currently eligible pending cards. Acceptance
-- rechecks the same predicate after locking, closing the block-after-read race.
create temporary table br_accept_safety_claim as
select *
from public.claim_daily_match_batch(
  '90000000-0000-0000-0000-000000000020',
  'behavior-v2',
  120
);

select *
from public.finalize_daily_match_batch(
  (select batch_id from br_accept_safety_claim),
  '90000000-0000-0000-0000-000000000020',
  (select claim_token from br_accept_safety_claim),
  jsonb_build_array(jsonb_build_object(
    'candidate_id', '90000000-0000-0000-0000-000000000021',
    'candidate_snapshot', '{}'::jsonb,
    'ai_reason', 'accept TOCTOU card',
    'compatibility_label', 'Great',
    'compatibility_score', 84
  )),
  'behavior-v2', null, 900, 1, 5
);

create temporary table br_live_rows_before as
select *
from public.get_daily_match_rows_v2(
  '90000000-0000-0000-0000-000000000020',
  (select batch_id from br_accept_safety_claim)
);

insert into public.blocks(blocker_id, blocked_user_id, reason)
values (
  '90000000-0000-0000-0000-000000000021',
  '90000000-0000-0000-0000-000000000020',
  'behavior accept TOCTOU test'
);

select ok(
  (select count(*) from br_live_rows_before) = 1
    and not exists (
      select 1
      from public.get_daily_match_rows_v2(
        '90000000-0000-0000-0000-000000000020',
        (select batch_id from br_accept_safety_claim)
      )
    )
    and not public.match_pair_live_eligible(
      '90000000-0000-0000-0000-000000000020',
      '90000000-0000-0000-0000-000000000021'
    ),
  'live daily reader drops a pending card immediately after either side blocks'
);

select set_config(
  'request.jwt.claim.sub',
  '90000000-0000-0000-0000-000000000020',
  true
);

create temporary table br_accept_after_block_error(
  returned_sqlstate text
);
do $$
declare
  v_state text;
begin
  perform *
  from public.submit_match_feedback_atomic(
    (select batch_id from br_accept_safety_claim)
      || '_90000000-0000-0000-0000-000000000021',
    'accepted',
    'behavior-accept-after-block',
    '{}'::text[],
    ''
  );
  insert into br_accept_after_block_error values (null);
exception when others then
  get stacked diagnostics v_state = returned_sqlstate;
  insert into br_accept_after_block_error values (v_state);
end;
$$;

select ok(
  (select returned_sqlstate from br_accept_after_block_error) = '42501'
    and not exists (
      select 1 from public.match_feedback
      where user_id = '90000000-0000-0000-0000-000000000020'
        and idempotency_key = 'behavior-accept-after-block'
    )
    and not exists (
      select 1 from public.matches
      where pair_key = public.pair_key_for(
        '90000000-0000-0000-0000-000000000020',
        '90000000-0000-0000-0000-000000000021'
      )
    )
    and exists (
      select 1 from public.curated_matches
      where id = (select batch_id from br_accept_safety_claim)
          || '_90000000-0000-0000-0000-000000000021'
        and status = 'pending'
    ),
  'accept after a block is rejected without feedback or an official match'
);

-- Cross-user profile reads expose only confirmed, complete, currently safe
-- profiles. A normal eligible profile remains visible through the same view.
update public.profiles
set profile_confirmed = false
where id = '90000000-0000-0000-0000-000000000022';

update public.profiles
set name = '',
    age = 16,
    bio = '',
    interests = '{}'::text[],
    personality_tags = '{}'::text[],
    dating_goals = '{}'::text[],
    profile_text = '{}'::jsonb,
    ai_profile_analysis = '{}'::jsonb,
    ai_signals = '{}'::jsonb
where id = '90000000-0000-0000-0000-000000000023';

insert into public.user_safety_actions(user_id, action, status, reason)
values
  (
    '90000000-0000-0000-0000-000000000024',
    'suspension',
    'active',
    'behavior public view suspension'
  ),
  (
    '90000000-0000-0000-0000-000000000025',
    'ban',
    'active',
    'behavior public view ban'
  );

select ok(
  exists (
    select 1 from public.public_profiles
    where id = '90000000-0000-0000-0000-000000000026'
  )
    and not exists (
      select 1 from public.public_profiles
      where id = any(array[
        '90000000-0000-0000-0000-000000000022'::uuid,
        '90000000-0000-0000-0000-000000000023'::uuid,
        '90000000-0000-0000-0000-000000000024'::uuid,
        '90000000-0000-0000-0000-000000000025'::uuid
      ])
    ),
  'public profile view excludes unready and actively suspended or banned users'
);

-- The live predicate is executable by authenticated because curated-match RLS
-- calls it. Its viewer argument is nevertheless bound to the JWT subject so it
-- cannot be used to probe safety/consent state between arbitrary third parties.
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claim.sub',
  '90000000-0000-0000-0000-000000000026',
  true
);
create temporary table br_live_pair_own as
select public.match_pair_live_eligible(
  '90000000-0000-0000-0000-000000000026',
  '90000000-0000-0000-0000-000000000001'
) as eligible;

select set_config(
  'request.jwt.claim.sub',
  '90000000-0000-0000-0000-000000000020',
  true
);

select ok(
  (select eligible from br_live_pair_own)
    and not public.match_pair_live_eligible(
      '90000000-0000-0000-0000-000000000026',
      '90000000-0000-0000-0000-000000000001'
    ),
  'authenticated live-pair checks are bound to the JWT subject'
);

-- The one-release direct profile compatibility path normalizes bounded fields
-- before revision/completeness/embedding triggers observe them.
select set_config(
  'request.jwt.claim.sub',
  '90000000-0000-0000-0000-000000000026',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.email', 'backend-test-26@fpt.edu.vn', true);
select set_config('request.jwt.claim.iss', 'https://project.supabase.co/auth/v1', true);

set local role authenticated;
select lives_ok(
  $$
    update public.profiles
    set email = 'spoofed-but-fpt@fpt.edu.vn',
        name = '  Released Valid User  ',
        avatar_url = 'https://project.supabase.co/storage/v1/object/public/avatars/90000000-0000-0000-0000-000000000026/avatar.jpg',
        bio = 'fallback released bio',
        interests = array['Coffee', ' coffee ', 'Music', 'Testing'],
        personality_tags = array['Curious', ' curious '],
        dating_goals = array['Slow connection'],
        preferred_vibes = array['Clear communication'],
        profile_text = '{"bio":" Canonical released bio ","school":"FPT HCM","majorLabel":"SE"}'::jsonb,
        profile_completeness = 1,
        ai_signals = '{"client":"must not win"}'::jsonb,
        onboarding_source = 'sample_autofill'
    where id = '90000000-0000-0000-0000-000000000026'
  $$,
  'the released valid direct profile payload remains compatible'
);
reset role;

select ok(
  exists (
    select 1 from public.profiles profile
    where profile.id = '90000000-0000-0000-0000-000000000026'
      and profile.email = 'backend-test-26@fpt.edu.vn'
      and profile.name = 'Released Valid User'
      and profile.bio = 'Canonical released bio'
      and profile.interests = array['Coffee', 'Music', 'Testing']
      and profile.personality_tags = array['Curious']
      and profile.ai_signals = '{}'::jsonb
      and profile.onboarding_source = 'manual'
      and profile.profile_text ->> 'school' = 'FPT HCM'
      and profile.profile_text ->> 'majorLabel' = 'SE'
  ),
  'direct profile normalization canonicalizes email, text, arrays and legacy system fields'
);

set local role authenticated;
update public.profiles
set name = repeat('n', 500),
    bio = 'ignored in favor of profile_text',
    interests = array[repeat('X', 500), repeat('x', 500), 'Keep'],
    profile_text = jsonb_build_object(
      'bio', repeat('b', 5000),
      'school', repeat('s', 500)
    )
where id = '90000000-0000-0000-0000-000000000026';
reset role;

select ok(
  exists (
    select 1 from public.profiles profile
    where profile.id = '90000000-0000-0000-0000-000000000026'
      and char_length(profile.name) = 120
      and char_length(profile.bio) = 4000
      and cardinality(profile.interests) = 2
      and char_length(profile.interests[1]) = 200
      and profile.interests[2] = 'Keep'
      and char_length(profile.profile_text ->> 'school') = 200
  ),
  'moderate profile overages are clamped and case-insensitive duplicates collapse'
);

set local role authenticated;
select throws_ok(
  $$
    update public.profiles
    set avatar_url = 'https://evil.example/storage/v1/object/public/avatars/90000000-0000-0000-0000-000000000026/avatar.jpg'
    where id = '90000000-0000-0000-0000-000000000026'
  $$,
  '22023',
  'avatar_url must reference the caller avatar object',
  'direct profiles reject an external avatar origin even with a mimicked owner path'
);
select throws_ok(
  $$
    update public.profiles
    set bio = repeat('x', 2097152)
    where id = '90000000-0000-0000-0000-000000000026'
  $$,
  '22023',
  'Profile payload is too large or malformed',
  'multi-megabyte direct profile text is rejected before downstream triggers'
);
select throws_ok(
  $$
    update public.profiles
    set profile_text = '{"bio":"safe","admin":"not allowed"}'::jsonb
    where id = '90000000-0000-0000-0000-000000000026'
  $$,
  '22023',
  'profile_text contains unsupported fields',
  'profile_text rejects unknown keys'
);
select throws_ok(
  $$
    update public.profiles
    set interests = array(select 'item-' || value from generate_series(1, 101) value)
    where id = '90000000-0000-0000-0000-000000000026'
  $$,
  '22023',
  'Profile array payload is too large',
  'direct profile arrays reject pathological item counts'
);
reset role;

-- Only the latest pending embedding revision remains queued after rapid edits.
create temporary table br_profile_26_jobs as
select *
from public.read_ai_jobs(100, 60)
where message ->> 'type' = 'profile_embedding'
  and message ->> 'userId' = '90000000-0000-0000-0000-000000000026';

select ok(
  (select count(*) from br_profile_26_jobs) = 1
    and (
      select (message ->> 'profileRevision')::bigint
      from br_profile_26_jobs
    ) = (
      select profile_revision from public.profiles
      where id = '90000000-0000-0000-0000-000000000026'
    )
    and (
      select count(*) = 1
      from public.ai_job_registry registry
      where registry.idempotency_key like
        'profile_embedding:90000000-0000-0000-0000-000000000026:%'
        and registry.status = 'queued'
    )
    and exists (
      select 1 from public.ai_job_registry registry
      where registry.idempotency_key like
        'profile_embedding:90000000-0000-0000-0000-000000000026:%'
        and registry.status = 'completed'
    ),
  'embedding queue coalesces stale profile revisions into one latest FIFO job'
);

-- Open signup accepts any plausible verified email. Identity-bearing discovery
-- is no longer directly enumerable; server DTOs remain the only cross-user path.
set local role authenticated;
select throws_like(
  $$ select count(*) from public.public_profiles $$,
  '%permission denied%',
  'authenticated clients cannot enumerate the internal public profile view'
);
select lives_ok(
  $$
    insert into storage.objects(bucket_id, name, owner)
    values (
      'avatars',
      '90000000-0000-0000-0000-000000000026/avatar.jpg',
      '90000000-0000-0000-0000-000000000026'
    )
  $$,
  'an authenticated owner can write an owner-scoped avatar object'
);
reset role;

update auth.users
set email = 'outsider@example.com'
where id = '90000000-0000-0000-0000-000000000027';

select set_config(
  'request.jwt.claim.sub',
  '90000000-0000-0000-0000-000000000027',
  true
);
select set_config('request.jwt.claim.email', 'outsider@example.com', true);

set local role authenticated;
select lives_ok(
  $$
    update public.profiles
    set name = 'Open signup profile update'
    where id = '90000000-0000-0000-0000-000000000027'
  $$,
  'a verified non-FPT account can update its own profile'
);
select throws_like(
  $$ select count(*) from public.public_profiles $$,
  '%permission denied%',
  'open signup does not reopen direct cross-user profile enumeration'
);
select lives_ok(
  $$
    insert into storage.objects(bucket_id, name, owner)
    values (
      'avatars',
      '90000000-0000-0000-0000-000000000027/avatar.jpg',
      '90000000-0000-0000-0000-000000000027'
    )
  $$,
  'a verified non-FPT owner can upload an owner-scoped avatar object'
);
reset role;

insert into public.conversations(id, is_anonymous)
values ('behavior-non-fpt-compatibility', false);
insert into public.conversation_participants(conversation_id, user_id)
values
  ('behavior-non-fpt-compatibility', '90000000-0000-0000-0000-000000000026'),
  ('behavior-non-fpt-compatibility', '90000000-0000-0000-0000-000000000027');
insert into public.messages(conversation_id, sender_id, content)
values (
  'behavior-non-fpt-compatibility',
  '90000000-0000-0000-0000-000000000026',
  'FPT-authored compatibility fixture'
);

-- The historical admission helper name remains, but it now fences a verified
-- authenticated user rather than an email domain.
set local role authenticated;
select is(
  (select count(*) from public.messages
   where conversation_id = 'behavior-non-fpt-compatibility'),
  1::bigint,
  'a non-FPT participant can use the revealed-message compatibility read'
);
select lives_ok(
  $$
    insert into public.messages(conversation_id, sender_id, content)
    values (
      'behavior-non-fpt-compatibility', auth.uid(), 'open signup message'
    )
  $$,
  'a non-FPT participant can use the revealed-message compatibility write'
);
select lives_ok(
  $$
    insert into public.reports(reporter_id, reported_user_id, reason)
    values (
      auth.uid(), '90000000-0000-0000-0000-000000000026', 'open signup report'
    )
  $$,
  'a non-FPT account can create an owner-scoped report'
);
select lives_ok(
  $$
    insert into public.blocks(blocker_id, blocked_user_id, reason)
    values (
      auth.uid(), '90000000-0000-0000-0000-000000000026', 'open signup block'
    )
  $$,
  'a non-FPT account can create an owner-scoped block'
);
select is(
  private.assert_fpt_self_admission(),
  '90000000-0000-0000-0000-000000000027'::uuid,
  'the canonical admission helper accepts a verified non-FPT account'
);
select throws_ok(
  $$
    select * from public.submit_match_feedback_atomic(
      'missing-match', 'skipped', 'legacy-non-fpt-feedback', '{}'::text[], ''
    )
  $$,
  'P0002',
  'Curated match not found',
  'a non-FPT account reaches normal feedback validation after admission'
);
select lives_ok(
  $$ select * from public.find_blind_date_partner_atomic('Legacy outsider') $$,
  'a non-FPT account can invoke Blind Date RPCs'
);
select throws_ok(
  $$
    select * from public.send_message_atomic(
      'missing-conversation', 'hello', 'legacy-non-fpt-message', auth.uid()
    )
  $$,
  '42501',
  'Conversation access denied',
  'a non-FPT account reaches normal participant validation in message RPCs'
);
select throws_like(
  $$
    select * from public.save_preference_chat_turn_atomic(
      'hello', '{}'::text[], 'reply', 'legacy-non-fpt-preference'
    )
  $$,
  '%permission denied%',
  'the legacy caller-authored preference assistant RPC is unavailable to every client'
);
reset role;

-- Trusted service workers retain the repair/backfill path for legacy rows;
-- the exact-domain trigger applies only to direct authenticated writes.
select set_config('request.jwt.claim.role', 'service_role', true);
set local role service_role;
update public.profiles
set name = 'Service repair allowed'
where id = '90000000-0000-0000-0000-000000000027';
reset role;
select is(
  (select name from public.profiles
   where id = '90000000-0000-0000-0000-000000000027'),
  'Service repair allowed',
  'service-role workers can repair a legacy non-FPT profile'
);
select set_config('request.jwt.claim.role', 'authenticated', true);

update auth.users
set email = 'new-outsider@example.com'
where id = '90000000-0000-0000-0000-000000000028';
delete from public.profiles
where id = '90000000-0000-0000-0000-000000000028';
select set_config(
  'request.jwt.claim.sub',
  '90000000-0000-0000-0000-000000000028',
  true
);
select set_config('request.jwt.claim.email', 'new-outsider@example.com', true);

set local role authenticated;
select lives_ok(
  $$
    insert into public.profiles(id, email, name, age, major, campus)
    values (
      '90000000-0000-0000-0000-000000000028',
      'new-outsider@example.com',
      'Outsider',
      21,
      'SE',
      'HCM'
    )
  $$,
  'a verified non-FPT authenticated account can create its own profile'
);
reset role;

-- A current v2 payload (including the legacy adapter projection) persists, but
-- malformed/missing/duplicate/oversized answers never reach analysis storage.
select set_config(
  'request.jwt.claim.sub',
  '90000000-0000-0000-0000-000000000026',
  true
);
select set_config('request.jwt.claim.email', 'backend-test-26@fpt.edu.vn', true);

create temporary table br_valid_draft_payload as
select jsonb_build_object(
  'version', 2,
  'step', 6,
  'basic', jsonb_build_object(
    'name', 'Released Valid User',
    'age', 21,
    'gender', 'prefer_not_to_show',
    'genderText', '',
    'lookingForGender', jsonb_build_array('everyone'),
    'heightCm', null,
    'school', 'FPT University',
    'majorLabel', 'Software Engineering',
    'major', 'SE',
    'campus', 'HCM',
    'avatarUrl', '',
    'agePrefMin', null,
    'agePrefMax', null
  ),
  'answers', jsonb_build_array(
    jsonb_build_object('questionId', 'need_chips', 'value', jsonb_build_array('Mối quan hệ nghiêm túc')),
    jsonb_build_object('questionId', 'need_text', 'value', 'Tìm hiểu chậm rãi.'),
    jsonb_build_object('questionId', 'self_chips', 'value', jsonb_build_array('Curious')),
    jsonb_build_object('questionId', 'self_text', 'value', 'Mình thích cà phê và những cuộc trò chuyện sâu.'),
    jsonb_build_object('questionId', 'attraction_text', 'value', 'Mình thích người tử tế và chủ động.'),
    jsonb_build_object('questionId', 'appearance_importance', 'value', 'none'),
    jsonb_build_object('questionId', 'appearance_specifics', 'value', ''),
    jsonb_build_object('questionId', 'communication_text', 'value', 'Mình thích giao tiếp rõ ràng.'),
    jsonb_build_object('questionId', 'boundaries_chips', 'value', jsonb_build_array('Tôn trọng')),
    jsonb_build_object('questionId', 'boundaries_text', 'value', ''),
    jsonb_build_object('questionId', 'boundaries_unsure', 'value', 'true')
  )
) as draft;

create temporary table br_valid_draft_saved as
select *
from public.save_onboarding_draft(
  (select draft from br_valid_draft_payload),
  null,
  2,
  '90000000-0000-0000-0000-000000000026'
);

select ok(
  (select draft_revision from br_valid_draft_saved) = 1
    and (select draft from br_valid_draft_saved) = (select draft from br_valid_draft_payload),
  'a valid released/legacy-normalized onboarding v2 draft still persists'
);

create temporary table br_invalid_draft_results(
  case_name text,
  returned_sqlstate text
);
do $$
declare
  v_valid jsonb := (select draft from br_valid_draft_payload);
  v_items jsonb;
  v_state text;
begin
  begin
    perform public.save_onboarding_draft(v_valid - 'basic', 1, 2, auth.uid());
    insert into br_invalid_draft_results values ('missing_basic', null);
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate;
    insert into br_invalid_draft_results values ('missing_basic', v_state);
  end;
  begin
    perform public.save_onboarding_draft(v_valid - 'answers', 1, 2, auth.uid());
    insert into br_invalid_draft_results values ('missing_answers', null);
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate;
    insert into br_invalid_draft_results values ('missing_answers', v_state);
  end;
  begin
    perform public.save_onboarding_draft(
      jsonb_set(v_valid, '{answers}', '[{"questionId":"unknown","value":"x"}]'::jsonb),
      1, 2, auth.uid()
    );
    insert into br_invalid_draft_results values ('unknown_question', null);
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate;
    insert into br_invalid_draft_results values ('unknown_question', v_state);
  end;
  begin
    perform public.save_onboarding_draft(
      jsonb_set(v_valid, '{answers}', '[{"questionId":"self_text","value":"a"},{"questionId":"self_text","value":"b"}]'::jsonb),
      1, 2, auth.uid()
    );
    insert into br_invalid_draft_results values ('duplicate_question', null);
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate;
    insert into br_invalid_draft_results values ('duplicate_question', v_state);
  end;
  begin
    perform public.save_onboarding_draft(
      jsonb_set(v_valid, '{answers}', jsonb_build_array(jsonb_build_object(
        'questionId', 'self_text', 'value', repeat('x', 4001)
      ))),
      1, 2, auth.uid()
    );
    insert into br_invalid_draft_results values ('answer_too_long', null);
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate;
    insert into br_invalid_draft_results values ('answer_too_long', v_state);
  end;
  select jsonb_agg(to_jsonb('chip-' || value)) into v_items
  from generate_series(1, 31) value;
  begin
    perform public.save_onboarding_draft(
      jsonb_set(v_valid, '{answers}', jsonb_build_array(jsonb_build_object(
        'questionId', 'need_chips', 'value', v_items
      ))),
      1, 2, auth.uid()
    );
    insert into br_invalid_draft_results values ('too_many_values', null);
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate;
    insert into br_invalid_draft_results values ('too_many_values', v_state);
  end;
  begin
    perform public.save_onboarding_draft(
      jsonb_set(v_valid, '{answers}', jsonb_build_array(jsonb_build_object(
        'questionId', 'self_text', 'value', repeat('x', 70000)
      ))),
      1, 2, auth.uid()
    );
    insert into br_invalid_draft_results values ('aggregate_too_large', null);
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate;
    insert into br_invalid_draft_results values ('aggregate_too_large', v_state);
  end;
end;
$$;

select ok(
  (select count(*) from br_invalid_draft_results) = 7
    and not exists (
      select 1 from br_invalid_draft_results
      where returned_sqlstate is distinct from '22023'
    )
    and exists (
      select 1 from public.onboarding_drafts
      where user_id = '90000000-0000-0000-0000-000000000026'
        and draft_revision = 1
        and draft = (select draft from br_valid_draft_payload)
    ),
  'draft validation rejects missing, unknown, duplicate and oversized input without mutation'
);

select set_config(
  'request.jwt.claim.sub',
  '90000000-0000-0000-0000-000000000026',
  true
);
select throws_ok(
  $$
    select *
    from public.submit_match_feedback_atomic(
      repeat('x', 241),
      'skipped',
      'oversized-match-id',
      '{}'::text[],
      ''
    )
  $$,
  '22023',
  'match_id is out of range',
  'feedback RPC rejects a pathological match identifier before lookup'
);

select is(
  public.before_user_created_require_fpt(jsonb_build_object(
    'user', jsonb_build_object('email', 'new.student@fpt.edu.vn')
  )),
  '{}'::jsonb,
  'Before User Created auth hook allows a plausible email'
);
select is(
  public.before_user_created_require_fpt(jsonb_build_object(
    'user', jsonb_build_object('email', 'outsider@example.com')
  )),
  '{}'::jsonb,
  'Before User Created auth hook allows a plausible non-FPT email'
);

select * from finish();

rollback;
