insert into auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, role, aud)
values
  ('00000000-0000-0000-0000-000000000001', 'an@fpt.edu.vn', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"name":"An"}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000002', 'binh@fpt.edu.vn', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"name":"Binh"}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000003', 'chi@fpt.edu.vn', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"name":"Chi"}', 'authenticated', 'authenticated')
on conflict (id) do nothing;

insert into public.profiles as current_profile (
  id,
  email,
  name,
  age,
  major,
  campus,
  bio,
  interests,
  personality_tags,
  dating_goals,
  preferred_vibes,
  profile_text,
  profile_completeness,
  gender,
  looking_for_gender,
  age_pref_min,
  age_pref_max,
  profile_confirmed,
  profile_confirmed_at,
  onboarding_answers,
  onboarding_version
)
values
  ('00000000-0000-0000-0000-000000000001', 'an@fpt.edu.vn', 'An', 21, 'SE', 'HCM', 'Thich cafe cuoi tuan va side project co ich.', '{"Coding","Coffee","Music"}', '{"Chill","Curious"}', '{"Coffee dates","Slow connection"}', '{"Deep talks","Easy-going"}', '{"bio":"Thich cafe cuoi tuan va side project co ich.","weekendStyle":"Cafe va code.","conversationStyle":"Cham rai va that."}', 100, 'male', '{"female"}', 18, 25, true, now(), '[]', 2),
  ('00000000-0000-0000-0000-000000000002', 'binh@fpt.edu.vn', 'Binh', 22, 'AI', 'HCM', 'Quan tam AI, bong ro va nhung buoi noi chuyen vui.', '{"AI/ML","Basketball","Coffee"}', '{"Funny","Ambitious"}', '{"Coffee dates","New friends first"}', '{"Active plans","Career-minded"}', '{"bio":"Quan tam AI, bong ro va nhung buoi noi chuyen vui."}', 100, 'male', '{"female"}', 18, 25, true, now(), '[]', 2),
  ('00000000-0000-0000-0000-000000000003', 'chi@fpt.edu.vn', 'Chi', 20, 'Design', 'HCM', 'Thich art, music va cac buoi di dao nhe.', '{"Art","Music","Photography"}', '{"Creative","Calm"}', '{"Slow connection","Weekend hangouts"}', '{"Creative energy","Quiet dates"}', '{"bio":"Thich art, music va cac buoi di dao nhe."}', 100, 'female', '{"male"}', 18, 25, true, now(), '[]', 2)
on conflict (id) do update set
  profile_completeness = excluded.profile_completeness,
  gender = excluded.gender,
  looking_for_gender = excluded.looking_for_gender,
  age_pref_min = excluded.age_pref_min,
  age_pref_max = excluded.age_pref_max,
  profile_confirmed = excluded.profile_confirmed,
  profile_confirmed_at = coalesce(current_profile.profile_confirmed_at, excluded.profile_confirmed_at),
  onboarding_version = excluded.onboarding_version;

insert into public.preference_profiles (user_id, summary, soft_preferences)
values
  ('00000000-0000-0000-0000-000000000001', 'Likes gentle conversations and coffee dates.', '{"Coffee","Deep talks"}'),
  ('00000000-0000-0000-0000-000000000002', 'Likes energetic and career-minded people.', '{"AI/ML","Career-minded"}')
on conflict (user_id) do nothing;

-- Realistic local-only chat fixtures. These rows use the same Auth, profile,
-- match, participant and message contracts as production; the UI never falls
-- back to hard-coded people or conversations.
insert into auth.users (
  id, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, role, aud
)
values
  ('00000000-0000-0000-0000-000000000004', 'dung.nguyen@example.com', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"name":"Dung"}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000005', 'mai.tran@example.com', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"name":"Mai"}', 'authenticated', 'authenticated')
on conflict (id) do update set email_confirmed_at = coalesce(auth.users.email_confirmed_at, excluded.email_confirmed_at);

