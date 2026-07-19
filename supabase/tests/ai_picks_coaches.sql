begin;

select plan(48);

insert into auth.users (
  id, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, role, aud
)
select
  ('91000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  case when n % 2 = 0
    then format('ai-product-%s@example.com', n)
    else format('ai-product-%s@fpt.edu.vn', n)
  end,
  crypt('backend-test-only', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('name', format('AI Product Test %s', n)),
  'authenticated',
  'authenticated'
from generate_series(1, 8) n;

insert into public.profiles (
  id, email, name, age, major, campus, bio, interests,
  personality_tags, dating_goals, preferred_vibes, profile_text,
  ai_profile_analysis, gender, looking_for_gender, profile_confirmed,
  profile_confirmed_at, onboarding_answers, onboarding_version
)
select
  account.id,
  account.email,
  account.raw_user_meta_data ->> 'name',
  case when account.id = '91000000-0000-0000-0000-000000000008'::uuid then 17 else 21 end,
  'SE',
  'HCM',
  'A bounded profile for AI product database tests.',
  array['coffee', 'music', 'testing'],
  array['curious'],
  array['slow connection'],
  array['clear communication'],
  '{"bio":"A bounded profile for AI product database tests."}'::jsonb,
  jsonb_build_object(
    'matchingSignals', jsonb_build_object('selfTraits', jsonb_build_array('curious')),
    'aiReview', jsonb_build_object(
      'selfSummary', 'Curious and calm.',
      'seekingSummary', 'A thoughtful relationship.',
      'idealMatchSummary', 'Kind and communicative.',
      'avoidSummary', 'Avoids disrespect.'
    )
  ),
  'prefer_not_to_show',
  '{}'::text[],
  true,
  now(),
  '[]'::jsonb,
  2
from auth.users account
where account.id::text like '91000000-0000-0000-0000-%';

insert into auth.users (
  id, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, role, aud
) values (
  '91000000-0000-0000-0000-000000000009', 'not-an-email',
  crypt('backend-test-only', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"name":"Invalid Email Test"}'::jsonb,
  'authenticated', 'authenticated'
);

select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '91000000-0000-0000-0000-000000000009', true);
select throws_ok(
  $$ select private.assert_fpt_self_admission() $$,
  '42501',
  'A valid verified email is required to access F-Love',
  'open signup still rejects an invalid canonical account email'
);
select set_config('request.jwt.claim.role', '', true);
select set_config('request.jwt.claim.sub', '', true);

select is(
  (select mode::text || ':' || price_vnd::text
   from public.ai_pick_product_config where singleton),
  'open:100000',
  'AI Picks product configuration defaults to open at 100000 VND'
);

select ok(
  (select count(*) = 4
   from information_schema.columns column_info
   where (column_info.table_schema, column_info.table_name, column_info.column_name) in (
     ('public', 'curated_matches', 'preview_id'),
     ('public', 'daily_match_batches', 'access_state'),
     ('public', 'preference_profiles', 'soft_avoidances'),
     ('public', 'ai_assistant_requests', 'provider_started_at')
   )),
  'access and preference memory columns exist'
);

select ok(
  not has_table_privilege('authenticated', 'public.curated_matches', 'SELECT')
    and not has_table_privilege('authenticated', 'public.public_profiles', 'SELECT'),
  'authenticated clients cannot enumerate curated matches or public profiles directly'
);

create temporary table ap_open_claim as
select * from public.claim_daily_match_batch(
  '91000000-0000-0000-0000-000000000001', 'ai-product-tests', 120
);

create temporary table ap_open_final as
select * from public.finalize_daily_match_batch(
  (select batch_id from ap_open_claim),
  '91000000-0000-0000-0000-000000000001',
  (select claim_token from ap_open_claim),
  '[
    {"candidate_id":"91000000-0000-0000-0000-000000000002","candidate_snapshot":{"name":"Open Two","age":21,"interests":["coffee"]},"ai_reason":"Reason two","compatibility_label":"Tiềm năng mạnh","compatibility_score":82},
    {"candidate_id":"91000000-0000-0000-0000-000000000003","candidate_snapshot":{"name":"Open Three","age":21,"interests":["music"]},"ai_reason":"Reason three","compatibility_label":"Đáng khám phá","compatibility_score":73}
  ]'::jsonb,
  'ai-product-tests', null, 900, 2, 10
);

