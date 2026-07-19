-- Native relationship learning and participant-safe conversation summaries.
-- The first course is an original F-Love micro-course. External education
-- providers are cited as further reading; their copyrighted material is not
-- copied into the product.

create table public.learning_courses (
  id text primary key,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 1 and 160),
  subtitle text not null default '' check (char_length(subtitle) <= 240),
  description text not null default '' check (char_length(description) <= 2000),
  duration_minutes integer not null check (duration_minutes between 1 and 1440),
  lesson_count integer not null check (lesson_count between 1 and 100),
  is_free boolean not null default true,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  content_version integer not null default 1 check (content_version > 0),
  source_links jsonb not null default '[]'::jsonb check (jsonb_typeof(source_links) = 'array'),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'published' and published_at is not null) or status <> 'published')
);

create trigger learning_courses_set_updated_at
before update on public.learning_courses
for each row execute function public.set_updated_at();

create table public.learning_lessons (
  id text primary key,
  course_id text not null references public.learning_courses(id) on delete cascade,
  position integer not null check (position between 1 and 100),
  eyebrow text not null default '' check (char_length(eyebrow) <= 80),
  title text not null check (char_length(title) between 1 and 180),
  summary text not null default '' check (char_length(summary) <= 500),
  duration_minutes integer not null check (duration_minutes between 1 and 180),
  content_blocks jsonb not null check (jsonb_typeof(content_blocks) = 'array'),
  quiz jsonb not null check (
    jsonb_typeof(quiz) = 'object'
    and jsonb_typeof(quiz -> 'options') = 'array'
    and jsonb_array_length(quiz -> 'options') between 2 and 8
    and jsonb_typeof(quiz -> 'correctIndex') = 'number'
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, position)
);

create trigger learning_lessons_set_updated_at
before update on public.learning_lessons
for each row execute function public.set_updated_at();

create table public.course_enrollments (
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id text not null references public.learning_courses(id) on delete cascade,
  status text not null default 'enrolled' check (status in ('enrolled', 'in_progress', 'completed')),
  progress_percent integer not null default 0 check (progress_percent between 0 and 100),
  current_lesson integer not null default 1 check (current_lesson between 1 and 100),
  client_request_id text not null check (char_length(client_request_id) between 1 and 240),
  enrolled_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, course_id),
  unique (user_id, client_request_id),
  check ((status = 'completed' and completed_at is not null and progress_percent = 100)
    or status <> 'completed')
);

create trigger course_enrollments_set_updated_at
before update on public.course_enrollments
for each row execute function public.set_updated_at();

create table public.course_lesson_progress (
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id text not null references public.learning_courses(id) on delete cascade,
  lesson_id text not null references public.learning_lessons(id) on delete cascade,
  selected_answer integer not null check (selected_answer between 0 and 20),
  is_correct boolean not null,
  reflection text not null default '' check (char_length(reflection) <= 1000),
  completed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, course_id, lesson_id),
  foreign key (user_id, course_id)
    references public.course_enrollments(user_id, course_id) on delete cascade
);

create trigger course_lesson_progress_set_updated_at
before update on public.course_lesson_progress
for each row execute function public.set_updated_at();

alter table public.learning_courses enable row level security;
alter table public.learning_lessons enable row level security;
alter table public.course_enrollments enable row level security;
alter table public.course_lesson_progress enable row level security;

revoke all on table public.learning_courses, public.learning_lessons,
  public.course_enrollments, public.course_lesson_progress
  from anon, authenticated, public;
grant select, insert, update, delete on table public.learning_courses, public.learning_lessons,
  public.course_enrollments, public.course_lesson_progress to service_role;

insert into public.learning_courses (
  id, slug, title, subtitle, description, duration_minutes, lesson_count,
  is_free, status, content_version, source_links, published_at
) values (
  'healthy-love-101-v1',
  'yeu-lanh-manh-101',
  'Yêu lành mạnh 101',
  'Hiểu mình, tôn trọng nhau và trò chuyện an toàn hơn.',
  'Bốn bài học ngắn dành cho người trẻ đang làm quen, hẹn hò hoặc muốn xây dựng một mối quan hệ tử tế.',
  24,
  4,
  true,
  'published',
  1,
  $json$[
    {"label":"Healthy Relationship Skills for Young Adults","url":"https://extension.catalog.instructure.com/courses/healthy-relationship-skills"},
    {"label":"One Love Education Center","url":"https://www.joinonelove.org/our-education/"},
    {"label":"OpenLearn: What LGBTQ+ Relationships Can Teach Us About Love","url":"https://www.open.edu/openlearn/course/view.php?id=14841"}
  ]$json$::jsonb,
  now()
) on conflict (id) do update set
  slug = excluded.slug,
  title = excluded.title,
  subtitle = excluded.subtitle,
  description = excluded.description,
  duration_minutes = excluded.duration_minutes,
  lesson_count = excluded.lesson_count,
  is_free = excluded.is_free,
  status = excluded.status,
  content_version = excluded.content_version,
  source_links = excluded.source_links,
  published_at = excluded.published_at;