insert into public.profiles as current_profile (
  id, email, name, age, major, campus, avatar_url, bio,
  interests, personality_tags, dating_goals, preferred_vibes, profile_text,
  profile_completeness, gender, looking_for_gender, age_pref_min, age_pref_max,
  profile_confirmed, profile_confirmed_at, onboarding_answers, onboarding_version
)
values
  (
    '00000000-0000-0000-0000-000000000004', 'dung.nguyen@example.com', 'Dũng', 23, 'Biz', 'Hanoi', '',
    'Hay tìm quán ăn mới, chạy bộ buổi tối và nghe podcast trên đường đi làm.',
    '{"Running","Food","Podcasts"}', '{"Thoughtful","Playful"}',
    '{"Slow connection","Long-term relationship"}', '{"Honest talks","Weekend adventures"}',
    '{"bio":"Hay tìm quán ăn mới, chạy bộ buổi tối và nghe podcast trên đường đi làm.","weekendStyle":"Chạy bộ rồi tìm quán mới.","conversationStyle":"Hài hước nhưng lắng nghe kỹ."}',
    100, 'male', '{"female"}', 20, 27, true, now(), '[]', 2
  ),
  (
    '00000000-0000-0000-0000-000000000005', 'mai.tran@example.com', 'Mai', 21, 'Marketing', 'HCM', '',
    'Thích nhiếp ảnh film, những tiệm bánh nhỏ và các cuộc trò chuyện không vội.',
    '{"Photography","Baking","Indie music"}', '{"Warm","Curious"}',
    '{"Coffee dates","Long-term relationship"}', '{"Gentle humor","Creative energy"}',
    '{"bio":"Thích nhiếp ảnh film, những tiệm bánh nhỏ và các cuộc trò chuyện không vội.","weekendStyle":"Đi chụp film và thử làm bánh.","conversationStyle":"Nhẹ nhàng, thích hỏi những câu có chiều sâu."}',
    100, 'female', '{"male"}', 19, 27, true, now(), '[]', 2
  )
on conflict (id) do update set
  email = excluded.email,
  name = excluded.name,
  age = excluded.age,
  major = excluded.major,
  campus = excluded.campus,
  bio = excluded.bio,
  interests = excluded.interests,
  personality_tags = excluded.personality_tags,
  dating_goals = excluded.dating_goals,
  preferred_vibes = excluded.preferred_vibes,
  profile_text = excluded.profile_text,
  profile_completeness = excluded.profile_completeness,
  gender = excluded.gender,
  looking_for_gender = excluded.looking_for_gender,
  age_pref_min = excluded.age_pref_min,
  age_pref_max = excluded.age_pref_max,
  profile_confirmed = excluded.profile_confirmed,
  profile_confirmed_at = coalesce(current_profile.profile_confirmed_at, excluded.profile_confirmed_at),
  onboarding_version = excluded.onboarding_version;

insert into public.matches(id, pair_key, source, is_revealed, matched_at)
values
  ('demo-match-an-chi', '00000000-0000-0000-0000-000000000001_00000000-0000-0000-0000-000000000003', 'ai-curated', true, now() - interval '3 days'),
  ('demo-match-an-mai', '00000000-0000-0000-0000-000000000001_00000000-0000-0000-0000-000000000005', 'ai-curated', true, now() - interval '1 day')
on conflict (id) do update set is_revealed = true;

insert into public.conversations(id, match_id, pair_key, is_anonymous, updated_at)
values
  ('demo-conversation-an-chi', 'demo-match-an-chi', '00000000-0000-0000-0000-000000000001_00000000-0000-0000-0000-000000000003', false, now() - interval '40 minutes'),
  ('demo-conversation-an-mai', 'demo-match-an-mai', '00000000-0000-0000-0000-000000000001_00000000-0000-0000-0000-000000000005', false, now() - interval '8 minutes')
on conflict (id) do update set
  match_id = excluded.match_id,
  pair_key = excluded.pair_key,
  is_anonymous = false,
  updated_at = excluded.updated_at;

