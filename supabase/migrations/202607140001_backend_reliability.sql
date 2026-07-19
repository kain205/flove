-- Backend reliability v2: revisioned onboarding, recoverable daily matching,
-- durable AI jobs, idempotent actions, and concurrency-safe Blind Date flows.
-- This migration is intentionally additive and keeps every v1 table/RPC available.

create extension if not exists pgmq;

create type public.embedding_job_status as enum ('pending', 'processing', 'ready', 'failed');
create type public.daily_match_batch_status as enum ('generating', 'ready', 'empty', 'failed');
create type public.match_enrichment_status as enum ('pending', 'processing', 'ready', 'failed', 'skipped');

-- The product date is owned by Postgres, not by a device/runtime timezone.
create or replace function public.flove_business_date()
returns date
language sql
stable
set search_path = pg_catalog
as $$
  select (current_timestamp at time zone 'Asia/Ho_Chi_Minh')::date;
$$;

revoke all on function public.flove_business_date()
  from anon, authenticated, public;
grant execute on function public.flove_business_date() to authenticated, service_role;

-- Supabase Auth Before User Created hook. GoTrue invokes this as
-- supabase_auth_admin; all HTTP client and worker roles are intentionally denied.
create or replace function public.before_user_created_require_fpt(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = pg_catalog
as $$
declare
  v_email text := lower(btrim(coalesce(event -> 'user' ->> 'email', '')));
begin
  if v_email ~ '^[a-z0-9._%+\-]+@fpt\.edu\.vn$' then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object(
    'error', jsonb_build_object(
      'http_code', 403,
      'message', 'Only verified FPT email accounts are allowed'
    )
  );
end;
$$;

revoke all on function public.before_user_created_require_fpt(jsonb)
  from anon, authenticated, service_role, public;
grant usage on schema public to supabase_auth_admin;
grant execute on function public.before_user_created_require_fpt(jsonb)
  to supabase_auth_admin;

-- Defense in depth for accounts that predate the Auth hook. User-facing RPCs
-- call this SECURITY DEFINER helper so admission uses the canonical Auth row,
-- not a client-supplied profile email or a stale JWT email claim. Trusted SQL
-- and service-role repair/backfill paths remain available.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated, service_role;
grant usage on schema private to authenticated;

create or replace function private.assert_fpt_self_admission()
returns uuid
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
begin
  if auth.role() is null or auth.role() = 'service_role' then
    return v_uid;
  end if;
  if auth.role() <> 'authenticated' or v_uid is null then
    raise exception using errcode = '28000', message = 'Not authenticated';
  end if;

  select lower(btrim(coalesce(account.email, '')))
  into v_email
  from auth.users account
  where account.id = v_uid;

  if v_email is null or v_email !~ '^[a-z0-9._%+\-]+@fpt\.edu\.vn$' then
    raise exception using errcode = '42501', message = 'Only FPT accounts may access F-Love';
  end if;
  return v_uid;
end;
$$;

revoke all on function private.assert_fpt_self_admission()
  from anon, authenticated, service_role, public;
grant execute on function private.assert_fpt_self_admission() to authenticated;

-- Legacy clients can still use these owner-scoped tables directly for one
-- release. Bind their RLS identity to the same canonical Auth-domain gate.
drop policy if exists "reports own insert" on public.reports;
create policy "reports own insert"
on public.reports for insert to authenticated
with check (reporter_id = private.assert_fpt_self_admission());

drop policy if exists "reports own select" on public.reports;
create policy "reports own select"
on public.reports for select to authenticated
using (reporter_id = private.assert_fpt_self_admission());

drop policy if exists "blocks own insert" on public.blocks;
create policy "blocks own insert"
on public.blocks for insert to authenticated
with check (blocker_id = private.assert_fpt_self_admission());

drop policy if exists "blocks own select" on public.blocks;
create policy "blocks own select"
on public.blocks for select to authenticated
using (blocker_id = private.assert_fpt_self_admission());

drop policy if exists "blocks own delete" on public.blocks;
create policy "blocks own delete"
on public.blocks for delete to authenticated
using (blocker_id = private.assert_fpt_self_admission());

-- Legacy application helpers are trigger/server internals. Reset their direct
-- default grants as part of the v2 allowlist even though they were created by
-- earlier migrations.
revoke all on function public.set_updated_at()
  from anon, authenticated, public;
revoke all on function public.pair_key_for(uuid, uuid)
  from anon, authenticated, public;

-- Revisioned onboarding draft. It references auth.users so a user can autosave before
-- the final profile row is created by confirmation.
create table public.onboarding_drafts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  draft jsonb not null default '{}'::jsonb,
  draft_revision bigint not null default 1 check (draft_revision > 0),
  analysis jsonb,
  analysis_revision bigint,
  analysis_source text,
  onboarding_version integer not null default 2 check (onboarding_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(draft) in ('object', 'array')),
  check (analysis is null or jsonb_typeof(analysis) = 'object'),
  check (analysis_revision is null or analysis_revision = draft_revision)
);

create trigger onboarding_drafts_set_updated_at
before update on public.onboarding_drafts
for each row execute function public.set_updated_at();

alter table public.onboarding_drafts enable row level security;

create policy "onboarding drafts own select"
on public.onboarding_drafts for select
using (user_id = auth.uid());

create policy "onboarding drafts own insert"
on public.onboarding_drafts for insert
with check (user_id = auth.uid());

create policy "onboarding drafts own update"
on public.onboarding_drafts for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

alter table public.profiles
  add column onboarding_answers jsonb not null default '[]'::jsonb,
  add column onboarding_version integer not null default 1,
  add column profile_revision bigint not null default 1,
  add column embedding_revision bigint not null default 0,
  add column embedding_status public.embedding_job_status not null default 'pending',
  add column embedding_error_code text,
  add column embedding_updated_at timestamptz,
  add column profile_upgrade_required boolean not null default false;

alter table public.profiles
  add constraint profiles_onboarding_answers_shape_check
    check (jsonb_typeof(onboarding_answers) in ('array', 'object')),
  add constraint profiles_onboarding_version_check check (onboarding_version > 0),
  add constraint profiles_profile_revision_check check (profile_revision > 0),
  add constraint profiles_embedding_revision_check
    check (embedding_revision >= 0 and embedding_revision <= profile_revision);

-- Canonical readiness backfill. Legacy AI/onboarding evidence is used only here;
-- all runtime gates must use profile_confirmed + profile_completeness.
update public.profiles
set profile_confirmed = true,
    profile_confirmed_at = coalesce(profile_confirmed_at, updated_at, now())
where profile_confirmed = false
  and profile_completeness >= 75
  and (
    ai_signals <> '{}'::jsonb
    or ai_profile_analysis <> '{}'::jsonb
    or jsonb_array_length(
      case when jsonb_typeof(onboarding_answers) = 'array' then onboarding_answers else '[]'::jsonb end
    ) > 0
  );

update public.profiles
set profile_upgrade_required = true
where profile_completeness < 75
  and (
    profile_confirmed = true
    or ai_signals <> '{}'::jsonb
    or ai_profile_analysis <> '{}'::jsonb
  );

update public.profiles
set embedding_status = case
      when self_vector is not null
       and need_vector is not null
       and preference_vector is not null
       and communication_vector is not null
       and lifestyle_vector is not null then 'ready'::public.embedding_job_status
      else 'pending'::public.embedding_job_status
    end,
    embedding_revision = case
      when self_vector is not null
       and need_vector is not null
       and preference_vector is not null
       and communication_vector is not null
       and lifestyle_vector is not null then profile_revision
      else 0
    end,
    embedding_updated_at = case
      when self_vector is not null
       and need_vector is not null
       and preference_vector is not null
       and communication_vector is not null
       and lifestyle_vector is not null then updated_at
      else null
    end;

-- Cross-user display API exposes only canonically ready, currently safe
-- profiles. The view intentionally omits private analysis/preferences/vectors.
create or replace view public.public_profiles
with (security_barrier = true)
as
select
  profile.id,
  profile.name,
  profile.age,
  profile.major,
  profile.campus,
  profile.avatar_url,
  profile.bio,
  profile.interests,
  profile.personality_tags,
  profile.dating_goals,
  profile.preferred_vibes,
  profile.profile_text,
  profile.profile_completeness,
  profile.gender,
  profile.height_cm
from public.profiles profile
where profile.profile_confirmed = true
  and profile.profile_completeness >= 75
  and lower(btrim(profile.email)) ~ '^[a-z0-9._%+\-]+@fpt\.edu\.vn$'
  and (
    auth.role() is null
    or auth.role() = 'service_role'
    or exists (
      select 1
      from auth.users viewer
      where viewer.id = auth.uid()
        and lower(btrim(coalesce(viewer.email, '')))
          ~ '^[a-z0-9._%+\-]+@fpt\.edu\.vn$'
    )
  )
  and not exists (
    select 1 from public.user_safety_actions safety
    where safety.user_id = profile.id
      and safety.action in ('shadow_review', 'suspension', 'ban')
      and safety.status = 'active'
      and (safety.expires_at is null or safety.expires_at > now())
  );

revoke all on table public.public_profiles
  from anon, authenticated, public;
grant select on table public.public_profiles to authenticated, service_role;

-- Storage writes share the FPT boundary. The email claim is signed by GoTrue;
-- owner path validation is additionally enforced when that URL reaches profiles.
update storage.buckets
set file_size_limit = 5 * 1024 * 1024,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']::text[]
where id = 'avatars';

drop policy if exists "avatars owner writes" on storage.objects;
create policy "avatars owner writes"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'avatars'
  and owner = auth.uid()
  and split_part(name, '/', 1) = auth.uid()::text
  and lower(btrim(coalesce(auth.jwt() ->> 'email', '')))
    ~ '^[a-z0-9._%+\-]+@fpt\.edu\.vn$'
);

drop policy if exists "avatars owner updates" on storage.objects;
create policy "avatars owner updates"
on storage.objects for update to authenticated
using (
  bucket_id = 'avatars'
  and owner = auth.uid()
  and split_part(name, '/', 1) = auth.uid()::text
  and lower(btrim(coalesce(auth.jwt() ->> 'email', '')))
    ~ '^[a-z0-9._%+\-]+@fpt\.edu\.vn$'
)
with check (
  bucket_id = 'avatars'
  and owner = auth.uid()
  and split_part(name, '/', 1) = auth.uid()::text
  and lower(btrim(coalesce(auth.jwt() ->> 'email', '')))
    ~ '^[a-z0-9._%+\-]+@fpt\.edu\.vn$'
);

-- Matching-profile edits invalidate embeddings and advance a monotonic revision.
create or replace function public.bump_profile_revision()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
declare
  v_old jsonb;
  v_new jsonb;
begin
  v_old := to_jsonb(old) - array[
    'created_at', 'updated_at', 'profile_revision', 'embedding_revision',
    'embedding_status', 'embedding_error_code', 'embedding_updated_at',
    'self_vector', 'need_vector', 'preference_vector', 'communication_vector', 'lifestyle_vector'
  ];
  v_new := to_jsonb(new) - array[
    'created_at', 'updated_at', 'profile_revision', 'embedding_revision',
    'embedding_status', 'embedding_error_code', 'embedding_updated_at',
    'self_vector', 'need_vector', 'preference_vector', 'communication_vector', 'lifestyle_vector'
  ];

  if v_new is distinct from v_old then
    new.profile_revision := old.profile_revision + 1;
    new.embedding_status := 'pending';
    new.embedding_error_code := null;
  else
    new.profile_revision := old.profile_revision;
  end if;
  return new;
end;
$$;

revoke all on function public.bump_profile_revision()
  from anon, authenticated, public;

create trigger profiles_bump_profile_revision
before update on public.profiles
for each row execute function public.bump_profile_revision();

-- Recoverable daily batch lifecycle. Defaults support new claim/finalize while old
-- readers can continue selecting the same rows during the compatibility release.
alter table public.daily_match_batches
  add column status public.daily_match_batch_status not null default 'generating',
  add column attempt_count integer not null default 0,
  add column generation_started_at timestamptz,
  add column finalized_at timestamptz,
  add column retry_after timestamptz,
  add column error_code text,
  add column empty_reason text,
  add column algorithm_version text not null default 'legacy-v1',
  add column profile_revision bigint not null default 1,
  add column candidate_pool_revision bigint not null default 1,
  add column claim_token uuid,
  add column enrichment_status public.match_enrichment_status not null default 'skipped',
  add column enriched_at timestamptz,
  add column enrichment_error_code text,
  add column updated_at timestamptz not null default now();

alter table public.daily_match_batches
  add constraint daily_match_batches_attempt_count_check check (attempt_count >= 0),
  add constraint daily_match_batches_profile_revision_check check (profile_revision > 0),
  add constraint daily_match_batches_pool_revision_check check (candidate_pool_revision > 0),
  add constraint daily_match_batches_empty_reason_check check (
    empty_reason is null or empty_reason in ('no_eligible_candidates', 'all_recently_seen')
  );

create trigger daily_match_batches_set_updated_at
before update on public.daily_match_batches
for each row execute function public.set_updated_at();

update public.daily_match_batches b
set status = case
      when exists (select 1 from public.curated_matches m where m.batch_id = b.id)
        then 'ready'::public.daily_match_batch_status
      else 'empty'::public.daily_match_batch_status
    end,
    attempt_count = greatest(attempt_count, 1),
    generation_started_at = coalesce(generation_started_at, created_at),
    finalized_at = coalesce(finalized_at, created_at),
    retry_after = case
      when exists (select 1 from public.curated_matches m where m.batch_id = b.id) then null
      else now()
    end,
    empty_reason = case
      when exists (select 1 from public.curated_matches m where m.batch_id = b.id) then null
      else 'no_eligible_candidates'
    end,
    enrichment_status = case
      when exists (
        select 1 from public.curated_matches m
        where m.batch_id = b.id and nullif(m.suggested_opener, '') is not null
      ) then 'ready'::public.match_enrichment_status
      else 'skipped'::public.match_enrichment_status
    end;

create index daily_match_batches_generation_state_idx
  on public.daily_match_batches(status, retry_after, generation_started_at);

