insert into auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, role, aud)
values
  ('00000000-0000-0000-0000-000000000001', 'an@fpt.edu.vn', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"name":"An"}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000002', 'binh@fpt.edu.vn', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"name":"Binh"}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000003', 'chi@fpt.edu.vn', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"name":"Chi"}', 'authenticated', 'authenticated')
on conflict (id) do nothing;

insert into public.profiles (
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
  profile_completeness
)
values
  ('00000000-0000-0000-0000-000000000001', 'an@fpt.edu.vn', 'An', 21, 'SE', 'HCM', 'Thich cafe cuoi tuan va side project co ich.', '{"Coding","Coffee","Music"}', '{"Chill","Curious"}', '{"Coffee dates","Slow connection"}', '{"Deep talks","Easy-going"}', '{"bio":"Thich cafe cuoi tuan va side project co ich.","weekendStyle":"Cafe va code.","conversationStyle":"Cham rai va that."}', 100),
  ('00000000-0000-0000-0000-000000000002', 'binh@fpt.edu.vn', 'Binh', 22, 'AI', 'HCM', 'Quan tam AI, bong ro va nhung buoi noi chuyen vui.', '{"AI/ML","Basketball","Coffee"}', '{"Funny","Ambitious"}', '{"Coffee dates","New friends first"}', '{"Active plans","Career-minded"}', '{"bio":"Quan tam AI, bong ro va nhung buoi noi chuyen vui."}', 100),
  ('00000000-0000-0000-0000-000000000003', 'chi@fpt.edu.vn', 'Chi', 20, 'Design', 'HCM', 'Thich art, music va cac buoi di dao nhe.', '{"Art","Music","Photography"}', '{"Creative","Calm"}', '{"Slow connection","Weekend hangouts"}', '{"Creative energy","Quiet dates"}', '{"bio":"Thich art, music va cac buoi di dao nhe."}', 100)
on conflict (id) do nothing;

insert into public.preference_profiles (user_id, summary, soft_preferences)
values
  ('00000000-0000-0000-0000-000000000001', 'Likes gentle conversations and coffee dates.', '{"Coffee","Deep talks"}'),
  ('00000000-0000-0000-0000-000000000002', 'Likes energetic and career-minded people.', '{"AI/ML","Career-minded"}')
on conflict (user_id) do nothing;