insert into public.conversation_participants(conversation_id, user_id, unread_count)
values
  ('demo-conversation-an-chi', '00000000-0000-0000-0000-000000000001', 0),
  ('demo-conversation-an-chi', '00000000-0000-0000-0000-000000000003', 1),
  ('demo-conversation-an-mai', '00000000-0000-0000-0000-000000000001', 2),
  ('demo-conversation-an-mai', '00000000-0000-0000-0000-000000000005', 0)
on conflict (conversation_id, user_id) do update set unread_count = excluded.unread_count;

insert into public.messages(
  id, conversation_id, sender_id, content, created_at, is_read, client_message_id
)
values
  ('10000000-0000-0000-0000-000000000001', 'demo-conversation-an-chi', '00000000-0000-0000-0000-000000000001', 'Chào Chi, tớ thấy cậu cũng thích chụp ảnh. Cậu hay chụp ở đâu nhất?', now() - interval '3 days', true, 'seed-an-chi-1'),
  ('10000000-0000-0000-0000-000000000002', 'demo-conversation-an-chi', '00000000-0000-0000-0000-000000000003', 'Tớ thích đi quanh khu trung tâm lúc chiều muộn. Ánh sáng lúc đó đẹp lắm ✨', now() - interval '3 days' + interval '8 minutes', true, 'seed-an-chi-2'),
  ('10000000-0000-0000-0000-000000000003', 'demo-conversation-an-chi', '00000000-0000-0000-0000-000000000001', 'Nghe hay đấy. Cuối tuần này cậu có đang săn góc chụp nào không?', now() - interval '2 days', true, 'seed-an-chi-3'),
  ('10000000-0000-0000-0000-000000000004', 'demo-conversation-an-chi', '00000000-0000-0000-0000-000000000003', 'Có một triển lãm nhỏ ở Thảo Điền. Nếu cậu thích thì mình cùng ghé nhé?', now() - interval '40 minutes', false, 'seed-an-chi-4'),
  ('20000000-0000-0000-0000-000000000001', 'demo-conversation-an-mai', '00000000-0000-0000-0000-000000000005', 'Hi An, câu trả lời về một cuối tuần lý tưởng của cậu làm tớ thấy rất chill 😄', now() - interval '1 day', true, 'seed-an-mai-1'),
  ('20000000-0000-0000-0000-000000000002', 'demo-conversation-an-mai', '00000000-0000-0000-0000-000000000001', 'Cảm ơn Mai nha. Cafe, nhạc và không phải chạy deadline là đủ hoàn hảo rồi.', now() - interval '23 hours', true, 'seed-an-mai-2'),
  ('20000000-0000-0000-0000-000000000003', 'demo-conversation-an-mai', '00000000-0000-0000-0000-000000000005', 'Vậy gu cafe của cậu là kiểu yên tĩnh hay càng đông càng vui?', now() - interval '12 minutes', false, 'seed-an-mai-3'),
  ('20000000-0000-0000-0000-000000000004', 'demo-conversation-an-mai', '00000000-0000-0000-0000-000000000005', 'Tớ có một quán nhỏ nhiều cây, playlist cũng rất ổn 🌿', now() - interval '8 minutes', false, 'seed-an-mai-4')
on conflict (id) do update set
  content = excluded.content,
  created_at = excluded.created_at,
  is_read = excluded.is_read;

update public.conversations
set last_message = jsonb_build_object(
  'id', '10000000-0000-0000-0000-000000000004',
  'senderId', '00000000-0000-0000-0000-000000000003',
  'content', 'Có một triển lãm nhỏ ở Thảo Điền. Nếu cậu thích thì mình cùng ghé nhé?',
  'createdAt', now() - interval '40 minutes'
)
where id = 'demo-conversation-an-chi';

update public.conversations
set last_message = jsonb_build_object(
  'id', '20000000-0000-0000-0000-000000000004',
  'senderId', '00000000-0000-0000-0000-000000000005',
  'content', 'Tớ có một quán nhỏ nhiều cây, playlist cũng rất ổn 🌿',
  'createdAt', now() - interval '8 minutes'
)
where id = 'demo-conversation-an-mai';
