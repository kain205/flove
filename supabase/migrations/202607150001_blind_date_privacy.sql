-- Blind Date privacy boundary.
--
-- Anonymous participants must only receive opaque session/conversation IDs, a
-- masked display name, and message ownership relative to themselves. Raw user
-- IDs remain server-side until both participants accept reveal.

-- Anonymous conversation rows are still participant-readable, so make their
-- identity-bearing columns safe at rest. This trigger protects both current and
-- future writers, including security-definer RPCs.
create or replace function public.enforce_anonymous_conversation_privacy()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
begin
  if new.is_anonymous then
    new.match_id := null;
    new.pair_key := null;
    if new.last_message is not null then
      new.last_message := new.last_message - array[
        'senderId', 'sender_id', 'userId', 'user_id', 'authorId', 'author_id'
      ];
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_anonymous_conversation_privacy()
  from anon, authenticated, public;

drop trigger if exists conversations_protect_anonymous_identity on public.conversations;
create trigger conversations_protect_anonymous_identity
before insert or update on public.conversations
for each row execute function public.enforce_anonymous_conversation_privacy();

-- Repair anonymous conversations created before the trigger existed. Running
-- through the trigger also removes any future identity-key aliases above.
update public.conversations
set pair_key = null,
    match_id = null,
    last_message = coalesce(last_message, '{}'::jsonb)
where is_anonymous
  and (
    pair_key is not null
    or match_id is not null
    or last_message ?| array[
      'senderId', 'sender_id', 'userId', 'user_id', 'authorId', 'author_id'
    ]
  );

-- Column RLS cannot mask user_ids/reveal_requests/sender_id. Remove direct
-- client reads and expose purpose-built participant RPCs below instead.
drop policy if exists "blind sessions participant select" on public.blind_date_sessions;
drop policy if exists "messages participant select" on public.messages;
revoke all on table public.blind_date_sessions from anon, authenticated, public;
revoke all on table public.messages from anon, authenticated, public;

-- One-release compatibility adapter for the released binary, which still reads
-- and inserts `messages` directly. It is limited to conversations whose identity
-- is already revealed/non-anonymous; anonymous Blind Date messages remain RPC-only.
-- Remove these two policies/grants after the app cutover reaches 100%.
grant select, insert on table public.messages to authenticated;

create policy "messages revealed participant select compatibility"
on public.messages for select
using (
  private.assert_fpt_self_admission() = auth.uid()
  and exists (
    select 1
    from public.conversation_participants participant
    join public.conversations conversation
      on conversation.id = participant.conversation_id
    where participant.conversation_id = messages.conversation_id
      and participant.user_id = auth.uid()
      and conversation.is_anonymous = false
  )
);

create policy "messages revealed participant insert compatibility"
on public.messages for insert
with check (
  private.assert_fpt_self_admission() = auth.uid()
  and sender_id = auth.uid()
  and client_message_id is null
  and char_length(trim(content)) between 1 and 4000
  and exists (
    select 1
    from public.conversation_participants participant
    join public.conversations conversation
      on conversation.id = participant.conversation_id
    where participant.conversation_id = messages.conversation_id
      and participant.user_id = auth.uid()
      and conversation.is_anonymous = false
  )
);

-- Legacy direct inserts have no idempotency key, but their conversation summary
-- and unread counter still update atomically with the insert. The v2 RPC always
-- supplies client_message_id and therefore does not execute this compatibility path.
create or replace function public.sync_legacy_direct_message()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if new.client_message_id is not null then return new; end if;

  update public.conversations conversation
  set last_message = jsonb_build_object(
        'id', new.id,
        'senderId', new.sender_id,
        'content', new.content,
        'createdAt', new.created_at
      ),
      updated_at = new.created_at
  where conversation.id = new.conversation_id
    and conversation.is_anonymous = false;

  update public.conversation_participants participant
  set unread_count = participant.unread_count + 1
  where participant.conversation_id = new.conversation_id
    and participant.user_id <> new.sender_id;
  return new;
end;
$$;

revoke all on function public.sync_legacy_direct_message()
  from anon, authenticated, public;
create trigger messages_sync_legacy_direct_insert
after insert on public.messages
for each row
when (new.client_message_id is null)
execute function public.sync_legacy_direct_message();

-- Queue state is part of the transactional claim invariant. A client must not
-- turn its matched row back into waiting and become eligible for a second pair.
drop policy if exists "blind queue own insert" on public.blind_date_queue;
drop policy if exists "blind queue own update" on public.blind_date_queue;
revoke insert, update, delete on table public.blind_date_queue
  from anon, authenticated, public;

-- Repair missing/corrupted queue rows from the authoritative session records
-- before enforcing the invariant for future writes.
insert into public.blind_date_queue as queue_row(
  user_id, masked_name, status, queued_at
)
select distinct on (member.user_id)
  member.user_id,
  coalesce(nullif(cp.masked_name, ''), 'Anonymous'),
  'matched',
  s.created_at