select ok(
  exists (
    select 1 from public.daily_match_batches batch
    where batch.id = (select batch_id from ap_open_claim)
      and batch.access_state = 'unlocked'
      and batch.unlock_source = 'open'
      and batch.unlocked_at is not null
  ),
  'open mode assigns an unlocked entitlement inside finalize'
);

select is(
  (select count(*) from public.ai_pick_trial_claims
   where user_id = '91000000-0000-0000-0000-000000000001'),
  0::bigint,
  'open mode does not consume the trial'
);

select ok(
  (select count(*) = 2
     and bool_and(kind = 'revealed')
     and max(locked_count) = 0
   from public.get_daily_picks_safe(
     '91000000-0000-0000-0000-000000000001',
     (select batch_id from ap_open_claim)
   )),
  'safe open-mode DTO reveals every live row'
);

update public.ai_pick_product_config
set mode = 'stub', price_vnd = 100000
where singleton;

create temporary table ap_teaser_claim as
select * from public.claim_daily_match_batch(
  '91000000-0000-0000-0000-000000000004', 'ai-product-tests', 120
);

create temporary table ap_teaser_final as
select * from public.finalize_daily_match_batch(
  (select batch_id from ap_teaser_claim),
  '91000000-0000-0000-0000-000000000004',
  (select claim_token from ap_teaser_claim),
  '[
    {"candidate_id":"91000000-0000-0000-0000-000000000005","candidate_snapshot":{"name":"Teaser Five","age":21,"interests":["coffee"]},"ai_reason":"Private reason five","compatibility_label":"Rất hợp về ý định","compatibility_score":90},
    {"candidate_id":"91000000-0000-0000-0000-000000000006","candidate_snapshot":{"name":"Locked Six","age":21,"interests":["music"]},"ai_reason":"Private reason six","compatibility_label":"Tiềm năng mạnh","compatibility_score":84}
  ]'::jsonb,
  'ai-product-tests', null, 900, 2, 10
);

select ok(
  exists (
    select 1 from public.daily_match_batches batch
    where batch.id = (select batch_id from ap_teaser_claim)
      and batch.access_state = 'teaser'
      and batch.teaser_preview_id is not null
      and batch.unlock_source is null
  ),
  'first ready stub batch atomically receives one teaser'
);

select is(
  (select batch_id from public.ai_pick_trial_claims
   where user_id = '91000000-0000-0000-0000-000000000004'),
  (select batch_id from ap_teaser_claim),
  'the ready teaser batch owns the durable one-time trial claim'
);

create temporary table ap_teaser_dto as
select * from public.get_daily_picks_safe(
  '91000000-0000-0000-0000-000000000004',
  (select batch_id from ap_teaser_claim)
);

select ok(
  (select count(*) = 2
     and count(*) filter (where kind = 'revealed') = 1
     and count(*) filter (where kind = 'locked') = 1
     and max(locked_count) = 1
   from ap_teaser_dto),
  'teaser DTO contains one revealed and one locked pick with a real locked count'
);

select ok(
  (select preview_id is not null
     and match_id is null
     and user_id is null
     and candidate_id is null
     and candidate_snapshot is null
     and pair_key is null
     and ai_reason is null
     and suggested_opener is null
     and match_status is null
     and compatibility_score = 84
     and compatibility_label = 'Tiềm năng mạnh'
   from ap_teaser_dto where kind = 'locked'),
  'locked DTO exposes only opaque preview and compatibility fields'
);

select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '91000000-0000-0000-0000-000000000004', true);
select set_config('request.jwt.claim.email', 'ai-product-4@example.com', true);

select throws_ok(
  format(
    $sql$select * from public.submit_match_feedback_atomic(
      %L, 'skipped', 'locked-action', '{}'::text[], ''
    )$sql$,
    (select match.id
     from public.curated_matches match
     join public.daily_match_batches batch on batch.id = match.batch_id
     where match.batch_id = (select batch_id from ap_teaser_claim)
       and match.preview_id <> batch.teaser_preview_id)
  ),
  'P0002',
  'Curated match not found',
  'locked and nonexistent match IDs share the same not-found boundary'
);

select throws_ok(
  format(
    $sql$select * from public.submit_match_feedback_atomic(
      %L, 'accepted', 'locked-accept', '{}'::text[], ''
    )$sql$,
    (select match.id
     from public.curated_matches match
     join public.daily_match_batches batch on batch.id = match.batch_id
     where match.batch_id = (select batch_id from ap_teaser_claim)
       and match.preview_id <> batch.teaser_preview_id)
  ),
  'P0002',
  'Curated match not found',
  'a locked pick cannot be accepted'
);

