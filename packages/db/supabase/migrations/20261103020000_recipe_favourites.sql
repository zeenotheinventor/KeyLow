-- recipe favourites: the `recipe_favourites` table, which holds the recipes a person has starred so
-- the log screen can offer them beside their favourite foods.
--
-- A favourite reveals what a person eats, so it is health data. Nothing here logs a row value, and
-- the cap error below states a rule and quotes no value.
--
-- The migration adds a table and replaces one function. It inserts no row.

-- One row per person and recipe. A favourite is never edited, only added and removed, so the table
-- has no update privilege and no update policy. A recipe cannot be deleted by a client, only archived,
-- so a row stays when its recipe is archived and the clients leave it out of the list until the recipe
-- is restored. An account that is deleted takes its favourites with it.
create table public.recipe_favourites (
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  created_at timestamptz not null default now(),

  primary key (owner_id, recipe_id)
);

-- The primary key serves the cascade from `auth.users` and the list per owner. The plain index on
-- `recipe_id` keeps the foreign key check from scanning the table when a recipe is deleted, the reason
-- Amendment 2 gives for the same index on log entries.
create index recipe_favourites_recipe_idx on public.recipe_favourites (recipe_id);

alter table public.recipe_favourites enable row level security;

-- Set the table privileges explicitly so nothing relies on the default ones (see 0001_init.sql).
-- Start from a clean slate, then grant back only what the clients use. The anon role and the service
-- role keep nothing, because nothing server side reads favourites.
revoke all on public.recipe_favourites from anon, authenticated, service_role;

grant select, delete on public.recipe_favourites to authenticated;
grant insert (owner_id, recipe_id) on public.recipe_favourites to authenticated;

create policy "recipe_favourites_select_own" on public.recipe_favourites
  for select to authenticated
  using (owner_id = (select auth.uid()));

-- A foreign key is checked without row level security, so on its own it would let a user favourite
-- another user's recipe, and success against a failure would tell them whether the id exists. The
-- `exists` subquery runs as the caller, under the `recipes` policy, so only their own recipes pass,
-- and an id that does not exist fails the same way as one that is not theirs. An archived recipe
-- cannot be newly favourited.
create policy "recipe_favourites_insert_own" on public.recipe_favourites
  for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.recipes r
      where r.id = recipe_favourites.recipe_id and not r.is_archived
    )
  );

create policy "recipe_favourites_delete_own" on public.recipe_favourites
  for delete to authenticated
  using (owner_id = (select auth.uid()));

-- One strip shows foods and recipes together, so the cap of 30 is shared: a person has at most 30
-- live favourites across both kinds. The number must match MAX_FAVOURITES in @keylow/core
-- (packages/core/src/foods/favourites.ts). The raise is KL004 (class KL is this schema's own, see
-- 20261024010000_checkin_writers.sql) and its message states the rule and quotes no value.
--
-- A live favourite is one whose food is not soft deleted or whose recipe is not archived, because the
-- list the person sees leaves the others out, so someone who sees 25 can always add more. The cost is
-- that restoring a food or a recipe can take a person above 30. That is accepted: nothing is refused
-- on a restore, and the person simply cannot add another until they are back under 30.
--
-- A favourite that is already there is let through, so favouriting twice with "ignore duplicates"
-- stays a no-op for a person at the cap. Both triggers take the same advisory lock, per owner and
-- held to the end of the transaction, so a food and a recipe inserted at once cannot both see 29
-- rows and both succeed. The count is written out in both functions rather than shared, because a
-- helper would need an execute grant for the caller, and the trigger functions need none.
-- Replaces the food trigger function of 20261103000000_food_favourites.sql, which counted foods only.
create or replace function public.enforce_food_favourites_limit()
returns trigger
language plpgsql
volatile
security invoker
set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.owner_id::text, 0));

  if exists (
    select 1 from public.food_favourites
    where owner_id = new.owner_id and food_id = new.food_id
  ) then
    return new;
  end if;

  if (
    select
      (
        select pg_catalog.count(*)
        from public.food_favourites favourite
        join public.foods f on f.id = favourite.food_id
        where favourite.owner_id = new.owner_id and f.deleted_at is null
      )
      + (
        select pg_catalog.count(*)
        from public.recipe_favourites favourite
        join public.recipes r on r.id = favourite.recipe_id
        where favourite.owner_id = new.owner_id and not r.is_archived
      )
  ) >= 30 then
    raise exception 'favourite_limit' using errcode = 'KL004';
  end if;

  return new;
end;
$$;

create function public.enforce_recipe_favourites_limit()
returns trigger
language plpgsql
volatile
security invoker
set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.owner_id::text, 0));

  if exists (
    select 1 from public.recipe_favourites
    where owner_id = new.owner_id and recipe_id = new.recipe_id
  ) then
    return new;
  end if;

  if (
    select
      (
        select pg_catalog.count(*)
        from public.food_favourites favourite
        join public.foods f on f.id = favourite.food_id
        where favourite.owner_id = new.owner_id and f.deleted_at is null
      )
      + (
        select pg_catalog.count(*)
        from public.recipe_favourites favourite
        join public.recipes r on r.id = favourite.recipe_id
        where favourite.owner_id = new.owner_id and not r.is_archived
      )
  ) >= 30 then
    raise exception 'favourite_limit' using errcode = 'KL004';
  end if;

  return new;
end;
$$;

-- Only the trigger calls it, so no role needs to execute it directly.
revoke execute on function public.enforce_recipe_favourites_limit() from public, anon, authenticated, service_role;

create trigger recipe_favourites_limit
  before insert on public.recipe_favourites
  for each row execute function public.enforce_recipe_favourites_limit();
