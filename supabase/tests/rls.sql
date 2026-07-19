begin;

select plan(78);

select has_table('public', 'profiles', 'profiles table exists');
select has_table('public', 'conversation_participants', 'conversation participants table exists');
select has_table('public', 'reports', 'reports table exists');
select has_table('public', 'blocks', 'blocks table exists');
select has_view('public', 'public_profiles', 'safe public profile view exists');

select has_function(
  'public',
  'accept_curated_match',
  array['text', 'text[]', 'text'],
  'mutual accept transaction exists'
);

select is_empty(
  $$
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'messages'
      and policyname = 'messages participant insert'
  $$,
  'the broad legacy message insert policy is removed'
);

select isnt_empty(
  $$
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'messages'
      and policyname = 'messages revealed participant insert compatibility'
      and lower(with_check) like '%participant.user_id = auth.uid()%'
      and lower(with_check) like '%is_anonymous = false%'
      and lower(with_check) like '%client_message_id is null%'
      and lower(with_check) like '%char_length%'
      and lower(with_check) like '%4000%'
  $$,
  'legacy direct-message insert is bounded to revealed participants, null keys and valid content'
);
select isnt_empty(
  $$
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'messages'
      and policyname in (
        'messages revealed participant select compatibility',
        'messages revealed participant insert compatibility'
      )
      and lower(coalesce(qual, '') || ' ' || coalesce(with_check, ''))
        like '%private.assert_fpt_self_admission()%'
    group by schemaname, tablename
    having count(*) = 2
  $$,
  'both released direct-message compatibility policies enforce canonical FPT admission'
);
select isnt_empty(
  $$
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename in ('reports', 'blocks')
      and policyname in (
        'reports own insert', 'reports own select',
        'blocks own insert', 'blocks own select', 'blocks own delete'
      )
      and lower(coalesce(qual, '') || ' ' || coalesce(with_check, ''))
        like '%private.assert_fpt_self_admission()%'
    having count(*) = 5
  $$,
  'legacy report and block owner policies enforce canonical FPT admission'
);

select has_table('public', 'onboarding_drafts', 'revisioned onboarding drafts exist');
select has_table('public', 'match_generation_attempts', 'generation attempts exist');
select has_table('public', 'candidate_pool_state', 'candidate pool revision exists');
select has_table('public', 'ai_job_registry', 'AI queue idempotency registry exists');

select has_column('public', 'profiles', 'profile_revision', 'profiles have a revision');
select has_column('public', 'profiles', 'embedding_status', 'profiles expose embedding status');
select has_column('public', 'profiles', 'onboarding_answers', 'profiles retain onboarding answers');
select has_column('public', 'daily_match_batches', 'status', 'daily batches have a lifecycle');
select has_column('public', 'daily_match_batches', 'claim_token', 'daily batches have stale-worker fencing');
select has_column('public', 'messages', 'client_message_id', 'messages support idempotency');
select has_column('public', 'preference_chat_messages', 'client_request_id', 'preference chat supports idempotency');
select has_column('public', 'match_feedback', 'idempotency_key', 'match feedback supports idempotency');

select has_type('public', 'daily_match_batch_status', 'daily batch status enum exists');
select has_type('public', 'embedding_job_status', 'embedding job status enum exists');