insert into public.learning_lessons (
  id, course_id, position, eyebrow, title, summary, duration_minutes, content_blocks, quiz
) values
(
  'healthy-love-101-signals', 'healthy-love-101-v1', 1, 'BÀI 1 · NHẬN DIỆN',
  'Một mối quan hệ tốt trông như thế nào?',
  'Phân biệt sự quan tâm với kiểm soát và nhận ra những tín hiệu đáng tin cậy.',
  6,
  $json$[
    {"kind":"lead","title":"Bình yên không có nghĩa là nhàm chán","body":"Một kết nối lành mạnh cho bạn không gian được là chính mình. Bạn có thể nói không, đổi ý và dành thời gian cho bạn bè mà không phải lo sợ bị trừng phạt hay làm cho cảm thấy có lỗi."},
    {"kind":"principles","title":"Ba tín hiệu xanh","items":["Tôn trọng: lắng nghe ranh giới và không dùng áp lực để có được điều mình muốn.","Tin cậy: lời nói và hành động nhất quán, không yêu cầu kiểm tra điện thoại hay vị trí.","Cùng phát triển: hai người khuyến khích sở thích, bạn bè và mục tiêu riêng của nhau."]},
    {"kind":"scenario","title":"Thử đổi góc nhìn","body":"Người ấy nhắn liên tục khi bạn đang học và giận nếu bạn trả lời chậm. Sự quan tâm là hỏi xem bạn có rảnh không; kiểm soát là biến tốc độ trả lời thành bằng chứng về tình cảm."},
    {"kind":"safety","title":"Nếu bạn thấy không an toàn","body":"Ưu tiên rời khỏi tình huống, liên hệ người bạn tin tưởng và tìm hỗ trợ tại địa phương. F-Love không thay thế tư vấn tâm lý, y tế hoặc hỗ trợ khẩn cấp."}
  ]$json$::jsonb,
  $json${"question":"Hành vi nào thể hiện sự tôn trọng?","options":["Yêu cầu mật khẩu để chứng minh lòng tin","Chấp nhận khi người kia cần thời gian riêng","Giận dữ khi tin nhắn chưa được trả lời ngay"],"correctIndex":1,"explanation":"Tôn trọng bao gồm việc chấp nhận ranh giới và thời gian riêng của nhau."}$json$::jsonb
),
(
  'healthy-love-101-boundaries', 'healthy-love-101-v1', 2, 'BÀI 2 · RANH GIỚI',
  'Nói “không” mà không thấy có lỗi',
  'Biến ranh giới thành một cuộc trò chuyện rõ ràng, cụ thể và có thể điều chỉnh.',
  6,
  $json$[
    {"kind":"lead","title":"Ranh giới là hướng dẫn, không phải hình phạt","body":"Ranh giới cho người kia biết điều gì giúp bạn cảm thấy thoải mái và an toàn. Nó nói về điều bạn sẽ làm để chăm sóc mình, không phải cách ép người khác hành động."},
    {"kind":"framework","title":"Mẫu câu ba bước","items":["Khi…: mô tả tình huống, không phán xét.","Mình cảm thấy/cần…: nói về trải nghiệm của bạn.","Mình muốn…: đưa ra đề nghị cụ thể và chấp nhận rằng người kia có quyền lựa chọn."]},
    {"kind":"scenario","title":"Ví dụ","body":"“Khi kế hoạch thay đổi sát giờ, mình thấy bị động. Lần sau bạn báo mình sớm hơn được không?” rõ ràng hơn “Bạn chẳng bao giờ tôn trọng mình”."},
    {"kind":"note","title":"Đồng thuận luôn có thể được rút lại","body":"Một lần đồng ý không phải là đồng ý mãi mãi. Im lặng, do dự, say xỉn hoặc bị gây áp lực không phải là sự đồng thuận rõ ràng."}
  ]$json$::jsonb,
  $json${"question":"Câu nào đặt ranh giới rõ ràng nhất?","options":["Bạn phải trả lời mình ngay","Nếu bạn yêu mình thì bạn sẽ hiểu","Mình chưa sẵn sàng chia sẻ chuyện đó; khi nào thoải mái mình sẽ chủ động nói"],"correctIndex":2,"explanation":"Câu này nói rõ giới hạn hiện tại và giữ quyền chủ động mà không kiểm soát người kia."}$json$::jsonb
),
(
  'healthy-love-101-communication', 'healthy-love-101-v1', 3, 'BÀI 3 · GIAO TIẾP',
  'Nghe điều chưa được nói thành lời',
  'Lắng nghe để hiểu nhu cầu thay vì chỉ chuẩn bị phản biện.',
  6,
  $json$[
    {"kind":"lead","title":"Đừng đoán ý nhau","body":"Ngay cả người rất hợp nhau cũng không đọc được suy nghĩ. Giao tiếp tốt bắt đầu khi ta kiểm tra lại điều mình hiểu thay vì coi suy đoán là sự thật."},
    {"kind":"framework","title":"Nghe – nhắc lại – hỏi","items":["Nghe hết câu trước khi giải thích hoặc sửa.","Nhắc lại ngắn gọn: “Mình nghe là bạn đang…”.","Hỏi: “Điều bạn cần lúc này là được lắng nghe hay cùng tìm giải pháp?”"]},
    {"kind":"scenario","title":"Khi cuộc nói chuyện nóng lên","body":"Tạm dừng có hẹn giờ tốt hơn bỏ đi. Hãy nói: “Mình cần 20 phút để bình tĩnh, 9 giờ mình quay lại nói tiếp nhé”."},
    {"kind":"practice","title":"Bài tập 60 giây","body":"Chọn một điều nhỏ bạn muốn người kia hiểu. Viết lại bằng một sự kiện quan sát được, một cảm xúc và một đề nghị cụ thể."}
  ]$json$::jsonb,
  $json${"question":"Khi người kia đang buồn, câu hỏi nào hữu ích nhất?","options":["Ai đúng ai sai?","Bạn muốn mình lắng nghe hay cùng tìm cách giải quyết?","Sao chuyện nhỏ vậy cũng buồn?"],"correctIndex":1,"explanation":"Câu hỏi này tôn trọng nhu cầu hiện tại thay vì vội phán xét hoặc sửa chữa."}$json$::jsonb
),
(
  'healthy-love-101-online-safety', 'healthy-love-101-v1', 4, 'BÀI 4 · AN TOÀN ONLINE',
  'Từ cuộc trò chuyện đầu tiên tới buổi hẹn đầu',
  'Giữ nhịp làm quen tự nhiên mà không đánh đổi quyền riêng tư và sự an toàn.',
  6,
  $json$[
    {"kind":"lead","title":"Thân mật nên tăng cùng độ tin cậy","body":"Bạn không cần chia sẻ số điện thoại, địa chỉ, lịch học hay ảnh riêng tư để chứng minh thiện chí. Một người tôn trọng bạn sẽ chấp nhận nhịp độ bạn chọn."},
    {"kind":"checklist","title":"Trước buổi hẹn đầu","items":["Chọn nơi công cộng và tự chủ phương tiện đi về.","Cho một người tin cậy biết địa điểm và thời gian dự kiến.","Giữ đồ uống trong tầm mắt và rời đi nếu thấy không ổn.","Không chuyển tiền hoặc cung cấp mã xác minh cho người mới quen."]},
    {"kind":"scenario","title":"Một lời từ chối đủ rõ","body":"“Mình chưa muốn chuyển sang nền tảng khác. Mình nói chuyện ở đây thêm nhé.” Bạn không nợ ai một lời giải thích dài hơn."},
    {"kind":"finish","title":"Mang điều này vào cuộc trò chuyện","body":"Sự tự tin không phải luôn biết nói gì. Đó là biết mình cần gì, tôn trọng tín hiệu của người kia và sẵn sàng dừng lại khi kết nối không còn an toàn."}
  ]$json$::jsonb,
  $json${"question":"Lựa chọn nào an toàn nhất cho buổi hẹn đầu?","options":["Để người mới quen đón tại nhà","Gặp ở nơi công cộng và báo lịch cho người tin cậy","Giữ bí mật để buổi hẹn bất ngờ hơn"],"correctIndex":1,"explanation":"Nơi công cộng, phương án di chuyển chủ động và một người biết lịch trình giúp giảm rủi ro."}$json$::jsonb
)
on conflict (id) do update set
  course_id = excluded.course_id,
  position = excluded.position,
  eyebrow = excluded.eyebrow,
  title = excluded.title,
  summary = excluded.summary,
  duration_minutes = excluded.duration_minutes,
  content_blocks = excluded.content_blocks,
  quiz = excluded.quiz;

