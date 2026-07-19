-- AI Picks access boundary, simulated batch unlocks, and private AI assistant state.
-- The product remains open by default. Stub mode is an operator-controlled
-- preview of the eventual batch entitlement and never represents real payment.

-- Preserve the historical helper name used by existing RPCs/RLS while making
-- the open-signup rule explicit: any provider is accepted, but the canonical
-- Auth account must still own a plausible, confirmed email address.
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
  v_email_confirmed_at timestamptz;
begin
  if auth.role() is null or auth.role() = 'service_role' then
    return v_uid;
  end if;
  if auth.role() <> 'authenticated' or v_uid is null then
    raise exception using errcode = '28000', message = 'Not authenticated';
  end if;

  select lower(btrim(coalesce(account.email, ''))), account.email_confirmed_at
  into v_email, v_email_confirmed_at
  from auth.users account
  where account.id = v_uid;

  if v_email_confirmed_at is null
    or v_email is null
    or char_length(v_email) > 254
    or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception using errcode = '42501', message = 'A valid verified email is required to access F-Love';
  end if;
  return v_uid;
end;
$$;

create type public.ai_pick_product_mode as enum ('open', 'stub');
create type public.ai_pick_batch_access_state as enum ('teaser', 'locked', 'unlocked');

create table public.ai_pick_product_config (
  singleton boolean primary key default true check (singleton),
  mode public.ai_pick_product_mode not null default 'open',
  price_vnd integer not null default 100000 check (price_vnd > 0 and price_vnd <= 100000000),
  updated_at timestamptz not null default now()
);

insert into public.ai_pick_product_config(singleton, mode, price_vnd)
values (true, 'open', 100000)
on conflict (singleton) do nothing;

create trigger ai_pick_product_config_set_updated_at
before update on public.ai_pick_product_config
for each row execute function public.set_updated_at();

alter table public.ai_pick_product_config enable row level security;
revoke all on table public.ai_pick_product_config from anon, authenticated, public;
grant select, insert, update, delete on table public.ai_pick_product_config to service_role;

alter table public.curated_matches
  add column preview_id uuid not null default gen_random_uuid();

create unique index curated_matches_preview_id_uidx
  on public.curated_matches(preview_id);

alter table public.daily_match_batches
  add column access_state public.ai_pick_batch_access_state not null default 'unlocked',
  add column access_assigned_at timestamptz not null default now(),
  add column teaser_preview_id uuid,
  add column unlock_source text,
  add column unlocked_at timestamptz;

alter table public.daily_match_batches
  add constraint daily_match_batches_unlock_source_check check (
    unlock_source is null or unlock_source in ('open', 'simulated')
  ),
  add constraint daily_match_batches_access_shape_check check (
    (access_state = 'teaser' and teaser_preview_id is not null and unlock_source is null and unlocked_at is null)
    or (access_state = 'locked' and teaser_preview_id is null and unlock_source is null and unlocked_at is null)
    or (access_state = 'unlocked' and teaser_preview_id is null)
  );

update public.daily_match_batches
set access_state = 'unlocked',
    access_assigned_at = coalesce(finalized_at, created_at, now()),
    teaser_preview_id = null,
    unlock_source = 'open',
    unlocked_at = coalesce(finalized_at, created_at, now());

create table public.ai_pick_trial_claims (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  batch_id text not null unique references public.daily_match_batches(id) on delete cascade,
  claimed_at timestamptz not null default now()
);

alter table public.ai_pick_trial_claims enable row level security;
revoke all on table public.ai_pick_trial_claims from anon, authenticated, public;
grant select, insert, update, delete on table public.ai_pick_trial_claims to service_role;

create table public.ai_pick_unlock_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  batch_id text not null references public.daily_match_batches(id) on delete cascade,
  product_key text not null default 'daily_batch' check (product_key = 'daily_batch'),
  idempotency_key text not null check (char_length(idempotency_key) between 1 and 240),
  source text not null default 'simulated' check (source = 'simulated'),
  amount_vnd integer not null check (amount_vnd > 0 and amount_vnd <= 100000000),
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key),
  unique (user_id, batch_id, product_key)
);

create index ai_pick_unlock_ledger_batch_idx
  on public.ai_pick_unlock_ledger(batch_id, created_at desc);

alter table public.ai_pick_unlock_ledger enable row level security;
revoke all on table public.ai_pick_unlock_ledger from anon, authenticated, public;
grant select, insert, update, delete on table public.ai_pick_unlock_ledger to service_role;

-- Access is assigned by the same UPDATE that marks finalize ready. The trigger
-- sees the already-inserted curated rows, so no ready/null or ready/unassigned
-- state can become observable after the transaction commits.
create or replace function public.assign_daily_match_batch_access()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_mode public.ai_pick_product_mode;
  v_preview_id uuid;
  v_trial_batch_id text;
begin
  if new.status <> 'ready' or old.status = 'ready' then
    return new;
  end if;

  select config.mode into v_mode
  from public.ai_pick_product_config config
  where config.singleton;
  v_mode := coalesce(v_mode, 'open'::public.ai_pick_product_mode);

  new.access_assigned_at := now();
  if v_mode = 'open' then
    new.access_state := 'unlocked';
    new.teaser_preview_id := null;
    new.unlock_source := 'open';
    new.unlocked_at := now();
    return new;
  end if;

  -- A paid/simulated or previously open entitlement survives regeneration.
  -- Fresh generating rows also default to `unlocked` for schema compatibility,
  -- so require the durable source/timestamp pair before preserving it.
  if old.access_state = 'unlocked'
    and old.unlock_source in ('open', 'simulated')
    and old.unlocked_at is not null then
    new.access_state := 'unlocked';
    new.teaser_preview_id := null;
    new.unlock_source := old.unlock_source;
    new.unlocked_at := old.unlocked_at;
    return new;
  end if;

  -- The previous trial batch may have become unsafe after its last read. Repair
  -- that entitlement before assigning a newer ready batch, otherwise its stale
  -- claim could lock every future batch indefinitely.
  select claim.batch_id into v_trial_batch_id
  from public.ai_pick_trial_claims claim
  where claim.user_id = new.user_id;
  if v_trial_batch_id is not null and v_trial_batch_id <> new.id then
    perform public.repair_daily_match_teaser(v_trial_batch_id);
  end if;

  select match.preview_id into v_preview_id
  from public.curated_matches match
  where match.batch_id = new.id
    and match.status = 'pending'
    and public.match_pair_live_eligible(match.user_id, match.candidate_id)
  order by match.compatibility_score desc, match.id
  limit 1;

  insert into public.ai_pick_trial_claims(user_id, batch_id)
  values (new.user_id, new.id)
  on conflict (user_id) do nothing;

  select claim.batch_id into v_trial_batch_id
  from public.ai_pick_trial_claims claim
  where claim.user_id = new.user_id;

  if v_trial_batch_id = new.id and v_preview_id is not null then
    new.access_state := 'teaser';
    new.teaser_preview_id := v_preview_id;
  else
    -- A theoretically empty ready batch must never consume the trial. The
    -- finalize function itself rejects this state, but keep the trigger repairable.
    if v_trial_batch_id = new.id and v_preview_id is null then
      delete from public.ai_pick_trial_claims
      where user_id = new.user_id and batch_id = new.id;
    end if;
    new.access_state := 'locked';
    new.teaser_preview_id := null;
  end if;
  new.unlock_source := null;
  new.unlocked_at := null;
  return new;