from public.blind_date_sessions s
cross join lateral unnest(s.user_ids) as member(user_id)
left join public.conversation_participants cp
  on cp.conversation_id = s.conversation_id
 and cp.user_id = member.user_id
order by member.user_id, s.created_at desc
on conflict (user_id) do update
set status = 'matched',
    masked_name = coalesce(nullif(queue_row.masked_name, ''), excluded.masked_name);

create or replace function public.enforce_blind_date_queue_invariant()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
begin
  if new.status = 'waiting' and exists (
    select 1
    from public.blind_date_sessions s
    where new.user_id = any(s.user_ids)
  ) then
    raise exception using
      errcode = '23514',
      message = 'A Blind Date participant with an existing session cannot rejoin the queue';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_blind_date_queue_invariant()
  from anon, authenticated, public;

drop trigger if exists blind_date_queue_enforce_single_session on public.blind_date_queue;
create trigger blind_date_queue_enforce_single_session
before insert or update on public.blind_date_queue
for each row execute function public.enforce_blind_date_queue_invariant();

-- Preserve the transactional queue implementation behind an owner-only
-- function, then expose a response that contains no counterpart UUID.
alter function public.find_blind_date_partner_atomic(text)
  rename to find_blind_date_partner_atomic_internal;
revoke all on function public.find_blind_date_partner_atomic_internal(text)
  from anon, authenticated, public;

create function public.find_blind_date_partner_atomic(p_masked_name text)
returns table (
  waiting boolean,
  session_id text,
  conversation_id text,
  partner_masked_name text
)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  perform private.assert_fpt_self_admission();
  -- Serialize the repair with the internal claim. Advisory locks are
  -- transaction-reentrant, so the internal function can safely take it again.
  perform pg_advisory_xact_lock(hashtextextended('blind_date_queue', 0));
  update public.blind_date_queue q
  set status = 'matched'
  where q.status = 'waiting'
    and exists (
      select 1
      from public.blind_date_sessions existing_session
      where q.user_id = any(existing_session.user_ids)
    );

  return query select
    claim.waiting,
    claim.session_id,
    claim.conversation_id,
    claim.partner_masked_name
  from public.find_blind_date_partner_atomic_internal(p_masked_name) claim;
end;
$$;

revoke all on function public.find_blind_date_partner_atomic(text)
  from anon, authenticated, public;
grant execute on function public.find_blind_date_partner_atomic(text) to authenticated;

-- Preserve the row-locking reveal merge internally. The public wrapper never
-- returns the UUID-keyed reveal_requests document; partner_id is populated only
-- after the internal transaction has confirmed mutual reveal.
alter function public.request_reveal_atomic(text)
  rename to request_reveal_atomic_internal;
revoke all on function public.request_reveal_atomic_internal(text)
  from anon, authenticated, public;

create function public.request_reveal_atomic(
  p_session_id text,
  p_expected_user_id uuid default null
)
returns table (
  accepted boolean,
  is_revealed boolean,
  requested_by_me boolean,
  requested_by_partner boolean,
  partner_id uuid
)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_uid uuid := auth.uid();
  v_accepted boolean;
  v_is_revealed boolean;
  v_session public.blind_date_sessions%rowtype;
  v_partner_id uuid;
  v_requested_by_partner boolean;
begin
  perform private.assert_fpt_self_admission();
  if v_uid is null then
    raise exception using errcode = '28000', message = 'Not authenticated';
  end if;
  if p_expected_user_id is not null and p_expected_user_id <> v_uid then
    raise exception using errcode = '40001', message = 'Session changed before reveal';
  end if;

  select reveal.accepted, reveal.is_revealed
  into v_accepted, v_is_revealed
  from public.request_reveal_atomic_internal(p_session_id) reveal;

  select s.* into strict v_session
  from public.blind_date_sessions s
  where s.id = p_session_id;

  if not (v_uid = any(v_session.user_ids)) then
    raise exception using errcode = '42501', message = 'Blind Date session access denied';
  end if;

  select member into v_partner_id
  from unnest(v_session.user_ids) member
  where member <> v_uid
  limit 1;

  select coalesce(bool_or(
    v_session.reveal_requests -> member::text = 'true'::jsonb
  ), false)
  into v_requested_by_partner
  from unnest(v_session.user_ids) member
  where member <> v_uid;

  return query select
    v_accepted,
    v_is_revealed,
    coalesce(v_session.reveal_requests -> v_uid::text = 'true'::jsonb, false),
    v_requested_by_partner,
    case when v_is_revealed then v_partner_id else null::uuid end;
end;
$$;

revoke all on function public.request_reveal_atomic(text, uuid)
  from anon, authenticated, public;
