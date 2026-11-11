-- Asserts the exercise form media contract (KEY-957): the `exercise_form_videos` table with its
-- checks, its global-only rule and its closed privileges, and the `public.exercise_form_media`
-- read function with its visibility rule, its image paths and its grants.
--
-- `supabase test db` runs this file as postgres inside a transaction that is rolled back, so
-- nothing created here persists. Every fixture id starts with 95700000 and every name and email
-- with key957-. Nothing asserts a whole-table count. Each actor is entered with `set local role`
-- plus the JWT claims that `auth.uid()` reads, and left with `reset role`.
--
-- Health data: no fixture here is a real user's exercise, and the refusal messages asserted below
-- state a rule and never a value.

begin;

select plan(30);

insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', '95700000-0000-4000-8000-00000000000a', 'authenticated', 'authenticated', 'key957-user-a@keylow.test'),
  ('00000000-0000-0000-0000-000000000000', '95700000-0000-4000-8000-00000000000b', 'authenticated', 'authenticated', 'key957-user-b@keylow.test');

-- 101 is a global exercise with a curated video, 102 a global one without, 103 a global one that is
-- soft deleted. 1a1 is A's own exercise and 1b1 is B's.
insert into public.exercises (id, owner_id, source, source_ref, name, equipment, mechanic, deleted_at) values
  ('95700000-0000-4000-8000-000000000101', null, 'free_exercise_db', 'KEY957-EX-1', 'key957-global-with-video', 'barbell', 'compound', null),
  ('95700000-0000-4000-8000-000000000102', null, 'free_exercise_db', 'KEY957-EX-2', 'key957-global-without-video', 'barbell', 'compound', null),
  ('95700000-0000-4000-8000-000000000103', null, 'free_exercise_db', 'KEY957-EX-3', 'key957-global-deleted', 'barbell', 'compound', '2026-11-01T00:00:00Z'),
  ('95700000-0000-4000-8000-0000000001a1', '95700000-0000-4000-8000-00000000000a', 'user', null, 'key957-a-raise', 'dumbbell', 'isolation', null),
  ('95700000-0000-4000-8000-0000000001b1', '95700000-0000-4000-8000-00000000000b', 'user', null, 'key957-b-curl', 'ez_bar', 'isolation', null);

insert into public.exercise_import_runs (id, source, label, source_commit, file_sha256) values
  ('95700000-0000-4000-8000-000000000301', 'free_exercise_db', 'key957-run', 'key957-commit', repeat('a', 64));

insert into public.exercise_source_data (exercise_id, import_run_id, raw) values
  ('95700000-0000-4000-8000-000000000101', '95700000-0000-4000-8000-000000000301', '{"images":["KEY957_One/0.jpg","KEY957_One/1.jpg"]}'),
  ('95700000-0000-4000-8000-000000000102', '95700000-0000-4000-8000-000000000301', '{"images":["KEY957_Two/0.jpg","KEY957_Two/1.jpg"]}'),
  ('95700000-0000-4000-8000-000000000103', '95700000-0000-4000-8000-000000000301', '{"images":["KEY957_Three/0.jpg","KEY957_Three/1.jpg"]}');

insert into public.exercise_form_videos (exercise_id, youtube_video_id, title, channel, verified_on) values
  ('95700000-0000-4000-8000-000000000101', 'aB3_-xYz012', 'key957 squat form', 'key957 channel', '2026-11-11');

-- Shape.
select has_table('public', 'exercise_form_videos', 'exercise_form_videos exists');
select has_function('public', 'exercise_form_media', array['uuid'], 'exercise_form_media(uuid) exists');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.exercise_form_videos'::regclass),
  'row level security is enabled on exercise_form_videos'
);
select is(
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'exercise_form_videos'),
  0::bigint,
  'exercise_form_videos has no policy'
);
select ok(
  not exists (
    select 1
    from unnest(array['anon', 'authenticated', 'service_role']) as role_name,
      unnest(array['select', 'insert', 'update', 'delete', 'truncate', 'references', 'trigger']) as privilege
    where has_table_privilege(role_name, 'public.exercise_form_videos', privilege)
  ),
  'anon, authenticated and service_role hold no privilege on exercise_form_videos'
);
select ok(
  (select p.prosecdef and p.provolatile = 's' and p.proconfig = array['search_path=""']
   from pg_proc p where p.oid = 'public.exercise_form_media(uuid)'::regprocedure),
  'exercise_form_media is security definer, stable and has an empty search_path'
);

