begin;

select plan(20);

select has_table('public', 'learning_courses', 'learning course catalog exists');
select has_table('public', 'course_enrollments', 'private course enrollment table exists');
select has_table('public', 'course_lesson_progress', 'private lesson progress table exists');
select has_function('public', 'enroll_free_learning_course', array['text', 'text'], 'free enrollment RPC exists');
select has_function('public', 'complete_learning_lesson', array['text', 'text', 'integer', 'text'], 'lesson completion RPC exists');
select has_function('public', 'list_learning_courses', array[]::text[], 'published course catalog RPC exists');
select has_function('public', 'list_conversation_summaries', array['text', 'integer'], 'participant-safe conversation summary RPC exists');

select ok(
  not has_table_privilege('authenticated', 'public.learning_courses', 'SELECT')
    and not has_table_privilege('authenticated', 'public.learning_lessons', 'SELECT')
    and not has_table_privilege('authenticated', 'public.course_enrollments', 'SELECT')
    and not has_table_privilege('authenticated', 'public.course_lesson_progress', 'SELECT'),
  'authenticated clients cannot bypass the learning DTO and mutation RPCs'
);

select is(
  (select title || ':' || duration_minutes::text || ':' || lesson_count::text
   from public.learning_courses where id = 'healthy-love-101-v1'),
  'Yêu lành mạnh 101:24:4',
  'the original free micro-course is published with four short lessons'
);

insert into auth.users (
  id, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, role, aud
) values
  ('93000000-0000-0000-0000-000000000001', 'course-chat-one@example.com', crypt('test-only', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"name":"Lan"}', 'authenticated', 'authenticated'),
  ('93000000-0000-0000-0000-000000000002', 'course-chat-two@example.com', crypt('test-only', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"name":"Minh"}', 'authenticated', 'authenticated'),
  ('93000000-0000-0000-0000-000000000003', 'course-chat-three@example.com', crypt('test-only', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"name":"Ngoài cuộc"}', 'authenticated', 'authenticated');

insert into public.profiles (
  id, email, name, age, major, campus, profile_text, profile_completeness,
  profile_confirmed, profile_confirmed_at, onboarding_answers, onboarding_version
) values
  ('93000000-0000-0000-0000-000000000001', 'course-chat-one@example.com', 'Lan', 21, 'SE', 'HCM', '{"bio":"Lan"}', 100, true, now(), '[]', 2),
  ('93000000-0000-0000-0000-000000000002', 'course-chat-two@example.com', 'Minh', 22, 'AI', 'HCM', '{"bio":"Minh"}', 100, true, now(), '[]', 2),
  ('93000000-0000-0000-0000-000000000003', 'course-chat-three@example.com', 'Ngoài cuộc', 23, 'Biz', 'Hanoi', '{"bio":"Other"}', 100, true, now(), '[]', 2);

insert into public.conversations(id, is_anonymous, updated_at)
values ('course-chat-conversation', false, now());
insert into public.conversation_participants(conversation_id, user_id, unread_count)
values
  ('course-chat-conversation', '93000000-0000-0000-0000-000000000001', 1),
  ('course-chat-conversation', '93000000-0000-0000-0000-000000000002', 0);
insert into public.messages(id, conversation_id, sender_id, content, client_message_id, created_at)
values (
  '93000000-0000-0000-0000-000000000010', 'course-chat-conversation',
  '93000000-0000-0000-0000-000000000002', 'Một tin nhắn thật', 'course-chat-message', now()
);

select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '93000000-0000-0000-0000-000000000001', true);

select is(
  (select count(*)::integer from public.list_learning_courses()),
  1,
  'authenticated users can read the published course catalog through its DTO'
);
select ok(
  not (public.get_learning_course('yeu-lanh-manh-101') -> 'lessons' -> 0 -> 'quiz' ? 'correctIndex'),
  'course detail DTO does not expose quiz answer keys'
);

create temporary table first_enrollment as
select * from public.enroll_free_learning_course('healthy-love-101-v1', 'free-signup-1');
select is((select applied from first_enrollment), true, 'first free signup creates an enrollment');
select is(
  (select applied from public.enroll_free_learning_course('healthy-love-101-v1', 'free-signup-1')),
  false,
  'free signup retry is idempotent'
);
select is(
  (select count(*)::integer from public.course_enrollments
   where user_id = '93000000-0000-0000-0000-000000000001'),
  1,
  'free signup retry leaves exactly one enrollment'
);

create temporary table first_lesson as
select * from public.complete_learning_lesson(
  'healthy-love-101-v1', 'healthy-love-101-signals', 1, 'Một ghi chú riêng tư'
);
select is(
  (select enrollment_status || ':' || progress_percent::text || ':' || is_correct::text from first_lesson),
  'in_progress:25:true',
  'first lesson advances progress and validates the quiz server-side'
);

do $$
begin
  perform * from public.complete_learning_lesson('healthy-love-101-v1', 'healthy-love-101-boundaries', 2, '');
  perform * from public.complete_learning_lesson('healthy-love-101-v1', 'healthy-love-101-communication', 1, '');
  perform * from public.complete_learning_lesson('healthy-love-101-v1', 'healthy-love-101-online-safety', 1, '');
end;
$$;
select is(
  (select status || ':' || progress_percent::text from public.course_enrollments
   where user_id = '93000000-0000-0000-0000-000000000001'
     and course_id = 'healthy-love-101-v1'),
  'completed:100',
  'four completed lessons finish the course'
);

select is(
  (select partner_name || ':' || last_message_content || ':' || unread_count::text
   from public.list_conversation_summaries('course-chat-conversation', 1)),
  'Minh:Một tin nhắn thật:1',
  'conversation summary returns real partner display data and last message'
);
select ok(
  pg_get_function_result('public.list_conversation_summaries(text,integer)'::regprocedure)
    not like '%partner_id%'
    and pg_get_function_result('public.list_conversation_summaries(text,integer)'::regprocedure)
      not like '%user_id%',
  'conversation summary contract has no partner or participant UUID column'
);

select set_config('request.jwt.claim.sub', '93000000-0000-0000-0000-000000000003', true);
select is(
  (select count(*)::integer from public.list_conversation_summaries('course-chat-conversation', 1)),
  0,
  'a non-participant cannot read conversation summary data'
);

select set_config('request.jwt.claim.role', '', true);
select set_config('request.jwt.claim.sub', '', true);

select is(
  (select reflection from public.course_lesson_progress
   where user_id = '93000000-0000-0000-0000-000000000001'
     and lesson_id = 'healthy-love-101-signals'),
  'Một ghi chú riêng tư',
  'lesson reflection is stored privately without entering AI memory'
);

select * from finish();
rollback;