select throws_ok(
  format(
    $sql$select * from public.submit_match_feedback_atomic(
      %L, 'declined', 'locked-decline', '{}'::text[], ''
    )$sql$,
    (select match.id
     from public.curated_matches match
     join public.daily_match_batches batch on batch.id = match.batch_id
     where match.batch_id = (select batch_id from ap_teaser_claim)
       and match.preview_id <> batch.teaser_preview_id)
  ),
  'P0002',
  'Curated match not found',
  'a locked pick cannot be declined'
);

select throws_ok(
  format(
    $sql$select * from public.submit_match_feedback_atomic(
      %L, 'reported', 'locked-report', array['safety'], 'not visible'
    )$sql$,
    (select match.id
     from public.curated_matches match
     join public.daily_match_batches batch on batch.id = match.batch_id
     where match.batch_id = (select batch_id from ap_teaser_claim)
       and match.preview_id <> batch.teaser_preview_id)
  ),
  'P0002',
  'Curated match not found',
  'a locked pick cannot be reported'
);

select lives_ok(
  format(
    $sql$select * from public.submit_match_feedback_atomic(
      %L, 'skipped', 'teaser-action', '{}'::text[], ''
    )$sql$,
    (select match_id from ap_teaser_dto where kind = 'revealed')
  ),
  'the one designated teaser pick accepts a normal decision'
);

select is(
  (select count(*) from public.get_daily_picks_safe(
      '91000000-0000-0000-0000-000000000004',
      (select batch_id from ap_teaser_claim)
    ) where kind = 'revealed'),
  0::bigint,
  'a decided teaser is not replaced by another free profile'
);

select is(
  (select applied from public.unlock_daily_match_batch(
    (select batch_id from ap_teaser_claim),
    'simulated-unlock-4',
    '91000000-0000-0000-0000-000000000004'
  )),
  true,
  'stub unlock applies once'
);

update public.ai_pick_product_config
set price_vnd = 120000
where singleton;

select ok(
  (select not applied and price_vnd = 100000
   from public.unlock_daily_match_batch(
     (select batch_id from ap_teaser_claim),
     'simulated-unlock-4',
     '91000000-0000-0000-0000-000000000004'
   )),
  'stub unlock retry is idempotent and returns its ledger price'
);

update public.ai_pick_product_config
set price_vnd = 100000
where singleton;

select ok(
  (select count(*) from public.ai_pick_unlock_ledger
    where user_id = '91000000-0000-0000-0000-000000000004'
      and batch_id = (select batch_id from ap_teaser_claim)) = 1
    and (select count(*) from public.get_daily_picks_safe(
      '91000000-0000-0000-0000-000000000004',
      (select batch_id from ap_teaser_claim)
    ) where kind = 'revealed') = 1,
  'one simulated ledger row opens every remaining live pick'
);

-- A later batch for the same trial owner is locked. Its schema default is
-- unlocked for backfill compatibility, so this also verifies fresh rows are not
-- mistaken for a durable open/simulated entitlement.
insert into public.daily_match_batches(
  id, user_id, date, target_count, generated_by, status
) values (
  'ai-product-later-4',
  '91000000-0000-0000-0000-000000000004',
  public.flove_business_date() + 1,
  1,
  'ai-product-tests',
  'generating'
);
insert into public.curated_matches(
  id, batch_id, user_id, candidate_id, candidate_snapshot, pair_key,
  ai_reason, compatibility_label, compatibility_score
) values (
  'ai-product-later-4-7', 'ai-product-later-4',
  '91000000-0000-0000-0000-000000000004',
  '91000000-0000-0000-0000-000000000007',
  '{"name":"Later Seven","age":21}'::jsonb,
  public.pair_key_for(
    '91000000-0000-0000-0000-000000000004',
    '91000000-0000-0000-0000-000000000007'
  ),
  'Private later reason', 'Đáng khám phá', 70
);
update public.daily_match_batches set status = 'ready'
where id = 'ai-product-later-4';

select is(
  (select access_state::text from public.daily_match_batches
   where id = 'ai-product-later-4'),
  'locked',
  'subsequent ready stub batches are locked'
);

