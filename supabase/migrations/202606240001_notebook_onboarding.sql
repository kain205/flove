-- Notebook AI onboarding + embedding matching.
-- Additive migration on top of 202606230001_initial_contract.sql.
-- Adds discovery/preference fields, the AI profile analysis store, and pgvector embeddings,
-- plus a service-only candidate retrieval RPC for the rewritten matching pipeline.

create extension if not exists vector;

create type gender as enum ('male', 'female', 'other', 'prefer_not_to_show');

alter table public.profiles
  add column gender gender not null default 'prefer_not_to_show',
  add column gender_text text,
  add column looking_for_gender text[] not null default '{}',
  add column height_cm integer,
  add column age_pref_min integer,
  add column age_pref_max integer,
  add column appearance_preference jsonb not null default '{}'::jsonb,
  add column dealbreakers jsonb not null default '[]'::jsonb,
  add column ai_profile_analysis jsonb not null default '{}'::jsonb,
  add column profile_confirmed boolean not null default false,
  add column profile_confirmed_at timestamptz,
  add column self_vector vector(1536),
  add column need_vector vector(1536),
  add column preference_vector vector(1536),
  add column communication_vector vector(1536),
  add column lifestyle_vector vector(1536);

alter table public.profiles
  add constraint profiles_height_cm_check check (height_cm is null or height_cm between 120 and 230),
  add constraint profiles_age_pref_check check (
    age_pref_min is null or age_pref_max is null or age_pref_min <= age_pref_max
  );

-- Approximate-nearest-neighbour indexes for cosine distance (<=>).
create index profiles_self_vec_idx on public.profiles using hnsw (self_vector vector_cosine_ops);
create index profiles_need_vec_idx on public.profiles using hnsw (need_vector vector_cosine_ops);
create index profiles_preference_vec_idx on public.profiles using hnsw (preference_vector vector_cosine_ops);
create index profiles_communication_vec_idx on public.profiles using hnsw (communication_vector vector_cosine_ops);
create index profiles_lifestyle_vec_idx on public.profiles using hnsw (lifestyle_vector vector_cosine_ops);

-- Recreate the safe candidate view: expose gender + height for display only.
-- Discovery preferences, appearance preferences, dealbreakers, AI analysis, and all
-- embeddings stay private (server-side only) and are intentionally excluded here.
create or replace view public.public_profiles as
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
  profile_completeness,
  gender,
  height_cm
from public.profiles;

grant select on public.public_profiles to authenticated;

alter table public.curated_matches add column suggested_opener text;

-- Service-only candidate retrieval: applies cheap hard filters (discovery, age, safety, blocks)
-- in SQL, does a coarse cosine prefilter on need_vector, and returns the 5 embeddings as real[]
-- so the matching Edge Function can parse them directly. NOT granted to authenticated because the
-- result contains private vectors/preferences; only the service-role matcher may call it.
create or replace function public.get_match_candidates(p_user_id uuid, p_limit integer default 120)
returns table (
  id uuid,
  name text,
  age integer,
  gender gender,
  campus campus,
  major major,
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
  appearance_preference jsonb,
  dealbreakers jsonb,
  ai_profile_analysis jsonb,
  self_vector real[],
  need_vector real[],
  preference_vector real[],
  communication_vector real[],
  lifestyle_vector real[]
)
language sql
security definer
set search_path = public
as $$
  with me as (
    select * from public.profiles where id = p_user_id
  )
  select
    p.id, p.name, p.age, p.gender, p.campus, p.major, p.height_cm, p.bio, p.avatar_url,
    p.interests, p.personality_tags, p.dating_goals, p.preferred_vibes, p.profile_text,
    p.profile_completeness, p.looking_for_gender, p.appearance_preference, p.dealbreakers,
    p.ai_profile_analysis,
    p.self_vector::real[], p.need_vector::real[], p.preference_vector::real[],
    p.communication_vector::real[], p.lifestyle_vector::real[]
  from public.profiles p, me
  where p.id <> me.id
    and p.profile_confirmed = true
    and p.profile_completeness >= 75
    and not exists (
      select 1 from public.blocks b
      where b.blocker_id = me.id and b.blocked_user_id = p.id
    )
    and not exists (
      select 1 from public.user_safety_actions sa
      where sa.user_id = p.id
        and sa.action in ('shadow_review', 'suspension', 'ban')
        and sa.status = 'active'
    )
    -- mutual gender discovery (empty preference, or 'other'/'prefer_not_to_show' never hard-excluded)
    and (
      cardinality(me.looking_for_gender) = 0
      or p.gender in ('other', 'prefer_not_to_show')
      or me.looking_for_gender && array['everyone', 'depends']
      or p.gender::text = any(me.looking_for_gender)
    )
    and (
      cardinality(p.looking_for_gender) = 0
      or me.gender in ('other', 'prefer_not_to_show')
      or p.looking_for_gender && array['everyone', 'depends']
      or me.gender::text = any(p.looking_for_gender)
    )
    -- mutual age preference (only applies when a side set bounds)
    and (me.age_pref_min is null or p.age >= me.age_pref_min)
    and (me.age_pref_max is null or p.age <= me.age_pref_max)
    and (p.age_pref_min is null or me.age >= p.age_pref_min)
    and (p.age_pref_max is null or me.age <= p.age_pref_max)
  order by
    case
      when (select need_vector from me) is not null and p.need_vector is not null
        then p.need_vector <=> (select need_vector from me)
      else 1
    end asc,
    p.profile_completeness desc
  limit greatest(1, least(p_limit, 300));
$$;

revoke all on function public.get_match_candidates(uuid, integer) from public;
grant execute on function public.get_match_candidates(uuid, integer) to service_role;