end;
$$;

revoke all on function public.assign_daily_match_batch_access()
  from anon, authenticated, public;

create trigger daily_match_batches_10_assign_access
before update of status on public.daily_match_batches
for each row execute function public.assign_daily_match_batch_access();

-- Promote the highest live pending row if the free teaser is removed by the
-- existing stale/safety repair path. preview_id is opaque and carries no user ID.
create or replace function public.repair_daily_match_teaser(p_batch_id text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_batch public.daily_match_batches%rowtype;
  v_preview_id uuid;
  v_teaser_status public.curated_match_status;
begin
  select batch.* into v_batch
  from public.daily_match_batches batch
  where batch.id = p_batch_id
  for update;

  if not found or v_batch.access_state <> 'teaser' then
    return null;
  end if;

  select match.status into v_teaser_status
  from public.curated_matches match
  where match.batch_id = v_batch.id
    and match.preview_id = v_batch.teaser_preview_id;

  if found then
    -- Accept/decline/skip consumes the one revealed trial card. A report is a
    -- safety invalidation, so it follows the same replacement path as a still-
    -- pending row that became unsafe/ineligible.
    if v_teaser_status <> 'pending' and v_teaser_status <> 'reported' then
      return null;
    end if;
    if v_teaser_status = 'pending' and exists (
      select 1
      from public.curated_matches match
      where match.batch_id = v_batch.id
        and match.preview_id = v_batch.teaser_preview_id
        and public.match_pair_live_eligible(match.user_id, match.candidate_id)
    ) then
      return v_batch.teaser_preview_id;
    end if;
  end if;

  select match.preview_id into v_preview_id
  from public.curated_matches match
  where match.batch_id = v_batch.id
    and match.status = 'pending'
    and public.match_pair_live_eligible(match.user_id, match.candidate_id)
  order by match.compatibility_score desc, match.id
  limit 1;

  if v_preview_id is not null then
    update public.daily_match_batches batch
    set teaser_preview_id = v_preview_id,
        access_assigned_at = now()
    where batch.id = v_batch.id;
  else
    -- Safety invalidation must not burn the one-time trial when there is no
    -- replacement in this batch. Release the claim so the next ready stub batch
    -- can grant a teaser; normal accept/decline/skip returned earlier.
    delete from public.ai_pick_trial_claims claim
    where claim.user_id = v_batch.user_id and claim.batch_id = v_batch.id;
    update public.daily_match_batches batch
    set access_state = 'locked',
        teaser_preview_id = null,
        unlock_source = null,
        unlocked_at = null,
        access_assigned_at = now()
    where batch.id = v_batch.id;
  end if;
  return v_preview_id;
end;
$$;

revoke all on function public.repair_daily_match_teaser(text)
  from anon, authenticated, public;
grant execute on function public.repair_daily_match_teaser(text) to service_role;

create or replace function public.repair_teaser_after_curated_delete()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if old.status = 'pending' and exists (
    select 1 from public.daily_match_batches batch
    where batch.id = old.batch_id
      and batch.access_state = 'teaser'
      and batch.teaser_preview_id = old.preview_id
  ) then
    perform public.repair_daily_match_teaser(old.batch_id);
  end if;
  return old;
end;
$$;

revoke all on function public.repair_teaser_after_curated_delete()
  from anon, authenticated, public;

create trigger curated_matches_repair_teaser_after_delete
after delete on public.curated_matches
for each row execute function public.repair_teaser_after_curated_delete();

create or replace function public.repair_teaser_after_report()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if old.status = 'pending' and new.status = 'reported' and exists (
    select 1 from public.daily_match_batches batch
    where batch.id = new.batch_id
      and batch.access_state = 'teaser'
      and batch.teaser_preview_id = new.preview_id
  ) then
    perform public.repair_daily_match_teaser(new.batch_id);
  end if;
  return new;
end;
$$;

revoke all on function public.repair_teaser_after_report()
  from anon, authenticated, public;

create trigger curated_matches_repair_teaser_after_report
after update of status on public.curated_matches
for each row execute function public.repair_teaser_after_report();

create or replace function public.unlock_daily_match_batch(
  p_batch_id text,
  p_idempotency_key text,
  p_expected_user_id uuid
)
returns table (
  batch_id text,
  product_mode text,
  access_state text,
  price_vnd integer,
  applied boolean,
  unlock_source text
)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_uid uuid := auth.uid();
  v_batch public.daily_match_batches%rowtype;
  v_mode public.ai_pick_product_mode;
  v_price integer;
  v_key text := nullif(left(btrim(coalesce(p_idempotency_key, '')), 240), '');
  v_existing public.ai_pick_unlock_ledger%rowtype;
begin
  perform private.assert_fpt_self_admission();
  if v_uid is null then
    raise exception using errcode = '28000', message = 'Not authenticated';
  end if;
  if p_expected_user_id is null or p_expected_user_id <> v_uid then
    raise exception using errcode = '42501', message = 'Authenticated user changed during unlock';
  end if;
  if nullif(btrim(coalesce(p_batch_id, '')), '') is null
    or char_length(p_batch_id) > 240 or v_key is null then
    raise exception using errcode = '22023', message = 'batch_id and idempotency_key are required';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('ai_pick_unlock:' || v_uid::text || ':' || p_batch_id, 0)
  );

  select batch.* into v_batch
  from public.daily_match_batches batch
  where batch.id = p_batch_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Daily match batch not found';
  end if;
  if v_batch.user_id <> v_uid then
    raise exception using errcode = '42501', message = 'Daily match batch owner mismatch';
  end if;
  if v_batch.status <> 'ready' then
    raise exception using errcode = '55000', message = 'Daily match batch is not ready';
  end if;

  select config.mode, config.price_vnd into v_mode, v_price
  from public.ai_pick_product_config config
  where config.singleton;
  v_mode := coalesce(v_mode, 'open'::public.ai_pick_product_mode);
  v_price := coalesce(v_price, 100000);

  select ledger.* into v_existing
  from public.ai_pick_unlock_ledger ledger
  where ledger.user_id = v_uid and ledger.idempotency_key = v_key;
  if found and v_existing.batch_id <> p_batch_id then
    raise exception using errcode = '22023', message = 'Idempotency key was already used for another batch';
  end if;
  if found then
    -- A retry reports the price captured by its original simulated ledger,
    -- even if an operator changes the configured price later.
    v_price := v_existing.amount_vnd;
  end if;

  if v_mode = 'open' then
    return query select v_batch.id, v_mode::text, 'unlocked'::text,
      v_price, false, 'open'::text;
    return;
  end if;

  if v_batch.access_state = 'unlocked' then
    return query select v_batch.id, v_mode::text, v_batch.access_state::text,
      v_price, false, coalesce(v_batch.unlock_source, 'simulated');
    return;
  end if;

  insert into public.ai_pick_unlock_ledger(
    user_id, batch_id, idempotency_key, amount_vnd
  ) values (
    v_uid, v_batch.id, v_key, v_price
  )
  on conflict (user_id, batch_id, product_key) do nothing;

  update public.daily_match_batches batch
  set access_state = 'unlocked',
      teaser_preview_id = null,
      unlock_source = 'simulated',
      unlocked_at = now(),
      access_assigned_at = now()
  where batch.id = v_batch.id
  returning batch.* into v_batch;

  return query select v_batch.id, v_mode::text, v_batch.access_state::text,
    v_price, true, v_batch.unlock_source;