create table public.match_generation_attempts (
  id bigint generated always as identity primary key,
  batch_id text not null references public.daily_match_batches(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  attempt_no integer not null check (attempt_no > 0),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  outcome text not null default 'generating'
    check (outcome in ('generating', 'ready', 'empty', 'failed', 'superseded')),
  candidate_count integer not null default 0 check (candidate_count >= 0),
  selected_count integer not null default 0 check (selected_count between 0 and 5),
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  error_code text,
  unique (batch_id, attempt_no)
);

create index match_generation_attempts_user_started_idx
  on public.match_generation_attempts(user_id, started_at desc);

alter table public.match_generation_attempts enable row level security;
-- No end-user policies: generation telemetry is service-only and contains no raw answers.

-- Monotonic pool version lets an empty batch become retryable immediately when eligibility changes.
create table public.candidate_pool_state (
  singleton boolean primary key default true check (singleton),
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);

insert into public.candidate_pool_state(singleton, revision)
values (true, 1)
on conflict (singleton) do nothing;

alter table public.candidate_pool_state enable row level security;

create or replace function public.bump_candidate_pool_revision()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  update public.candidate_pool_state
  set revision = revision + 1, updated_at = now()
  where singleton;
  return coalesce(new, old);
end;
$$;

revoke all on function public.bump_candidate_pool_revision()
  from anon, authenticated, public;

create trigger profiles_bump_candidate_pool_on_insert_delete
after insert or delete on public.profiles
for each row execute function public.bump_candidate_pool_revision();

create trigger profiles_bump_candidate_pool_on_revision
after update on public.profiles
for each row
when (
  old.profile_revision is distinct from new.profile_revision
  or old.embedding_revision is distinct from new.embedding_revision
)
execute function public.bump_candidate_pool_revision();

create trigger blocks_bump_candidate_pool
after insert or update or delete on public.blocks
for each row execute function public.bump_candidate_pool_revision();

create trigger safety_actions_bump_candidate_pool
after insert or update or delete on public.user_safety_actions
for each row execute function public.bump_candidate_pool_revision();

create trigger reports_bump_candidate_pool
after insert or update or delete on public.reports
for each row execute function public.bump_candidate_pool_revision();

-- Idempotency fields are nullable so existing clients remain wire-compatible.
alter table public.match_feedback add column idempotency_key text;
create unique index match_feedback_user_idempotency_uidx
  on public.match_feedback(user_id, idempotency_key)
  where idempotency_key is not null;

alter table public.messages add column client_message_id text;
create unique index messages_sender_client_id_uidx
  on public.messages(sender_id, client_message_id)
  where client_message_id is not null;

alter table public.preference_chat_messages add column client_request_id text;
alter table public.preference_chat_messages add column request_payload jsonb;
create unique index preference_chat_request_sender_uidx
  on public.preference_chat_messages(user_id, client_request_id, sender)
  where client_request_id is not null;

-- Optimistic draft writes. A stale caller receives SQLSTATE 40001 and must reload;
-- analysis is always invalidated when the source draft changes.
create or replace function public.assert_onboarding_draft_v2(p_draft jsonb)
returns void
language plpgsql
set search_path = public, pg_catalog
as $$
declare
  v_basic jsonb;
  v_answer jsonb;
  v_answer_id text;
  v_answer_value jsonb;
  v_field record;
begin
  if p_draft is null or jsonb_typeof(p_draft) <> 'object' then
    raise exception using errcode = '22023', message = 'draft must be a v2 JSON object';
  end if;
  if octet_length(p_draft::text) > 65536 then
    raise exception using errcode = '22023', message = 'draft exceeds the 64 KiB limit';
  end if;
  if exists (
    select 1 from jsonb_object_keys(p_draft) key
    where key <> all(array['version', 'step', 'basic', 'answers'])
  ) then
    raise exception using errcode = '22023', message = 'draft contains unknown fields';
  end if;
  if p_draft -> 'version' is distinct from '2'::jsonb
    or jsonb_typeof(p_draft -> 'step') is distinct from 'number'
    or (p_draft ->> 'step') !~ '^[0-6]$'
    or jsonb_typeof(p_draft -> 'basic') is distinct from 'object'
    or jsonb_typeof(p_draft -> 'answers') is distinct from 'array' then
    raise exception using errcode = '22023', message = 'draft v2 shape is invalid';
  end if;

  v_basic := p_draft -> 'basic';
  if exists (
    select 1 from jsonb_object_keys(v_basic) key
    where key <> all(array[
      'name', 'age', 'gender', 'genderText', 'lookingForGender',
      'heightCm', 'school', 'majorLabel', 'major', 'campus',
      'avatarUrl', 'agePrefMin', 'agePrefMax'
    ])
  ) then
    raise exception using errcode = '22023', message = 'draft basic contains unknown fields';
  end if;

  for v_field in
    select * from (values
      ('name', 120),
      ('gender', 60),
      ('genderText', 120),
      ('school', 200),
      ('majorLabel', 200),
      ('major', 40),
      ('campus', 40),
      ('avatarUrl', 2048)
    ) fields(field_name, max_length)
  loop
    if v_basic ? v_field.field_name
      and (
        jsonb_typeof(v_basic -> v_field.field_name) <> 'string'
        or char_length(v_basic ->> v_field.field_name) > v_field.max_length
      ) then
      raise exception using errcode = '22023', message = 'draft basic text is out of range';
    end if;
  end loop;

  if coalesce(v_basic ->> 'gender', '') not in (
    '', 'male', 'female', 'other', 'prefer_not_to_show'
  ) or coalesce(v_basic ->> 'major', '') not in (
    '', 'SE', 'AI', 'Biz', 'Design', 'Marketing'
  ) or coalesce(v_basic ->> 'campus', '') not in (
    '', 'HCM', 'Hanoi', 'Danang', 'Cantho'
  ) then
    raise exception using errcode = '22023', message = 'draft basic enum is invalid';
  end if;

  for v_field in
    select * from (values
      ('age', 0, 120),
      ('heightCm', 120, 230),
      ('agePrefMin', 17, 120),
      ('agePrefMax', 17, 120)
    ) fields(field_name, min_value, max_value)
  loop
    if v_basic ? v_field.field_name
      and v_basic -> v_field.field_name <> 'null'::jsonb
      and (
        jsonb_typeof(v_basic -> v_field.field_name) <> 'number'
        or (v_basic ->> v_field.field_name)::numeric <> trunc((v_basic ->> v_field.field_name)::numeric)
        or (v_basic ->> v_field.field_name)::numeric < v_field.min_value
        or (v_basic ->> v_field.field_name)::numeric > v_field.max_value
      ) then
      raise exception using errcode = '22023', message = 'draft basic number is out of range';
    end if;
  end loop;

  if v_basic ? 'lookingForGender' then
    if jsonb_typeof(v_basic -> 'lookingForGender') <> 'array'
      or jsonb_array_length(v_basic -> 'lookingForGender') > 10
      or exists (
        select 1
        from jsonb_array_elements(v_basic -> 'lookingForGender') item
        where jsonb_typeof(item) <> 'string'
          or item #>> '{}' not in ('male', 'female', 'everyone', 'depends')
      )
      or (
        select count(*) <> count(distinct lower(btrim(item #>> '{}')))
        from jsonb_array_elements(v_basic -> 'lookingForGender') item
      ) then
      raise exception using errcode = '22023', message = 'draft lookingForGender is invalid';
    end if;
  end if;

  if jsonb_array_length(p_draft -> 'answers') > 11 then
    raise exception using errcode = '22023', message = 'draft contains too many answers';
  end if;
  if (
    select count(*) <> count(distinct answer ->> 'questionId')
    from jsonb_array_elements(p_draft -> 'answers') answer
  ) then
    raise exception using errcode = '22023', message = 'draft questionId values must be unique';
  end if;

  for v_answer in select value from jsonb_array_elements(p_draft -> 'answers')
  loop
    if jsonb_typeof(v_answer) <> 'object'
      or not (v_answer ? 'questionId')
      or not (v_answer ? 'value')
      or exists (
        select 1 from jsonb_object_keys(v_answer) key
        where key <> all(array['questionId', 'value'])
      )
      or jsonb_typeof(v_answer -> 'questionId') <> 'string' then
      raise exception using errcode = '22023', message = 'draft answer shape is invalid';
    end if;

    v_answer_id := v_answer ->> 'questionId';
    v_answer_value := v_answer -> 'value';
    if v_answer_id not in (
      'need_chips', 'need_text', 'self_chips', 'self_text',
      'attraction_text', 'appearance_importance', 'appearance_specifics',
      'communication_text', 'boundaries_chips', 'boundaries_text',
      'boundaries_unsure'
    ) then
      raise exception using errcode = '22023', message = 'draft questionId is not supported';
    end if;

    if v_answer_id in ('need_chips', 'self_chips', 'boundaries_chips') then
      if jsonb_typeof(v_answer_value) <> 'array'
        or jsonb_array_length(v_answer_value) > 30
        or exists (
          select 1 from jsonb_array_elements(v_answer_value) item
          where jsonb_typeof(item) <> 'string'
            or nullif(btrim(item #>> '{}'), '') is null
            or char_length(item #>> '{}') > 200
        )
        or (
          select count(*) <> count(distinct lower(btrim(item #>> '{}')))
          from jsonb_array_elements(v_answer_value) item
        ) then
        raise exception using errcode = '22023', message = 'draft answer list is invalid';
      end if;
    elsif jsonb_typeof(v_answer_value) <> 'string'
      or char_length(v_answer_value #>> '{}') > 4000 then
      raise exception using errcode = '22023', message = 'draft answer text is out of range';
    end if;

    if v_answer_id = 'appearance_importance'
      and v_answer_value #>> '{}' not in ('none', 'soft', 'medium', 'hard') then
      raise exception using errcode = '22023', message = 'draft appearance importance is invalid';
    end if;
    if v_answer_id = 'boundaries_unsure'
      and v_answer_value #>> '{}' not in ('true', 'false') then
      raise exception using errcode = '22023', message = 'draft boundary flag is invalid';
    end if;
  end loop;
end;
$$;

revoke all on function public.assert_onboarding_draft_v2(jsonb)
  from anon, authenticated, public;

create or replace function public.save_onboarding_draft(
  p_draft jsonb,
  p_expected_revision bigint default null,
  p_onboarding_version integer default 2,
  p_expected_user_id uuid default null
)
returns setof public.onboarding_drafts
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  v_uid uuid := auth.uid();
  v_current public.onboarding_drafts%rowtype;
begin
  perform private.assert_fpt_self_admission();
  if v_uid is null then
    raise exception using errcode = '28000', message = 'Not authenticated';
  end if;
  if p_expected_user_id is not null and v_uid <> p_expected_user_id then
    raise exception using errcode = '28000', message = 'Onboarding draft owner changed';
  end if;
  if p_onboarding_version is distinct from 2 then
    raise exception using errcode = '22023', message = 'onboarding version must be 2';
  end if;
  perform public.assert_onboarding_draft_v2(p_draft);

  select * into v_current
  from public.onboarding_drafts
  where user_id = v_uid
  for update;

  if not found then
    if p_expected_revision is not null and p_expected_revision <> 0 then
      raise exception using errcode = '40001', message = 'Onboarding draft revision conflict';
    end if;

    insert into public.onboarding_drafts(user_id, draft, draft_revision, onboarding_version)
    values (v_uid, p_draft, 1, p_onboarding_version);
  else
    if p_expected_revision is null or p_expected_revision <> v_current.draft_revision then
      raise exception using errcode = '40001', message = 'Onboarding draft revision conflict';
    end if;

    update public.onboarding_drafts
    set draft = p_draft,
        draft_revision = v_current.draft_revision + 1,
        analysis = null,
        analysis_revision = null,
        analysis_source = null,
        onboarding_version = p_onboarding_version
    where user_id = v_uid;
  end if;

  return query
  select * from public.onboarding_drafts where user_id = v_uid;
end;
$$;

revoke all on function public.save_onboarding_draft(jsonb, bigint, integer, uuid)
  from anon, authenticated, public;
grant execute on function public.save_onboarding_draft(jsonb, bigint, integer, uuid) to authenticated;

-- Only trusted server code may attach an analysis to the revision it analyzed.
create or replace function public.save_onboarding_analysis(
  p_user_id uuid,
  p_draft_revision bigint,
  p_analysis jsonb,
  p_analysis_source text default 'ai'
)
returns table(analysis_revision bigint, analysis jsonb)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_draft public.onboarding_drafts%rowtype;
begin
  if p_analysis is null or jsonb_typeof(p_analysis) <> 'object' then
    raise exception using errcode = '22023', message = 'analysis must be a JSON object';
  end if;

  select d.* into v_draft
  from public.onboarding_drafts d
  where d.user_id = p_user_id
  for update;

  if not found or v_draft.draft_revision <> p_draft_revision then
    raise exception using errcode = '40001', message = 'Onboarding analysis is stale';
  end if;

  -- First successful analysis wins for a draft revision. Concurrent provider
  -- responses therefore share one canonical review instead of invalidating each other.
  if v_draft.analysis_revision = p_draft_revision and v_draft.analysis is not null then
    return query select v_draft.analysis_revision, v_draft.analysis;
    return;
  end if;

  update public.onboarding_drafts d
  set analysis = p_analysis,
      analysis_revision = p_draft_revision,
      analysis_source = nullif(left(coalesce(p_analysis_source, ''), 120), '')
  where d.user_id = p_user_id;

  return query select p_draft_revision, p_analysis;
end;
$$;

revoke all on function public.save_onboarding_analysis(uuid, bigint, jsonb, text)
  from anon, authenticated, public;
grant execute on function public.save_onboarding_analysis(uuid, bigint, jsonb, text) to service_role;

-- Logged PGMQ queue with public-schema service wrappers. The queue itself is never
-- exposed through PostgREST, which avoids depending on Dashboard pgmq_public settings.
do $$
begin
  if not exists (select 1 from pgmq.meta where queue_name = 'ai_jobs') then
    perform pgmq.create('ai_jobs');
  end if;
end;
$$;

create table public.ai_job_registry (
  idempotency_key text primary key,
  msg_id bigint unique,
  job_type text not null,
  status text not null default 'queued'
    check (status in ('queued', 'completed', 'archived')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.ai_job_registry enable row level security;

create or replace function public.enqueue_ai_job(
  p_message jsonb,
  p_idempotency_key text default null,
  p_delay_seconds integer default 0
)
returns bigint
language plpgsql
security definer
set search_path = public, pgmq, pg_catalog
as $$
declare
  v_key text := nullif(left(trim(coalesce(p_idempotency_key, '')), 240), '');
  v_msg_id bigint;
  v_inserted boolean := false;
  v_payload jsonb;
begin
  if p_message is null or jsonb_typeof(p_message) <> 'object' then
    raise exception using errcode = '22023', message = 'AI job message must be a JSON object';
  end if;
  if p_delay_seconds < 0 or p_delay_seconds > 86400 then
    raise exception using errcode = '22023', message = 'AI job delay is out of range';
  end if;

  v_payload := p_message;
  if v_key is not null then
    insert into public.ai_job_registry(idempotency_key, job_type)
    values (v_key, coalesce(nullif(p_message ->> 'type', ''), 'unknown'))
    on conflict (idempotency_key) do nothing
    returning true into v_inserted;

    if not coalesce(v_inserted, false) then
      select r.msg_id into v_msg_id
      from public.ai_job_registry r
      where r.idempotency_key = v_key;
      return v_msg_id;
    end if;

    v_payload := p_message || jsonb_build_object('idempotencyKey', v_key);
  end if;

  select s into v_msg_id
  from pgmq.send('ai_jobs', v_payload, p_delay_seconds) as s;

  if v_key is not null then
    update public.ai_job_registry set msg_id = v_msg_id where idempotency_key = v_key;
  end if;
  return v_msg_id;
end;
$$;

create or replace function public.read_ai_jobs(
  p_batch_size integer default 10,
  p_visibility_timeout integer default 60
)
returns table(
  msg_id bigint,
  read_ct bigint,
  enqueued_at timestamptz,
  vt timestamptz,
  message jsonb
)
language sql
security definer
set search_path = pgmq, pg_catalog
as $$
  select q.msg_id, q.read_ct, q.enqueued_at, q.vt, q.message
  from pgmq.read(
    'ai_jobs',
    greatest(1, least(coalesce(p_visibility_timeout, 60), 3600)),
    greatest(1, least(coalesce(p_batch_size, 10), 100))
  ) q;
$$;

create or replace function public.delete_ai_job(p_msg_id bigint)
returns boolean
language plpgsql
security definer
set search_path = public, pgmq, pg_catalog
as $$
declare
  v_deleted boolean;
begin
  select pgmq.delete('ai_jobs', p_msg_id) into v_deleted;
  if v_deleted then
    update public.ai_job_registry
    set status = 'completed', completed_at = now()
    where msg_id = p_msg_id;
  end if;
  return coalesce(v_deleted, false);
end;
$$;

create or replace function public.archive_ai_job(p_msg_id bigint)
returns boolean
language plpgsql
security definer
set search_path = public, pgmq, pg_catalog
as $$
declare
  v_archived boolean;
begin
  select pgmq.archive('ai_jobs', p_msg_id) into v_archived;
  if v_archived then
    update public.ai_job_registry
    set status = 'archived', completed_at = now()
    where msg_id = p_msg_id;
  end if;
  return coalesce(v_archived, false);
end;
$$;

revoke all on function public.enqueue_ai_job(jsonb, text, integer)
  from anon, authenticated, public;
revoke all on function public.read_ai_jobs(integer, integer)
  from anon, authenticated, public;
revoke all on function public.delete_ai_job(bigint)
  from anon, authenticated, public;
revoke all on function public.archive_ai_job(bigint)
  from anon, authenticated, public;
grant execute on function public.enqueue_ai_job(jsonb, text, integer) to service_role;
grant execute on function public.read_ai_jobs(integer, integer) to service_role;
grant execute on function public.delete_ai_job(bigint) to service_role;
grant execute on function public.archive_ai_job(bigint) to service_role;

-- Internal helpers for robust SQL hard filtering and scalar-only vector scoring.
create or replace function public.jsonb_array_or_empty(p_value jsonb)
returns jsonb
language sql
immutable
set search_path = pg_catalog
as $$
  select case when jsonb_typeof(p_value) = 'array' then p_value else '[]'::jsonb end;
$$;

create or replace function public.jsonb_object_or_empty(p_value jsonb)
returns jsonb
language sql
immutable
set search_path = pg_catalog
as $$
  select case when jsonb_typeof(p_value) = 'object' then p_value else '{}'::jsonb end;
$$;

create or replace function public.profile_matching_signals(p_profile public.profiles)
returns jsonb
language sql
stable
set search_path = public, pg_catalog
as $$
  select public.jsonb_object_or_empty(
    coalesce(
      (p_profile).ai_profile_analysis -> 'matchingSignals',
      (p_profile).ai_profile_analysis -> 'matching_signals',
      (p_profile).ai_signals,
      '{}'::jsonb
    )
  );
$$;

create or replace function public.profile_match_tokens(p_profile public.profiles)
returns text[]
language sql
stable
set search_path = public, pg_catalog
as $$
  with signals as (
    select public.profile_matching_signals(p_profile) as value
  ), tokens as (
    select unnest(coalesce((p_profile).interests, '{}'::text[])) as token
    union all select unnest(coalesce((p_profile).personality_tags, '{}'::text[]))
    union all select unnest(coalesce((p_profile).dating_goals, '{}'::text[]))
    union all select unnest(coalesce((p_profile).preferred_vibes, '{}'::text[]))
    union all
      select jsonb_array_elements_text(public.jsonb_array_or_empty(value -> 'vibeTags')) from signals
    union all
      select jsonb_array_elements_text(public.jsonb_array_or_empty(value -> 'selfTraits')) from signals
    union all
      select jsonb_array_elements_text(public.jsonb_array_or_empty(value -> 'intents')) from signals
    union all
      select jsonb_object_keys(public.jsonb_object_or_empty(value -> 'lifestyle')) from signals
    union all
      select jsonb_object_keys(public.jsonb_object_or_empty(value -> 'personality')) from signals
  )
  select coalesce(
    array_agg(distinct lower(trim(token))) filter (where nullif(trim(token), '') is not null),
    '{}'::text[]
  )
  from tokens;
$$;

create or replace function public.snapshot_match_tokens(p_snapshot jsonb)
returns text[]
language sql
immutable
set search_path = public, pg_catalog
as $$
  with tokens as (
    select jsonb_array_elements_text(public.jsonb_array_or_empty(p_snapshot -> 'interests')) as token
    union all select jsonb_array_elements_text(public.jsonb_array_or_empty(p_snapshot -> 'personality_tags'))
    union all select jsonb_array_elements_text(public.jsonb_array_or_empty(p_snapshot -> 'dating_goals'))
    union all select jsonb_array_elements_text(public.jsonb_array_or_empty(p_snapshot -> 'preferred_vibes'))
  )
  select coalesce(
    array_agg(distinct lower(trim(token))) filter (where nullif(trim(token), '') is not null),
    '{}'::text[]
  )
  from tokens;
$$;

create or replace function public.profile_hard_dealbreakers(p_profile public.profiles)
returns text[]
language sql
stable
set search_path = public, pg_catalog
as $$
  with signals as (
    select public.profile_matching_signals(p_profile) as value
  ), items as (
    select value
    from jsonb_array_elements(public.jsonb_array_or_empty((p_profile).dealbreakers)) value
    union all
    select value
    from jsonb_array_elements(
      public.jsonb_array_or_empty((p_profile).appearance_preference -> 'physicalDealbreakers')
    ) value
    union all
    select item
    from signals,
      jsonb_array_elements(public.jsonb_array_or_empty(signals.value -> 'dealbreakers')) item
  ), normalized as (
    select case
      when jsonb_typeof(value) = 'object'
        -- Legacy strings and objects without an explicit severity are soft
        -- evidence. They predate the revision contract and must never empty a
        -- pool as an implicit hard exclusion.
        and lower(coalesce(value ->> 'severity', '')) = 'hard'
        then value ->> 'trait'
      else null
    end as trait
    from items
  )
  select coalesce(
    array_agg(distinct lower(trim(trait))) filter (where nullif(trim(trait), '') is not null),
    '{}'::text[]
  )
  from normalized;
$$;

create or replace function public.profile_height_hard_compatible(
  p_viewer public.profiles,
  p_target public.profiles
)
returns boolean
language plpgsql
stable
set search_path = public, pg_catalog
as $$
declare
  v_pref jsonb := public.jsonb_object_or_empty((p_viewer).appearance_preference -> 'heightPreference');
  v_min integer;
  v_max integer;
  v_taller boolean;
  v_shorter boolean;
begin
  if lower(coalesce(v_pref ->> 'importance', 'none')) <> 'hard' then
    return true;
  end if;
  if coalesce(v_pref ->> 'minHeightCm', '') ~ '^\d{2,3}$' then
    v_min := (v_pref ->> 'minHeightCm')::integer;
  end if;
  if coalesce(v_pref ->> 'maxHeightCm', '') ~ '^\d{2,3}$' then
    v_max := (v_pref ->> 'maxHeightCm')::integer;
  end if;
  v_taller := lower(coalesce(v_pref ->> 'prefersTallerThanSelf', 'false')) = 'true';
  v_shorter := lower(coalesce(v_pref ->> 'prefersShorterThanSelf', 'false')) = 'true';

  -- A hard constraint may only pass when every required measurement is known.
  -- Merely selecting "hard" with no bound/direction remains a no-op.
  if (v_taller or v_shorter) and (p_viewer).height_cm is null then return false; end if;
  if (p_target).height_cm is null then
    return not (v_min is not null or v_max is not null or v_taller or v_shorter);
  end if;

  if v_min is not null and (p_target).height_cm < v_min then return false; end if;
  if v_max is not null and (p_target).height_cm > v_max then return false; end if;
  if v_taller
    and (p_target).height_cm <= (p_viewer).height_cm then return false;
  end if;
  if v_shorter
    and (p_target).height_cm >= (p_viewer).height_cm then return false;
  end if;
  return true;
exception when invalid_text_representation then
  return true;
end;
$$;

create or replace function public.vector_cosine_similarity(
  p_left public.vector(1536),
  p_right public.vector(1536)
)
returns double precision
language sql
immutable
set search_path = public, extensions, pg_catalog
as $$
  select case
    when p_left is null or p_right is null then 0::double precision
    else greatest(0::double precision, least(1::double precision, 1 - (p_left <=> p_right)))
  end;
$$;

create or replace function public.text_array_overlap_ratio(p_left text[], p_right text[])
returns double precision
language sql
immutable
set search_path = pg_catalog
as $$
  select case
    when cardinality(coalesce(p_left, '{}'::text[])) = 0
      or cardinality(coalesce(p_right, '{}'::text[])) = 0 then 0::double precision
    else (
      select count(*)::double precision
      from (
        select distinct lower(value) as value from unnest(p_left) value
        intersect
        select distinct lower(value) as value from unnest(p_right) value
      ) overlap_values
    ) / greatest(cardinality(p_left), cardinality(p_right))::double precision
  end;
$$;

revoke all on function public.jsonb_array_or_empty(jsonb)
  from anon, authenticated, public;
revoke all on function public.jsonb_object_or_empty(jsonb)
  from anon, authenticated, public;
revoke all on function public.profile_matching_signals(public.profiles)
  from anon, authenticated, public;
revoke all on function public.profile_match_tokens(public.profiles)
  from anon, authenticated, public;
revoke all on function public.snapshot_match_tokens(jsonb)
  from anon, authenticated, public;
revoke all on function public.profile_hard_dealbreakers(public.profiles)
  from anon, authenticated, public;
revoke all on function public.profile_height_hard_compatible(public.profiles, public.profiles)
  from anon, authenticated, public;
revoke all on function public.vector_cosine_similarity(public.vector, public.vector)
  from anon, authenticated, public;
revoke all on function public.text_array_overlap_ratio(text[], text[])
  from anon, authenticated, public;

-- One live predicate protects cached cards and accepts after the original
-- generation snapshot. It intentionally excludes history: the current curated
-- row is itself history, while consent/readiness/safety must remain live.
create or replace function public.match_pair_live_eligible(
  p_user_id uuid,
  p_candidate_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  v_admitted_uid uuid;
begin
  v_admitted_uid := private.assert_fpt_self_admission();
  if auth.role() is not null
    and auth.role() <> 'service_role'
    and v_admitted_uid is distinct from p_user_id then
    return false;
  end if;

  return exists (
    select 1
    from public.profiles self_profile
    join public.profiles candidate on candidate.id = p_candidate_id
    where self_profile.id = p_user_id
      and self_profile.id <> candidate.id
      and self_profile.profile_confirmed = true
      and self_profile.profile_completeness >= 75
      and candidate.profile_confirmed = true
      and candidate.profile_completeness >= 75
      and not exists (
        select 1 from public.blocks blocked
        where (blocked.blocker_id = self_profile.id and blocked.blocked_user_id = candidate.id)
           or (blocked.blocker_id = candidate.id and blocked.blocked_user_id = self_profile.id)
      )
      and not exists (
        select 1 from public.reports reported
        where (reported.reporter_id = self_profile.id and reported.reported_user_id = candidate.id)
           or (reported.reporter_id = candidate.id and reported.reported_user_id = self_profile.id)
      )
      and not exists (
        select 1 from public.match_feedback reported_feedback
        where reported_feedback.decision = 'reported'
          and ((reported_feedback.user_id = self_profile.id and reported_feedback.candidate_id = candidate.id)
            or (reported_feedback.user_id = candidate.id and reported_feedback.candidate_id = self_profile.id))
      )
      and not exists (
        select 1 from public.user_safety_actions safety
        where safety.user_id in (self_profile.id, candidate.id)
          and safety.action in ('shadow_review', 'suspension', 'ban')
          and safety.status = 'active'
          and (safety.expires_at is null or safety.expires_at > now())
      )
      and not exists (
        select 1 from public.matches existing_match
        where existing_match.pair_key = public.pair_key_for(self_profile.id, candidate.id)
      )
      and (
        cardinality(self_profile.looking_for_gender) = 0
        or self_profile.looking_for_gender && array['everyone', 'depends']
        or candidate.gender::text = any(self_profile.looking_for_gender)
      )
      and (
        cardinality(candidate.looking_for_gender) = 0
        or candidate.looking_for_gender && array['everyone', 'depends']
        or self_profile.gender::text = any(candidate.looking_for_gender)
      )
      and (self_profile.age_pref_min is null or candidate.age >= self_profile.age_pref_min)
      and (self_profile.age_pref_max is null or candidate.age <= self_profile.age_pref_max)
      and (candidate.age_pref_min is null or self_profile.age >= candidate.age_pref_min)
      and (candidate.age_pref_max is null or self_profile.age <= candidate.age_pref_max)
      and public.profile_height_hard_compatible(self_profile, candidate)
      and public.profile_height_hard_compatible(candidate, self_profile)
      and not (public.profile_hard_dealbreakers(self_profile) && public.profile_match_tokens(candidate))
      and not (public.profile_hard_dealbreakers(candidate) && public.profile_match_tokens(self_profile))
  );
end;
$$;

revoke all on function public.match_pair_live_eligible(uuid, uuid)
  from anon, authenticated, public;
grant execute on function public.match_pair_live_eligible(uuid, uuid) to authenticated, service_role;

create index profiles_match_ready_idx
  on public.profiles(profile_completeness desc, id)
  where profile_confirmed = true and profile_completeness >= 75;
create index blocks_blocked_blocker_idx on public.blocks(blocked_user_id, blocker_id);
create index reports_users_idx on public.reports(reporter_id, reported_user_id);
create index match_feedback_user_candidate_decision_idx
  on public.match_feedback(user_id, candidate_id, decision, created_at desc);
create index curated_matches_user_candidate_created_idx
  on public.curated_matches(user_id, candidate_id, created_at desc);
create index user_safety_actions_active_idx
  on public.user_safety_actions(user_id, action, expires_at)
  where status = 'active';

-- Both the v2 and one-release v1 readers must never resurrect a card after the
-- user decided it. Service-role generation/history queries bypass this policy.
drop policy if exists "curated matches own select" on public.curated_matches;
create policy "curated matches pending own select"
on public.curated_matches for select
using (
  user_id = auth.uid()
  and status = 'pending'
  and public.match_pair_live_eligible(user_id, candidate_id)
);

-- Service-side batch reads recheck the same live predicate as RLS. This closes
-- the gap between a generation snapshot and a later block/moderation action.
create or replace function public.get_daily_match_rows_v2(
  p_user_id uuid,
  p_batch_id text
)
returns setof public.curated_matches
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select m.*
  from public.curated_matches m
  where m.user_id = p_user_id
    and m.batch_id = p_batch_id
    and m.status = 'pending'
    and public.match_pair_live_eligible(m.user_id, m.candidate_id)
  order by m.compatibility_score desc, m.id;
$$;

revoke all on function public.get_daily_match_rows_v2(uuid, text)
  from anon, authenticated, public;
grant execute on function public.get_daily_match_rows_v2(uuid, text) to service_role;

-- Service-only candidate retrieval. Hard filters happen before every shortlist LIMIT.
-- Each ANN branch keeps a bare pgvector distance in ORDER BY so the existing HNSW
-- indexes remain usable. Only the bounded union is exactly reranked and only scalar
-- similarities leave Postgres; private 1536-dimensional vectors never cross JSON.
create or replace function public.get_match_candidates_v2(
  p_user_id uuid,
  p_limit integer default 120,
  p_cooldown_days integer default 30
)
returns table (
  id uuid,
  name text,
  age integer,
  gender public.gender,
  campus public.campus,
  major public.major,
  height_cm integer,
  bio text,
  avatar_url text,
  interests text[],
  personality_tags text[],
  dating_goals text[],
  preferred_vibes text[],
  profile_text jsonb,
  profile_completeness integer,
  looking_for_gender text[],
  age_pref_min integer,
  age_pref_max integer,
  appearance_preference jsonb,
  dealbreakers jsonb,
  ai_profile_analysis jsonb,
  self_similarity double precision,
  need_similarity double precision,
  preference_to_candidate double precision,
  candidate_to_preference double precision,
  communication_similarity double precision,
  lifestyle_similarity double precision,
  feedback_affinity double precision,
  coarse_score double precision
)
language sql
security definer
set search_path = public, extensions, pg_catalog
as $$
  with me as materialized (
    select p.*
    from public.profiles p
    where p.id = p_user_id
      and p.profile_confirmed = true
      and p.profile_completeness >= 75
  ), eligible as materialized (
    select
      candidate.id,
      candidate.profile_completeness,
      public.profile_match_tokens(candidate) as candidate_tokens,
      (
        candidate.embedding_status = 'ready'
        and candidate.embedding_revision = candidate.profile_revision
        and candidate.self_vector is not null
        and candidate.need_vector is not null
        and candidate.preference_vector is not null
        and candidate.communication_vector is not null
        and candidate.lifestyle_vector is not null
      ) as embedding_fresh
    from public.profiles candidate
    cross join me
    where candidate.id <> me.id
      and candidate.profile_confirmed = true
      and candidate.profile_completeness >= 75
      and not exists (
        select 1 from public.blocks b
        where (b.blocker_id = me.id and b.blocked_user_id = candidate.id)
           or (b.blocker_id = candidate.id and b.blocked_user_id = me.id)
      )
      and not exists (
        select 1 from public.reports r
        where (r.reporter_id = me.id and r.reported_user_id = candidate.id)
           or (r.reporter_id = candidate.id and r.reported_user_id = me.id)
      )
      and not exists (
        select 1 from public.match_feedback mf
        where mf.decision = 'reported'
          and ((mf.user_id = me.id and mf.candidate_id = candidate.id)
            or (mf.user_id = candidate.id and mf.candidate_id = me.id))
      )
      and not exists (
        select 1 from public.matches existing_match
        where existing_match.pair_key = public.pair_key_for(me.id, candidate.id)
      )
      and not exists (
        select 1 from public.user_safety_actions sa
        where sa.user_id in (me.id, candidate.id)
          and sa.action in ('shadow_review', 'suspension', 'ban')
          and sa.status = 'active'
          and (sa.expires_at is null or sa.expires_at > now())
      )
      and (
        cardinality(me.looking_for_gender) = 0
        or me.looking_for_gender && array['everyone', 'depends']
        or candidate.gender::text = any(me.looking_for_gender)
      )
      and (
        cardinality(candidate.looking_for_gender) = 0
        or candidate.looking_for_gender && array['everyone', 'depends']
        or me.gender::text = any(candidate.looking_for_gender)
      )
      and (me.age_pref_min is null or candidate.age >= me.age_pref_min)
      and (me.age_pref_max is null or candidate.age <= me.age_pref_max)
      and (candidate.age_pref_min is null or me.age >= candidate.age_pref_min)
      and (candidate.age_pref_max is null or me.age <= candidate.age_pref_max)
      and public.profile_height_hard_compatible(me, candidate)
      and public.profile_height_hard_compatible(candidate, me)
      and not (
        public.profile_hard_dealbreakers(me) && public.profile_match_tokens(candidate)
      )
      and not (
        public.profile_hard_dealbreakers(candidate) && public.profile_match_tokens(me)
      )
      and (
        coalesce(p_cooldown_days, 30) <= 0
        or not exists (
          select 1 from public.curated_matches history
          where history.user_id = me.id
            and history.candidate_id = candidate.id
            and history.created_at >= now() - make_interval(days => least(p_cooldown_days, 365))
        )
      )
  ), me_state as materialized (
    select me.*,
      (
        me.embedding_status = 'ready'
        and me.embedding_revision = me.profile_revision
        and me.self_vector is not null
        and me.need_vector is not null
        and me.preference_vector is not null
        and me.communication_vector is not null
        and me.lifestyle_vector is not null
      ) as embedding_fresh
    from me
  ), ann_preference_to_candidate as materialized (
    select candidate.id
    from public.profiles candidate
    cross join me_state me
    where me.embedding_fresh
      and candidate.embedding_status = 'ready'
      and candidate.embedding_revision = candidate.profile_revision
      and candidate.self_vector is not null
      and exists (select 1 from eligible allowed where allowed.id = candidate.id)
    order by candidate.self_vector <=> me.preference_vector
    limit greatest(1, least(coalesce(p_limit, 120), 300))
  ), ann_candidate_to_preference as materialized (
    select candidate.id
    from public.profiles candidate
    cross join me_state me
    where me.embedding_fresh
      and candidate.embedding_status = 'ready'
      and candidate.embedding_revision = candidate.profile_revision
      and candidate.preference_vector is not null
      and exists (select 1 from eligible allowed where allowed.id = candidate.id)
    order by candidate.preference_vector <=> me.self_vector
    limit greatest(1, least(coalesce(p_limit, 120), 300))
  ), ann_need as materialized (
    select candidate.id
    from public.profiles candidate
    cross join me_state me
    where me.embedding_fresh
      and candidate.embedding_status = 'ready'
      and candidate.embedding_revision = candidate.profile_revision
      and candidate.need_vector is not null
      and exists (select 1 from eligible allowed where allowed.id = candidate.id)
    order by candidate.need_vector <=> me.need_vector
    limit greatest(1, least(coalesce(p_limit, 120), 300))
  ), ann_communication as materialized (
    select candidate.id
    from public.profiles candidate
    cross join me_state me
    where me.embedding_fresh
      and candidate.embedding_status = 'ready'
      and candidate.embedding_revision = candidate.profile_revision
      and candidate.communication_vector is not null
      and exists (select 1 from eligible allowed where allowed.id = candidate.id)
    order by candidate.communication_vector <=> me.communication_vector
    limit greatest(1, least(coalesce(p_limit, 120), 300))
  ), ann_lifestyle as materialized (
    select candidate.id
    from public.profiles candidate
    cross join me_state me
    where me.embedding_fresh
      and candidate.embedding_status = 'ready'
      and candidate.embedding_revision = candidate.profile_revision
      and candidate.lifestyle_vector is not null
      and exists (select 1 from eligible allowed where allowed.id = candidate.id)
    order by candidate.lifestyle_vector <=> me.lifestyle_vector
    limit greatest(1, least(coalesce(p_limit, 120), 300))
  ), ann_self as materialized (
    select candidate.id
    from public.profiles candidate
    cross join me_state me
    where me.embedding_fresh
      and candidate.embedding_status = 'ready'
      and candidate.embedding_revision = candidate.profile_revision
      and candidate.self_vector is not null
      and exists (select 1 from eligible allowed where allowed.id = candidate.id)
    order by candidate.self_vector <=> me.self_vector
    limit greatest(1, least(coalesce(p_limit, 120), 300))
  ), deterministic_fallback as materialized (
    -- Provider failures must not empty the pool. Stale vectors are admitted via
    -- structured signals, but are never read for similarity scoring.
    select candidate.id
    from eligible candidate
    cross join me_state me
    where not me.embedding_fresh or not candidate.embedding_fresh
    order by candidate.profile_completeness desc, candidate.id
    limit greatest(1, least(coalesce(p_limit, 120), 300))
  ), shortlist_ids as materialized (
    select id from ann_preference_to_candidate
    union select id from ann_candidate_to_preference
    union select id from ann_need
    union select id from ann_communication
    union select id from ann_lifestyle
    union select id from ann_self
    union select id from deterministic_fallback
  ), shortlist as materialized (
    -- Keep the all-pool materialization narrow. Only the bounded ANN/fallback
    -- union loads profile JSON and five vectors for exact scalar reranking.
    select candidate.*, allowed.candidate_tokens, allowed.embedding_fresh
    from public.profiles candidate
    join eligible allowed on allowed.id = candidate.id
    join shortlist_ids shortlisted on shortlisted.id = candidate.id
  ), feedback_history as materialized (
    select feedback.decision, public.snapshot_match_tokens(previous.candidate_snapshot) as candidate_tokens
    from public.match_feedback feedback
    join public.curated_matches previous on previous.id = feedback.match_id
    where feedback.user_id = p_user_id
  ), scored as (
    select
      candidate.*,
      case when me.embedding_fresh and candidate.embedding_fresh
        then public.vector_cosine_similarity(me.self_vector, candidate.self_vector)
        else 0::double precision end as self_sim,
      case when me.embedding_fresh and candidate.embedding_fresh
        then public.vector_cosine_similarity(me.need_vector, candidate.need_vector)
        else 0::double precision end as need_sim,
      case when me.embedding_fresh and candidate.embedding_fresh
        then public.vector_cosine_similarity(me.preference_vector, candidate.self_vector)
        else 0::double precision end as pref_to_candidate,
      case when me.embedding_fresh and candidate.embedding_fresh
        then public.vector_cosine_similarity(candidate.preference_vector, me.self_vector)
        else 0::double precision end as candidate_to_pref,
      case when me.embedding_fresh and candidate.embedding_fresh
        then public.vector_cosine_similarity(me.communication_vector, candidate.communication_vector)
        else 0::double precision end as comm_sim,
      case when me.embedding_fresh and candidate.embedding_fresh
        then public.vector_cosine_similarity(me.lifestyle_vector, candidate.lifestyle_vector)
        else 0::double precision end as lifestyle_sim,
      least(0.15::double precision, greatest(-0.15::double precision,
        coalesce((
          select sum(
            case feedback.decision
              when 'accepted' then 1::double precision
              when 'declined' then -0.5::double precision
              when 'skipped' then -0.25::double precision
              when 'reported' then -1::double precision
            end * public.text_array_overlap_ratio(
              feedback.candidate_tokens,
              candidate.candidate_tokens
            )
          ) / nullif(sum(
            case feedback.decision
              when 'accepted' then 1::double precision
              when 'declined' then 0.5::double precision
              when 'skipped' then 0.25::double precision
              when 'reported' then 1::double precision
            end
          ), 0) * 0.12
          from feedback_history feedback
        ), 0::double precision)
        + coalesce((
          select public.text_array_overlap_ratio(
            pref.soft_preferences || pref.feedback_summary,
            candidate.candidate_tokens
          ) * 0.03
          from public.preference_profiles pref
          where pref.user_id = me.id
        ), 0::double precision)
      )) as feedback_fit
    from shortlist candidate
    cross join me_state me
  )
  select
    candidate.id, candidate.name, candidate.age, candidate.gender, candidate.campus,
    candidate.major, candidate.height_cm, candidate.bio, candidate.avatar_url,
    candidate.interests, candidate.personality_tags, candidate.dating_goals,
    candidate.preferred_vibes, candidate.profile_text, candidate.profile_completeness,
    candidate.looking_for_gender, candidate.age_pref_min, candidate.age_pref_max,
    candidate.appearance_preference, candidate.dealbreakers, candidate.ai_profile_analysis,
    candidate.self_sim, candidate.need_sim, candidate.pref_to_candidate,
    candidate.candidate_to_pref, candidate.comm_sim, candidate.lifestyle_sim,
    candidate.feedback_fit,
    (
      0.24 * sqrt(greatest(0::double precision, candidate.pref_to_candidate * candidate.candidate_to_pref))
      + 0.18 * candidate.need_sim
      + 0.15 * candidate.comm_sim
      + 0.14 * candidate.lifestyle_sim
      + 0.08 * candidate.self_sim
      + candidate.feedback_fit
      + case when candidate.campus = me.campus then 0.04 else 0 end
    )::double precision as coarse_score
  from scored candidate
  cross join me_state me
  order by coarse_score desc, candidate.profile_completeness desc, candidate.id
  limit greatest(1, least(coalesce(p_limit, 120), 300));
$$;

-- Keep the one-release vector-bearing adapter service-only as well. Supabase
-- projects can have direct default EXECUTE grants for anon/authenticated, so a
-- revoke from the pseudo-role PUBLIC alone is not sufficient.
revoke all on function public.get_match_candidates(uuid, integer)
  from anon, authenticated, public;
grant execute on function public.get_match_candidates(uuid, integer) to service_role;

revoke all on function public.get_match_candidates_v2(uuid, integer, integer)
  from anon, authenticated, public;
grant execute on function public.get_match_candidates_v2(uuid, integer, integer) to service_role;

-- Sampled observability helper. It mirrors the hard-filter funnel but returns only
-- aggregate counts, never profiles, answers, or vectors. The Edge function invokes
-- it off the response critical path (and always for an empty pool).
create or replace function public.get_match_filter_metrics(
  p_user_id uuid,
  p_cooldown_days integer default 30
)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  with me as materialized (
    select p.* from public.profiles p where p.id = p_user_id
  ), canonical as materialized (
    select candidate.id
    from public.profiles candidate
    cross join me
    where candidate.id <> me.id
      and candidate.profile_confirmed = true
      and candidate.profile_completeness >= 75
  ), after_safety as materialized (
    select candidate.id
    from public.profiles candidate
    join canonical allowed on allowed.id = candidate.id
    cross join me
    where not exists (
        select 1 from public.blocks b
        where (b.blocker_id = me.id and b.blocked_user_id = candidate.id)
           or (b.blocker_id = candidate.id and b.blocked_user_id = me.id)
      )
      and not exists (
        select 1 from public.reports r
        where (r.reporter_id = me.id and r.reported_user_id = candidate.id)
           or (r.reporter_id = candidate.id and r.reported_user_id = me.id)
      )
      and not exists (
        select 1 from public.match_feedback feedback
        where feedback.decision = 'reported'
          and ((feedback.user_id = me.id and feedback.candidate_id = candidate.id)
            or (feedback.user_id = candidate.id and feedback.candidate_id = me.id))
      )
      and not exists (
        select 1 from public.matches existing_match
        where existing_match.pair_key = public.pair_key_for(me.id, candidate.id)
      )
      and not exists (
        select 1 from public.user_safety_actions safety
        where safety.user_id in (me.id, candidate.id)
          and safety.action in ('shadow_review', 'suspension', 'ban')
          and safety.status = 'active'
          and (safety.expires_at is null or safety.expires_at > now())
      )
  ), after_discovery as materialized (
    select candidate.id
    from public.profiles candidate
    join after_safety allowed on allowed.id = candidate.id
    cross join me
      where (
        cardinality(me.looking_for_gender) = 0
        or me.looking_for_gender && array['everyone', 'depends']
        or candidate.gender::text = any(me.looking_for_gender)
      )
      and (
        cardinality(candidate.looking_for_gender) = 0
        or candidate.looking_for_gender && array['everyone', 'depends']
        or me.gender::text = any(candidate.looking_for_gender)
      )
      and (me.age_pref_min is null or candidate.age >= me.age_pref_min)
      and (me.age_pref_max is null or candidate.age <= me.age_pref_max)
      and (candidate.age_pref_min is null or me.age >= candidate.age_pref_min)
      and (candidate.age_pref_max is null or me.age <= candidate.age_pref_max)
  ), after_dealbreakers as materialized (
    select candidate.id
    from public.profiles candidate
    join after_discovery allowed on allowed.id = candidate.id
    cross join me
    where public.profile_height_hard_compatible(me, candidate)
      and public.profile_height_hard_compatible(candidate, me)
      and not (public.profile_hard_dealbreakers(me) && public.profile_match_tokens(candidate))
      and not (public.profile_hard_dealbreakers(candidate) && public.profile_match_tokens(me))
  ), after_history as materialized (
    select candidate.id
    from public.profiles candidate
    join after_dealbreakers allowed on allowed.id = candidate.id
    cross join me
    where coalesce(p_cooldown_days, 30) <= 0
       or not exists (
         select 1 from public.curated_matches history
         where history.user_id = me.id
           and history.candidate_id = candidate.id
           and history.created_at >= now() - make_interval(days => least(p_cooldown_days, 365))
       )
  )
  select jsonb_build_object(
    'canonicalReady', (select count(*) from canonical),
    'afterSafety', (select count(*) from after_safety),
    'afterDiscovery', (select count(*) from after_discovery),
    'afterDealbreakers', (select count(*) from after_dealbreakers),
    'afterHistory', (select count(*) from after_history)
  );
$$;

revoke all on function public.get_match_filter_metrics(uuid, integer)
  from anon, authenticated, public;
grant execute on function public.get_match_filter_metrics(uuid, integer) to service_role;

-- Atomically claims today's Vietnam-time batch. The claim token prevents a stale
-- invocation from finalizing after another worker reclaimed the batch.
create or replace function public.claim_daily_match_batch(
  p_user_id uuid,
  p_algorithm_version text default 'deterministic-v2',
  p_stale_after_seconds integer default 120
)
returns table (
  result text,
  business_date date,
  batch_id text,
  batch_status public.daily_match_batch_status,
  claim_token uuid,
  attempt_count integer,
  retry_after timestamptz,
  profile_revision bigint,
  candidate_pool_revision bigint,
  missing_requirements text[]
)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_date date := public.flove_business_date();
  v_batch_id text := p_user_id::text || '_' || public.flove_business_date()::text;
  v_profile public.profiles%rowtype;
  v_batch public.daily_match_batches%rowtype;
  v_pool_revision bigint;
  v_claim_token uuid;
  v_stale_seconds integer := greatest(30, least(coalesce(p_stale_after_seconds, 120), 900));
  v_missing text[] := '{}'::text[];
  v_batch_found boolean := false;
  v_removed_pending integer := 0;
begin
  perform pg_advisory_xact_lock(hashtextextended(v_batch_id, 0));

  select p.* into v_profile from public.profiles p where p.id = p_user_id;
  select s.revision into v_pool_revision
  from public.candidate_pool_state s where s.singleton;
  v_pool_revision := coalesce(v_pool_revision, 1);

  if v_profile.id is null then
    return query select
      'needs_onboarding'::text, v_date, null::text,
      null::public.daily_match_batch_status, null::uuid, 0, null::timestamptz,
      1::bigint, v_pool_revision,
      array[
        'name', 'age', 'campus', 'major', 'interests', 'personalityTags',
        'datingGoals', 'profileText', 'profileConfirmed'
      ]::text[];
    return;
  end if;

  if not v_profile.profile_confirmed then
    v_missing := array_append(v_missing, 'profileConfirmed');
  end if;
  if v_profile.profile_completeness < 75 then
    if nullif(trim(v_profile.name), '') is null then v_missing := array_append(v_missing, 'name'); end if;
    if v_profile.age < 17 then v_missing := array_append(v_missing, 'age'); end if;
    if cardinality(v_profile.interests) < 3 then v_missing := array_append(v_missing, 'interests'); end if;
    if cardinality(v_profile.personality_tags) < 1 then v_missing := array_append(v_missing, 'personalityTags'); end if;
    if cardinality(v_profile.dating_goals) < 1 then v_missing := array_append(v_missing, 'datingGoals'); end if;
    if nullif(trim(coalesce(v_profile.profile_text ->> 'bio', v_profile.bio)), '') is null then
      v_missing := array_append(v_missing, 'profileText');
    end if;
    -- Completeness is a server-owned aggregate. If legacy data has a stale aggregate,
    -- route through profile review without exposing an internal field identifier.
    if cardinality(v_missing) = 0 then
      v_missing := array_append(v_missing, 'profileText');
    end if;
  end if;

  if cardinality(v_missing) > 0 then
    return query select
      'needs_onboarding'::text, v_date, null::text,
      null::public.daily_match_batch_status, null::uuid, 0, null::timestamptz,
      v_profile.profile_revision, v_pool_revision, v_missing;
    return;
  end if;

  select b.* into v_batch
  from public.daily_match_batches b
  where b.user_id = p_user_id and b.date = v_date
  for update;
  v_batch_found := found;

  if v_batch_found then
    delete from public.curated_matches pending
    where pending.batch_id = v_batch.id
      and pending.status = 'pending'
      and not public.match_pair_live_eligible(pending.user_id, pending.candidate_id);
    get diagnostics v_removed_pending = row_count;

    if v_removed_pending > 0 then
      update public.daily_match_batches batch
      set target_count = (
        select count(*) from public.curated_matches remaining
        where remaining.batch_id = batch.id
      )
      where batch.id = v_batch.id
      returning batch.* into v_batch;
    end if;
  end if;

  -- A decision is durable product state. Repair any historical failed/generating
  -- batch around it and never regenerate rows the user already acted on.
  if v_batch_found and exists (
    select 1 from public.curated_matches decided
    where decided.batch_id = v_batch.id and decided.status <> 'pending'
  ) then
    update public.match_generation_attempts attempt
    set outcome = 'superseded', finished_at = coalesce(attempt.finished_at, now())
    where attempt.batch_id = v_batch.id and attempt.outcome = 'generating';

    update public.daily_match_batches batch
    set status = 'ready',
        finalized_at = coalesce(batch.finalized_at, now()),
        retry_after = null,
        error_code = null,
        claim_token = null
    where batch.id = v_batch.id
    returning batch.* into v_batch;

    return query select
      'cached'::text, v_date, v_batch.id, v_batch.status, null::uuid,
      v_batch.attempt_count, null::timestamptz, v_batch.profile_revision,
      v_batch.candidate_pool_revision, '{}'::text[];
    return;
  end if;

  if v_batch_found
    and v_batch.status = 'ready'
    and v_batch.profile_revision = v_profile.profile_revision
    and v_batch.algorithm_version = left(coalesce(nullif(p_algorithm_version, ''), 'deterministic-v2'), 120)
    and exists (
      select 1 from public.curated_matches current_match
      where current_match.batch_id = v_batch.id
    ) then
    return query select
      'cached'::text, v_date, v_batch.id, v_batch.status, null::uuid,
      v_batch.attempt_count, null::timestamptz, v_batch.profile_revision,
      v_batch.candidate_pool_revision, '{}'::text[];
    return;
  end if;

  if v_batch_found
    and v_batch.status = 'generating'
    and v_batch.generation_started_at > now() - make_interval(secs => v_stale_seconds) then
    return query select
      'processing'::text, v_date, v_batch.id, v_batch.status, null::uuid,
      v_batch.attempt_count,
      v_batch.generation_started_at + make_interval(secs => v_stale_seconds),
      v_batch.profile_revision, v_batch.candidate_pool_revision, '{}'::text[];
    return;
  end if;

  if v_batch_found
    and v_batch.status = 'empty'
    and v_batch.retry_after > now()
    and v_batch.candidate_pool_revision = v_pool_revision then
    return query select
      'empty'::text, v_date, v_batch.id, v_batch.status, null::uuid,
      v_batch.attempt_count, v_batch.retry_after, v_batch.profile_revision,
      v_batch.candidate_pool_revision, '{}'::text[];
    return;
  end if;

  if v_batch_found and v_batch.status = 'failed' and v_batch.retry_after > now() then
    return query select
      'processing'::text, v_date, v_batch.id, v_batch.status, null::uuid,
      v_batch.attempt_count, v_batch.retry_after, v_batch.profile_revision,
      v_batch.candidate_pool_revision, '{}'::text[];
    return;
  end if;

  v_claim_token := gen_random_uuid();

  if v_batch_found then
    update public.match_generation_attempts a
    set outcome = 'superseded', finished_at = now()
    where a.batch_id = v_batch.id and a.outcome = 'generating';

    update public.daily_match_batches b
    set status = 'generating',
        attempt_count = b.attempt_count + 1,
        target_count = 5,
        generation_started_at = now(),
        finalized_at = null,
        retry_after = null,
        error_code = null,
        empty_reason = null,
        algorithm_version = left(coalesce(nullif(p_algorithm_version, ''), 'deterministic-v2'), 120),
        profile_revision = v_profile.profile_revision,
        candidate_pool_revision = v_pool_revision,
        claim_token = v_claim_token,
        enrichment_status = 'skipped',
        enriched_at = null,
        enrichment_error_code = null
    where b.id = v_batch.id
    returning b.* into v_batch;
  else
    insert into public.daily_match_batches(
      id, user_id, date, target_count, generated_by, status, attempt_count,
      generation_started_at, algorithm_version, profile_revision,
      candidate_pool_revision, claim_token, enrichment_status
    ) values (
      v_batch_id, p_user_id, v_date, 5, 'deterministic-v2', 'generating', 1,
      now(), left(coalesce(nullif(p_algorithm_version, ''), 'deterministic-v2'), 120),
      v_profile.profile_revision, v_pool_revision, v_claim_token, 'skipped'
    )
    returning * into v_batch;
  end if;

  insert into public.match_generation_attempts(batch_id, user_id, attempt_no)
  values (v_batch.id, p_user_id, v_batch.attempt_count);

  return query select
    'claimed'::text, v_date, v_batch.id, v_batch.status, v_claim_token,
    v_batch.attempt_count, null::timestamptz, v_profile.profile_revision,
    v_pool_revision, '{}'::text[];
end;
$$;

revoke all on function public.claim_daily_match_batch(uuid, text, integer)
  from anon, authenticated, public;
grant execute on function public.claim_daily_match_batch(uuid, text, integer) to service_role;

create or replace function public.finalize_daily_match_batch(
  p_batch_id text,
  p_user_id uuid,
  p_claim_token uuid,
  p_matches jsonb,
  p_generated_by text default 'deterministic-v2',
  p_empty_reason text default null,
  p_empty_retry_seconds integer default 900,
  p_candidate_count integer default 0,
  p_duration_ms integer default null
)
returns table (
  batch_id text,
  batch_status public.daily_match_batch_status,
  match_count integer,
  business_date date,
  enrichment_status public.match_enrichment_status
)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_batch public.daily_match_batches%rowtype;
  v_match_count integer;
  v_status public.daily_match_batch_status;
  v_empty_reason text;
begin
  if p_matches is null or jsonb_typeof(p_matches) <> 'array' then
    raise exception using errcode = '22023', message = 'matches must be a JSON array';
  end if;
  v_match_count := jsonb_array_length(p_matches);
  if v_match_count > 5 then
    raise exception using errcode = '22023', message = 'A daily batch can contain at most five matches';
  end if;
  if p_candidate_count < 0 or p_candidate_count < v_match_count then
    raise exception using errcode = '22023', message = 'candidate_count is invalid';
  end if;
  if p_duration_ms is not null and p_duration_ms < 0 then
    raise exception using errcode = '22023', message = 'duration_ms is invalid';
  end if;

  select b.* into v_batch
  from public.daily_match_batches b
  where b.id = p_batch_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Daily match batch not found';
  end if;
  if v_batch.user_id <> p_user_id then
    raise exception using errcode = '42501', message = 'Daily match batch owner mismatch';
  end if;
  if v_batch.status <> 'generating' or v_batch.claim_token is distinct from p_claim_token then
    raise exception using errcode = '40001', message = 'Daily match batch claim is stale';
  end if;

  if exists (
    select 1 from public.curated_matches existing
    where existing.batch_id = p_batch_id and existing.status <> 'pending'
  ) then
    raise exception using errcode = '55000', message = 'Cannot replace a decided batch';
  end if;
  delete from public.curated_matches existing where existing.batch_id = p_batch_id;

  if v_match_count > 0 then
    insert into public.curated_matches(
      id, batch_id, user_id, candidate_id, candidate_snapshot, pair_key,
      ai_reason, suggested_opener, compatibility_label, compatibility_score
    )
    select
      p_batch_id || '_' || item.candidate_id::text,
      p_batch_id,
      p_user_id,
      item.candidate_id,
      coalesce(item.candidate_snapshot, '{}'::jsonb),
      public.pair_key_for(p_user_id, item.candidate_id),
      left(coalesce(nullif(item.ai_reason, ''), 'Một kết nối đáng để khám phá.'), 2000),
      nullif(left(coalesce(item.suggested_opener, ''), 1000), ''),
      left(coalesce(nullif(item.compatibility_label, ''), 'Đáng khám phá'), 120),
      greatest(0, least(coalesce(item.compatibility_score, 50), 100))
    from jsonb_to_recordset(p_matches) as item(
      candidate_id uuid,
      candidate_snapshot jsonb,
      pair_key text,
      ai_reason text,
      compatibility_label text,
      compatibility_score integer,
      suggested_opener text
    )
    join public.profiles candidate on candidate.id = item.candidate_id
    join public.profiles self_profile on self_profile.id = p_user_id
    where item.candidate_id <> p_user_id
      and candidate.profile_confirmed = true
      and candidate.profile_completeness >= 75
      and not exists (
        select 1 from public.blocks blocked
        where (blocked.blocker_id = p_user_id and blocked.blocked_user_id = item.candidate_id)
           or (blocked.blocker_id = item.candidate_id and blocked.blocked_user_id = p_user_id)
      )
      and not exists (
        select 1 from public.reports reported
        where (reported.reporter_id = p_user_id and reported.reported_user_id = item.candidate_id)
           or (reported.reporter_id = item.candidate_id and reported.reported_user_id = p_user_id)
      )
      and not exists (
        select 1 from public.match_feedback reported_feedback
        where reported_feedback.decision = 'reported'
          and ((reported_feedback.user_id = p_user_id and reported_feedback.candidate_id = item.candidate_id)
            or (reported_feedback.user_id = item.candidate_id and reported_feedback.candidate_id = p_user_id))
      )
      and not exists (
        select 1 from public.user_safety_actions safety
        where safety.user_id in (p_user_id, item.candidate_id)
          and safety.action in ('shadow_review', 'suspension', 'ban')
          and safety.status = 'active'
          and (safety.expires_at is null or safety.expires_at > now())
      )
      and not exists (
        select 1 from public.matches existing_match
        where existing_match.pair_key = public.pair_key_for(p_user_id, item.candidate_id)
      )
      and (
        cardinality(self_profile.looking_for_gender) = 0
        or self_profile.looking_for_gender && array['everyone', 'depends']
        or candidate.gender::text = any(self_profile.looking_for_gender)
      )
      and (
        cardinality(candidate.looking_for_gender) = 0
        or candidate.looking_for_gender && array['everyone', 'depends']
        or self_profile.gender::text = any(candidate.looking_for_gender)
      )
      and (self_profile.age_pref_min is null or candidate.age >= self_profile.age_pref_min)
      and (self_profile.age_pref_max is null or candidate.age <= self_profile.age_pref_max)
      and (candidate.age_pref_min is null or self_profile.age >= candidate.age_pref_min)
      and (candidate.age_pref_max is null or self_profile.age <= candidate.age_pref_max)
      and public.profile_height_hard_compatible(self_profile, candidate)
      and public.profile_height_hard_compatible(candidate, self_profile)
      and not (public.profile_hard_dealbreakers(self_profile) && public.profile_match_tokens(candidate))
      and not (public.profile_hard_dealbreakers(candidate) && public.profile_match_tokens(self_profile));

    get diagnostics v_match_count = row_count;
    if v_match_count = 0 then
      raise exception using errcode = '22023', message = 'No valid selected candidates';
    end if;
  end if;

  v_status := case when v_match_count > 0 then 'ready' else 'empty' end;
  v_empty_reason := case
    when v_match_count > 0 then null
    when p_empty_reason in ('no_eligible_candidates', 'all_recently_seen') then p_empty_reason
    else 'no_eligible_candidates'
  end;

  update public.daily_match_batches b
  set status = v_status,
      target_count = v_match_count,
      generated_by = left(coalesce(nullif(p_generated_by, ''), 'deterministic-v2'), 120),
      finalized_at = now(),
      retry_after = case when v_match_count = 0
        then now() + make_interval(secs => greatest(60, least(coalesce(p_empty_retry_seconds, 900), 86400)))
        else null end,
      empty_reason = v_empty_reason,
      error_code = null,
      claim_token = null,
      enrichment_status = case
        when v_match_count > 0 then 'pending'::public.match_enrichment_status
        else 'skipped'::public.match_enrichment_status
      end,
      enriched_at = null,
      enrichment_error_code = null
  where b.id = p_batch_id
  returning b.* into v_batch;

  update public.match_generation_attempts a
  set outcome = case when v_match_count > 0 then 'ready' else 'empty' end,
      finished_at = now(),
      candidate_count = p_candidate_count,
      selected_count = v_match_count,
      duration_ms = p_duration_ms,
      error_code = null
  where a.batch_id = p_batch_id and a.attempt_no = v_batch.attempt_count;

  if v_match_count > 0 then
    perform public.enqueue_ai_job(
      jsonb_build_object(
        'type', 'match_enrichment',
        'batchId', p_batch_id,
        'userId', p_user_id,
        'attemptCount', v_batch.attempt_count
      ),
      'match_enrichment:' || p_batch_id || ':' || v_batch.attempt_count::text,
      0
    );
  end if;

  return query select
    v_batch.id, v_batch.status, v_match_count, v_batch.date, v_batch.enrichment_status;
end;
$$;

revoke all on function public.finalize_daily_match_batch(text, uuid, uuid, jsonb, text, text, integer, integer, integer)
  from anon, authenticated, public;
grant execute on function public.finalize_daily_match_batch(text, uuid, uuid, jsonb, text, text, integer, integer, integer) to service_role;

create or replace function public.fail_daily_match_batch(
  p_batch_id text,
  p_claim_token uuid,
  p_error_code text,
  p_retry_after_seconds integer default 60,
  p_candidate_count integer default 0,
  p_duration_ms integer default null
)
returns table (
  batch_id text,
  batch_status public.daily_match_batch_status,
  retry_after timestamptz
)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_batch public.daily_match_batches%rowtype;
begin
  select b.* into v_batch
  from public.daily_match_batches b
  where b.id = p_batch_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Daily match batch not found';
  end if;
  if v_batch.status <> 'generating' or v_batch.claim_token is distinct from p_claim_token then
    raise exception using errcode = '40001', message = 'Daily match batch claim is stale';
  end if;

  update public.daily_match_batches b
  set status = 'failed',
      finalized_at = now(),
      retry_after = now() + make_interval(secs => greatest(15, least(coalesce(p_retry_after_seconds, 60), 3600))),
      error_code = left(coalesce(nullif(p_error_code, ''), 'generation_failed'), 120),
      claim_token = null,
      enrichment_status = 'skipped'
  where b.id = p_batch_id
  returning b.* into v_batch;

  update public.match_generation_attempts a
  set outcome = 'failed',
      finished_at = now(),
      candidate_count = greatest(0, coalesce(p_candidate_count, 0)),
      selected_count = 0,
      duration_ms = case when p_duration_ms is null then null else greatest(0, p_duration_ms) end,
      error_code = v_batch.error_code
  where a.batch_id = p_batch_id and a.attempt_no = v_batch.attempt_count;

  return query select v_batch.id, v_batch.status, v_batch.retry_after;
end;
$$;

revoke all on function public.fail_daily_match_batch(text, uuid, text, integer, integer, integer)
  from anon, authenticated, public;
grant execute on function public.fail_daily_match_batch(text, uuid, text, integer, integer, integer) to service_role;

-- One transaction for every curated-match decision. Idempotency is scoped to the user;
-- reporting also creates the durable safety record used by candidate filtering.
create or replace function public.submit_match_feedback_atomic(
  p_match_id text,
  p_decision public.feedback_decision,
  p_idempotency_key text,
  p_tags text[] default '{}',
  p_note text default ''
)
returns table (
  match_id text,
  status public.curated_match_status,
  applied boolean,
  is_mutual boolean,
  conversation_id text
)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_uid uuid := auth.uid();
  v_match public.curated_matches%rowtype;
  v_batch public.daily_match_batches%rowtype;
  v_existing public.match_feedback%rowtype;
  v_status public.curated_match_status;
  v_key text := nullif(left(trim(coalesce(p_idempotency_key, '')), 240), '');
  v_mutual boolean := false;
  v_conversation_id text;
  v_match_record_id text;
  v_accepted_count integer;
  v_tags text[] := coalesce(p_tags, '{}'::text[]);
  v_note text := nullif(left(trim(coalesce(p_note, '')), 2000), '');
begin
  perform private.assert_fpt_self_admission();
  if v_uid is null then
    raise exception using errcode = '28000', message = 'Not authenticated';
  end if;
  if nullif(trim(coalesce(p_match_id, '')), '') is null or v_key is null then
    raise exception using errcode = '22023', message = 'match_id and idempotency_key are required';
  end if;
  if char_length(trim(p_match_id)) > 240 then
    raise exception using errcode = '22023', message = 'match_id is out of range';
  end if;
  if cardinality(v_tags) > 20 or exists (select 1 from unnest(v_tags) tag where char_length(tag) > 120) then
    raise exception using errcode = '22023', message = 'feedback tags are out of range';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('feedback_key:' || v_uid::text || ':' || v_key, 0)
  );

  select m.* into v_match
  from public.curated_matches m
  where m.id = p_match_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'Curated match not found';
  end if;
  if v_match.user_id <> v_uid then
    raise exception using errcode = '42501', message = 'Cannot update another user match';
  end if;

  -- Generation/finalization lock the parent batch first. Taking the same lock order
  -- prevents a profile-revision reclaim from racing a decision on rows it is about
  -- to replace.
  select batch.* into v_batch
  from public.daily_match_batches batch
  where batch.id = v_match.batch_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Daily match batch not found';
  end if;

  -- Reciprocal curated rows are distinct, so row locks alone do not serialize the
  -- mutual-accept count. Lock the pair before either row to keep lock ordering
  -- consistent when reciprocal accepts/retries arrive concurrently.
  perform pg_advisory_xact_lock(hashtextextended('match_pair:' || v_match.pair_key, 0));

  select m.* into v_match
  from public.curated_matches m
  where m.id = p_match_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Curated match not found';
  end if;

  select f.* into v_existing
  from public.match_feedback f
  where f.user_id = v_uid and f.idempotency_key = v_key;

  if found then
    if v_existing.match_id <> p_match_id
      or v_existing.decision <> p_decision
      or v_existing.tags is distinct from v_tags
      or v_existing.note is distinct from v_note then
      raise exception using errcode = '22023', message = 'Idempotency key was already used for another action';
    end if;
    select c.id into v_conversation_id
    from public.conversations c
    where c.pair_key = v_match.pair_key
    order by c.updated_at desc
    limit 1;
    v_mutual := v_match.status = 'matched';
    return query select v_match.id, v_match.status, false, v_mutual, v_conversation_id;
    return;
  end if;

  if v_batch.status <> 'ready' then
    raise exception using errcode = '55000', message = 'Daily match batch is not ready for feedback';
  end if;

  if p_decision = 'accepted'
    and not public.match_pair_live_eligible(v_uid, v_match.candidate_id) then
    raise exception using errcode = '42501', message = 'This match is no longer eligible for acceptance';
  end if;

  v_status := p_decision::text::public.curated_match_status;
  if v_match.status <> 'pending' then
    if v_match.status = v_status or (p_decision = 'accepted' and v_match.status = 'matched') then
      select c.id into v_conversation_id
      from public.conversations c
      where c.pair_key = v_match.pair_key
      order by c.updated_at desc
      limit 1;
      return query select v_match.id, v_match.status, false, v_match.status = 'matched', v_conversation_id;
      return;
    end if;
    raise exception using errcode = '55000', message = 'Curated match was already decided';
  end if;

  insert into public.match_feedback(
    match_id, user_id, candidate_id, decision, tags, note, idempotency_key
  ) values (
    p_match_id, v_uid, v_match.candidate_id, p_decision, v_tags, v_note, v_key
  );

  update public.curated_matches m
  set status = v_status,
      feedback_tags = v_tags,
      feedback_note = v_note,
      decided_at = now()
  where m.id = p_match_id;

  if p_decision = 'reported' then
    insert into public.reports(
      reporter_id, reported_user_id, curated_match_id, reason, note
    ) values (
      v_uid, v_match.candidate_id, p_match_id, 'match_feedback_report',
      coalesce(v_note, nullif(array_to_string(v_tags, ', '), ''))
    );
  elsif p_decision = 'accepted' then
    select count(distinct m.user_id) into v_accepted_count
    from public.curated_matches m
    where m.pair_key = v_match.pair_key and m.status in ('accepted', 'matched');

    if v_accepted_count >= 2 then
      insert into public.matches(id, pair_key, source, is_revealed)
      values (v_match.pair_key, v_match.pair_key, 'ai-curated', true)
      on conflict (pair_key) do update set is_revealed = true
      returning id into v_match_record_id;

      select c.id into v_conversation_id
      from public.conversations c
      where c.match_id = v_match_record_id
      order by c.updated_at desc
      limit 1;

      if v_conversation_id is null then
        v_conversation_id := 'conversation_' || v_match.pair_key;
        insert into public.conversations(id, match_id, pair_key, is_anonymous)
        values (v_conversation_id, v_match_record_id, v_match.pair_key, false)
        on conflict (id) do update
          set match_id = excluded.match_id, pair_key = excluded.pair_key, is_anonymous = false;
      end if;

      insert into public.conversation_participants(conversation_id, user_id, unread_count)
      values
        (v_conversation_id, v_match.user_id, 0),
        (v_conversation_id, v_match.candidate_id, 0)
      on conflict on constraint conversation_participants_pkey do nothing;

      update public.curated_matches m
      set status = 'matched', decided_at = coalesce(m.decided_at, now())
      where m.pair_key = v_match.pair_key and m.status in ('accepted', 'matched');
      v_status := 'matched';
      v_mutual := true;
    end if;
  end if;

  return query select p_match_id, v_status, true, v_mutual, v_conversation_id;
end;
$$;

revoke all on function public.submit_match_feedback_atomic(text, public.feedback_decision, text, text[], text)
  from anon, authenticated, public;
grant execute on function public.submit_match_feedback_atomic(text, public.feedback_decision, text, text[], text) to authenticated;

-- Preserve the v1 RPC while routing it through the idempotent transaction.
create or replace function public.accept_curated_match(
  p_match_id text,
  p_tags text[] default '{}',
  p_note text default ''
)
returns table(is_mutual boolean, conversation_id text)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_result record;
begin
  perform private.assert_fpt_self_admission();
  select * into v_result
  from public.submit_match_feedback_atomic(
    p_match_id,
    'accepted',
    'legacy_accept:' || auth.uid()::text || ':' || p_match_id,
    p_tags,
    p_note
  );
  return query select v_result.is_mutual, v_result.conversation_id;
end;
$$;

revoke all on function public.accept_curated_match(text, text[], text)
  from anon, authenticated, public;
grant execute on function public.accept_curated_match(text, text[], text) to authenticated;

create or replace function public.save_preference_chat_turn_atomic(
  p_content text,
  p_hints text[],
  p_assistant_content text,
  p_request_id text
)
returns table (
  user_message_id uuid,
  assistant_message_id uuid,
  applied boolean
)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_uid uuid := auth.uid();
  v_request_id text := nullif(left(trim(coalesce(p_request_id, '')), 240), '');
  v_content text := trim(coalesce(p_content, ''));
  v_assistant text := trim(coalesce(p_assistant_content, ''));
  v_hints text[] := coalesce(p_hints, '{}'::text[]);
  v_expected_payload jsonb;
  v_user_id uuid;
  v_assistant_id uuid;
  v_existing_user_content text;
  v_existing_assistant_content text;
  v_existing_payload jsonb;
begin
  perform private.assert_fpt_self_admission();
  if v_uid is null then
    raise exception using errcode = '28000', message = 'Not authenticated';
  end if;
  if v_request_id is null or char_length(v_content) = 0 or char_length(v_content) > 2000
    or char_length(v_assistant) = 0 or char_length(v_assistant) > 2000 then
    raise exception using errcode = '22023', message = 'Preference chat payload is invalid';
  end if;
  if cardinality(v_hints) > 20 or exists (select 1 from unnest(v_hints) hint where char_length(hint) > 120) then
    raise exception using errcode = '22023', message = 'Preference hints are out of range';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('preference_chat:' || v_uid::text, 0));

  v_expected_payload := jsonb_build_object(
    'content', v_content,
    'assistantContent', v_assistant,
    'hints', to_jsonb(v_hints)
  );

  select m.id, m.content, m.request_payload
  into v_user_id, v_existing_user_content, v_existing_payload
  from public.preference_chat_messages m
  where m.user_id = v_uid and m.client_request_id = v_request_id and m.sender = 'user';
  select m.id, m.content
  into v_assistant_id, v_existing_assistant_content
  from public.preference_chat_messages m
  where m.user_id = v_uid and m.client_request_id = v_request_id and m.sender = 'assistant';

  if v_user_id is not null and v_assistant_id is not null then
    if v_existing_user_content is distinct from v_content
      or v_existing_assistant_content is distinct from v_assistant
      or v_existing_payload is distinct from v_expected_payload then
      raise exception using errcode = '22023', message = 'Idempotency key was reused with a different preference chat payload';
    end if;
    return query select v_user_id, v_assistant_id, false;
    return;
  end if;
  if v_user_id is not null or v_assistant_id is not null then
    raise exception using errcode = '55000', message = 'Incomplete preference chat transaction detected';
  end if;

  insert into public.preference_chat_messages(user_id, sender, content, client_request_id, request_payload)
  values (v_uid, 'user', v_content, v_request_id, v_expected_payload)
  returning id into v_user_id;

  insert into public.preference_chat_messages(user_id, sender, content, client_request_id, request_payload)
  values (v_uid, 'assistant', v_assistant, v_request_id, v_expected_payload)
  returning id into v_assistant_id;

  insert into public.preference_profiles(user_id, summary, soft_preferences, updated_at)
  values (v_uid, v_content, v_hints, now())
  on conflict (user_id) do update
    set summary = excluded.summary,
        soft_preferences = excluded.soft_preferences,
        updated_at = excluded.updated_at;

  return query select v_user_id, v_assistant_id, true;
end;
$$;

revoke all on function public.save_preference_chat_turn_atomic(text, text[], text, text)
  from anon, authenticated, public;
grant execute on function public.save_preference_chat_turn_atomic(text, text[], text, text) to authenticated;

-- Preference learning is one atomic transcript+profile transaction. Direct
-- writes would bypass both idempotency and the paired assistant message.
drop policy if exists "preference profiles own insert" on public.preference_profiles;
drop policy if exists "preference profiles own update" on public.preference_profiles;
revoke insert, update, delete on public.preference_profiles from anon, authenticated;
grant select on public.preference_profiles to authenticated;

-- Idempotent message send also updates conversation summaries and unread counters.
create or replace function public.send_message_atomic(
  p_conversation_id text,
  p_content text,
  p_client_message_id text,
  p_expected_user_id uuid default null
)
returns table (
  message_id uuid,
  created_at timestamptz,
  applied boolean
)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_uid uuid := auth.uid();
  v_content text := trim(coalesce(p_content, ''));
  v_client_id text := nullif(left(trim(coalesce(p_client_message_id, '')), 240), '');
  v_message public.messages%rowtype;
begin
  perform private.assert_fpt_self_admission();
  if v_uid is null then
    raise exception using errcode = '28000', message = 'Not authenticated';
  end if;
  if p_expected_user_id is not null and p_expected_user_id <> v_uid then
    raise exception using errcode = '40001', message = 'Session changed before message send';
  end if;
  if v_client_id is null or char_length(v_content) = 0 or char_length(v_content) > 4000 then
    raise exception using errcode = '22023', message = 'Message payload is invalid';
  end if;
  if not exists (
    select 1 from public.conversation_participants cp
    where cp.conversation_id = p_conversation_id and cp.user_id = v_uid
  ) then
    raise exception using errcode = '42501', message = 'Conversation access denied';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('message_key:' || v_uid::text || ':' || v_client_id, 0)
  );

  select m.* into v_message
  from public.messages m
  where m.sender_id = v_uid and m.client_message_id = v_client_id;
  if found then
    if v_message.conversation_id <> p_conversation_id or v_message.content <> v_content then
      raise exception using errcode = '22023', message = 'Client message ID was reused with different content';
    end if;
    return query select v_message.id, v_message.created_at, false;
    return;
  end if;

  insert into public.messages(conversation_id, sender_id, content, client_message_id)
  values (p_conversation_id, v_uid, v_content, v_client_id)
  returning * into v_message;

  update public.conversations c
  set last_message = jsonb_build_object(
        'id', v_message.id,
        'senderId', v_uid,
        'content', v_content,
        'createdAt', v_message.created_at
      ),
      updated_at = v_message.created_at
  where c.id = p_conversation_id;

  update public.conversation_participants cp
  set unread_count = cp.unread_count + 1
  where cp.conversation_id = p_conversation_id and cp.user_id <> v_uid;

  return query select v_message.id, v_message.created_at, true;
end;
$$;

revoke all on function public.send_message_atomic(text, text, text, uuid)
  from anon, authenticated, public;
grant execute on function public.send_message_atomic(text, text, text, uuid) to authenticated;

-- Reading a conversation is one participant-scoped transaction: reset only the
-- caller's counter and mark only counterpart messages. Repeating the call is a
-- no-op with applied=false.
create or replace function public.mark_conversation_read(p_conversation_id text)
returns table (
  conversation_id text,
  unread_count integer,
  marked_read_count integer,
  applied boolean
)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_uid uuid := auth.uid();
  v_conversation_id text := nullif(left(btrim(coalesce(p_conversation_id, '')), 240), '');
  v_previous_unread integer;
  v_marked integer := 0;
begin
  perform private.assert_fpt_self_admission();
  if v_uid is null then
    raise exception using errcode = '28000', message = 'Not authenticated';
  end if;
  if v_conversation_id is null or v_conversation_id <> btrim(coalesce(p_conversation_id, '')) then
    raise exception using errcode = '22023', message = 'conversation_id is invalid';
  end if;

  select participant.unread_count
  into v_previous_unread
  from public.conversation_participants participant
  where participant.conversation_id = v_conversation_id
    and participant.user_id = v_uid
  for update;

  if not found then
    raise exception using errcode = '42501', message = 'Conversation access denied';
  end if;

  update public.conversation_participants participant
  set unread_count = 0
  where participant.conversation_id = v_conversation_id
    and participant.user_id = v_uid
    and participant.unread_count <> 0;

  update public.messages message
  set is_read = true
  where message.conversation_id = v_conversation_id
    and message.sender_id <> v_uid
    and message.is_read = false;
  get diagnostics v_marked = row_count;

  return query select
    v_conversation_id,
    0,
    v_marked,
    coalesce(v_previous_unread, 0) > 0 or v_marked > 0;
end;
$$;

revoke all on function public.mark_conversation_read(text)
  from anon, authenticated, public;
grant execute on function public.mark_conversation_read(text) to authenticated;

-- Once the app has an atomic path, direct inserts would bypass idempotency and
-- unread/preference-profile updates. Reads remain protected by the existing RLS.
drop policy if exists "messages participant insert" on public.messages;
drop policy if exists "preference chat own insert" on public.preference_chat_messages;
revoke insert on public.messages from anon, authenticated;
revoke insert on public.preference_chat_messages from anon, authenticated;

-- Realtime invalidation is driven by participant unread-count/session changes.
-- A clean project does not publish this table unless the migration adds it.
do $$
begin
  alter publication supabase_realtime add table public.conversation_participants;
exception when duplicate_object then
  null;
end;
$$;

-- A single database transaction claims a waiting Blind Date partner and creates all
-- related records. The advisory lock serializes the small queue and eliminates double-pairing.
create or replace function public.find_blind_date_partner_atomic(p_masked_name text)
returns table (
  waiting boolean,
  session_id text,
  conversation_id text,
  partner_id uuid,
  partner_masked_name text
)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_uid uuid := auth.uid();
  v_masked_name text := nullif(left(trim(coalesce(p_masked_name, '')), 80), '');
  v_candidate public.blind_date_queue%rowtype;
  v_session public.blind_date_sessions%rowtype;
  v_session_id text;
  v_conversation_id text;
  v_partner_id uuid;
begin
  perform private.assert_fpt_self_admission();
  if v_uid is null then
    raise exception using errcode = '28000', message = 'Not authenticated';
  end if;
  if v_masked_name is null then
    raise exception using errcode = '22023', message = 'masked_name is required';
  end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = v_uid and p.profile_confirmed = true and p.profile_completeness >= 75
  ) then
    raise exception using errcode = '55000', message = 'Complete onboarding before joining Blind Date';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('blind_date_queue', 0));

  select s.* into v_session
  from public.blind_date_sessions s
  where v_uid = any(s.user_ids)
    and exists (
      select 1 from public.blind_date_queue own_queue
      where own_queue.user_id = v_uid and own_queue.status = 'matched'
    )
  order by s.created_at desc
  limit 1;

  if found then
    select member into v_partner_id
    from unnest(v_session.user_ids) member
    where member <> v_uid
    limit 1;
    return query select
      false, v_session.id, v_session.conversation_id, v_partner_id,
      v_session.partner_masked_names ->> v_uid::text;
    return;
  end if;

  select q.* into v_candidate
  from public.blind_date_queue q
  join public.profiles candidate on candidate.id = q.user_id
  where q.status = 'waiting'
    and q.user_id <> v_uid
    and candidate.profile_confirmed = true
    and candidate.profile_completeness >= 75
    and not exists (
      select 1
      from public.blind_date_sessions existing_session
      where q.user_id = any(existing_session.user_ids)
    )
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_id = v_uid and b.blocked_user_id = q.user_id)
         or (b.blocker_id = q.user_id and b.blocked_user_id = v_uid)
    )
    and not exists (
      select 1 from public.reports r
      where (r.reporter_id = v_uid and r.reported_user_id = q.user_id)
         or (r.reporter_id = q.user_id and r.reported_user_id = v_uid)
    )
    and not exists (
      select 1 from public.user_safety_actions sa
      where sa.user_id in (v_uid, q.user_id)
        and sa.action in ('shadow_review', 'suspension', 'ban')
        and sa.status = 'active'
        and (sa.expires_at is null or sa.expires_at > now())
    )
  order by q.queued_at, q.user_id
  for update of q skip locked
  limit 1;

  if not found then
    insert into public.blind_date_queue as current_queue(user_id, masked_name, status, queued_at)
    values (v_uid, v_masked_name, 'waiting', now())
    on conflict (user_id) do update
      set masked_name = excluded.masked_name,
          status = 'waiting',
          queued_at = case
            when current_queue.status = 'waiting'
              then current_queue.queued_at
            else excluded.queued_at
          end;
    return query select true, null::text, null::text, null::uuid, null::text;
    return;
  end if;

  v_session_id := 'blind_' || gen_random_uuid()::text;
  v_conversation_id := 'blind_conversation_' || gen_random_uuid()::text;

  insert into public.conversations(id, pair_key, is_anonymous)
  values (v_conversation_id, public.pair_key_for(v_uid, v_candidate.user_id), true);

  insert into public.conversation_participants(
    conversation_id, user_id, unread_count, masked_name
  ) values
    (v_conversation_id, v_uid, 0, v_masked_name),
    (v_conversation_id, v_candidate.user_id, 0, v_candidate.masked_name);

  insert into public.blind_date_sessions(
    id, conversation_id, user_ids, partner_masked_names
  ) values (
    v_session_id,
    v_conversation_id,
    array[v_uid, v_candidate.user_id],
    jsonb_build_object(
      v_uid::text, v_candidate.masked_name,
      v_candidate.user_id::text, v_masked_name
    )
  );

  insert into public.blind_date_queue(user_id, masked_name, status, queued_at)
  values (v_uid, v_masked_name, 'matched', now())
  on conflict (user_id) do update
    set masked_name = excluded.masked_name, status = 'matched';

  update public.blind_date_queue q
  set status = 'matched'
  where q.user_id = v_candidate.user_id;

  return query select
    false, v_session_id, v_conversation_id, v_candidate.user_id, v_candidate.masked_name;
end;
$$;

revoke all on function public.find_blind_date_partner_atomic(text)
  from anon, authenticated, public;
grant execute on function public.find_blind_date_partner_atomic(text) to authenticated;

create or replace function public.request_reveal_atomic(p_session_id text)
returns table (
  accepted boolean,
  is_revealed boolean,
  reveal_requests jsonb
)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_uid uuid := auth.uid();
  v_session public.blind_date_sessions%rowtype;
  v_requests jsonb;
  v_accepted boolean;
  v_pair_key text;
  v_match_id text;
begin
  perform private.assert_fpt_self_admission();
  if v_uid is null then
    raise exception using errcode = '28000', message = 'Not authenticated';
  end if;

  select s.* into v_session
  from public.blind_date_sessions s
  where s.id = p_session_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Blind Date session not found';
  end if;
  if not (v_uid = any(v_session.user_ids)) then
    raise exception using errcode = '42501', message = 'Blind Date session access denied';
  end if;

  v_requests := coalesce(v_session.reveal_requests, '{}'::jsonb)
    || jsonb_build_object(v_uid::text, true);
  -- bool_and ignores NULL inputs. Treat a missing participant key as false so
  -- one request cannot reveal a two-person session by itself.
  select coalesce(bool_and(coalesce(
    v_requests -> member::text = 'true'::jsonb,
    false
  )), false)
  into v_accepted
  from unnest(v_session.user_ids) member;

  update public.blind_date_sessions s
  set reveal_requests = v_requests,
      is_revealed = v_accepted
  where s.id = p_session_id;

  if v_accepted and cardinality(v_session.user_ids) = 2 then
    v_pair_key := public.pair_key_for(v_session.user_ids[1], v_session.user_ids[2]);
    insert into public.matches(id, pair_key, source, is_revealed)
    values ('blind_match_' || v_pair_key, v_pair_key, 'blind-date', true)
    on conflict (pair_key) do update set is_revealed = true
    returning id into v_match_id;

    update public.conversations c
    set match_id = v_match_id,
        pair_key = v_pair_key,
        is_anonymous = false,
        updated_at = now()
    where c.id = v_session.conversation_id;
  end if;

  return query select v_accepted, v_accepted, v_requests;
end;
$$;

revoke all on function public.request_reveal_atomic(text)
  from anon, authenticated, public;
grant execute on function public.request_reveal_atomic(text) to authenticated;

-- Fixed-window paid-AI limiter. It is service-only so callers cannot mint capacity.
create table public.ai_rate_limit_buckets (
  user_id uuid not null references auth.users(id) on delete cascade,
  scope text not null,
  window_start timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, scope, window_start)
);

alter table public.ai_rate_limit_buckets enable row level security;

create index ai_rate_limit_buckets_updated_idx
  on public.ai_rate_limit_buckets(updated_at);

create or replace function public.claim_ai_rate_limit(
  p_user_id uuid,
  p_scope text,
  p_limit integer,
  p_window_seconds integer
)
returns table (
  allowed boolean,
  remaining integer,
  reset_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_scope text := nullif(left(trim(coalesce(p_scope, '')), 120), '');
  v_window_start timestamptz;
  v_reset_at timestamptz;
  v_count integer;
begin
  if p_user_id is null or v_scope is null
    or p_limit < 1 or p_limit > 10000
    or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception using errcode = '22023', message = 'AI rate-limit arguments are invalid';
  end if;

  v_window_start := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );
  v_reset_at := v_window_start + make_interval(secs => p_window_seconds);

  insert into public.ai_rate_limit_buckets as current_bucket(user_id, scope, window_start, request_count)
  values (p_user_id, v_scope, v_window_start, 1)
  on conflict (user_id, scope, window_start) do update
    set request_count = current_bucket.request_count + 1,
        updated_at = now()
    where current_bucket.request_count < p_limit
  returning request_count into v_count;

  if v_count is null then
    select b.request_count into v_count
    from public.ai_rate_limit_buckets b
    where b.user_id = p_user_id and b.scope = v_scope and b.window_start = v_window_start;
    return query select false, 0, v_reset_at;
  else
    return query select true, greatest(0, p_limit - v_count), v_reset_at;
  end if;
end;
$$;

revoke all on function public.claim_ai_rate_limit(uuid, text, integer, integer)
  from anon, authenticated, public;
grant execute on function public.claim_ai_rate_limit(uuid, text, integer, integer) to service_role;

-- Queue embeddings whenever a confirmed matching profile advances revision. The
-- idempotency key makes an explicit enqueue from the confirmation Edge Function harmless.
create or replace function public.queue_profile_embedding_job()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_key_prefix text;
  v_current_key text;
  v_stale record;
begin
  if new.profile_confirmed = true
    and new.profile_completeness >= 75
    and new.embedding_status = 'pending'
    and (
      tg_op = 'INSERT'
      or old.profile_revision is distinct from new.profile_revision
      or old.embedding_status is distinct from new.embedding_status
    ) then
    v_key_prefix := 'profile_embedding:' || new.id::text || ':';
    v_current_key := v_key_prefix || new.profile_revision::text;
    perform pg_advisory_xact_lock(hashtextextended(v_key_prefix, 0));

    -- A burst of profile edits should occupy one FIFO slot, not one slot per
    -- historical revision. Completion remains revision-fenced, so deleting a
    -- stale queued message cannot make an old vector authoritative.
    for v_stale in
      select registry.idempotency_key, registry.msg_id
      from public.ai_job_registry registry
      where registry.job_type = 'profile_embedding'
        and registry.status = 'queued'
        and left(registry.idempotency_key, char_length(v_key_prefix)) = v_key_prefix
        and registry.idempotency_key <> v_current_key
      for update
    loop
      if v_stale.msg_id is not null then
        perform public.delete_ai_job(v_stale.msg_id);
      end if;
      update public.ai_job_registry registry
      set status = 'completed', completed_at = coalesce(registry.completed_at, now())
      where registry.idempotency_key = v_stale.idempotency_key
        and registry.status = 'queued';
    end loop;

    perform public.enqueue_ai_job(
      jsonb_build_object(
        'type', 'profile_embedding',
        'userId', new.id,
        'profileRevision', new.profile_revision
      ),
      v_current_key,
      0
    );
  end if;
  return new;
end;
$$;

revoke all on function public.queue_profile_embedding_job()
  from anon, authenticated, public;

create trigger profiles_queue_embedding_job_on_insert
after insert on public.profiles
for each row execute function public.queue_profile_embedding_job();

create trigger profiles_queue_embedding_job_on_update
after update on public.profiles
for each row execute function public.queue_profile_embedding_job();

-- Enqueue pre-migration confirmed profiles whose vectors were absent.
select public.enqueue_ai_job(
  jsonb_build_object(
    'type', 'profile_embedding',
    'userId', p.id,
    'profileRevision', p.profile_revision
  ),
  'profile_embedding:' || p.id::text || ':' || p.profile_revision::text,
  0
)
from public.profiles p
where p.profile_confirmed = true
  and p.profile_completeness >= 75
  and p.embedding_status = 'pending';

create or replace function public.mark_profile_embedding_processing(
  p_user_id uuid,
  p_profile_revision bigint
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  update public.profiles p
  set embedding_status = 'processing',
      embedding_error_code = null,
      embedding_updated_at = now()
  where p.id = p_user_id
    and p.profile_revision = p_profile_revision
    and p.embedding_revision < p_profile_revision
    and (
      p.embedding_status in ('pending', 'failed')
      -- Provider work is bounded to 20 seconds. Reclaiming after 45 seconds is
      -- safely below the queue's 60-second visibility timeout, so a killed
      -- worker cannot strand this revision in `processing` forever.
      or (
        p.embedding_status = 'processing'
        and coalesce(p.embedding_updated_at, '-infinity'::timestamptz) <= now() - interval '45 seconds'
      )
    );
  return found;
end;
$$;

create or replace function public.complete_profile_embedding_job(
  p_user_id uuid,
  p_profile_revision bigint,
  p_vectors jsonb,
  p_error_code text default null
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions, pg_catalog
as $$
declare
  v_self public.vector(1536);
  v_need public.vector(1536);
  v_preference public.vector(1536);
  v_communication public.vector(1536);
  v_lifestyle public.vector(1536);
begin
  if nullif(trim(coalesce(p_error_code, '')), '') is not null then
    update public.profiles p
    set embedding_status = 'failed',
        embedding_error_code = left(trim(p_error_code), 120),
        embedding_updated_at = now()
    where p.id = p_user_id
      and p.profile_revision = p_profile_revision
      and p.embedding_revision < p_profile_revision;
    return found;
  end if;

  if p_vectors is null or jsonb_typeof(p_vectors) <> 'object' then
    raise exception using errcode = '22023', message = 'vectors must be a JSON object';
  end if;

  begin
    v_self := (p_vectors -> 'self')::text::public.vector(1536);
    v_need := (p_vectors -> 'need')::text::public.vector(1536);
    v_preference := (p_vectors -> 'preference')::text::public.vector(1536);
    v_communication := (p_vectors -> 'communication')::text::public.vector(1536);
    v_lifestyle := (p_vectors -> 'lifestyle')::text::public.vector(1536);
  exception when others then
    raise exception using errcode = '22023', message = 'Each embedding must contain exactly 1536 numeric dimensions';
  end;

  if v_self is null or v_need is null or v_preference is null
    or v_communication is null or v_lifestyle is null then
    raise exception using errcode = '22023', message = 'All five embeddings are required';
  end if;

  update public.profiles p
  set self_vector = v_self,
      need_vector = v_need,
      preference_vector = v_preference,
      communication_vector = v_communication,
      lifestyle_vector = v_lifestyle,
      embedding_revision = p_profile_revision,
      embedding_status = 'ready',
      embedding_error_code = null,
      embedding_updated_at = now()
  where p.id = p_user_id
    and p.profile_revision = p_profile_revision
    and p.embedding_revision < p_profile_revision;
  return found;
end;
$$;

revoke all on function public.mark_profile_embedding_processing(uuid, bigint)
  from anon, authenticated, public;
revoke all on function public.complete_profile_embedding_job(uuid, bigint, jsonb, text)
  from anon, authenticated, public;
grant execute on function public.mark_profile_embedding_processing(uuid, bigint) to service_role;
grant execute on function public.complete_profile_embedding_job(uuid, bigint, jsonb, text) to service_role;

-- Enrichment may only replace prose. Deterministic score, label and ordering stay immutable.
create or replace function public.complete_daily_match_enrichment(
  p_batch_id text,
  p_attempt_count integer,
  p_updates jsonb,
  p_error_code text default null
)
returns public.match_enrichment_status
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_status public.match_enrichment_status;
begin
  if p_attempt_count is null or p_attempt_count < 1 then
    raise exception using errcode = '22023', message = 'attempt count must be positive';
  end if;

  select b.enrichment_status into v_status
  from public.daily_match_batches b
  where b.id = p_batch_id
    and b.status = 'ready'
    and b.attempt_count = p_attempt_count
  for update;
  if not found then
    -- The batch was reclaimed/regenerated after this job was enqueued. Returning
    -- skipped lets the worker acknowledge the stale job without touching the
    -- replacement attempt.
    return 'skipped'::public.match_enrichment_status;
  end if;

  -- A duplicate/stale worker must never downgrade completed enrichment.
  if v_status = 'ready' then
    return v_status;
  end if;

  if nullif(trim(coalesce(p_error_code, '')), '') is not null then
    update public.daily_match_batches b
    set enrichment_status = 'failed',
        enrichment_error_code = left(trim(p_error_code), 120),
        enriched_at = now()
    where b.id = p_batch_id and b.attempt_count = p_attempt_count
    returning b.enrichment_status into v_status;
    return v_status;
  end if;

  if p_updates is null or jsonb_typeof(p_updates) <> 'array' then
    raise exception using errcode = '22023', message = 'enrichment updates must be a JSON array';
  end if;

  update public.curated_matches m
  set ai_reason = left(coalesce(nullif(trim(item.ai_reason), ''), m.ai_reason), 2000),
      suggested_opener = nullif(left(coalesce(item.suggested_opener, m.suggested_opener, ''), 1000), '')
  from jsonb_to_recordset(p_updates) as item(
    candidate_id uuid,
    ai_reason text,
    suggested_opener text
  )
  where m.batch_id = p_batch_id
    and m.candidate_id = item.candidate_id
    and exists (
      select 1 from public.daily_match_batches current_batch
      where current_batch.id = p_batch_id
        and current_batch.attempt_count = p_attempt_count
        and current_batch.status = 'ready'
    );

  update public.daily_match_batches b
  set enrichment_status = 'ready',
      enrichment_error_code = null,
      enriched_at = now()
  where b.id = p_batch_id and b.attempt_count = p_attempt_count
  returning b.enrichment_status into v_status;
  return v_status;
end;
$$;

revoke all on function public.complete_daily_match_enrichment(text, integer, jsonb, text)
  from anon, authenticated, public;
grant execute on function public.complete_daily_match_enrichment(text, integer, jsonb, text) to service_role;

-- Confirmation is a compare-and-swap over the analyzed draft and the canonical profile.
-- The caller is trusted server code, but every persisted field is explicitly selected.
create or replace function public.confirm_onboarding_profile_atomic(
  p_user_id uuid,
  p_draft_revision bigint,
  p_analysis_revision bigint,
  p_profile jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  v_draft public.onboarding_drafts%rowtype;
  v_profile jsonb;
begin
  if p_profile is null or jsonb_typeof(p_profile) <> 'object' then
    raise exception using errcode = '22023', message = 'profile must be a JSON object';
  end if;

  select d.* into v_draft
  from public.onboarding_drafts d
  where d.user_id = p_user_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Onboarding draft not found';
  end if;
  if v_draft.draft_revision <> p_draft_revision
    or v_draft.analysis_revision <> p_analysis_revision
    or p_draft_revision <> p_analysis_revision
    or v_draft.analysis is null then
    raise exception using errcode = '40001', message = 'Onboarding analysis is stale';
  end if;
  if nullif(trim(coalesce(p_profile ->> 'email', '')), '') is null then
    raise exception using errcode = '22023', message = 'Profile email is required';
  end if;

  insert into public.profiles as current_profile(
    id, email, name, age, major, campus, gender, gender_text,
    looking_for_gender, height_cm, age_pref_min, age_pref_max, avatar_url,
    bio, interests, personality_tags, dating_goals, preferred_vibes,
    profile_text, appearance_preference, dealbreakers, ai_profile_analysis, ai_signals,
    onboarding_answers, onboarding_version, profile_completeness,
    onboarding_source, profile_confirmed, profile_confirmed_at,
    profile_upgrade_required
  ) values (
    p_user_id,
    left(trim(p_profile ->> 'email'), 320),
    left(trim(coalesce(p_profile ->> 'name', '')), 120),
    coalesce((p_profile ->> 'age')::integer, 0),
    coalesce(nullif(p_profile ->> 'major', ''), 'SE')::public.major,
    coalesce(nullif(p_profile ->> 'campus', ''), 'HCM')::public.campus,
    coalesce(nullif(p_profile ->> 'gender', ''), 'prefer_not_to_show')::public.gender,
    nullif(left(trim(coalesce(p_profile ->> 'gender_text', '')), 120), ''),
    array(
      select jsonb_array_elements_text(public.jsonb_array_or_empty(p_profile -> 'looking_for_gender'))
    ),
    nullif(p_profile ->> 'height_cm', '')::integer,
    nullif(p_profile ->> 'age_pref_min', '')::integer,
    nullif(p_profile ->> 'age_pref_max', '')::integer,
    left(trim(coalesce(p_profile ->> 'avatar_url', '')), 2000),
    left(trim(coalesce(p_profile ->> 'bio', '')), 500),
    array(select jsonb_array_elements_text(public.jsonb_array_or_empty(p_profile -> 'interests'))),
    array(select jsonb_array_elements_text(public.jsonb_array_or_empty(p_profile -> 'personality_tags'))),
    array(select jsonb_array_elements_text(public.jsonb_array_or_empty(p_profile -> 'dating_goals'))),
    array(select jsonb_array_elements_text(public.jsonb_array_or_empty(p_profile -> 'preferred_vibes'))),
    public.jsonb_object_or_empty(p_profile -> 'profile_text'),
    public.jsonb_object_or_empty(p_profile -> 'appearance_preference'),
    public.jsonb_array_or_empty(p_profile -> 'dealbreakers'),
    public.jsonb_object_or_empty(p_profile -> 'ai_profile_analysis'),
    public.jsonb_object_or_empty(p_profile -> 'ai_signals'),
    coalesce(p_profile -> 'onboarding_answers', '[]'::jsonb),
    greatest(1, coalesce((p_profile ->> 'onboarding_version')::integer, 2)),
    greatest(0, least(coalesce((p_profile ->> 'profile_completeness')::integer, 0), 100)),
    coalesce(nullif(p_profile ->> 'onboarding_source', ''), 'manual')::public.onboarding_source,
    true,
    now(),
    false
  )
  on conflict (id) do update set
    email = excluded.email,
    name = excluded.name,
    age = excluded.age,
    major = excluded.major,
    campus = excluded.campus,
    gender = excluded.gender,
    gender_text = excluded.gender_text,
    looking_for_gender = excluded.looking_for_gender,
    height_cm = excluded.height_cm,
    age_pref_min = excluded.age_pref_min,
    age_pref_max = excluded.age_pref_max,
    avatar_url = excluded.avatar_url,
    bio = excluded.bio,
    interests = excluded.interests,
    personality_tags = excluded.personality_tags,
    dating_goals = excluded.dating_goals,
    preferred_vibes = excluded.preferred_vibes,
    profile_text = excluded.profile_text,
    appearance_preference = excluded.appearance_preference,
    dealbreakers = excluded.dealbreakers,
    ai_profile_analysis = excluded.ai_profile_analysis,
    ai_signals = excluded.ai_signals,
    onboarding_answers = excluded.onboarding_answers,
    onboarding_version = excluded.onboarding_version,
    profile_completeness = excluded.profile_completeness,
    onboarding_source = excluded.onboarding_source,
    profile_confirmed = true,
    profile_confirmed_at = coalesce(current_profile.profile_confirmed_at, excluded.profile_confirmed_at),
    profile_upgrade_required = false;

  select to_jsonb(p) - array[
    'self_vector',
    'need_vector',
    'preference_vector',
    'communication_vector',
    'lifestyle_vector'
  ] into v_profile
  from public.profiles p
  where p.id = p_user_id;

  return v_profile;
end;
$$;

revoke all on function public.confirm_onboarding_profile_atomic(uuid, bigint, bigint, jsonb)
  from anon, authenticated, public;
grant execute on function public.confirm_onboarding_profile_atomic(uuid, bigint, bigint, jsonb) to service_role;

-- Server-owned onboarding/analysis revisions are writable only through the CAS RPCs.
drop policy "onboarding drafts own insert" on public.onboarding_drafts;
drop policy "onboarding drafts own update" on public.onboarding_drafts;
revoke insert, update, delete on public.onboarding_drafts from anon, authenticated;
grant select on public.onboarding_drafts to authenticated;

-- Direct profile edits retain a narrow compatibility surface. Canonical readiness,
-- AI analysis, revisions, embeddings and completeness remain server-only.
revoke insert, update on public.profiles from anon, authenticated;
grant insert (
  id, email, name, age, major, campus, avatar_url, bio, interests,
  personality_tags, dating_goals, preferred_vibes, profile_text,
  onboarding_source, gender, gender_text, looking_for_gender,
  height_cm, age_pref_min, age_pref_max,
  profile_completeness, ai_signals
) on public.profiles to authenticated;
grant update (
  id, email, name, age, major, campus, avatar_url, bio, interests, personality_tags,
  dating_goals, preferred_vibes, profile_text, gender, gender_text,
  looking_for_gender, height_cm, age_pref_min, age_pref_max,
  onboarding_source, profile_completeness, ai_signals
) on public.profiles to authenticated;

-- The released binary still upserts four legacy system columns. Keep those
-- column privileges for one release, but neutralize their values before any
-- revision/completeness trigger runs. Runtime readiness never trusts ai_signals.
create or replace function public.normalize_profile_text_array(
  p_values text[],
  p_max_items integer,
  p_max_length integer
)
returns text[]
language sql
immutable
set search_path = pg_catalog
as $$
  select coalesce(array_agg(item order by first_ordinal), '{}'::text[])
  from (
    select item, first_ordinal
    from (
      select distinct on (lower(normalized.item))
        normalized.item,
        normalized.ordinality as first_ordinal
      from (
        select left(btrim(raw.item), greatest(1, p_max_length)) as item,
               raw.ordinality
        from unnest(coalesce(p_values, '{}'::text[])) with ordinality raw(item, ordinality)
        where nullif(btrim(raw.item), '') is not null
      ) normalized
      order by lower(normalized.item), normalized.ordinality
    ) unique_items
    order by first_ordinal
    limit greatest(0, p_max_items)
  ) bounded;
$$;

revoke all on function public.normalize_profile_text_array(text[], integer, integer)
  from anon, authenticated, public;

create or replace function public.protect_client_profile_system_fields()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  v_uid uuid := auth.uid();
  v_auth_email text;
  v_profile_bio text;
  v_project_origin text;
  v_avatar_prefix text;
begin
  -- Trusted SQL/migrations and service-role workers retain the full server
  -- write path. Only the released direct authenticated compatibility path is
  -- normalized here.
  if auth.role() is null or auth.role() = 'service_role' then return new; end if;
  if auth.role() <> 'authenticated' or v_uid is null then
    raise exception using errcode = '28000', message = 'Not authenticated';
  end if;

  select lower(btrim(coalesce(account.email, '')))
  into v_auth_email
  from auth.users account
  where account.id = v_uid;

  if v_auth_email is null
    or char_length(v_auth_email) > 254
    or v_auth_email !~ '^[a-z0-9._%+\-]+@fpt\.edu\.vn$' then
    raise exception using errcode = '42501', message = 'Only FPT accounts may write profiles';
  end if;
  if tg_op = 'INSERT' and new.id <> v_uid then
    raise exception using errcode = '42501', message = 'Profile owner mismatch';
  end if;

  -- Reject pathological inputs before any revision, completeness, matching or
  -- embedding trigger can observe them. Moderate overages are normalized below
  -- for compatibility with the released client.
  if octet_length(coalesce(new.email, '')) > 1024
    or octet_length(coalesce(new.name, '')) > 16384
    or octet_length(coalesce(new.avatar_url, '')) > 16384
    or octet_length(coalesce(new.bio, '')) > 65536
    or octet_length(coalesce(new.gender_text, '')) > 16384
    or new.profile_text is null
    or jsonb_typeof(new.profile_text) <> 'object'
    or octet_length(new.profile_text::text) > 32768 then
    raise exception using errcode = '22023', message = 'Profile payload is too large or malformed';
  end if;
  if exists (
    select 1 from jsonb_object_keys(new.profile_text) key
    where key <> all(array[
      'bio', 'school', 'majorLabel', 'weekendStyle',
      'conversationStyle', 'memorableThing', 'relationshipIntent'
    ])
  ) or exists (
    select 1 from jsonb_each(new.profile_text) field
    where jsonb_typeof(field.value) <> 'string'
  ) then
    raise exception using errcode = '22023', message = 'profile_text contains unsupported fields';
  end if;
  if cardinality(coalesce(new.interests, '{}'::text[])) > 100
    or cardinality(coalesce(new.personality_tags, '{}'::text[])) > 100
    or cardinality(coalesce(new.dating_goals, '{}'::text[])) > 100
    or cardinality(coalesce(new.preferred_vibes, '{}'::text[])) > 100
    or cardinality(coalesce(new.looking_for_gender, '{}'::text[])) > 20
    or exists (
      select 1
      from unnest(
        coalesce(new.interests, '{}'::text[])
        || coalesce(new.personality_tags, '{}'::text[])
        || coalesce(new.dating_goals, '{}'::text[])
        || coalesce(new.preferred_vibes, '{}'::text[])
        || coalesce(new.looking_for_gender, '{}'::text[])
      ) item
      where octet_length(coalesce(item, '')) > 4096
    ) then
    raise exception using errcode = '22023', message = 'Profile array payload is too large';
  end if;

  new.email := v_auth_email;
  new.name := left(btrim(coalesce(new.name, '')), 120);
  new.avatar_url := left(btrim(coalesce(new.avatar_url, '')), 2048);
  v_project_origin := nullif(regexp_replace(
    btrim(coalesce(auth.jwt() ->> 'iss', '')),
    '/auth/v1/?$',
    ''
  ), '');
  v_avatar_prefix := coalesce(v_project_origin, '')
    || '/storage/v1/object/public/avatars/' || v_uid::text || '/';
  if new.avatar_url <> ''
    and (
      left(new.avatar_url, char_length(v_avatar_prefix)) <> v_avatar_prefix
      or char_length(new.avatar_url) <= char_length(v_avatar_prefix)
    ) then
    raise exception using errcode = '22023', message = 'avatar_url must reference the caller avatar object';
  end if;
  new.gender_text := nullif(left(btrim(coalesce(new.gender_text, '')), 120), '');
  new.interests := public.normalize_profile_text_array(new.interests, 30, 200);
  new.personality_tags := public.normalize_profile_text_array(new.personality_tags, 20, 200);
  new.dating_goals := public.normalize_profile_text_array(new.dating_goals, 20, 200);
  new.preferred_vibes := public.normalize_profile_text_array(new.preferred_vibes, 20, 200);
  new.looking_for_gender := public.normalize_profile_text_array(new.looking_for_gender, 10, 60);
  if exists (
    select 1 from unnest(new.looking_for_gender) value
    where value not in ('male', 'female', 'everyone', 'depends')
  ) then
    raise exception using errcode = '22023', message = 'looking_for_gender is invalid';
  end if;

  v_profile_bio := left(btrim(coalesce(
    nullif(new.profile_text ->> 'bio', ''),
    new.bio,
    ''
  )), 4000);
  new.bio := v_profile_bio;
  new.profile_text := jsonb_build_object(
    'bio', v_profile_bio,
    'school', left(btrim(coalesce(new.profile_text ->> 'school', '')), 200),
    'majorLabel', left(btrim(coalesce(new.profile_text ->> 'majorLabel', '')), 200),
    'weekendStyle', left(btrim(coalesce(new.profile_text ->> 'weekendStyle', '')), 1000),
    'conversationStyle', left(btrim(coalesce(new.profile_text ->> 'conversationStyle', '')), 1000),
    'memorableThing', left(btrim(coalesce(new.profile_text ->> 'memorableThing', '')), 1000),
    'relationshipIntent', left(btrim(coalesce(new.profile_text ->> 'relationshipIntent', '')), 1000)
  );

  if tg_op = 'INSERT' then
    new.profile_completeness := 0;
    new.ai_signals := '{}'::jsonb;
    new.onboarding_source := 'manual';
    return new;
  end if;

  new.id := old.id;
  new.profile_completeness := old.profile_completeness;
  new.ai_signals := old.ai_signals;
  new.onboarding_source := old.onboarding_source;
  return new;
end;
$$;

revoke all on function public.protect_client_profile_system_fields()
  from anon, authenticated, public;
create trigger profiles_00_protect_client_system_fields
before insert or update on public.profiles
for each row execute function public.protect_client_profile_system_fields();

create or replace function public.recompute_profile_completeness()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
declare
  v_completed integer := 0;
begin
  v_completed := v_completed + case when nullif(trim(new.name), '') is not null then 1 else 0 end;
  v_completed := v_completed + case when new.age >= 17 then 1 else 0 end;
  v_completed := v_completed + 1; -- campus is a required enum
  v_completed := v_completed + 1; -- major is a required enum
  v_completed := v_completed + case when cardinality(new.interests) >= 3 then 1 else 0 end;
  v_completed := v_completed + case when cardinality(new.personality_tags) >= 1 then 1 else 0 end;
  v_completed := v_completed + case when cardinality(new.dating_goals) >= 1 then 1 else 0 end;
  v_completed := v_completed + case
    when nullif(trim(coalesce(new.profile_text ->> 'bio', new.bio)), '') is not null
      and (new.ai_profile_analysis <> '{}'::jsonb or new.ai_signals <> '{}'::jsonb)
      then 1 else 0 end;
  new.profile_completeness := round(v_completed * 100.0 / 8.0);
  new.profile_upgrade_required := new.profile_confirmed and new.profile_completeness < 75;
  return new;
end;
$$;

revoke all on function public.recompute_profile_completeness()
  from anon, authenticated, public;

create trigger profiles_recompute_completeness_on_insert
before insert on public.profiles
for each row execute function public.recompute_profile_completeness();

create trigger profiles_recompute_completeness_on_update
before update of
  name, age, major, campus, bio, interests, personality_tags, dating_goals,
  profile_text, ai_profile_analysis, ai_signals, profile_confirmed
on public.profiles
for each row execute function public.recompute_profile_completeness();

-- Machine-readable alert source for the production dashboard/alert router. Cached
-- request latency is emitted by the Edge structured logs; uncached latency and
-- durable-state breaches are derived here without storing raw onboarding data.
create or replace function public.get_backend_v2_alerts()
returns table (
  code text,
  severity text,
  observed_value numeric,
  threshold_value numeric,
  observed_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  with recent as materialized (
    select *
    from public.match_generation_attempts
    where started_at >= now() - interval '15 minutes'
  ), generation as materialized (
    select
      count(*) as attempts,
      100.0 * count(*) filter (where outcome = 'failed') / nullif(count(*), 0) as failure_percent,
      percentile_cont(0.95) within group (order by duration_ms)
        filter (where outcome in ('ready', 'empty') and duration_ms is not null) as p95_ms
    from recent
  )
  select 'generation_failure_rate'::text, 'critical'::text,
         generation.failure_percent::numeric, 2::numeric, now()
  from generation
  where generation.attempts > 0 and generation.failure_percent > 2
  union all
  select 'uncached_generation_p95'::text, 'critical'::text,
         generation.p95_ms::numeric, 3000::numeric, now()
  from generation
  where generation.p95_ms > 3000
  union all
  select 'batch_generating_stuck'::text, 'critical'::text,
         count(*)::numeric, 0::numeric, now()
  from public.daily_match_batches batch
  where batch.status = 'generating'
    and batch.generation_started_at < now() - interval '2 minutes'
  having count(*) > 0
  union all
  select 'embedding_pending_stuck'::text, 'warning'::text,
         count(*)::numeric, 0::numeric, now()
  from public.profiles profile
  where profile.embedding_status in ('pending', 'processing')
    and coalesce(profile.embedding_updated_at, profile.updated_at) < now() - interval '10 minutes'
  having count(*) > 0;
$$;

revoke all on function public.get_backend_v2_alerts()
  from anon, authenticated, public;
grant execute on function public.get_backend_v2_alerts() to service_role;
