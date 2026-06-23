create extension if not exists pgcrypto;

create type campus as enum ('HCM', 'Hanoi', 'Danang', 'Cantho');
create type major as enum ('SE', 'AI', 'Biz', 'Design', 'Marketing');
create type onboarding_source as enum ('manual', 'sample_autofill');
create type curated_match_status as enum ('pending', 'accepted', 'declined', 'skipped', 'reported', 'matched');
create type feedback_decision as enum ('accepted', 'declined', 'skipped', 'reported');
create type match_source as enum ('ai-curated', 'blind-date');
create type report_status as enum ('open', 'reviewing', 'resolved', 'dismissed');
create type moderation_event_type as enum ('report_created', 'block_created', 'message_flagged', 'profile_flagged', 'safety_action_applied');
create type safety_action_type as enum ('warning', 'temporary_restriction', 'shadow_review', 'suspension', 'ban');
create type safety_action_status as enum ('active', 'expired', 'revoked');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.pair_key_for(a uuid, b uuid)
returns text
language sql
immutable
as $$
  select array_to_string(array(select unnest(array[a::text, b::text]) order by 1), '_');
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  name text not null default '',
  age integer not null default 0 check (age >= 0 and age <= 120),
  major major not null default 'SE',
  campus campus not null default 'HCM',
  avatar_url text not null default '',
  bio text not null default '',
  interests text[] not null default '{}',
  personality_tags text[] not null default '{}',
  dating_goals text[] not null default '{}',
  preferred_vibes text[] not null default '{}',
  profile_text jsonb not null default '{"bio": ""}'::jsonb,
  profile_completeness integer not null default 0 check (profile_completeness between 0 and 100),
  onboarding_source onboarding_source not null default 'manual',
  ai_signals jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create view public.public_profiles as
select
  id,
  name,
  age,
  major,
  campus,
  avatar_url,
  bio,
  interests,
  personality_tags,
  dating_goals,
  preferred_vibes,
  profile_text,
  profile_completeness
from public.profiles;

create table public.preference_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  summary text not null default 'Still learning dating preferences from feedback.',
  hard_filters text[] not null default '{}',
  soft_preferences text[] not null default '{}',
  feedback_summary text[] not null default '{}',
  updated_at timestamptz not null default now()
);