-- Grants on the function.
select ok(
  has_function_privilege('authenticated', 'public.exercise_form_media(uuid)', 'execute'),
  'authenticated can execute exercise_form_media'
);
select ok(
  not has_function_privilege('anon', 'public.exercise_form_media(uuid)', 'execute')
    and not has_function_privilege('service_role', 'public.exercise_form_media(uuid)', 'execute'),
  'anon and service_role cannot execute exercise_form_media'
);
select ok(
  not exists (
    select 1 from pg_proc p, aclexplode(p.proacl) acl
    where p.oid = 'public.exercise_form_media(uuid)'::regprocedure and acl.grantee = 0
  ),
  'public holds no execute on exercise_form_media'
);

-- Table checks, as postgres.
select throws_ok(
  $$ insert into public.exercise_form_videos (exercise_id, youtube_video_id, title, channel, verified_on)
     values ('95700000-0000-4000-8000-000000000102', 'tooshort', 'key957 t', 'key957 c', '2026-11-11') $$,
  '23514',
  'new row for relation "exercise_form_videos" violates check constraint "exercise_form_videos_youtube_video_id_check"',
  'a video id of fewer than 11 characters is refused'
);
select throws_ok(
  $$ insert into public.exercise_form_videos (exercise_id, youtube_video_id, title, channel, verified_on)
     values ('95700000-0000-4000-8000-000000000102', 'aB3_-xYz0123', 'key957 t', 'key957 c', '2026-11-11') $$,
  '23514',
  'new row for relation "exercise_form_videos" violates check constraint "exercise_form_videos_youtube_video_id_check"',
  'a video id of more than 11 characters is refused'
);
select throws_ok(
  $$ insert into public.exercise_form_videos (exercise_id, youtube_video_id, title, channel, verified_on)
     values ('95700000-0000-4000-8000-000000000102', 'aB3_-xYz01!', 'key957 t', 'key957 c', '2026-11-11') $$,
  '23514',
  'new row for relation "exercise_form_videos" violates check constraint "exercise_form_videos_youtube_video_id_check"',
  'a video id with a character outside letters, digits, underscore and hyphen is refused'
);
select throws_ok(
  $$ insert into public.exercise_form_videos (exercise_id, youtube_video_id, title, channel, verified_on)
     values ('95700000-0000-4000-8000-000000000102', 'aB3_-xYz012', '', 'key957 c', '2026-11-11') $$,
  '23514',
  'new row for relation "exercise_form_videos" violates check constraint "exercise_form_videos_title_check"',
  'a blank title is refused'
);
select throws_ok(
  format($$ insert into public.exercise_form_videos (exercise_id, youtube_video_id, title, channel, verified_on)
     values ('95700000-0000-4000-8000-000000000102', 'aB3_-xYz012', %L, 'key957 c', '2026-11-11') $$, repeat('t', 201)),
  '23514',
  'new row for relation "exercise_form_videos" violates check constraint "exercise_form_videos_title_check"',
  'a title of more than 200 characters is refused'
);
select throws_ok(
  $$ insert into public.exercise_form_videos (exercise_id, youtube_video_id, title, channel, verified_on)
     values ('95700000-0000-4000-8000-000000000102', 'aB3_-xYz012', 'key957 t', '', '2026-11-11') $$,
  '23514',
  'new row for relation "exercise_form_videos" violates check constraint "exercise_form_videos_channel_check"',
  'a blank channel is refused'
);
select throws_ok(
  format($$ insert into public.exercise_form_videos (exercise_id, youtube_video_id, title, channel, verified_on)
     values ('95700000-0000-4000-8000-000000000102', 'aB3_-xYz012', 'key957 t', %L, '2026-11-11') $$, repeat('c', 101)),
  '23514',
  'new row for relation "exercise_form_videos" violates check constraint "exercise_form_videos_channel_check"',
  'a channel of more than 100 characters is refused'
);
select throws_ok(
  $$ insert into public.exercise_form_videos (exercise_id, youtube_video_id, title, channel, verified_on)
     values ('95700000-0000-4000-8000-0000000001a1', 'aB3_-xYz012', 'key957 t', 'key957 c', '2026-11-11') $$,
  '23514',
  'an exercise form video belongs to a global exercise',
  'a video row on a custom exercise is refused'
);
select throws_ok(
  $$ update public.exercise_form_videos set exercise_id = '95700000-0000-4000-8000-0000000001a1'
     where exercise_id = '95700000-0000-4000-8000-000000000101' $$,
  '23514',
  'an exercise form video belongs to a global exercise',
  'a video row cannot be moved onto a custom exercise'
);
select throws_ok(
  $$ insert into public.exercise_form_videos (exercise_id, youtube_video_id, title, channel, verified_on)
     values ('95700000-0000-4000-8000-000000000101', 'aB3_-xYz012', 'key957 t', 'key957 c', '2026-11-11') $$,
  '23505',
  null,
  'an exercise holds at most one video'
);
select lives_ok(
  $$ insert into public.exercise_form_videos (exercise_id, youtube_video_id, title, channel, verified_on)
     values ('95700000-0000-4000-8000-000000000103', 'aB3_-xYz012', repeat('t', 200), repeat('c', 100), '2026-11-11') $$,
  'a title of 200 characters and a channel of 100 are accepted'
);
-- anon.
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select throws_ok(
  $$ select * from public.exercise_form_media('95700000-0000-4000-8000-000000000101') $$,
  '42501',
  'permission denied for function exercise_form_media',
  'anon cannot execute exercise_form_media'
);
reset role;

