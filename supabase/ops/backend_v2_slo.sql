-- Read-only post-deploy health/SLO checks for backend reliability v2.

-- Non-empty rows are the machine-readable alert feed (2% failures, 3s p95,
-- two-minute generation leases, and ten-minute embedding deadlines).
select * from public.get_backend_v2_alerts();

with recent as (
  select *
  from public.match_generation_attempts
  where started_at >= now() - interval '24 hours'
)
select
  count(*) as attempts,
  count(*) filter (where outcome = 'failed') as failures,
  round(100.0 * count(*) filter (where outcome = 'failed') / nullif(count(*), 0), 2) as failure_percent,
  percentile_cont(0.95) within group (order by duration_ms)
    filter (where outcome in ('ready', 'empty')) as uncached_p95_ms,
  round(avg(candidate_count), 2) as avg_candidates,
  round(avg(selected_count), 2) as avg_selected
from recent;

select id, user_id, attempt_count, generation_started_at, now() - generation_started_at as age
from public.daily_match_batches
where status = 'generating'
  and generation_started_at < now() - interval '2 minutes'
order by generation_started_at;

select id, embedding_status, profile_revision, embedding_revision,
       coalesce(embedding_updated_at, updated_at) as pending_since
from public.profiles
where embedding_status in ('pending', 'processing')
  and coalesce(embedding_updated_at, updated_at) < now() - interval '10 minutes'
order by pending_since;

select status, count(*) as batches,
       min(retry_after) as earliest_retry,
       max(updated_at) as latest_update
from public.daily_match_batches
where date >= public.flove_business_date() - 7
group by status
order by status;

select embedding_status, count(*)
from public.profiles
group by embedding_status
order by embedding_status;

select
  count(*) as queued_jobs,
  max(now() - enqueued_at) as oldest_queue_age,
  max(read_ct) as highest_retry_count
from pgmq.q_ai_jobs;