-- Empty does not claim a trial. Becoming ready later does.
select set_config('request.jwt.claim.role', 'service_role', true);
insert into public.daily_match_batches(
  id, user_id, date, target_count, generated_by, status
) values (
  'ai-product-empty-7',
  '91000000-0000-0000-0000-000000000007',
  public.flove_business_date(),
  0,
  'ai-product-tests',
  'generating'
);
update public.daily_match_batches set status = 'empty'
where id = 'ai-product-empty-7';

select is(
  (select count(*) from public.ai_pick_trial_claims
   where user_id = '91000000-0000-0000-0000-000000000007'),
  0::bigint,
  'an empty stub batch does not consume the trial'
);

update public.daily_match_batches set status = 'generating'
where id = 'ai-product-empty-7';
update public.daily_match_batches set status = 'failed'
where id = 'ai-product-empty-7';

select is(
  (select count(*) from public.ai_pick_trial_claims
   where user_id = '91000000-0000-0000-0000-000000000007'),
  0::bigint,
  'a failed stub batch does not consume the trial'
);

update public.daily_match_batches set status = 'generating', target_count = 3
where id = 'ai-product-empty-7';
insert into public.curated_matches(
  id, batch_id, user_id, candidate_id, candidate_snapshot, pair_key,
  ai_reason, compatibility_label, compatibility_score
) values
  (
    'ai-product-repair-7-2', 'ai-product-empty-7',
    '91000000-0000-0000-0000-000000000007',
    '91000000-0000-0000-0000-000000000002',
    '{"name":"Repair Two","age":21}'::jsonb,
    public.pair_key_for('91000000-0000-0000-0000-000000000007','91000000-0000-0000-0000-000000000002'),
    'Repair reason two', 'Rất hợp về ý định', 91
  ),
  (
    'ai-product-repair-7-3', 'ai-product-empty-7',
    '91000000-0000-0000-0000-000000000007',
    '91000000-0000-0000-0000-000000000003',
    '{"name":"Repair Three","age":21}'::jsonb,
    public.pair_key_for('91000000-0000-0000-0000-000000000007','91000000-0000-0000-0000-000000000003'),
    'Repair reason three', 'Tiềm năng mạnh', 83
  ),
  (
    'ai-product-repair-7-5', 'ai-product-empty-7',
    '91000000-0000-0000-0000-000000000007',
    '91000000-0000-0000-0000-000000000005',
    '{"name":"Repair Five","age":21}'::jsonb,
    public.pair_key_for('91000000-0000-0000-0000-000000000007','91000000-0000-0000-0000-000000000005'),
    'Repair reason five', 'Đáng khám phá', 75
  );
update public.daily_match_batches set status = 'ready'
where id = 'ai-product-empty-7';

select is(
  (select access_state::text from public.daily_match_batches
   where id = 'ai-product-empty-7'),
  'teaser',
  'the first later ready transition receives the unconsumed trial'
);

select set_config('request.jwt.claim.sub', '91000000-0000-0000-0000-000000000007', true);
select set_config('request.jwt.claim.email', 'ai-product-7@fpt.edu.vn', true);
select lives_ok(
  $$
    select * from public.submit_match_feedback_atomic(
      'ai-product-repair-7-2', 'reported', 'teaser-report-repair',
      array['safety'], 'Safety report invalidates this teaser'
    )
  $$,
  'reporting the designated teaser is a safety invalidation'
);

select is(
  (select teaser_preview_id from public.daily_match_batches
   where id = 'ai-product-empty-7'),
  (select preview_id from public.curated_matches
   where id = 'ai-product-repair-7-3'),
  'report feedback atomically advances the teaser pointer before the next read'
);

select ok(
  (select count(*) = 2
     and count(*) filter (
       where kind = 'revealed'
         and candidate_id = '91000000-0000-0000-0000-000000000003'::uuid
     ) = 1
     and count(*) filter (where kind = 'locked') = 1
   from public.get_daily_picks_safe(
     '91000000-0000-0000-0000-000000000007', 'ai-product-empty-7'
   )),
  'a reported teaser is replaced by the highest live pending pick'
);

insert into public.user_safety_actions(user_id, action, status, reason)
values (
  '91000000-0000-0000-0000-000000000003',
  'suspension',
  'active',
  'safety action invalidates current teaser'
);

select ok(
  (select count(*) = 1
     and bool_and(kind = 'revealed')
     and bool_and(candidate_id = '91000000-0000-0000-0000-000000000005'::uuid)
   from public.get_daily_picks_safe(
     '91000000-0000-0000-0000-000000000007', 'ai-product-empty-7'
   )),
  'an active safety action promotes the next pending teaser on read'
);

