-- Rebuild liked snapshots from an explicit allowlist so even a legacy row with
-- extra JSON keys cannot expose them through the authenticated history DTO.

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
    jsonb_strip_nulls(jsonb_build_object(
      -- A match-scoped key is sufficient for rendering and is not a candidate UUID.
      'id', picked.id,
      'name', coalesce(picked.candidate_snapshot ->> 'name', 'Thành viên F-Love'),
      'age', coalesce(picked.candidate_snapshot -> 'age', '0'::jsonb),
      'major', coalesce(picked.candidate_snapshot ->> 'major', 'SE'),
      'campus', coalesce(picked.candidate_snapshot ->> 'campus', 'HCM'),
      'avatar_url', coalesce(picked.candidate_snapshot ->> 'avatar_url', picked.candidate_snapshot ->> 'avatarUrl', ''),
      'bio', coalesce(picked.candidate_snapshot ->> 'bio', ''),
      'interests', coalesce(picked.candidate_snapshot -> 'interests', '[]'::jsonb),
      'personality_tags', coalesce(picked.candidate_snapshot -> 'personality_tags', picked.candidate_snapshot -> 'personalityTags', '[]'::jsonb),
      'dating_goals', coalesce(picked.candidate_snapshot -> 'dating_goals', picked.candidate_snapshot -> 'datingGoals', '[]'::jsonb),
      'preferred_vibes', coalesce(picked.candidate_snapshot -> 'preferred_vibes', picked.candidate_snapshot -> 'preferredVibes', '[]'::jsonb),
      'profile_text', jsonb_strip_nulls(jsonb_build_object(
        'bio', coalesce(picked.candidate_snapshot #>> '{profile_text,bio}', picked.candidate_snapshot #>> '{profileText,bio}', picked.candidate_snapshot ->> 'bio', ''),
        'school', coalesce(picked.candidate_snapshot #>> '{profile_text,school}', picked.candidate_snapshot #>> '{profileText,school}'),
        'majorLabel', coalesce(picked.candidate_snapshot #>> '{profile_text,majorLabel}', picked.candidate_snapshot #>> '{profileText,majorLabel}'),
        'weekendStyle', coalesce(picked.candidate_snapshot #>> '{profile_text,weekendStyle}', picked.candidate_snapshot #>> '{profileText,weekendStyle}'),
        'conversationStyle', coalesce(picked.candidate_snapshot #>> '{profile_text,conversationStyle}', picked.candidate_snapshot #>> '{profileText,conversationStyle}'),
        'memorableThing', coalesce(picked.candidate_snapshot #>> '{profile_text,memorableThing}', picked.candidate_snapshot #>> '{profileText,memorableThing}'),
        'relationshipIntent', coalesce(picked.candidate_snapshot #>> '{profile_text,relationshipIntent}', picked.candidate_snapshot #>> '{profileText,relationshipIntent}')
      )),
      'profile_completeness', coalesce(picked.candidate_snapshot -> 'profile_completeness', picked.candidate_snapshot -> 'profileCompleteness', '100'::jsonb),
      'gender', picked.candidate_snapshot -> 'gender',
      'height_cm', coalesce(picked.candidate_snapshot -> 'height_cm', picked.candidate_snapshot -> 'heightCm')
    )),
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
