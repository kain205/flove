-- Open signup to all email providers. F-Love is for students generally, not
-- only FPT accounts. The two admission gates keep their original names so the
-- Auth hook registration and every RPC caller stay unchanged; only the FPT
-- email requirement is dropped.

-- Before User Created hook: accept any account with a plausible email.
create or replace function public.before_user_created_require_fpt(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = pg_catalog
as $$
declare
  v_email text := lower(btrim(coalesce(event -> 'user' ->> 'email', '')));
begin
  if v_email = '' or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 400,
        'message', 'A valid email address is required'
      )
    );
  end if;
  return '{}'::jsonb;
end;
$$;

-- Defense-in-depth admission helper: still requires an authenticated session
-- backed by a real auth.users row, but no longer restricts the email domain.
create or replace function private.assert_fpt_self_admission()
returns uuid
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
begin
  if auth.role() is null or auth.role() = 'service_role' then
    return v_uid;
  end if;
  if auth.role() <> 'authenticated' or v_uid is null then
    raise exception using errcode = '28000', message = 'Not authenticated';
  end if;

  select lower(btrim(coalesce(account.email, '')))
  into v_email
  from auth.users account
  where account.id = v_uid;

  if v_email is null or v_email = '' then
    raise exception using errcode = '42501', message = 'Account email is missing';
  end if;
  return v_uid;
end;
$$;