insert into public.blocks(blocker_id, blocked_user_id, reason)
values (
  '91000000-0000-0000-0000-000000000007',
  '91000000-0000-0000-0000-000000000005',
  'exhaust teaser repair candidates'
);

-- Do not read the invalidated old batch. Finalizing the next batch must repair
-- its stale claim first, so a trial cannot become stranded across days.
insert into public.daily_match_batches(
  id, user_id, date, target_count, generated_by, status
) values (
  'ai-product-after-invalidation-7',
  '91000000-0000-0000-0000-000000000007',
  public.flove_business_date() + 1,
  1,
  'ai-product-tests',
  'generating'
);
insert into public.curated_matches(
  id, batch_id, user_id, candidate_id, candidate_snapshot, pair_key,
  ai_reason, compatibility_label, compatibility_score
) values (
  'ai-product-after-invalidation-7-6', 'ai-product-after-invalidation-7',
  '91000000-0000-0000-0000-000000000007',
  '91000000-0000-0000-0000-000000000006',
  '{"name":"Future Six","age":21}'::jsonb,
  public.pair_key_for(
    '91000000-0000-0000-0000-000000000007',
    '91000000-0000-0000-0000-000000000006'
  ),
  'Future safe reason', 'Tiềm năng mạnh', 80
);
update public.daily_match_batches set status = 'ready'
where id = 'ai-product-after-invalidation-7';

select ok(
  (select access_state = 'locked' and teaser_preview_id is null
   from public.daily_match_batches where id = 'ai-product-empty-7')
    and (select access_state = 'teaser' and teaser_preview_id is not null
         from public.daily_match_batches where id = 'ai-product-after-invalidation-7')
    and (select batch_id = 'ai-product-after-invalidation-7'
         from public.ai_pick_trial_claims
         where user_id = '91000000-0000-0000-0000-000000000007'),
  'next-day finalize repairs a stale unsafe teaser and reassigns the unspent trial'
);

-- Generic assistant claim/finalize state and canonical preference memory.
select set_config('request.jwt.claim.role', 'service_role', true);
select set_config('request.jwt.claim.sub', '91000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.email', 'ai-product-1@fpt.edu.vn', true);

create temporary table ap_rate_results (
  scope text not null,
  attempt integer not null,
  allowed boolean not null
);
do $$
declare
  v_attempt integer;
  v_allowed boolean;
begin
  for v_attempt in 1..21 loop
    select rate.allowed into v_allowed
    from public.claim_ai_rate_limit(
      '91000000-0000-0000-0000-000000000001', 'preference_chat', 20, 600
    ) rate;
    insert into ap_rate_results(scope, attempt, allowed)
    values ('preference_chat', v_attempt, v_allowed);
  end loop;
  for v_attempt in 1..13 loop
    select rate.allowed into v_allowed
    from public.claim_ai_rate_limit(
      '91000000-0000-0000-0000-000000000001', 'conversation_wingman', 12, 600
    ) rate;
    insert into ap_rate_results(scope, attempt, allowed)
    values ('conversation_wingman', v_attempt, v_allowed);
  end loop;
end;
$$;

select ok(
  (select count(*) filter (where allowed) = 20
      and coalesce(bool_or(allowed) filter (where attempt = 21), false) = false
   from ap_rate_results where scope = 'preference_chat'),
  'Preference Coach permits 20 provider attempts per 10-minute window'
);

select ok(
  (select count(*) filter (where allowed) = 12
      and coalesce(bool_or(allowed) filter (where attempt = 13), false) = false
   from ap_rate_results where scope = 'conversation_wingman'),
  'Wingman permits 12 provider attempts per 10-minute window'
);

create temporary table ap_preference_claim as
select * from public.claim_ai_assistant_request(
  'preference_chat', 'preference-request-1', repeat('a', 64),
  '91000000-0000-0000-0000-000000000001'
);

select is(
  (select request_status from ap_preference_claim),
  'claimed',
  'the first preference assistant request owns its claim'
);

select is(
  (select request_status from public.claim_ai_assistant_request(
    'preference_chat', 'preference-request-1', repeat('a', 64),
    '91000000-0000-0000-0000-000000000001'
  )),
  'in_progress',
  'a concurrent preference request cannot duplicate the provider call'
);