create or replace function public.list_learning_courses()
returns table (
  course_id text,
  slug text,
  title text,
  subtitle text,
  description text,
  duration_minutes integer,
  lesson_count integer,
  is_free boolean,
  enrollment_status text,
  progress_percent integer,
  current_lesson integer,
  enrolled_at timestamptz,
  completed_at timestamptz
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
  return query
  select course.id, course.slug, course.title, course.subtitle, course.description,
    course.duration_minutes, course.lesson_count, course.is_free,
    enrollment.status, coalesce(enrollment.progress_percent, 0),
    coalesce(enrollment.current_lesson, 1), enrollment.enrolled_at, enrollment.completed_at
  from public.learning_courses course
  left join public.course_enrollments enrollment
    on enrollment.course_id = course.id and enrollment.user_id = v_uid
  where course.status = 'published'
  order by course.published_at desc, course.id;
end;
$$;

revoke all on function public.list_learning_courses() from anon, authenticated, public;
grant execute on function public.list_learning_courses() to authenticated;

create or replace function public.get_learning_course(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  v_uid uuid := auth.uid();
  v_result jsonb;
begin
  perform private.assert_fpt_self_admission();
  select jsonb_build_object(
    'id', course.id,
    'slug', course.slug,
    'title', course.title,
    'subtitle', course.subtitle,
    'description', course.description,
    'durationMinutes', course.duration_minutes,
    'lessonCount', course.lesson_count,
    'isFree', course.is_free,
    'contentVersion', course.content_version,
    'sourceLinks', course.source_links,
    'enrollment', case when enrollment.user_id is null then null else jsonb_build_object(
      'status', enrollment.status,
      'progressPercent', enrollment.progress_percent,
      'currentLesson', enrollment.current_lesson,
      'enrolledAt', enrollment.enrolled_at,
      'completedAt', enrollment.completed_at
    ) end,
    'lessons', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', lesson.id,
        'position', lesson.position,
        'eyebrow', lesson.eyebrow,
        'title', lesson.title,
        'summary', lesson.summary,
        'durationMinutes', lesson.duration_minutes,
        'contentBlocks', lesson.content_blocks,
        'quiz', lesson.quiz - 'correctIndex',
        'progress', case when progress.lesson_id is null then null else jsonb_build_object(
          'selectedAnswer', progress.selected_answer,
          'isCorrect', progress.is_correct,
          'reflection', progress.reflection,
          'completedAt', progress.completed_at
        ) end
      ) order by lesson.position)
      from public.learning_lessons lesson
      left join public.course_lesson_progress progress
        on progress.lesson_id = lesson.id
        and progress.course_id = lesson.course_id
        and progress.user_id = v_uid
      where lesson.course_id = course.id
    ), '[]'::jsonb)
  ) into v_result
  from public.learning_courses course
  left join public.course_enrollments enrollment
    on enrollment.course_id = course.id and enrollment.user_id = v_uid
  where course.slug = btrim(coalesce(p_slug, '')) and course.status = 'published';

  if v_result is null then
    raise exception using errcode = 'P0002', message = 'Learning course not found';
  end if;
  return v_result;