select has_function(
  'public', 'save_onboarding_draft', array['jsonb', 'bigint', 'integer', 'uuid'],
  'optimistic onboarding draft save exists'
);
select has_function(
  'public', 'save_onboarding_analysis', array['uuid', 'bigint', 'jsonb', 'text'],
  'revision-bound onboarding analysis save exists'
);
select has_function(
  'public', 'confirm_onboarding_profile_atomic', array['uuid', 'bigint', 'bigint', 'jsonb'],
  'atomic onboarding confirmation exists'
);
select has_function(
  'public', 'claim_daily_match_batch', array['uuid', 'text', 'integer'],
  'daily match claim transaction exists'
);
select has_function(
  'public', 'get_match_candidates_v2', array['uuid', 'integer', 'integer'],
  'scalar-only candidate retrieval exists'
);
select has_function(
  'public', 'match_pair_live_eligible', array['uuid', 'uuid'],
  'live pair eligibility predicate exists'
);
select has_function(
  'public', 'get_daily_match_rows_v2', array['uuid', 'text'],
  'live-filtered daily match reader exists'
);
select has_function(
  'public', 'finalize_daily_match_batch',
  array['text', 'uuid', 'uuid', 'jsonb', 'text', 'text', 'integer', 'integer', 'integer'],
  'daily match finalize transaction exists'
);
select has_function(
  'public', 'fail_daily_match_batch', array['text', 'uuid', 'text', 'integer', 'integer', 'integer'],
  'daily match failure recovery exists'
);
select has_function(
  'public', 'submit_match_feedback_atomic',
  array['text', 'feedback_decision', 'text', 'text[]', 'text'],
  'idempotent feedback transaction exists'
);
select has_function(
  'public', 'find_blind_date_partner_atomic', array['text'],
  'transactional Blind Date claim exists'
);
select has_function(
  'public', 'request_reveal_atomic', array['text', 'uuid'],
  'atomic Blind Date reveal exists'
);
select has_function(
  'public', 'get_blind_date_session', array['text'],
  'participant-safe Blind Date session read exists'
);
select has_function(
  'public', 'get_blind_date_session_for_conversation', array['text'],
  'reload-safe Blind Date conversation lookup exists'
);
select has_function(
  'public', 'list_conversation_messages', array['text', 'integer'],
  'participant-safe message read exists'
);
select has_function(
  'public', 'mark_conversation_read', array['text'],
  'authenticated atomic conversation read marker exists'
);
select has_function(
  'public', 'before_user_created_require_fpt', array['jsonb'],
  'Before User Created verified-email auth hook exists'
);
select has_function(
  'private', 'assert_fpt_self_admission', array[]::text[],
  'canonical self-admission helper exists under its compatibility name'
);
select ok(
  has_schema_privilege('authenticated', 'private', 'USAGE')
  and not has_schema_privilege('anon', 'private', 'USAGE')
  and not has_schema_privilege('service_role', 'private', 'USAGE')
  and not has_function_privilege(
    'anon', 'private.assert_fpt_self_admission()', 'EXECUTE'
  )
  and has_function_privilege(
    'authenticated', 'private.assert_fpt_self_admission()', 'EXECUTE'
  )
  and not has_function_privilege(
    'service_role', 'private.assert_fpt_self_admission()', 'EXECUTE'
  ),
  'the private admission helper is available to authenticated RLS but not exposed in an API schema'
);
select ok(
  has_function_privilege(
    'supabase_auth_admin', 'public.before_user_created_require_fpt(jsonb)', 'EXECUTE'
  )
  and not has_function_privilege(
    'anon', 'public.before_user_created_require_fpt(jsonb)', 'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated', 'public.before_user_created_require_fpt(jsonb)', 'EXECUTE'
  )
  and not has_function_privilege(
    'service_role', 'public.before_user_created_require_fpt(jsonb)', 'EXECUTE'
  ),
  'only the Supabase Auth hook role can execute the verified-email signup gate'
);
select is_empty(
  $$
    with admitted_rpc(signature) as (
      values
        ('public.accept_curated_match(text,text[],text)'),
        ('public.find_blind_date_partner_atomic(text)'),
        ('public.get_blind_date_session(text)'),
        ('public.get_blind_date_session_for_conversation(text)'),
        ('public.get_conversation_wingman_context(text,uuid,integer)'),
        ('public.get_preference_coach_context(uuid,integer)'),
        ('public.list_conversation_messages(text,integer)'),
        ('public.mark_conversation_read(text)'),
        ('public.match_pair_live_eligible(uuid,uuid)'),
        ('public.request_reveal_atomic(text,uuid)'),
        ('public.save_onboarding_draft(jsonb,bigint,integer,uuid)'),
        ('public.send_message_atomic(text,text,text,uuid)'),
        ('public.submit_match_feedback_atomic(text,public.feedback_decision,text,text[],text)'),
        ('public.unlock_daily_match_batch(text,text,uuid)')
    )
    select signature
    from admitted_rpc
    where to_regprocedure(signature) is null
       or position(
         'private.assert_fpt_self_admission()'
         in pg_get_functiondef(to_regprocedure(signature))
       ) = 0
  $$,
  'every authenticated user RPC except the harmless business-date helper enforces canonical admission'
);
select ok(
  (
    select bucket.file_size_limit = 5 * 1024 * 1024
      and bucket.allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']::text[]
    from storage.buckets bucket
    where bucket.id = 'avatars'
  ),
  'avatar bucket accepts only JPEG, PNG or WebP files up to 5 MiB'
);
select isnt_empty(
  $$
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname in ('avatars owner writes', 'avatars owner updates')
      and lower(coalesce(with_check, '')) like '%bucket_id = ''avatars''%'
      and lower(coalesce(with_check, '')) like '%owner = auth.uid()%'
      and lower(coalesce(with_check, '')) like '%split_part%name%auth.uid()%'
      and lower(coalesce(with_check, '')) like '%assert_fpt_self_admission%auth.uid()%'
      and lower(coalesce(with_check, '')) not like '%auth.jwt()%'
      and lower(coalesce(with_check, '')) not like '%fpt%edu%vn%'
    group by schemaname, tablename
    having count(*) = 2
  $$,
  'avatar insert and update policies require owner UUID/path scope without a domain gate'
);
select ok(
  not has_table_privilege('authenticated', 'public.blind_date_sessions', 'SELECT'),
  'authenticated users cannot read raw Blind Date sessions'
);
select ok(
  not has_table_privilege('anon', 'public.messages', 'SELECT'),
  'anonymous users cannot read raw message sender IDs'
);
select ok(
  not has_table_privilege('anon', 'public.public_profiles', 'SELECT')
  and not has_table_privilege('authenticated', 'public.public_profiles', 'SELECT')
  and has_table_privilege('service_role', 'public.public_profiles', 'SELECT'),
  'identity-bearing public profile discovery is service-only'
);
select is_empty(
  $$
    select relation.oid::regclass
    from pg_class relation
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relkind in ('r', 'p', 'v', 'm', 'f')
      and not exists (
        select 1
        from pg_depend dependency
        where dependency.classid = 'pg_class'::regclass
          and dependency.objid = relation.oid
          and dependency.deptype = 'e'
      )
      and (
        has_table_privilege('anon', relation.oid, 'SELECT')
        or has_table_privilege('anon', relation.oid, 'INSERT')
        or has_table_privilege('anon', relation.oid, 'UPDATE')
        or has_table_privilege('anon', relation.oid, 'DELETE')
      )
  $$,
  'anonymous role has no direct access to any public-schema application table or view'
);
select ok(
  not has_table_privilege('authenticated', 'public.blind_date_queue', 'INSERT')
  and not has_table_privilege('authenticated', 'public.blind_date_queue', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.blind_date_queue', 'DELETE'),
  'Blind Date queue writes are RPC-only'
);
select ok(
  not has_function_privilege(
    'authenticated', 'public.find_blind_date_partner_atomic_internal(text)', 'EXECUTE'
  ),
  'identity-bearing Blind Date claim is owner-only'
);
select ok(
  not has_function_privilege(
    'authenticated', 'public.request_reveal_atomic_internal(text)', 'EXECUTE'
  ),
  'identity-bearing reveal merge is owner-only'
);
select ok(
  not has_function_privilege(
    'authenticated', 'public.get_daily_match_rows_v2(uuid,text)', 'EXECUTE'
  ),
  'live daily match reader is service-only'
);

select is_empty(
  $$
    with service_only(signature) as (
      values
        ('public.abandon_ai_assistant_request(text,text,text,uuid,uuid)'),
        ('public.claim_ai_assistant_request(text,text,text,uuid)'),
        ('public.finalize_ai_assistant_request(text,text,text,uuid,jsonb,uuid)'),
        ('public.finalize_preference_coach_request(text,text,uuid,text,jsonb,boolean,uuid)'),
        ('public.mark_ai_assistant_provider_started(text,text,text,uuid,uuid)'),
        ('public.save_onboarding_analysis(uuid,bigint,jsonb,text)'),
        ('public.enqueue_ai_job(jsonb,text,integer)'),
        ('public.read_ai_jobs(integer,integer)'),
        ('public.delete_ai_job(bigint)'),
        ('public.archive_ai_job(bigint)'),
        ('public.get_daily_match_rows_v2(uuid,text)'),
        ('public.get_daily_picks_safe(uuid,text)'),
        ('public.get_match_candidates(uuid,integer)'),
        ('public.get_match_candidates_v2(uuid,integer,integer)'),
        ('public.get_match_filter_metrics(uuid,integer)'),
        ('public.claim_daily_match_batch(uuid,text,integer)'),
        ('public.finalize_daily_match_batch(text,uuid,uuid,jsonb,text,text,integer,integer,integer)'),
        ('public.fail_daily_match_batch(text,uuid,text,integer,integer,integer)'),
        ('public.claim_ai_rate_limit(uuid,text,integer,integer)'),
        ('public.mark_profile_embedding_processing(uuid,bigint)'),
        ('public.complete_profile_embedding_job(uuid,bigint,jsonb,text)'),
        ('public.complete_daily_match_enrichment(text,integer,jsonb,text)'),
        ('public.confirm_onboarding_profile_atomic(uuid,bigint,bigint,jsonb)'),
        ('public.get_backend_v2_alerts()'),
        ('public.repair_daily_match_teaser(text)')
    ), resolved as (
      select signature, to_regprocedure(signature) as procedure_oid
      from service_only
    )
    select signature
    from resolved
    where procedure_oid is null
       or coalesce(has_function_privilege('anon', procedure_oid, 'EXECUTE'), false)
       or coalesce(has_function_privilege('authenticated', procedure_oid, 'EXECUTE'), false)
       or not coalesce(has_function_privilege('service_role', procedure_oid, 'EXECUTE'), false)
  $$,
  'every worker and service RPC is denied to client roles and executable by service role'
);

select is_empty(
  $$
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace namespace on namespace.oid = p.pronamespace
    where namespace.nspname = 'public'
      and not exists (
        select 1
        from pg_depend dependency
        where dependency.classid = 'pg_proc'::regclass
          and dependency.objid = p.oid
          and dependency.deptype = 'e'
      )
      and has_function_privilege('anon', p.oid, 'EXECUTE')
  $$,
  'anonymous role cannot execute any application-owned public-schema function'
);

select ok(
  (
    with expected(signature) as (
      values
        ('public.accept_curated_match(text,text[],text)'),
        ('public.find_blind_date_partner_atomic(text)'),
        ('public.flove_business_date()'),
        ('public.get_blind_date_session(text)'),
        ('public.get_blind_date_session_for_conversation(text)'),
        ('public.get_conversation_wingman_context(text,uuid,integer)'),
        ('public.get_preference_coach_context(uuid,integer)'),
        ('public.list_conversation_messages(text,integer)'),
        ('public.mark_conversation_read(text)'),
        ('public.match_pair_live_eligible(uuid,uuid)'),
        ('public.request_reveal_atomic(text,uuid)'),
        ('public.save_onboarding_draft(jsonb,bigint,integer,uuid)'),
        ('public.send_message_atomic(text,text,text,uuid)'),
        ('public.submit_match_feedback_atomic(text,public.feedback_decision,text,text[],text)'),
        ('public.unlock_daily_match_batch(text,text,uuid)')
    ), expected_oids as (
      select array_agg(to_regprocedure(signature)::oid order by to_regprocedure(signature)::oid) as oids
      from expected
    ), actual_oids as (
      select array_agg(p.oid order by p.oid) as oids
      from pg_proc p
      join pg_namespace namespace on namespace.oid = p.pronamespace
      where namespace.nspname = 'public'
        and not exists (
          select 1
          from pg_depend dependency
          where dependency.classid = 'pg_proc'::regclass
            and dependency.objid = p.oid
            and dependency.deptype = 'e'
        )
        and has_function_privilege('authenticated', p.oid, 'EXECUTE')
    )
    select expected_oids.oids = actual_oids.oids
    from expected_oids, actual_oids
  ),
  'authenticated function ACL matches the explicit user RPC and RLS-helper allowlist'
);
select unlike(
  pg_get_function_result('public.find_blind_date_partner_atomic(text)'::regprocedure),
  '%partner_id%',
  'public Blind Date claim has no partner UUID field'
);
select unlike(
  pg_get_function_result('public.request_reveal_atomic(text,uuid)'::regprocedure),
  '%reveal_requests%',
  'public reveal response hides UUID-keyed request state'
);
select unlike(
  pg_get_function_result('public.list_conversation_messages(text,integer)'::regprocedure),
  '%sender_id%',
  'public message response exposes only relative ownership'
);
select has_trigger(
  'public', 'conversations', 'conversations_protect_anonymous_identity',
  'anonymous conversations scrub identity-bearing fields'
);
select has_trigger(
  'public', 'blind_date_queue', 'blind_date_queue_enforce_single_session',
  'Blind Date queue prevents participants from rejoining after a session exists'
);
select has_function(
  'public', 'save_preference_chat_turn_atomic', array['text', 'text[]', 'text', 'text'],
  'legacy atomic preference chat symbol remains for migration compatibility'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.save_preference_chat_turn_atomic(text,text[],text,text)',
    'EXECUTE'
  ),
  'legacy caller-authored preference assistant writes are denied to clients'
);
select has_function(
  'public', 'send_message_atomic', array['text', 'text', 'text', 'uuid'],
  'idempotent message send exists'
);
select ok(
  (
    select pronargdefaults = 1
    from pg_proc
    where oid = 'public.request_reveal_atomic(text,uuid)'::regprocedure
  )
  and (
    select pronargdefaults = 1
    from pg_proc
    where oid = 'public.send_message_atomic(text,text,text,uuid)'::regprocedure
  ),
  'reveal and message expected-user arguments remain optional compatibility fences'
);
select has_function(
  'public', 'claim_ai_rate_limit', array['uuid', 'text', 'integer', 'integer'],
  'paid-AI limiter exists'
);
select has_function(
  'public', 'enqueue_ai_job', array['jsonb', 'text', 'integer'],
  'durable AI enqueue wrapper exists'
);
select has_function(
  'public', 'read_ai_jobs', array['integer', 'integer'],
  'durable AI read wrapper exists'
);
select has_function('public', 'delete_ai_job', array['bigint'], 'durable AI delete wrapper exists');
select has_function('public', 'archive_ai_job', array['bigint'], 'durable AI archive wrapper exists');
select has_function(
  'public', 'complete_profile_embedding_job', array['uuid', 'bigint', 'jsonb', 'text'],
  'revision-safe embedding completion exists'
);
select has_function(
  'public', 'complete_daily_match_enrichment', array['text', 'integer', 'jsonb', 'text'],
  'attempt-fenced prose-only match enrichment completion exists'
);

select isnt_empty(
  $$
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'onboarding_drafts'
      and policyname = 'onboarding drafts own select'
  $$,
  'onboarding drafts are owner-readable'
);

select is_empty(
  $$
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'onboarding_drafts'
      and cmd in ('INSERT', 'UPDATE')
  $$,
  'onboarding drafts cannot bypass revision RPCs with direct writes'
);

select ok(
  not has_table_privilege('authenticated', 'public.preference_profiles', 'INSERT')
  and not has_table_privilege('authenticated', 'public.preference_profiles', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.preference_profiles', 'DELETE'),
  'preference profile mutations are RPC-only'
);

select is_empty(
  $$
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'preference_profiles'
      and cmd in ('INSERT', 'UPDATE')
  $$,
  'preference profiles have no direct-write policies'
);

select * from finish();

rollback;
