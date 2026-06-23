begin;

select plan(7);

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

select isnt_empty(
  $$
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'messages'
      and policyname = 'messages participant insert'
  $$,
  'messages insert is participant-gated'
);

select * from finish();

rollback;
