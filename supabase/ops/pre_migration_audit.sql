-- Read-only production inventory to run before 202607140001_backend_reliability.sql.
-- This intentionally reads only the v1 schema and never selects raw onboarding answers.

select
  count(*) as total_auth_users,
  count(*) filter (
    where lower(btrim(coalesce(email, ''))) !~ '^[a-z0-9._%+\-]+@fpt\.edu\.vn$'
  ) as legacy_non_fpt_auth_users
from auth.users;

select
  count(*) as total_profile_rows,
  count(*) filter (
    where lower(btrim(coalesce(profile.email, ''))) !~ '^[a-z0-9._%+\-]+@fpt\.edu\.vn$'
  ) as non_fpt_profile_emails,
  count(*) filter (where account.id is null) as profiles_without_auth_user,
  count(*) filter (
    where account.id is not null
      and lower(btrim(coalesce(account.email, ''))) !~ '^[a-z0-9._%+\-]+@fpt\.edu\.vn$'
  ) as profiles_owned_by_non_fpt_auth_users
from public.profiles profile
left join auth.users account on account.id = profile.id;

select
  count(*) as total_profiles,
  count(*) filter (where profile_confirmed and profile_completeness >= 75) as canonically_ready,
  count(*) filter (where not profile_confirmed and profile_completeness >= 75) as completeness_ready_but_unconfirmed,
  count(*) filter (
    where not profile_confirmed
      and profile_completeness >= 75
      and (ai_signals <> '{}'::jsonb or ai_profile_analysis <> '{}'::jsonb)
  ) as safe_backfill_candidates,
  count(*) filter (where profile_completeness < 75) as incomplete_profiles
from public.profiles;

select
  count(*) as total_batches,
  count(*) filter (
    where not exists (
      select 1 from public.curated_matches m where m.batch_id = b.id
    )
  ) as orphan_or_empty_batches,
  min(created_at) as oldest_batch,
  max(created_at) as newest_batch
from public.daily_match_batches b;

select
  b.date,
  count(*) as batches,
  count(*) filter (
    where not exists (
      select 1 from public.curated_matches m where m.batch_id = b.id
    )
  ) as empty_batches,
  round(avg((select count(*) from public.curated_matches m where m.batch_id = b.id)), 2) as avg_picks
from public.daily_match_batches b
where b.date >= current_date - 30
group by b.date
order by b.date desc;

select
  count(*) filter (
    where self_vector is not null
      and need_vector is not null
      and preference_vector is not null
      and communication_vector is not null
      and lifestyle_vector is not null
  ) as profiles_with_all_vectors,
  count(*) filter (
    where self_vector is null
       or need_vector is null
       or preference_vector is null
       or communication_vector is null
       or lifestyle_vector is null
  ) as profiles_missing_any_vector
from public.profiles
where profile_confirmed and profile_completeness >= 75;

select decision, count(*)
from public.match_feedback
group by decision
order by decision;
