-- Local development seed. Runs after the migrations on `supabase db reset`.
-- Local test values only, never loaded into production.
--
-- The CoFID subset and the Open Food Facts samples live in seeds/*.sql, which
-- load after this file. M5 adds its own file there (six weeks of diary and
-- weigh-ins), so this file stays as it is.

-- One demo user who can sign in with email and password. The password is the
-- plain text literal passed to crypt() below.
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  email_change,
  email_change_token_new
) values (
  '00000000-0000-0000-0000-000000000000',
  '11111111-1111-4111-8111-111111111111',
  'authenticated',
  'authenticated',
  'demo@keylow.local',
  extensions.crypt('keylow-demo-local', extensions.gen_salt('bf')),
  now(),
  '{"provider": "email", "providers": ["email"]}',
  '{}',
  now(),
  now(),
  '',
  '',
  '',
  ''
);

-- GoTrue needs a matching identity row before it accepts an email login.
insert into auth.identities (
  id,
  user_id,
  provider_id,
  provider,
  identity_data,
  last_sign_in_at,
  created_at,
  updated_at
) values (
  gen_random_uuid(),
  '11111111-1111-4111-8111-111111111111',
  '11111111-1111-4111-8111-111111111111',
  'email',
  '{"sub": "11111111-1111-4111-8111-111111111111", "email": "demo@keylow.local", "email_verified": true}',
  now(),
  now(),
  now()
);

-- The handle_new_user trigger creates the profiles row, so it is not inserted
-- here. Fail the seed loudly if the trigger did not create the demo profile.
do $$
begin
  if not exists (
    select 1 from public.profiles where id = '11111111-1111-4111-8111-111111111111'
  ) then
    raise exception 'seed expected the demo profile row, created by handle_new_user';
  end if;
end;
$$;