-- A, signed in.
set local role authenticated;
set local request.jwt.claims = '{"sub":"95700000-0000-4000-8000-00000000000a","role":"authenticated"}';
select throws_ok(
  $$ select * from public.exercise_form_videos $$,
  '42501',
  'permission denied for table exercise_form_videos',
  'authenticated cannot select from exercise_form_videos'
);
select throws_ok(
  $$ select * from public.exercise_source_data $$,
  '42501',
  'permission denied for table exercise_source_data',
  'authenticated cannot select from exercise_source_data'
);
select results_eq(
  $$ select video_id, video_title, video_channel, image_paths from public.exercise_form_media('95700000-0000-4000-8000-000000000101') $$,
  $$ values ('aB3_-xYz012'::text, 'key957 squat form'::text, 'key957 channel'::text, array['KEY957_One/0.jpg', 'KEY957_One/1.jpg']::text[]) $$,
  'a global exercise with a video answers the video fields and its two image paths'
);
select results_eq(
  $$ select video_id, video_title, video_channel, image_paths from public.exercise_form_media('95700000-0000-4000-8000-000000000102') $$,
  $$ values (null::text, null::text, null::text, array['KEY957_Two/0.jpg', 'KEY957_Two/1.jpg']::text[]) $$,
  'a global exercise without a video answers null video fields and its two image paths'
);
select results_eq(
  $$ select video_id, video_title, video_channel, image_paths from public.exercise_form_media('95700000-0000-4000-8000-0000000001a1') $$,
  $$ values (null::text, null::text, null::text, array[]::text[]) $$,
  'the caller''s own exercise answers null video fields and an empty array'
);
select is_empty(
  $$ select * from public.exercise_form_media('95700000-0000-4000-8000-0000000001b1') $$,
  'another user''s custom exercise answers no row'
);
select is_empty(
  $$ select * from public.exercise_form_media('95700000-0000-4000-8000-000000000999') $$,
  'an unknown exercise answers no row'
);
select results_eq(
  $$ select video_id, image_paths from public.exercise_form_media('95700000-0000-4000-8000-000000000103') $$,
  $$ values ('aB3_-xYz012'::text, array['KEY957_Three/0.jpg', 'KEY957_Three/1.jpg']::text[]) $$,
  'a soft deleted global exercise still answers'
);
reset role;

-- B sees B's own exercise and not A's.
set local role authenticated;
set local request.jwt.claims = '{"sub":"95700000-0000-4000-8000-00000000000b","role":"authenticated"}';
select is_empty(
  $$ select * from public.exercise_form_media('95700000-0000-4000-8000-0000000001a1') $$,
  'B gets no row for A''s exercise'
);
reset role;

select * from finish();

rollback;