create table public.daily_match_batches (
  id text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  target_count integer not null default 5 check (target_count between 0 and 5),
  generated_by text not null default 'edge-curation-fallback',
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

create table public.curated_matches (
  id text primary key,
  batch_id text not null references public.daily_match_batches(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  candidate_id uuid not null references public.profiles(id) on delete cascade,
  candidate_snapshot jsonb not null,
  pair_key text not null,
  ai_reason text not null,
  compatibility_label text not null,
  compatibility_score integer not null check (compatibility_score between 0 and 100),
  status curated_match_status not null default 'pending',
  feedback_tags text[] not null default '{}',
  feedback_note text,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  check (user_id <> candidate_id)
);

create index curated_matches_user_status_idx on public.curated_matches(user_id, status);
create index curated_matches_pair_key_idx on public.curated_matches(pair_key);

create table public.match_feedback (
  id uuid primary key default gen_random_uuid(),
  match_id text not null references public.curated_matches(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  candidate_id uuid not null references public.profiles(id) on delete cascade,
  decision feedback_decision not null,
  tags text[] not null default '{}',
  note text,
  created_at timestamptz not null default now()
);

create table public.matches (
  id text primary key,
  pair_key text not null unique,
  source match_source not null default 'ai-curated',
  is_revealed boolean not null default true,
  matched_at timestamptz not null default now()
);

alter table public.matches enable row level security;

create table public.conversations (
  id text primary key,
  match_id text references public.matches(id) on delete cascade,
  pair_key text,
  is_anonymous boolean not null default false,
  last_message jsonb,
  updated_at timestamptz not null default now()
);

create table public.conversation_participants (
  conversation_id text not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  unread_count integer not null default 0,
  masked_name text,
  created_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create index conversation_participants_user_idx on public.conversation_participants(user_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id text not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  content text not null check (char_length(trim(content)) > 0 and char_length(content) <= 4000),
  created_at timestamptz not null default now(),
  is_read boolean not null default false
);

create index messages_conversation_created_idx on public.messages(conversation_id, created_at);

create table public.preference_chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  sender text not null check (sender in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create table public.blind_date_queue (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  masked_name text not null,
  status text not null check (status in ('waiting', 'matched', 'cancelled')) default 'waiting',
  queued_at timestamptz not null default now()
);

create table public.blind_date_sessions (
  id text primary key,
  conversation_id text references public.conversations(id) on delete set null,
  user_ids uuid[] not null,
  partner_masked_names jsonb not null default '{}'::jsonb,
  reveal_requests jsonb not null default '{}'::jsonb,
  is_revealed boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  reported_user_id uuid not null references public.profiles(id) on delete cascade,
  conversation_id text references public.conversations(id) on delete set null,
  curated_match_id text references public.curated_matches(id) on delete set null,
  reason text not null,
  note text,
  status report_status not null default 'open',
  created_at timestamptz not null default now(),
  check (reporter_id <> reported_user_id)
);

create table public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  blocked_user_id uuid not null references public.profiles(id) on delete cascade,
  reason text,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_user_id),
  check (blocker_id <> blocked_user_id)
);

create table public.moderation_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  target_user_id uuid references public.profiles(id) on delete cascade,
  report_id uuid references public.reports(id) on delete set null,
  event_type moderation_event_type not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.user_safety_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  action safety_action_type not null,
  status safety_action_status not null default 'active',
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

alter table public.profiles enable row level security;
alter table public.preference_profiles enable row level security;
alter table public.daily_match_batches enable row level security;
alter table public.curated_matches enable row level security;
alter table public.match_feedback enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;
alter table public.preference_chat_messages enable row level security;
alter table public.blind_date_queue enable row level security;
alter table public.blind_date_sessions enable row level security;
alter table public.reports enable row level security;
alter table public.blocks enable row level security;
alter table public.moderation_events enable row level security;
alter table public.user_safety_actions enable row level security;

create policy "profiles own select" on public.profiles for select using (id = auth.uid());
create policy "profiles own insert" on public.profiles for insert with check (id = auth.uid());
create policy "profiles own update" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

grant select on public.public_profiles to authenticated;

create policy "preference profiles own select" on public.preference_profiles for select using (user_id = auth.uid());
create policy "preference profiles own insert" on public.preference_profiles for insert with check (user_id = auth.uid());
create policy "preference profiles own update" on public.preference_profiles for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "daily batches own select" on public.daily_match_batches for select using (user_id = auth.uid());
create policy "curated matches own select" on public.curated_matches for select using (user_id = auth.uid());
create policy "match feedback own select" on public.match_feedback for select using (user_id = auth.uid());

create policy "matches participant select" on public.matches for select using (
  exists (
    select 1
    from public.conversation_participants cp
    join public.conversations c on c.id = cp.conversation_id
    where c.match_id = matches.id and cp.user_id = auth.uid()
  )
);

create policy "conversations participant select" on public.conversations for select using (
  exists (
    select 1 from public.conversation_participants cp
    where cp.conversation_id = conversations.id and cp.user_id = auth.uid()
  )
);

create policy "conversation participants own select" on public.conversation_participants for select using (user_id = auth.uid());

create policy "messages participant select" on public.messages for select using (
  exists (
    select 1 from public.conversation_participants cp
    where cp.conversation_id = messages.conversation_id and cp.user_id = auth.uid()
  )
);

create policy "messages participant insert" on public.messages for insert with check (
  sender_id = auth.uid()
  and exists (
    select 1 from public.conversation_participants cp
    where cp.conversation_id = messages.conversation_id and cp.user_id = auth.uid()
  )
);

create policy "preference chat own select" on public.preference_chat_messages for select using (user_id = auth.uid());
create policy "preference chat own insert" on public.preference_chat_messages for insert with check (user_id = auth.uid() and sender = 'user');

create policy "blind queue own select" on public.blind_date_queue for select using (user_id = auth.uid());
create policy "blind queue own insert" on public.blind_date_queue for insert with check (user_id = auth.uid());
create policy "blind queue own update" on public.blind_date_queue for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "blind sessions participant select" on public.blind_date_sessions for select using (auth.uid() = any(user_ids));

create policy "reports own insert" on public.reports for insert with check (reporter_id = auth.uid());
create policy "reports own select" on public.reports for select using (reporter_id = auth.uid());

create policy "blocks own insert" on public.blocks for insert with check (blocker_id = auth.uid());
create policy "blocks own select" on public.blocks for select using (blocker_id = auth.uid());
create policy "blocks own delete" on public.blocks for delete using (blocker_id = auth.uid());

create policy "moderation events hidden" on public.moderation_events for select using (false);
create policy "safety actions own select" on public.user_safety_actions for select using (user_id = auth.uid());

create or replace function public.accept_curated_match(
  p_match_id text,
  p_tags text[] default '{}',
  p_note text default ''
)
returns table(is_mutual boolean, conversation_id text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_match curated_matches%rowtype;
  v_pair_users uuid[];
  v_accepted_count integer;
  v_match_id text;
  v_conversation_id text;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_match
  from public.curated_matches
  where id = p_match_id
  for update;

  if not found then
    raise exception 'Curated match not found';
  end if;

  if v_match.user_id <> v_uid then
    raise exception 'Cannot update another user match';
  end if;

  insert into public.match_feedback(match_id, user_id, candidate_id, decision, tags, note)
  values (p_match_id, v_uid, v_match.candidate_id, 'accepted', coalesce(p_tags, '{}'), nullif(p_note, ''));

  update public.curated_matches
  set status = 'accepted',
      feedback_tags = coalesce(p_tags, '{}'),
      feedback_note = nullif(p_note, ''),
      decided_at = now()
  where id = p_match_id;

  select count(distinct user_id) into v_accepted_count
  from public.curated_matches
  where pair_key = v_match.pair_key and status in ('accepted', 'matched');

  if v_accepted_count < 2 then
    return query select false, null::text;
    return;
  end if;

  v_pair_users := array[v_match.user_id, v_match.candidate_id];
  v_match_id := v_match.pair_key;
  v_conversation_id := 'conversation_' || v_match.pair_key;

  insert into public.matches(id, pair_key, source, is_revealed)
  values (v_match_id, v_match.pair_key, 'ai-curated', true)
  on conflict (id) do nothing;

  insert into public.conversations(id, match_id, pair_key, is_anonymous)
  values (v_conversation_id, v_match_id, v_match.pair_key, false)
  on conflict (id) do nothing;

  insert into public.conversation_participants(conversation_id, user_id, unread_count)
  select v_conversation_id, unnest(v_pair_users), 0
  on conflict (conversation_id, user_id) do nothing;

  update public.curated_matches
  set status = 'matched', decided_at = now()
  where pair_key = v_match.pair_key and status in ('accepted', 'matched');

  return query select true, v_conversation_id;
end;
$$;

revoke all on function public.accept_curated_match(text, text[], text) from public;
grant execute on function public.accept_curated_match(text, text[], text) to authenticated;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "avatars owner writes" on storage.objects for insert to authenticated with check (
  bucket_id = 'avatars' and owner = auth.uid()
);

create policy "avatars owner updates" on storage.objects for update to authenticated using (
  bucket_id = 'avatars' and owner = auth.uid()
) with check (
  bucket_id = 'avatars' and owner = auth.uid()
);

create policy "avatars public reads" on storage.objects for select using (bucket_id = 'avatars');