end;
$$;

revoke all on function public.unlock_daily_match_batch(text, text, uuid)
  from anon, authenticated, public;
grant execute on function public.unlock_daily_match_batch(text, text, uuid) to authenticated;

-- The only app-facing AI Picks payload. Locked rows carry an opaque preview ID,
-- score, and label; every identity-bearing field is SQL NULL.
create or replace function public.get_daily_picks_safe(
  p_user_id uuid,
  p_batch_id text
)
returns table (
  batch_id text,
  business_date date,
  product_mode text,
  access_state text,
  price_vnd integer,
  locked_count integer,
  kind text,
  match_id text,
  preview_id uuid,
  user_id uuid,
  candidate_id uuid,
  candidate_snapshot jsonb,
  pair_key text,
  ai_reason text,
  suggested_opener text,
  compatibility_label text,
  compatibility_score integer,
  match_status public.curated_match_status,
  feedback_tags text[],
  feedback_note text,
  created_at timestamptz,
  decided_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_batch public.daily_match_batches%rowtype;
  v_mode public.ai_pick_product_mode;
  v_price integer;
begin
  select batch.* into v_batch
  from public.daily_match_batches batch
  where batch.id = p_batch_id and batch.user_id = p_user_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Daily match batch not found';
  end if;

  if v_batch.access_state = 'teaser' then
    perform public.repair_daily_match_teaser(v_batch.id);
    select batch.* into v_batch
    from public.daily_match_batches batch
    where batch.id = p_batch_id;
  end if;

  select config.mode, config.price_vnd into v_mode, v_price
  from public.ai_pick_product_config config
  where config.singleton;
  v_mode := coalesce(v_mode, 'open'::public.ai_pick_product_mode);
  v_price := coalesce(v_price, 100000);

  return query
  with live as materialized (
    select match.*,
      (
        v_mode = 'open'
        or v_batch.access_state = 'unlocked'
        or (v_batch.access_state = 'teaser' and match.preview_id = v_batch.teaser_preview_id)
      ) as is_revealed
    from public.curated_matches match
    where match.batch_id = v_batch.id
      and match.user_id = p_user_id
      and match.status = 'pending'
      and public.match_pair_live_eligible(match.user_id, match.candidate_id)
  ), counts as (
    select count(*) filter (where not is_revealed)::integer as locked_count
    from live
  ), payload as (
    select
      v_batch.id as batch_id,
      v_batch.date as business_date,
      v_mode::text as product_mode,
      case when v_mode = 'open' then 'unlocked' else v_batch.access_state::text end as access_state,
      v_price as price_vnd,
      counts.locked_count,
      case when live.is_revealed then 'revealed' else 'locked' end as kind,
      case when live.is_revealed then live.id else null end as match_id,
      case when live.is_revealed then null else live.preview_id end as preview_id,
      case when live.is_revealed then live.user_id else null end as user_id,
      case when live.is_revealed then live.candidate_id else null end as candidate_id,
      case when live.is_revealed then live.candidate_snapshot else null end as candidate_snapshot,
      case when live.is_revealed then live.pair_key else null end as pair_key,
      case when live.is_revealed then live.ai_reason else null end as ai_reason,
      case when live.is_revealed then live.suggested_opener else null end as suggested_opener,
      live.compatibility_label,
      live.compatibility_score,
      case when live.is_revealed then live.status else null end as match_status,
      case when live.is_revealed then live.feedback_tags else null end as feedback_tags,
      case when live.is_revealed then live.feedback_note else null end as feedback_note,
      case when live.is_revealed then live.created_at else null end as created_at,
      case when live.is_revealed then live.decided_at else null end as decided_at
    from live cross join counts
    union all
    select
      v_batch.id, v_batch.date, v_mode::text,
      case when v_mode = 'open' then 'unlocked' else v_batch.access_state::text end,
      v_price, 0,
      null::text, null::text, null::uuid, null::uuid, null::uuid,
      null::jsonb, null::text, null::text, null::text, null::text, null::integer,
      null::public.curated_match_status, null::text[], null::text,
      null::timestamptz, null::timestamptz
    where not exists (select 1 from live)
  )
  select payload.*
  from payload
  order by payload.compatibility_score desc nulls last,
    coalesce(payload.match_id, payload.preview_id::text, '');
end;
$$;

revoke all on function public.get_daily_picks_safe(uuid, text)
  from anon, authenticated, public;
grant execute on function public.get_daily_picks_safe(uuid, text) to service_role;

-- Enforce the access boundary at the durable write, covering every current and
-- legacy RPC that records a match decision.
create or replace function public.enforce_curated_match_feedback_access()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_batch public.daily_match_batches%rowtype;
  v_preview_id uuid;
  v_mode public.ai_pick_product_mode;
begin
  if auth.role() is null or auth.role() = 'service_role' then
    return new;
  end if;

  select match.preview_id into v_preview_id
  from public.curated_matches match
  where match.id = new.match_id and match.user_id = auth.uid();
  if not found then
    raise exception using errcode = '42501', message = 'Curated match access denied';
  end if;

  select batch.* into v_batch
  from public.daily_match_batches batch
  join public.curated_matches match on match.batch_id = batch.id
  where match.id = new.match_id and match.user_id = auth.uid()
  for update of batch;

  select config.mode into v_mode
  from public.ai_pick_product_config config
  where config.singleton;
  v_mode := coalesce(v_mode, 'open'::public.ai_pick_product_mode);

  if v_mode <> 'open'
    and v_batch.access_state <> 'unlocked'
    and not (v_batch.access_state = 'teaser' and v_batch.teaser_preview_id = v_preview_id) then
    raise exception using errcode = '42501', message = 'Daily match batch must be unlocked before feedback';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_curated_match_feedback_access()
  from anon, authenticated, public;

create trigger match_feedback_00_enforce_match_access
before insert on public.match_feedback
for each row execute function public.enforce_curated_match_feedback_access();

-- Hide deterministic internal IDs behind the same not-found result for locked,
-- foreign, and nonexistent rows. This removes a candidate-membership oracle
-- while preserving exact idempotent retries for an action the caller already made.
alter function public.submit_match_feedback_atomic(
  text, public.feedback_decision, text, text[], text
) rename to submit_match_feedback_atomic_access_internal;

revoke all on function public.submit_match_feedback_atomic_access_internal(
  text, public.feedback_decision, text, text[], text
) from anon, authenticated, service_role, public;

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
  v_key text := nullif(left(btrim(coalesce(p_idempotency_key, '')), 240), '');
  v_accessible boolean;
begin
  perform private.assert_fpt_self_admission();
  if v_uid is null then
    raise exception using errcode = '28000', message = 'Not authenticated';
  end if;
  if nullif(btrim(coalesce(p_match_id, '')), '') is null or v_key is null then
    raise exception using errcode = '22023', message = 'match_id and idempotency_key are required';
  end if;
  if char_length(btrim(p_match_id)) > 240 then
    raise exception using errcode = '22023', message = 'match_id is out of range';
  end if;

  select exists (
    select 1
    from public.curated_matches match
    join public.daily_match_batches batch on batch.id = match.batch_id
    where match.id = p_match_id
      and match.user_id = v_uid
      and (
        coalesce((
          select config.mode from public.ai_pick_product_config config where config.singleton
        ), 'open'::public.ai_pick_product_mode) = 'open'
        or batch.access_state = 'unlocked'
        or (batch.access_state = 'teaser' and batch.teaser_preview_id = match.preview_id)
        or exists (
          select 1 from public.match_feedback retry
          where retry.user_id = v_uid
            and retry.match_id = match.id
            and retry.idempotency_key = v_key
        )
      )
  ) into v_accessible;

  if not v_accessible then
    raise exception using errcode = 'P0002', message = 'Curated match not found';
  end if;

  return query
  select result.match_id, result.status, result.applied,
         result.is_mutual, result.conversation_id
  from public.submit_match_feedback_atomic_access_internal(
    p_match_id, p_decision, p_idempotency_key, p_tags, p_note
  ) result;
end;
$$;

revoke all on function public.submit_match_feedback_atomic(
  text, public.feedback_decision, text, text[], text
) from anon, authenticated, public;
grant execute on function public.submit_match_feedback_atomic(
  text, public.feedback_decision, text, text[], text
) to authenticated;

-- Client reads must use the safe Edge/RPC DTO. public_profiles remains an
-- internal candidate/display helper for trusted server code only.
drop policy if exists "curated matches pending own select" on public.curated_matches;
drop policy if exists "curated matches own select" on public.curated_matches;
revoke select on table public.curated_matches from anon, authenticated, public;
revoke all on table public.public_profiles from anon, authenticated, public;
grant select on table public.curated_matches, public.public_profiles to service_role;

-- ---------------------------------------------------------------------------
-- Generic private assistant idempotency/cache state
-- ---------------------------------------------------------------------------

create table public.ai_assistant_requests (
  user_id uuid not null references public.profiles(id) on delete cascade,
  scope text not null check (scope in ('preference_chat', 'conversation_wingman')),
  client_request_id text not null check (char_length(client_request_id) between 1 and 240),
  request_fingerprint text not null check (char_length(request_fingerprint) between 32 and 128),
  status text not null default 'processing' check (status in ('processing', 'completed')),
  claim_token uuid not null default gen_random_uuid(),
  claimed_at timestamptz not null default now(),
  provider_started_at timestamptz,
  completed_at timestamptz,
  response_payload jsonb,
  expires_at timestamptz,
  primary key (user_id, scope, client_request_id),
  check (
    (status = 'processing' and completed_at is null and response_payload is null)
    or (status = 'completed' and completed_at is not null and jsonb_typeof(response_payload) = 'object')
  )
);

create index ai_assistant_requests_expiry_idx
  on public.ai_assistant_requests(expires_at)
  where expires_at is not null;

alter table public.ai_assistant_requests enable row level security;
revoke all on table public.ai_assistant_requests from anon, authenticated, public;
grant select, insert, update, delete on table public.ai_assistant_requests to service_role;

create or replace function public.claim_ai_assistant_request(
  p_scope text,
  p_client_request_id text,
  p_request_fingerprint text,
  p_expected_user_id uuid
)
returns table (
  request_status text,
  claim_token uuid,
  response_payload jsonb
)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_uid uuid := case when auth.role() = 'service_role' then p_expected_user_id else auth.uid() end;
  v_scope text := lower(btrim(coalesce(p_scope, '')));
  v_request_id text := nullif(left(btrim(coalesce(p_client_request_id, '')), 240), '');
  v_fingerprint text := nullif(left(btrim(coalesce(p_request_fingerprint, '')), 128), '');
  v_request public.ai_assistant_requests%rowtype;
  v_token uuid;
begin
  perform private.assert_fpt_self_admission();
  if auth.role() <> 'service_role' or v_uid is null then
    raise exception using errcode = '42501', message = 'Assistant claims are service-only';
  end if;
  if p_expected_user_id is null or p_expected_user_id <> v_uid then
    raise exception using errcode = '42501', message = 'Authenticated user changed during assistant request';
  end if;
  if v_scope not in ('preference_chat', 'conversation_wingman')
    or v_request_id is null
    or v_fingerprint is null
    or char_length(v_fingerprint) < 32 then
    raise exception using errcode = '22023', message = 'Assistant request claim is invalid';
  end if;

  -- Wingman stores suggestions only (never transcript/context) and treats them
  -- as a one-hour cache. Purge expired payloads opportunistically on every AI
  -- request so active installations do not retain stale suggestions forever.
  delete from public.ai_assistant_requests expired
  where expired.ctid in (
    select stale.ctid
    from public.ai_assistant_requests stale
    where stale.scope = 'conversation_wingman'
      and stale.status = 'completed'
      and stale.expires_at <= now()
    order by stale.expires_at
    limit 100
  );

  perform pg_advisory_xact_lock(
    hashtextextended('assistant_request:' || v_uid::text || ':' || v_scope || ':' || v_request_id, 0)
  );

  select request.* into v_request
  from public.ai_assistant_requests request
  where request.user_id = v_uid
    and request.scope = v_scope
    and request.client_request_id = v_request_id
  for update;

  if not found then
    v_token := gen_random_uuid();
    insert into public.ai_assistant_requests(
      user_id, scope, client_request_id, request_fingerprint, claim_token
    ) values (
      v_uid, v_scope, v_request_id, v_fingerprint, v_token
    );
    return query select 'claimed'::text, v_token, null::jsonb;
    return;
  end if;

  if v_request.request_fingerprint <> v_fingerprint then
    raise exception using errcode = '22023', message = 'Idempotency key was reused with a different assistant request';
  end if;

  if v_request.status = 'completed'
    and (v_request.expires_at is null or v_request.expires_at > now()) then
    return query select 'cached'::text, null::uuid, v_request.response_payload;
    return;
  end if;

  -- Once the provider fence is marked, this exact token remains the sole
  -- owner. A retry must skip a second provider call and finalize a fallback
  -- with the original token instead of reclaiming a stale lease.
  if v_request.status = 'processing' and v_request.provider_started_at is not null then
    return query select 'provider_started'::text, v_request.claim_token, null::jsonb;
    return;
  end if;

  if v_request.status = 'processing'
    and v_request.claimed_at > now() - interval '90 seconds' then
    return query select 'in_progress'::text, null::uuid, null::jsonb;
    return;
  end if;

  v_token := gen_random_uuid();
  update public.ai_assistant_requests request
  set status = 'processing',
      claim_token = v_token,
      claimed_at = now(),
      completed_at = null,
      response_payload = null,
      provider_started_at = null,
      expires_at = null
  where request.user_id = v_uid
    and request.scope = v_scope
    and request.client_request_id = v_request_id;

  return query select 'claimed'::text, v_token, null::jsonb;
end;
$$;

revoke all on function public.claim_ai_assistant_request(text, text, text, uuid)
  from anon, authenticated, public;
grant execute on function public.claim_ai_assistant_request(text, text, text, uuid) to service_role;

-- Fence the provider call before making the external request. Marking the
-- same live token is idempotent; a stale worker can never take ownership.
create or replace function public.mark_ai_assistant_provider_started(
  p_scope text,
  p_client_request_id text,
  p_request_fingerprint text,
  p_claim_token uuid,
  p_expected_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_uid uuid := case when auth.role() = 'service_role' then p_expected_user_id else auth.uid() end;
  v_scope text := lower(btrim(coalesce(p_scope, '')));
  v_request_id text := nullif(left(btrim(coalesce(p_client_request_id, '')), 240), '');
  v_fingerprint text := nullif(left(btrim(coalesce(p_request_fingerprint, '')), 128), '');
  v_request public.ai_assistant_requests%rowtype;
  v_applied_count integer;
begin
  perform private.assert_fpt_self_admission();
  if auth.role() <> 'service_role' or v_uid is null then
    raise exception using errcode = '42501', message = 'Assistant provider fence is service-only';
  end if;
  if p_expected_user_id is null or p_expected_user_id <> v_uid then
    raise exception using errcode = '42501', message = 'Authenticated user changed during provider fence';
  end if;
  if v_scope not in ('preference_chat', 'conversation_wingman')
    or v_request_id is null
    or v_fingerprint is null
    or char_length(v_fingerprint) < 32
    or p_claim_token is null then
    raise exception using errcode = '22023', message = 'Assistant provider fence is invalid';
  end if;

  select request.* into v_request
  from public.ai_assistant_requests request
  where request.user_id = v_uid
    and request.scope = v_scope
    and request.client_request_id = v_request_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Assistant request claim not found';
  end if;
  if v_request.request_fingerprint <> v_fingerprint then
    raise exception using errcode = '22023', message = 'Assistant request fingerprint mismatch';
  end if;
  if v_request.status <> 'processing' then
    raise exception using errcode = '55000', message = 'Assistant request is already completed';
  end if;
  if v_request.claim_token <> p_claim_token then
    raise exception using errcode = '40001', message = 'Assistant request claim is stale';
  end if;

  update public.ai_assistant_requests request
  set provider_started_at = now()
  where request.user_id = v_uid
    and request.scope = v_scope
    and request.client_request_id = v_request_id
    and request.provider_started_at is null;
  get diagnostics v_applied_count = row_count;
  return v_applied_count = 1;
end;
$$;

revoke all on function public.mark_ai_assistant_provider_started(text, text, text, uuid, uuid)
  from anon, authenticated, public;
grant execute on function public.mark_ai_assistant_provider_started(text, text, text, uuid, uuid)
  to service_role;

create or replace function public.finalize_ai_assistant_request(
  p_scope text,
  p_client_request_id text,
  p_request_fingerprint text,
  p_claim_token uuid,
  p_response_payload jsonb,
  p_expected_user_id uuid
)
returns table (
  request_status text,
  response_payload jsonb
)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_uid uuid := case when auth.role() = 'service_role' then p_expected_user_id else auth.uid() end;
  v_scope text := lower(btrim(coalesce(p_scope, '')));
  v_request_id text := nullif(left(btrim(coalesce(p_client_request_id, '')), 240), '');
  v_fingerprint text := nullif(left(btrim(coalesce(p_request_fingerprint, '')), 128), '');
  v_request public.ai_assistant_requests%rowtype;
begin
  perform private.assert_fpt_self_admission();
  if auth.role() <> 'service_role' or v_uid is null then
    raise exception using errcode = '42501', message = 'Assistant finalize is service-only';
  end if;
  if p_expected_user_id is null or p_expected_user_id <> v_uid then
    raise exception using errcode = '42501', message = 'Authenticated user changed during assistant finalize';
  end if;
  if v_scope <> 'conversation_wingman'
    or v_request_id is null or v_fingerprint is null
    or p_claim_token is null
    or p_response_payload is null
    or jsonb_typeof(p_response_payload) <> 'object'
    or octet_length(p_response_payload::text) > 32768 then
    raise exception using errcode = '22023', message = 'Assistant finalize payload is invalid';
  end if;

  select request.* into v_request
  from public.ai_assistant_requests request
  where request.user_id = v_uid
    and request.scope = v_scope
    and request.client_request_id = v_request_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Assistant request claim not found';
  end if;
  if v_request.request_fingerprint <> v_fingerprint then
    raise exception using errcode = '22023', message = 'Assistant request fingerprint mismatch';
  end if;
  if v_request.status = 'completed' then
    return query select 'cached'::text, v_request.response_payload;
    return;
  end if;
  if v_request.claim_token <> p_claim_token then
    raise exception using errcode = '40001', message = 'Assistant request claim is stale';
  end if;

  update public.ai_assistant_requests request
  set status = 'completed',
      completed_at = now(),
      response_payload = p_response_payload,
      expires_at = now() + interval '1 hour'
  where request.user_id = v_uid
    and request.scope = v_scope
    and request.client_request_id = v_request_id;

  return query select 'completed'::text, p_response_payload;
end;
$$;

revoke all on function public.finalize_ai_assistant_request(text, text, text, uuid, jsonb, uuid)
  from anon, authenticated, public;
grant execute on function public.finalize_ai_assistant_request(text, text, text, uuid, jsonb, uuid)
  to service_role;

-- Provider/configuration failures can release a processing claim immediately.
-- A stale or completed request is never deleted by an older worker.
create or replace function public.abandon_ai_assistant_request(
  p_scope text,
  p_client_request_id text,
  p_request_fingerprint text,
  p_claim_token uuid,
  p_expected_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_uid uuid := case when auth.role() = 'service_role' then p_expected_user_id else auth.uid() end;
  v_deleted_count integer;
begin
  perform private.assert_fpt_self_admission();
  if auth.role() <> 'service_role' or v_uid is null then
    raise exception using errcode = '42501', message = 'Assistant abandon is service-only';
  end if;
  if p_expected_user_id is null or p_expected_user_id <> v_uid then
    raise exception using errcode = '42501', message = 'Authenticated user changed during assistant abandon';
  end if;
  if lower(btrim(coalesce(p_scope, ''))) not in ('preference_chat', 'conversation_wingman')
    or nullif(btrim(coalesce(p_client_request_id, '')), '') is null
    or nullif(btrim(coalesce(p_request_fingerprint, '')), '') is null
    or p_claim_token is null then
    raise exception using errcode = '22023', message = 'Assistant abandon payload is invalid';
  end if;

  delete from public.ai_assistant_requests request
  where request.user_id = v_uid
    and request.scope = lower(btrim(p_scope))
    and request.client_request_id = left(btrim(p_client_request_id), 240)
    and request.request_fingerprint = left(btrim(p_request_fingerprint), 128)
    and request.claim_token = p_claim_token
    and request.status = 'processing'
    and request.provider_started_at is null;
  get diagnostics v_deleted_count = row_count;
  return v_deleted_count > 0;
end;
$$;

revoke all on function public.abandon_ai_assistant_request(text, text, text, uuid, uuid)
  from anon, authenticated, public;
grant execute on function public.abandon_ai_assistant_request(text, text, text, uuid, uuid)
  to service_role;

alter table public.preference_profiles
  add column soft_avoidances text[] not null default '{}';

-- The old RPC accepted caller-authored assistant prose and could bypass the
-- provider claim/finalize boundary. Keep the symbol for migrations/operators,
-- but remove it from every client role.
revoke all on function public.save_preference_chat_turn_atomic(text, text[], text, text)
  from anon, authenticated, public;

create or replace function public.get_preference_coach_context(
  p_expected_user_id uuid,
  p_limit integer default 12
)
returns table (
  user_age integer,
  llm_eligible boolean,
  profile_context jsonb,
  preference_summary text,
  soft_preferences text[],
  soft_avoidances text[],
  recent_turns jsonb
)
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_preference public.preference_profiles%rowtype;
  v_limit integer := greatest(1, least(coalesce(p_limit, 12), 12));
begin
  perform private.assert_fpt_self_admission();
  if v_uid is null then
    raise exception using errcode = '28000', message = 'Not authenticated';
  end if;
  if p_expected_user_id is null or p_expected_user_id <> v_uid then
    raise exception using errcode = '42501', message = 'Authenticated user changed during preference context load';
  end if;

  select profile.* into v_profile
  from public.profiles profile
  where profile.id = v_uid;
  if not found then
    raise exception using errcode = 'P0002', message = 'Profile not found';
  end if;
  select preference.* into v_preference
  from public.preference_profiles preference
  where preference.user_id = v_uid;

  return query
  select
    v_profile.age,
    v_profile.age >= 18,
    jsonb_build_object(
      'bio', left(coalesce(v_profile.bio, ''), 1000),
      'interests', to_jsonb(coalesce(v_profile.interests, '{}'::text[])),
      'personalityTags', to_jsonb(coalesce(v_profile.personality_tags, '{}'::text[])),
      'datingGoals', to_jsonb(coalesce(v_profile.dating_goals, '{}'::text[])),
      'preferredVibes', to_jsonb(coalesce(v_profile.preferred_vibes, '{}'::text[])),
      'aiReview', jsonb_build_object(
        'selfSummary', left(coalesce(v_profile.ai_profile_analysis #>> '{aiReview,selfSummary}', ''), 1000),
        'seekingSummary', left(coalesce(v_profile.ai_profile_analysis #>> '{aiReview,seekingSummary}', ''), 1000),
        'idealMatchSummary', left(coalesce(v_profile.ai_profile_analysis #>> '{aiReview,idealMatchSummary}', ''), 1000),
        'avoidSummary', left(coalesce(v_profile.ai_profile_analysis #>> '{aiReview,avoidSummary}', ''), 1000)
      )
    ),
    coalesce(v_preference.summary, ''),
    coalesce(v_preference.soft_preferences, '{}'::text[]),
    coalesce(v_preference.soft_avoidances, '{}'::text[]),
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'sender', recent.sender,
        'content', left(recent.content, 2000),
        'createdAt', recent.created_at
      ) order by recent.created_at, recent.id)
      from (
        select message.id, message.sender, message.content, message.created_at
        from public.preference_chat_messages message
        where message.user_id = v_uid
        order by message.created_at desc, message.id desc
        limit v_limit
      ) recent
    ), '[]'::jsonb);
end;
$$;

revoke all on function public.get_preference_coach_context(uuid, integer)
  from anon, authenticated, public;
grant execute on function public.get_preference_coach_context(uuid, integer) to authenticated;

create or replace function public.finalize_preference_coach_request(
  p_client_request_id text,
  p_request_fingerprint text,
  p_claim_token uuid,
  p_content text,
  p_response_payload jsonb,
  p_update_memory boolean,
  p_expected_user_id uuid
)
returns table (
  request_status text,
  user_message_id uuid,
  assistant_message_id uuid,
  response_payload jsonb
)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_uid uuid := case when auth.role() = 'service_role' then p_expected_user_id else auth.uid() end;
  v_request_id text := nullif(left(btrim(coalesce(p_client_request_id, '')), 240), '');
  v_fingerprint text := nullif(left(btrim(coalesce(p_request_fingerprint, '')), 128), '');
  v_content text := btrim(coalesce(p_content, ''));
  v_request public.ai_assistant_requests%rowtype;
  v_reply text;
  v_summary text;
  v_preferred text[];
  v_avoided text[];
  v_user_message_id uuid;
  v_assistant_message_id uuid;
  v_bounded_payload jsonb;
begin
  perform private.assert_fpt_self_admission();
  if auth.role() <> 'service_role' or v_uid is null then
    raise exception using errcode = '42501', message = 'Preference coach finalize is service-only';
  end if;
  if p_expected_user_id is null or p_expected_user_id <> v_uid then
    raise exception using errcode = '42501', message = 'Authenticated user changed during preference finalize';
  end if;
  if v_request_id is null or v_fingerprint is null or p_claim_token is null
    or char_length(v_content) < 1 or char_length(v_content) > 2000
    or p_response_payload is null or jsonb_typeof(p_response_payload) <> 'object'
    or octet_length(p_response_payload::text) > 32768 then
    raise exception using errcode = '22023', message = 'Preference coach finalize payload is invalid';
  end if;

  v_reply := left(btrim(coalesce(p_response_payload ->> 'reply', '')), 2000);
  v_summary := left(btrim(coalesce(p_response_payload ->> 'summary', '')), 2000);
  if v_reply = '' then
    raise exception using errcode = '22023', message = 'Preference coach reply is required';
  end if;
  if jsonb_typeof(coalesce(p_response_payload -> 'preferredTraits', '[]'::jsonb)) <> 'array'
    or jsonb_typeof(coalesce(p_response_payload -> 'avoidedTraits', '[]'::jsonb)) <> 'array' then
    raise exception using errcode = '22023', message = 'Preference coach memory must be arrays';
  end if;

  select public.normalize_profile_text_array(
    array(select jsonb_array_elements_text(coalesce(p_response_payload -> 'preferredTraits', '[]'::jsonb))),
    20,
    120
  ) into v_preferred;
  select public.normalize_profile_text_array(
    array(select jsonb_array_elements_text(coalesce(p_response_payload -> 'avoidedTraits', '[]'::jsonb))),
    20,
    120
  ) into v_avoided;

  v_bounded_payload := jsonb_build_object(
    'reply', v_reply,
    'summary', v_summary,
    'preferredTraits', to_jsonb(v_preferred),
    'avoidedTraits', to_jsonb(v_avoided),
    'fallback', coalesce((p_response_payload ->> 'fallback')::boolean, false)
  );

  select request.* into v_request
  from public.ai_assistant_requests request
  where request.user_id = v_uid
    and request.scope = 'preference_chat'
    and request.client_request_id = v_request_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Preference coach claim not found';
  end if;
  if v_request.request_fingerprint <> v_fingerprint then
    raise exception using errcode = '22023', message = 'Preference coach request fingerprint mismatch';
  end if;

  if v_request.status = 'completed' then
    select message.id into v_user_message_id
    from public.preference_chat_messages message
    where message.user_id = v_uid
      and message.client_request_id = v_request_id
      and message.sender = 'user';
    select message.id into v_assistant_message_id
    from public.preference_chat_messages message
    where message.user_id = v_uid
      and message.client_request_id = v_request_id
      and message.sender = 'assistant';
    if v_user_message_id is null or v_assistant_message_id is null then
      raise exception using errcode = '55000', message = 'Incomplete preference coach transaction detected';
    end if;
    return query select 'cached'::text, v_user_message_id, v_assistant_message_id,
      v_request.response_payload;
    return;
  end if;
  if v_request.claim_token <> p_claim_token then
    raise exception using errcode = '40001', message = 'Preference coach request claim is stale';
  end if;

  insert into public.preference_chat_messages(
    user_id, sender, content, client_request_id, request_payload
  ) values (
    v_uid, 'user', v_content, v_request_id,
    jsonb_build_object('content', v_content, 'fingerprint', v_fingerprint)
  ) returning id into v_user_message_id;

  insert into public.preference_chat_messages(
    user_id, sender, content, client_request_id, request_payload
  ) values (
    v_uid, 'assistant', v_reply, v_request_id,
    jsonb_build_object('fingerprint', v_fingerprint)
  ) returning id into v_assistant_message_id;

  if coalesce(p_update_memory, false) then
    insert into public.preference_profiles(
      user_id, summary, soft_preferences, soft_avoidances, updated_at
    ) values (
      v_uid, v_summary, v_preferred, v_avoided, now()
    )
    on conflict (user_id) do update
      set summary = excluded.summary,
          soft_preferences = excluded.soft_preferences,
          soft_avoidances = excluded.soft_avoidances,
          updated_at = excluded.updated_at;
  end if;

  update public.ai_assistant_requests request
  set status = 'completed',
      completed_at = now(),
      response_payload = v_bounded_payload,
      expires_at = null
  where request.user_id = v_uid
    and request.scope = 'preference_chat'
    and request.client_request_id = v_request_id;

  return query select 'completed'::text, v_user_message_id, v_assistant_message_id,
    v_bounded_payload;
exception when invalid_text_representation then
  raise exception using errcode = '22023', message = 'Preference coach response is invalid';
end;
$$;

revoke all on function public.finalize_preference_coach_request(text, text, uuid, text, jsonb, boolean, uuid)
  from anon, authenticated, public;
grant execute on function public.finalize_preference_coach_request(text, text, uuid, text, jsonb, boolean, uuid)
  to service_role;

create or replace function public.get_conversation_wingman_context(
  p_conversation_id text,
  p_expected_user_id uuid,
  p_limit integer default 20
)
returns table (
  user_age integer,
  eligible boolean,
  eligibility_reason text,
  is_anonymous boolean,
  self_context jsonb,
  messages jsonb
)
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  v_uid uuid := auth.uid();
  v_age integer;
  v_is_anonymous boolean;
  v_limit integer := greatest(1, least(coalesce(p_limit, 20), 20));
  v_eligible boolean;
  v_reason text;
  v_self_context jsonb;
begin
  perform private.assert_fpt_self_admission();
  if v_uid is null then
    raise exception using errcode = '28000', message = 'Not authenticated';
  end if;
  if p_expected_user_id is null or p_expected_user_id <> v_uid then
    raise exception using errcode = '42501', message = 'Authenticated user changed during Wingman context load';
  end if;
  if nullif(btrim(coalesce(p_conversation_id, '')), '') is null
    or char_length(p_conversation_id) > 240 then
    raise exception using errcode = '22023', message = 'conversation_id is invalid';
  end if;

  select profile.age, conversation.is_anonymous
  into v_age, v_is_anonymous
  from public.conversation_participants participant
  join public.conversations conversation on conversation.id = participant.conversation_id
  join public.profiles profile on profile.id = participant.user_id
  where participant.conversation_id = p_conversation_id
    and participant.user_id = v_uid;
  if not found then
    raise exception using errcode = '42501', message = 'Conversation access denied';
  end if;

  v_eligible := v_age >= 18 and not v_is_anonymous;
  v_reason := case
    when v_age < 18 then 'under_18'
    when v_is_anonymous then 'anonymous_not_revealed'
    else null
  end;

  select jsonb_build_object(
    'bio', left(coalesce(profile.bio, ''), 1000),
    'datingGoals', to_jsonb(coalesce(profile.dating_goals, '{}'::text[])),
    'preferenceSummary', coalesce(preference.summary, ''),
    'preferredTraits', to_jsonb(coalesce(preference.soft_preferences, '{}'::text[])),
    'avoidedTraits', to_jsonb(coalesce(preference.soft_avoidances, '{}'::text[]))
  ) into v_self_context
  from public.profiles profile
  left join public.preference_profiles preference on preference.user_id = profile.id
  where profile.id = v_uid;

  return query select
    v_age,
    v_eligible,
    v_reason,
    v_is_anonymous,
    case when v_eligible then coalesce(v_self_context, '{}'::jsonb) else '{}'::jsonb end,
    case when not v_eligible then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object(
        'content', left(recent.content, 1000),
        'isMine', recent.sender_id = v_uid,
        'createdAt', recent.created_at
      ) order by recent.created_at, recent.id)
      from (
        select message.id, message.sender_id, message.content, message.created_at
        from public.messages message
        where message.conversation_id = p_conversation_id
        order by message.created_at desc, message.id desc
        limit v_limit
      ) recent
    ), '[]'::jsonb) end;
end;
$$;

revoke all on function public.get_conversation_wingman_context(text, uuid, integer)
  from anon, authenticated, public;
grant execute on function public.get_conversation_wingman_context(text, uuid, integer)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Complete the open-signup cutover left by the compatibility migration
-- ---------------------------------------------------------------------------

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
  and exists (
    select 1
    from auth.users account
    where account.id = profile.id
      and account.email_confirmed_at is not null
      and lower(btrim(coalesce(account.email, '')))
        ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
      and lower(btrim(account.email)) = lower(btrim(profile.email))
  )
  and not exists (
    select 1 from public.user_safety_actions safety
    where safety.user_id = profile.id
      and safety.action in ('shadow_review', 'suspension', 'ban')
      and safety.status = 'active'
      and (safety.expires_at is null or safety.expires_at > now())
  );

revoke all on table public.public_profiles from anon, authenticated, public;
grant select on table public.public_profiles to service_role;

drop policy if exists "avatars owner writes" on storage.objects;
create policy "avatars owner writes"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'avatars'
  and private.assert_fpt_self_admission() = auth.uid()
  and owner = auth.uid()
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists "avatars owner updates" on storage.objects;
create policy "avatars owner updates"
on storage.objects for update to authenticated
using (
  bucket_id = 'avatars'
  and private.assert_fpt_self_admission() = auth.uid()
  and owner = auth.uid()
  and split_part(name, '/', 1) = auth.uid()::text
)
with check (
  bucket_id = 'avatars'
  and private.assert_fpt_self_admission() = auth.uid()
  and owner = auth.uid()
  and split_part(name, '/', 1) = auth.uid()::text
);

create or replace function public.protect_client_profile_system_fields()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  v_uid uuid := auth.uid();
  v_auth_email text;
  v_email_confirmed_at timestamptz;
  v_profile_bio text;
  v_project_origin text;
  v_avatar_prefix text;
begin
  if auth.role() is null or auth.role() = 'service_role' then return new; end if;
  if auth.role() <> 'authenticated' or v_uid is null then
    raise exception using errcode = '28000', message = 'Not authenticated';
  end if;

  select lower(btrim(coalesce(account.email, ''))), account.email_confirmed_at
  into v_auth_email, v_email_confirmed_at
  from auth.users account
  where account.id = v_uid;

  if v_email_confirmed_at is null
    or v_auth_email is null
    or char_length(v_auth_email) > 254
    or v_auth_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception using errcode = '42501', message = 'A valid verified email is required to write profiles';
  end if;
  if tg_op = 'INSERT' and new.id <> v_uid then
    raise exception using errcode = '42501', message = 'Profile owner mismatch';
  end if;

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

-- ---------------------------------------------------------------------------
-- Soft avoidances participate only as a bounded feedback adjustment
-- ---------------------------------------------------------------------------

alter function public.get_match_candidates_v2(uuid, integer, integer)
  rename to get_match_candidates_v2_without_avoidances;

revoke all on function public.get_match_candidates_v2_without_avoidances(uuid, integer, integer)
  from anon, authenticated, service_role, public;

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
  with source as materialized (
    select base.*,
      coalesce((
        select public.text_array_overlap_ratio(
          preference.soft_avoidances,
          public.snapshot_match_tokens(jsonb_build_object(
            'interests', to_jsonb(coalesce(base.interests, '{}'::text[])),
            'personality_tags', to_jsonb(coalesce(base.personality_tags, '{}'::text[])),
            'dating_goals', to_jsonb(coalesce(base.dating_goals, '{}'::text[])),
            'preferred_vibes', to_jsonb(coalesce(base.preferred_vibes, '{}'::text[]))
          ))
        ) * 0.03
        from public.preference_profiles preference
        where preference.user_id = p_user_id
      ), 0::double precision) as avoidance_penalty
    from public.get_match_candidates_v2_without_avoidances(
      p_user_id,
      least(300, greatest(1, least(coalesce(p_limit, 120), 300)) * 3),
      p_cooldown_days
    ) base
    where exists (
      select 1
      from auth.users account
      where account.id = base.id
        and account.email_confirmed_at is not null
        and lower(btrim(coalesce(account.email, '')))
          ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    )
  ), adjusted as (
    select source.*,
      greatest(-0.15::double precision, least(
        0.15::double precision,
        source.feedback_affinity - source.avoidance_penalty
      )) as adjusted_feedback
    from source
  )
  select
    candidate.id, candidate.name, candidate.age, candidate.gender, candidate.campus,
    candidate.major, candidate.height_cm, candidate.bio, candidate.avatar_url,
    candidate.interests, candidate.personality_tags, candidate.dating_goals,
    candidate.preferred_vibes, candidate.profile_text, candidate.profile_completeness,
    candidate.looking_for_gender, candidate.age_pref_min, candidate.age_pref_max,
    candidate.appearance_preference, candidate.dealbreakers, candidate.ai_profile_analysis,
    candidate.self_similarity, candidate.need_similarity,
    candidate.preference_to_candidate, candidate.candidate_to_preference,
    candidate.communication_similarity, candidate.lifestyle_similarity,
    candidate.adjusted_feedback,
    candidate.coarse_score - candidate.feedback_affinity + candidate.adjusted_feedback
  from adjusted candidate
  order by candidate.coarse_score - candidate.feedback_affinity + candidate.adjusted_feedback desc,
    candidate.profile_completeness desc,
    candidate.id
  limit greatest(1, least(coalesce(p_limit, 120), 300));
$$;

revoke all on function public.get_match_candidates_v2(uuid, integer, integer)
  from anon, authenticated, public;
grant execute on function public.get_match_candidates_v2(uuid, integer, integer) to service_role;
