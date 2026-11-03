-- food favourites: the `food_favourites` table, which holds the foods a person has starred so the
-- log screen can offer them first.
--
-- A favourite reveals what a person eats, so it is health data. Nothing here logs a row value, and
-- the cap error below states a rule and quotes no value.
--
-- The migration is additive and inserts no row.

-- One row per person and food. A favourite is never edited, only added and removed, so the table has
-- no update privilege and no update policy. A food that is deleted for good, or an account that is
-- deleted, takes its favourites with it. A soft deleted food keeps its row, so restoring the food
-- brings the favourite back, and the clients leave it out of the list while the food is deleted.
create table public.food_favourites (
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  food_id uuid not null references public.foods (id) on delete cascade,
  created_at timestamptz not null default now(),

  primary key (owner_id, food_id)
);

-- The primary key serves the cascade from `auth.users` and the list per owner. The plain index on
-- `food_id` keeps the foreign key check from scanning the table when a food is deleted, the reason
-- Amendment 2 gives for the same index on log entries.
create index food_favourites_food_idx on public.food_favourites (food_id);

alter table public.food_favourites enable row level security;

-- Set the table privileges explicitly so nothing relies on the default ones (see 0001_init.sql).
-- Start from a clean slate, then grant back only what the clients use. The anon role and the service
-- role keep nothing, because nothing server side reads favourites.
revoke all on public.food_favourites from anon, authenticated, service_role;

grant select, delete on public.food_favourites to authenticated;
grant insert (owner_id, food_id) on public.food_favourites to authenticated;

create policy "food_favourites_select_own" on public.food_favourites
  for select to authenticated
  using (owner_id = (select auth.uid()));

-- A foreign key is checked without row level security, so on its own it would let a user favourite
-- another user's private food, and success against a failure would tell them whether the id exists.
-- The `exists` subquery runs as the caller, under the `foods` policy, so only global or own foods
-- pass, and an id that does not exist fails the same way as one that is not theirs. A soft deleted
-- food cannot be newly favourited.
create policy "food_favourites_insert_own" on public.food_favourites
  for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.foods f
      where f.id = food_favourites.food_id and f.deleted_at is null
    )
  );

create policy "food_favourites_delete_own" on public.food_favourites
  for delete to authenticated
  using (owner_id = (select auth.uid()));

-- A person has at most 30 favourites whose food is live. The number must match MAX_FAVOURITE_FOODS
-- in @keylow/core (packages/core/src/foods/favourites.ts). The raise is KL004 (class KL is this
-- schema's own, see 20261024010000_checkin_writers.sql) and its message states the rule and quotes
-- no value.
--
-- Only favourites whose food is not soft deleted are counted, because the list the person sees leaves
-- the others out, so someone who sees 25 can always add more. The cost is that restoring a food can
-- take a person above 30. That is accepted: nothing is refused on a restore, and the person simply
-- cannot add another until they are back under 30.
--
-- A favourite that is already there is let through, so favouriting twice with "ignore duplicates"
-- stays a no-op for a person at the cap. The advisory lock is per owner and held to the end of the
-- transaction, so two inserts at once cannot both see 29 rows and both succeed.
create function public.enforce_food_favourites_limit()
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
    select pg_catalog.count(*)
    from public.food_favourites favourite
    join public.foods f on f.id = favourite.food_id
    where favourite.owner_id = new.owner_id and f.deleted_at is null
  ) >= 30 then
    raise exception 'favourite_limit' using errcode = 'KL004';
  end if;

  return new;
end;
$$;

-- Only the trigger calls it, so no role needs to execute it directly.
revoke execute on function public.enforce_food_favourites_limit() from public, anon, authenticated, service_role;

create trigger food_favourites_limit
  before insert on public.food_favourites
  for each row execute function public.enforce_food_favourites_limit();