select throws_ok(
  $$ select * from public.claim_ai_assistant_request(
    'preference_chat', 'preference-request-1', repeat('b', 64),
    '91000000-0000-0000-0000-000000000001'
  ) $$,
  '22023',
  'Idempotency key was reused with a different assistant request',
  'assistant idempotency keys bind the canonical client payload fingerprint'
);

select is(
  public.mark_ai_assistant_provider_started(
    'preference_chat', 'preference-request-1', repeat('a', 64),
    (select claim_token from ap_preference_claim),
    '91000000-0000-0000-0000-000000000001'
  ),
  true,
  'the service worker durably fences the preference provider call'
);

select is(
  public.mark_ai_assistant_provider_started(
    'preference_chat', 'preference-request-1', repeat('a', 64),
    (select claim_token from ap_preference_claim),
    '91000000-0000-0000-0000-000000000001'
  ),
  false,
  'the same token cannot acquire the provider fence twice'
);

update public.ai_assistant_requests
set claimed_at = now() - interval '1 year'
where user_id = '91000000-0000-0000-0000-000000000001'
  and scope = 'preference_chat'
  and client_request_id = 'preference-request-1';

select ok(
  (select request_status = 'provider_started'
     and claim_token = (select claim_token from ap_preference_claim)
     and response_payload is null
   from public.claim_ai_assistant_request(
     'preference_chat', 'preference-request-1', repeat('a', 64),
     '91000000-0000-0000-0000-000000000001'
   )),
  'a started provider keeps its original token beyond the processing lease'
);

select is(
  public.abandon_ai_assistant_request(
    'preference_chat', 'preference-request-1', repeat('a', 64),
    (select claim_token from ap_preference_claim),
    '91000000-0000-0000-0000-000000000001'
  ),
  false,
  'a provider-started claim cannot be abandoned and called a second time'
);

create temporary table ap_preference_final as
select * from public.finalize_preference_coach_request(
  'preference-request-1', repeat('a', 64),
  (select claim_token from ap_preference_claim),
  'I like calm coffee dates and avoid smoking.',
  '{"reply":"Mình đã ghi nhớ.","summary":"Thích những buổi hẹn yên tĩnh.","preferredTraits":["calm","coffee"],"avoidedTraits":["smoking"],"fallback":false}'::jsonb,
  true,
  '91000000-0000-0000-0000-000000000001'
);

select ok(
  (select request_status = 'completed' from ap_preference_final)
    and (select count(*) from public.preference_chat_messages
      where user_id = '91000000-0000-0000-0000-000000000001'
        and client_request_id = 'preference-request-1') = 2
    and (select soft_preferences = array['calm','coffee']
      and soft_avoidances = array['smoking']
      from public.preference_profiles
      where user_id = '91000000-0000-0000-0000-000000000001'),
  'preference finalize atomically stores transcript and canonical positive/negative memory'
);

select is(
  (select request_status from public.claim_ai_assistant_request(
    'preference_chat', 'preference-request-1', repeat('a', 64),
    '91000000-0000-0000-0000-000000000001'
  )),
  'cached',
  'a completed preference retry returns the durable cache'
);

create temporary table ap_wingman_claim as
select * from public.claim_ai_assistant_request(
  'conversation_wingman', 'wingman-abandon-1', repeat('c', 64),
  '91000000-0000-0000-0000-000000000001'
);

update public.ai_assistant_requests
set claimed_at = now() - interval '91 seconds'
where user_id = '91000000-0000-0000-0000-000000000001'
  and scope = 'conversation_wingman'
  and client_request_id = 'wingman-abandon-1';

create temporary table ap_wingman_stale_reclaim as
select * from public.claim_ai_assistant_request(
  'conversation_wingman', 'wingman-abandon-1', repeat('c', 64),
  '91000000-0000-0000-0000-000000000001'
);

select ok(
  (select request_status = 'claimed'
     and claim_token <> (select claim_token from ap_wingman_claim)
   from ap_wingman_stale_reclaim),
  'only an unstarted expired processing lease receives a replacement token'
);

select is(
  public.abandon_ai_assistant_request(
    'conversation_wingman', 'wingman-abandon-1', repeat('c', 64),
    (select claim_token from ap_wingman_stale_reclaim),
    '91000000-0000-0000-0000-000000000001'
  ),
  true,
  'a provider failure can abandon its matching processing claim'
);