end;
$$;

revoke all on function public.get_learning_course(text) from anon, authenticated, public;
grant execute on function public.get_learning_course(text) to authenticated;

create or replace function public.enroll_free_learning_course(
  p_course_id text,
  p_client_request_id text
)
returns table (
  course_id text,
  enrollment_status text,
  progress_percent integer,
  current_lesson integer,
  enrolled_at timestamptz,
  applied boolean
)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_uid uuid := auth.uid();
  v_key text := nullif(left(btrim(coalesce(p_client_request_id, '')), 240), '');
  v_course public.learning_courses%rowtype;
  v_enrollment public.course_enrollments%rowtype;
begin
  perform private.assert_fpt_self_admission();
  if v_key is null then
    raise exception using errcode = '22023', message = 'Enrollment request ID is required';
  end if;
  select course.* into v_course
  from public.learning_courses course
  where course.id = p_course_id and course.status = 'published'
  for share;
  if not found then
    raise exception using errcode = 'P0002', message = 'Learning course not found';
  end if;
  if not v_course.is_free then
    raise exception using errcode = '42501', message = 'This course is not available for free enrollment';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'course_enrollment:' || v_uid::text || ':' || v_course.id, 0
  ));

  select enrollment.* into v_enrollment
  from public.course_enrollments enrollment
  where enrollment.user_id = v_uid and enrollment.client_request_id = v_key;
  if found and v_enrollment.course_id <> v_course.id then
    raise exception using errcode = '22023', message = 'Enrollment request ID was reused';
  end if;

  select enrollment.* into v_enrollment
  from public.course_enrollments enrollment
  where enrollment.user_id = v_uid and enrollment.course_id = v_course.id;
  if found then
    return query select v_enrollment.course_id, v_enrollment.status,
      v_enrollment.progress_percent, v_enrollment.current_lesson,
      v_enrollment.enrolled_at, false;
    return;
  end if;

  insert into public.course_enrollments(user_id, course_id, client_request_id)
  values (v_uid, v_course.id, v_key)
  returning * into v_enrollment;

  return query select v_enrollment.course_id, v_enrollment.status,
    v_enrollment.progress_percent, v_enrollment.current_lesson,
    v_enrollment.enrolled_at, true;
