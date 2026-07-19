-- Safe, owner-only history for profiles the user explicitly liked.
-- The DTO intentionally omits candidate UUIDs, pair keys and all non-public
-- profile columns while retaining the snapshot the user originally saw.

create index if not exists curated_matches_user_liked_decided_idx
  on public.curated_matches(user_id, decided_at desc, id)
  where status in ('accepted', 'matched');

create or replace function public.list_ai_pick_history(
  p_limit integer default 30
)
returns table (
  match_id text,
  candidate_snapshot jsonb,
  ai_reason text,
  suggested_opener text,
  compatibility_label text,
  compatibility_score integer,
  match_status public.curated_match_status,
  liked_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  v_uid uuid := auth.uid();
begin
  perform private.assert_fpt_self_admission();
  if v_uid is null then
    raise exception using errcode = '28000', message = 'Not authenticated';
  end if;

  return query
  select
    picked.id,
    picked.candidate_snapshot,
    picked.ai_reason,
    picked.suggested_opener,
    picked.compatibility_label,
    picked.compatibility_score,
    picked.status,
    coalesce(picked.decided_at, picked.created_at)
  from public.curated_matches picked
  join public.profiles candidate on candidate.id = picked.candidate_id
  where picked.user_id = v_uid
    and picked.status in ('accepted', 'matched')
    and candidate.profile_confirmed = true
    and candidate.profile_completeness >= 75
    and not exists (
      select 1 from public.blocks blocked
      where (blocked.blocker_id = v_uid and blocked.blocked_user_id = picked.candidate_id)
         or (blocked.blocker_id = picked.candidate_id and blocked.blocked_user_id = v_uid)
    )
    and not exists (
      select 1 from public.reports reported
      where (reported.reporter_id = v_uid and reported.reported_user_id = picked.candidate_id)
         or (reported.reporter_id = picked.candidate_id and reported.reported_user_id = v_uid)
    )
    and not exists (
      select 1 from public.user_safety_actions safety
      where safety.user_id in (v_uid, picked.candidate_id)
        and safety.action in ('shadow_review', 'suspension', 'ban')
        and safety.status = 'active'
        and (safety.expires_at is null or safety.expires_at > now())
    )
  order by coalesce(picked.decided_at, picked.created_at) desc, picked.id
  limit greatest(1, least(coalesce(p_limit, 30), 100));
end;
$$;

revoke all on function public.list_ai_pick_history(integer)
  from anon, authenticated, public;
grant execute on function public.list_ai_pick_history(integer) to authenticated;
