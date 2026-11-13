-- palate_preferences and the palate_food_stats view (KEY-1023, part of KEY-216).
-- Everything here is set out in docs/adr/0003-data-model.md, Amendment 22, which wins over any other
-- description. What a person states about their taste, and what the diary says they eat, is health
-- data, and an `allergy` row is special category data. Nothing here logs a row value or raises a
-- notice with one. A check constraint failure can quote the failing row in PostgreSQL's own error
-- log, which no client can prevent. The migration inserts no row, so it applies to a database that
-- holds any data.

-- `kind` says what the row is. A `not_usual` row is the "not true" correction on one item of the
-- person's profile, and names it by a food, a recipe or a label. A `dislike` or an `allergy` row
-- carries a label such as a food word, which core matches against food names. Both references
-- cascade, because a preference about a row that no longer exists means nothing.
create table public.palate_preferences (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null,
  food_id uuid references public.foods (id) on delete cascade,
  recipe_id uuid references public.recipes (id) on delete cascade,
  label text,
  created_at timestamptz not null default now(),

  constraint palate_preferences_kind_check check (kind in ('dislike', 'allergy', 'not_usual')),
  constraint palate_preferences_label_check check (label is null or (label ~ '\S' and char_length(label) <= 100)),
  constraint palate_preferences_references_check check (
    case kind
      when 'not_usual' then num_nonnulls(food_id, recipe_id, label) = 1
      else label is not null
    end
  )
);

-- The same correction cannot be stored twice. `nulls not distinct` makes a null in the label or in
-- the coalesced reference count as a value, so two identical `not_usual` rows collide. Without it
-- every such row would be distinct and the index would stop nothing.
create unique index palate_preferences_unique_idx
  on public.palate_preferences (owner_id, kind, (coalesce(food_id, recipe_id)), (lower(label)))
  nulls not distinct;

-- Serves the person's list and the cascade from `auth.users`.
create index palate_preferences_owner_id_kind_idx on public.palate_preferences (owner_id, kind);

-- Serve the foreign key checks when a food or a recipe row is removed.
create index palate_preferences_food_id_idx on public.palate_preferences (food_id);
create index palate_preferences_recipe_id_idx on public.palate_preferences (recipe_id);

alter table public.palate_preferences enable row level security;

-- Set the table privileges explicitly so nothing relies on the default ones (see 0001_init.sql). A
-- client reads, adds and removes its own rows and cannot update one, so a change is a delete and an
-- add. It cannot set `id` or `created_at`. The anon and service roles keep nothing, because nothing
-- server side reads the palate: the assistant tools run under the person's own JWT.
revoke all on public.palate_preferences from anon, authenticated, service_role;

grant select, delete on public.palate_preferences to authenticated;
grant insert (owner_id, kind, food_id, recipe_id, label) on public.palate_preferences to authenticated;

create policy "palate_preferences_select_own" on public.palate_preferences
  for select to authenticated
  using (owner_id = (select auth.uid()));

-- A foreign key is checked without row level security, so without the `exists` subqueries a person
-- could point a row at another person's private food or recipe and learn whether the id exists. They
-- run as the caller, under the `foods` and `recipes` policies.
create policy "palate_preferences_insert_own" on public.palate_preferences
  for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and (food_id is null or exists (select 1 from public.foods f where f.id = palate_preferences.food_id))
    and (recipe_id is null or exists (select 1 from public.recipes r where r.id = palate_preferences.recipe_id))
  );

create policy "palate_preferences_delete_own" on public.palate_preferences
  for delete to authenticated
  using (owner_id = (select auth.uid()));

-- What the diary says a person eats: one row per owner and per food or recipe over the last 90 days of
-- entries that are not soft deleted. The view runs with the caller's rights, so the policies of
-- `food_log_entries` and `profiles` apply and a person reads only their own figures.
--
-- The window and the bands use the owner's own `profiles.timezone`, applied at read time, so a person
-- who changes timezone sees their past entries re-banded. The window is the entry's `local_date` from
-- 89 days before the owner's local today up to today, which is 90 days counting today. The bands are
-- the hour of `logged_at` in that zone: before 11:00, 11:00 to 15:59 and 16:00 on. Quick entries name
-- no food and no recipe, so they have no row.
--
-- The view does arithmetic only. What counts as usual, rare or never is core's.
create view public.palate_food_stats
with (security_invoker = true)
as
select
  entry.user_id as owner_id,
  entry.food_id,
  entry.recipe_id,
  count(*)::integer as entry_count,
  count(distinct entry.local_date)::integer as distinct_days,
  min(entry.local_date) as first_local_date,
  max(entry.local_date) as last_local_date,
  (percentile_cont(0.5) within group (order by entry.resolved_grams))::numeric as median_resolved_grams,
  count(*) filter (where extract(hour from entry.logged_at at time zone profile.timezone) < 11)::integer
    as before_eleven_count,
  count(*) filter (where extract(hour from entry.logged_at at time zone profile.timezone) >= 11
    and extract(hour from entry.logged_at at time zone profile.timezone) < 16)::integer
    as eleven_to_sixteen_count,
  count(*) filter (where extract(hour from entry.logged_at at time zone profile.timezone) >= 16)::integer
    as sixteen_or_later_count
from public.food_log_entries entry
join public.profiles profile on profile.id = entry.user_id
where entry.deleted_at is null
  and (entry.food_id is not null or entry.recipe_id is not null)
  and entry.local_date > (now() at time zone profile.timezone)::date - 90
  and entry.local_date <= (now() at time zone profile.timezone)::date
group by entry.user_id, entry.food_id, entry.recipe_id;

revoke all on public.palate_food_stats from anon, authenticated, service_role;
grant select on public.palate_food_stats to authenticated;