grant execute on function public.request_reveal_atomic(text, uuid) to authenticated;

-- Reload-safe session state. Before mutual reveal the only partner attribute is
-- the server-issued masked name. The UUID becomes visible atomically with reveal.
create or replace function public.get_blind_date_session(p_session_id text)
returns table (
  session_id text,
  conversation_id text,
  partner_masked_name text,
  requested_by_me boolean,
  requested_by_partner boolean,
  is_revealed boolean,
  partner_id uuid
)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_uid uuid := auth.uid();
  v_session public.blind_date_sessions%rowtype;
  v_partner_id uuid;
  v_requested_by_partner boolean;
begin
  perform private.assert_fpt_self_admission();
  if v_uid is null then
    raise exception using errcode = '28000', message = 'Not authenticated';
  end if;

  select s.* into v_session
  from public.blind_date_sessions s
  where s.id = p_session_id
    and v_uid = any(s.user_ids);

  if not found then
    raise exception using errcode = 'P0002', message = 'Blind Date session not found';
  end if;

  select member into v_partner_id
  from unnest(v_session.user_ids) member
  where member <> v_uid
  limit 1;

  select coalesce(bool_or(
    v_session.reveal_requests -> member::text = 'true'::jsonb
  ), false)
  into v_requested_by_partner
  from unnest(v_session.user_ids) member
  where member <> v_uid;

  return query select
    v_session.id,
    v_session.conversation_id,
    v_session.partner_masked_names ->> v_uid::text,
    coalesce(v_session.reveal_requests -> v_uid::text = 'true'::jsonb, false),
    v_requested_by_partner,
    v_session.is_revealed,
    case when v_session.is_revealed then v_partner_id else null::uuid end;
end;
$$;

revoke all on function public.get_blind_date_session(text) from anon, authenticated, public;
grant execute on function public.get_blind_date_session(text) to authenticated;

-- Conversation routes survive app restarts while the claim response does not.
-- Resolve the opaque session ID from a participant-owned conversation without
-- exposing either member UUID. Ordinary (non-Blind-Date) conversations return
-- no row, so clients can use this as a safe feature lookup.
create or replace function public.get_blind_date_session_for_conversation(
  p_conversation_id text
)
returns table (
  session_id text,
  conversation_id text,
  partner_masked_name text,
  requested_by_me boolean,
  requested_by_partner boolean,
  is_revealed boolean,
  partner_id uuid
)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_uid uuid := auth.uid();
  v_session_id text;
begin
  perform private.assert_fpt_self_admission();
  if v_uid is null then
    raise exception using errcode = '28000', message = 'Not authenticated';
  end if;

  select s.id into v_session_id
  from public.blind_date_sessions s
  where s.conversation_id = p_conversation_id
    and v_uid = any(s.user_ids)
  order by s.created_at desc
  limit 1;

  if v_session_id is null then return; end if;
  return query select * from public.get_blind_date_session(v_session_id);
end;
$$;

revoke all on function public.get_blind_date_session_for_conversation(text)
  from anon, authenticated, public;
grant execute on function public.get_blind_date_session_for_conversation(text) to authenticated;

-- Message ownership is relative to the caller. Never return sender_id or the
-- sender-scoped idempotency key to either participant.
create or replace function public.list_conversation_messages(
  p_conversation_id text,
  p_limit integer default 200
)
returns table (
  id uuid,
  conversation_id text,
  content text,
  created_at timestamptz,
  is_read boolean,
  is_mine boolean
)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_uid uuid := auth.uid();
  v_limit integer := greatest(1, least(coalesce(p_limit, 200), 500));
begin
  perform private.assert_fpt_self_admission();
  if v_uid is null then
    raise exception using errcode = '28000', message = 'Not authenticated';
  end if;
  if not exists (
    select 1
    from public.conversation_participants cp
    where cp.conversation_id = p_conversation_id
      and cp.user_id = v_uid
  ) then
    raise exception using errcode = '42501', message = 'Conversation access denied';
  end if;

  return query
  select recent.id,
         recent.conversation_id,
         recent.content,
         recent.created_at,
         recent.is_read,
         recent.is_mine
  from (
    select m.id,
           m.conversation_id,
           m.content,
           m.created_at,
           m.is_read,
           m.sender_id = v_uid as is_mine
    from public.messages m
    where m.conversation_id = p_conversation_id
    order by m.created_at desc, m.id desc
    limit v_limit
  ) recent
  order by recent.created_at, recent.id;
end;
$$;

revoke all on function public.list_conversation_messages(text, integer)
  from anon, authenticated, public;
grant execute on function public.list_conversation_messages(text, integer) to authenticated;

-- F-Love has no anonymous database flow. Supabase projects may carry direct
-- default table grants for anon even when RLS currently filters every row;
-- remove that latent surface for every application table/view in this schema.
revoke all privileges on all tables in schema public from anon, public;
