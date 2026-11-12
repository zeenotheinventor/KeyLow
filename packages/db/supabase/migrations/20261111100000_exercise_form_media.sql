-- Exercise form media (KEY-957): the curated YouTube video of a global exercise, and the one read
-- that every surface uses to show a video or, failing that, the free-exercise-db photos.

-- One curated video per global exercise, keyed by the exercise. A custom exercise never has one.
-- Only migrations write this table (the seed of videos is a data migration), so no role holds a
-- privilege on it and there is no policy.
create table public.exercise_form_videos (
  exercise_id uuid primary key references public.exercises (id) on delete cascade,
  youtube_video_id text not null,
  title text not null,
  channel text not null,
  verified_on date not null,
  created_at timestamptz not null default now(),

  constraint exercise_form_videos_youtube_video_id_check check (youtube_video_id ~ '^[A-Za-z0-9_-]{11}$'),
  constraint exercise_form_videos_title_check check (char_length(title) between 1 and 200),
  constraint exercise_form_videos_channel_check check (char_length(channel) between 1 and 100)
);

alter table public.exercise_form_videos enable row level security;

-- Set the privileges explicitly so nothing relies on the default ones (see 0001_init.sql).
revoke all on public.exercise_form_videos from anon, authenticated, service_role;

-- A check constraint cannot look at another table, so a trigger refuses a row whose exercise is
-- not global. Only the trigger runs this function, so nobody holds execute on it.
create function public.exercise_form_videos_global_only()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.exercises e where e.id = new.exercise_id and e.owner_id is null
  ) then
    raise exception 'an exercise form video belongs to a global exercise'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke execute on function public.exercise_form_videos_global_only() from public, anon, authenticated, service_role;

create trigger exercise_form_videos_global_only
  before insert or update of exercise_id on public.exercise_form_videos
  for each row execute function public.exercise_form_videos_global_only();

-- What a client needs to show the form of one exercise: the curated video when there is one, and
-- the paths of the free-exercise-db photos. It holds no choice between the two, that belongs to
-- core. At most one row, and none when the exercise is not visible to the caller, by the same rule
-- as the `exercises_select_visible` policy. A soft deleted exercise still answers, so a logged set
-- keeps its media. `image_paths` is empty for a custom exercise, which has no source row.
--
-- This is security definer because `exercise_source_data` stays readable by the service role
-- only: the raw upstream row is not for clients, and only the image paths leave it. The empty
-- search_path forces every reference to be schema-qualified.
create function public.exercise_form_media(p_exercise_id uuid)
returns table (video_id text, video_title text, video_channel text, image_paths text[])
language sql
stable
security definer
set search_path = ''
as $$
  select
    v.youtube_video_id,
    v.title,
    v.channel,
    coalesce(
      (
        select array_agg(image.path order by image.position)
        from jsonb_array_elements_text(
          case when jsonb_typeof(s.raw -> 'images') = 'array' then s.raw -> 'images' else '[]'::jsonb end
        ) with ordinality as image (path, position)
      ),
      array[]::text[]
    )
  from public.exercises e
  left join public.exercise_form_videos v on v.exercise_id = e.id
  left join public.exercise_source_data s on s.exercise_id = e.id
  where e.id = p_exercise_id
    and (e.owner_id is null or e.owner_id = (select auth.uid()))
$$;

-- `create function` grants execute to public and the Supabase default ACL grants it to the API
-- roles, so each is revoked by name. Only a signed in user may call it.
revoke execute on function public.exercise_form_media(uuid) from public, anon, authenticated, service_role;
grant execute on function public.exercise_form_media(uuid) to authenticated;