end;
$$;

revoke all on function public.enroll_free_learning_course(text, text)
  from anon, authenticated, public;
grant execute on function public.enroll_free_learning_course(text, text) to authenticated;

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
  on conflict (user_id, course_id, lesson_id) do update set
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

-- One participant-safe DTO powers the full inbox, chat header, and chat widget.
-- It never returns the counterpart UUID. Anonymous sessions keep using their
-- participant-specific masked name until the existing reveal transaction flips
-- the conversation to non-anonymous.
create or replace function public.list_conversation_summaries(
  p_conversation_id text default null,
  p_limit integer default 50
)
returns table (
  conversation_id text,
  partner_name text,
  partner_avatar_url text,
  is_anonymous boolean,
  last_message_content text,
  last_message_created_at timestamptz,
  last_message_is_mine boolean,
  unread_count integer,
  updated_at timestamptz
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
  return query
  select
    conversation.id,
    case when conversation.is_anonymous then coalesce(
      blind.partner_masked_names ->> v_uid::text,
      mine.masked_name,
      'Người ẩn danh'
    ) else coalesce(partner.name, 'Thành viên F-Love') end,
    case when conversation.is_anonymous then '' else coalesce(partner.avatar_url, '') end,
    conversation.is_anonymous,
    left(coalesce(latest.content, ''), 400),
    latest.created_at,
    coalesce(latest.sender_id = v_uid, false),
    mine.unread_count,
    greatest(conversation.updated_at, coalesce(latest.created_at, conversation.updated_at))
  from public.conversation_participants mine
  join public.conversations conversation on conversation.id = mine.conversation_id
  left join lateral (
    select profile.name, profile.avatar_url
    from public.conversation_participants counterpart
    join public.profiles profile on profile.id = counterpart.user_id
    where counterpart.conversation_id = conversation.id and counterpart.user_id <> v_uid
    order by counterpart.created_at, counterpart.user_id
    limit 1
  ) partner on true
  left join lateral (
    select session.partner_masked_names
    from public.blind_date_sessions session
    where session.conversation_id = conversation.id
    order by session.created_at desc
    limit 1
  ) blind on true
  left join lateral (
    select message.content, message.created_at, message.sender_id
    from public.messages message
    where message.conversation_id = conversation.id
    order by message.created_at desc, message.id desc
    limit 1
  ) latest on true
  where mine.user_id = v_uid
    and (p_conversation_id is null or conversation.id = p_conversation_id)
  order by greatest(conversation.updated_at, coalesce(latest.created_at, conversation.updated_at)) desc,
    conversation.id
  limit greatest(1, least(coalesce(p_limit, 50), 100));
end;
$$;

revoke all on function public.list_conversation_summaries(text, integer)
  from anon, authenticated, public;
grant execute on function public.list_conversation_summaries(text, integer)
  to authenticated;
