-- Resolve PL/pgSQL output-column ambiguity and make enum assignment explicit.
-- These are additive production fixes for functions introduced by prior migrations.

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

  v_status := case
    when v_match_count > 0 then 'ready'::public.daily_match_batch_status
    else 'empty'::public.daily_match_batch_status
  end;
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
  on conflict on constraint ai_pick_unlock_ledger_user_id_batch_id_product_key_key do nothing;

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

create or replace function public.complete_learning_lesson(
  p_course_id text,
  p_lesson_id text,
  p_selected_answer integer,
  p_reflection text default ''
)
returns table (
  course_id text,
  lesson_id text,
  enrollment_status text,
  progress_percent integer,
  current_lesson integer,
  lesson_completed boolean,
  is_correct boolean,
  completed_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_uid uuid := auth.uid();
  v_lesson public.learning_lessons%rowtype;
  v_enrollment public.course_enrollments%rowtype;
  v_correct_index integer;
  v_completed_count integer;
  v_total integer;
  v_next integer;
  v_progress integer;
  v_correct boolean;
  v_completed_at timestamptz;
begin
  perform private.assert_fpt_self_admission();
  select enrollment.* into v_enrollment
  from public.course_enrollments enrollment
  where enrollment.user_id = v_uid and enrollment.course_id = p_course_id
  for update;
  if not found then
    raise exception using errcode = '42501', message = 'Enroll before completing a lesson';
  end if;
  select lesson.* into v_lesson
  from public.learning_lessons lesson
  join public.learning_courses course on course.id = lesson.course_id
  where lesson.id = p_lesson_id and lesson.course_id = p_course_id
    and course.status = 'published';
  if not found then
    raise exception using errcode = 'P0002', message = 'Learning lesson not found';
  end if;

  v_correct_index := (v_lesson.quiz ->> 'correctIndex')::integer;
  if p_selected_answer is null
    or p_selected_answer < 0
    or p_selected_answer >= jsonb_array_length(v_lesson.quiz -> 'options') then
    raise exception using errcode = '22023', message = 'Quiz answer is invalid';
  end if;
  if char_length(coalesce(p_reflection, '')) > 1000 then
    raise exception using errcode = '22023', message = 'Reflection is too long';
  end if;
  v_correct := p_selected_answer = v_correct_index;

  insert into public.course_lesson_progress(
    user_id, course_id, lesson_id, selected_answer, is_correct, reflection
  ) values (
    v_uid, p_course_id, p_lesson_id, p_selected_answer, v_correct,
    left(btrim(coalesce(p_reflection, '')), 1000)
  )
  on conflict on constraint course_lesson_progress_pkey do update set
    selected_answer = excluded.selected_answer,
    is_correct = excluded.is_correct,
    reflection = excluded.reflection
  returning course_lesson_progress.completed_at into v_completed_at;

  select course.lesson_count into v_total
  from public.learning_courses course where course.id = p_course_id;
  select count(*)::integer into v_completed_count
  from public.course_lesson_progress progress
  where progress.user_id = v_uid and progress.course_id = p_course_id;
  v_progress := least(100, round(v_completed_count::numeric * 100 / greatest(v_total, 1))::integer);

  select coalesce(min(lesson.position), v_total) into v_next
  from public.learning_lessons lesson
  where lesson.course_id = p_course_id
    and not exists (
      select 1 from public.course_lesson_progress progress
      where progress.user_id = v_uid and progress.course_id = p_course_id
        and progress.lesson_id = lesson.id
    );

  update public.course_enrollments enrollment
  set status = case when v_completed_count >= v_total then 'completed' else 'in_progress' end,
      progress_percent = v_progress,
      current_lesson = greatest(1, v_next),
      started_at = coalesce(enrollment.started_at, now()),
      completed_at = case when v_completed_count >= v_total
        then coalesce(enrollment.completed_at, now()) else null end
  where enrollment.user_id = v_uid and enrollment.course_id = p_course_id
  returning * into v_enrollment;

  return query select p_course_id, p_lesson_id, v_enrollment.status,
    v_enrollment.progress_percent, v_enrollment.current_lesson,
    true, v_correct, v_completed_at;
end;
$$;

revoke all on function public.complete_learning_lesson(text, text, integer, text)
  from anon, authenticated, public;
grant execute on function public.complete_learning_lesson(text, text, integer, text)
  to authenticated;
