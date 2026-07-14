-- Read-only matching benchmark and index-path probe.
-- Usage:
--   psql "$DATABASE_URL" \
--     -v viewer_id='00000000-0000-0000-0000-000000000001' \
--     -v candidate_limit=120 \
--     -f supabase/ops/explain_matching_v2.sql
--
-- Run once for representative 100/1,000/10,000-profile datasets and retain the
-- plans with the rollout evidence. This script does not persist any changes.

begin read only;

set local statement_timeout = '30s';
set local lock_timeout = '2s';

select public.flove_business_date() as business_date,
       count(*) filter (
         where profile_confirmed and profile_completeness >= 75
       ) as canonical_ready_profiles,
       count(*) as total_profiles
from public.profiles;

select public.get_match_filter_metrics(:'viewer_id'::uuid, 30) as filter_funnel;

explain (analyze, buffers, settings, summary, timing)
select *
from public.get_match_candidates_v2(
  :'viewer_id'::uuid,
  :candidate_limit::integer,
  30
);

-- The security-definer function above appears as a Function Scan. Probe its
-- preference-to-candidate ANN branch directly as well so the captured plan can
-- prove whether profiles_self_vec_idx/HNSW is selected at the target pool size.
explain (analyze, buffers, settings, summary, timing)
select candidate.id
from public.profiles candidate
cross join lateral (
  select viewer.preference_vector
  from public.profiles viewer
  where viewer.id = :'viewer_id'::uuid
    and viewer.profile_confirmed
    and viewer.profile_completeness >= 75
    and viewer.embedding_status = 'ready'
    and viewer.embedding_revision = viewer.profile_revision
    and viewer.preference_vector is not null
) viewer
where candidate.id <> :'viewer_id'::uuid
  and candidate.profile_confirmed
  and candidate.profile_completeness >= 75
  and candidate.embedding_status = 'ready'
  and candidate.embedding_revision = candidate.profile_revision
  and candidate.self_vector is not null
order by candidate.self_vector <=> viewer.preference_vector
limit :candidate_limit::integer;

rollback;