create temporary table ap_wingman_reclaim as
select * from public.claim_ai_assistant_request(
    'conversation_wingman', 'wingman-abandon-1', repeat('c', 64),
    '91000000-0000-0000-0000-000000000001'
  );

select is(
  (select request_status from ap_wingman_reclaim),
  'claimed',
  'an abandoned assistant request is immediately retryable'
);

create temporary table ap_wingman_final as
select * from public.finalize_ai_assistant_request(
  'conversation_wingman', 'wingman-abandon-1', repeat('c', 64),
  (select claim_token from ap_wingman_reclaim),
  '{"suggestions":["One","Two","Three"]}'::jsonb,
  '91000000-0000-0000-0000-000000000001'
);
update public.ai_assistant_requests
set expires_at = now() - interval '1 second'
where user_id = '91000000-0000-0000-0000-000000000001'
  and scope = 'conversation_wingman'
  and client_request_id = 'wingman-abandon-1';

select ok(
  (select request_status = 'claimed' and response_payload is null
   from public.claim_ai_assistant_request(
     'conversation_wingman', 'wingman-abandon-1', repeat('c', 64),
     '91000000-0000-0000-0000-000000000001'
   )),
  'expired Wingman suggestions are purged and reclaimed without a stale cache hit'
);

insert into public.conversations(id, is_anonymous)
values ('ai-product-revealed-conversation', false), ('ai-product-anonymous-conversation', true);
insert into public.conversation_participants(conversation_id, user_id)
values
  ('ai-product-revealed-conversation', '91000000-0000-0000-0000-000000000001'),
  ('ai-product-revealed-conversation', '91000000-0000-0000-0000-000000000002'),
  ('ai-product-anonymous-conversation', '91000000-0000-0000-0000-000000000001'),
  ('ai-product-anonymous-conversation', '91000000-0000-0000-0000-000000000002');
insert into public.messages(conversation_id, sender_id, content)
values
  ('ai-product-revealed-conversation', '91000000-0000-0000-0000-000000000002', 'Would you like coffee?'),
  ('ai-product-revealed-conversation', '91000000-0000-0000-0000-000000000001', 'That sounds nice.');

select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '91000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.email', 'ai-product-1@fpt.edu.vn', true);

select ok(
  (select eligible
     and not is_anonymous
     and jsonb_array_length(messages) = 2
     and self_context ?& array['bio','datingGoals','preferenceSummary','preferredTraits','avoidedTraits']
     and not (self_context ?| array['id','name','email','avatar'])
   from public.get_conversation_wingman_context(
     'ai-product-revealed-conversation',
     '91000000-0000-0000-0000-000000000001', 20
   )),
  'Wingman context is participant-safe, relative, bounded, and identity-free'
);

select ok(
  (select not eligible
     and eligibility_reason = 'anonymous_not_revealed'
     and messages = '[]'::jsonb
   from public.get_conversation_wingman_context(
     'ai-product-anonymous-conversation',
     '91000000-0000-0000-0000-000000000001', 20
   )),
  'Wingman returns no transcript before Blind Date reveal'
);

select set_config('request.jwt.claim.sub', '91000000-0000-0000-0000-000000000008', true);
select set_config('request.jwt.claim.email', 'ai-product-8@example.com', true);

select ok(
  (select user_age = 17 and not llm_eligible
   from public.get_preference_coach_context(
     '91000000-0000-0000-0000-000000000008', 12
   )),
  'preference context marks under-18 users as ineligible for provider calls'
);

select set_config('request.jwt.claim.role', 'service_role', true);
select set_config('request.jwt.claim.sub', '', true);
update public.preference_profiles
set soft_avoidances = array['testing']
where user_id = '91000000-0000-0000-0000-000000000001';

select ok(
  exists (
    select 1
    from public.get_match_candidates_v2_without_avoidances(
      '91000000-0000-0000-0000-000000000001', 300, 30
    ) base
    join public.get_match_candidates_v2(
      '91000000-0000-0000-0000-000000000001', 300, 30
    ) adjusted using (id)
    where adjusted.feedback_affinity <= base.feedback_affinity
      and adjusted.feedback_affinity >= -0.15
      and base.feedback_affinity - adjusted.feedback_affinity <= 0.0300001
      and base.feedback_affinity - adjusted.feedback_affinity > 0
  ),
  'soft avoidances subtract at most 0.03 inside the bounded feedback component'
);

select * from finish();

rollback;
