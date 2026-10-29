-- shopping list: the `shopping_list_items` table and `save_shopping_items`. Everything here is set
-- out in docs/adr/0003-data-model.md, Amendment 15, which wins over any other description. The
-- bounds are the table in its "The numbers".
--
-- A shopping list is health data, because it reveals what a person cooks and eats. Nothing here
-- logs a row value, and `save_shopping_items` raises no error that quotes a name, an amount or a
-- recipe.
--
-- The migration is additive and inserts no row.

-- One list per person: the list is the owner's rows, in `position` order. `name` is frozen when the
-- item is added, so editing a food never changes the list. `food_id` is null for an item typed by
-- hand, and a food that is deleted leaves its items as typed items, so the delete never fails
-- because of a list. Which ingredients are store cupboard items is core's and is not stored.
create table public.shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  food_id uuid references public.foods (id) on delete set null,
  name text not null,
  -- The summed, scaled grams of every ingredient that added the item. Null for a typed item.
  grams numeric,
  -- Kept only when every recipe that added the food used this one portion.
  portion_label text,
  portion_count numeric,
  -- The recipes that added the item, as [{ "recipeId": uuid, "name": text }], each once.
  sources jsonb not null default '[]',
  position integer not null,
  -- When the item was ticked. Null is still to buy.
  checked_at timestamptz,
  created_at timestamptz not null default now(),

  constraint shopping_list_items_name_not_blank check (name ~ '\S'),
  constraint shopping_list_items_name_length_check check (pg_catalog.char_length(name) <= 200),
  constraint shopping_list_items_grams_check check (grams > 0 and grams <= 100000),
  constraint shopping_list_items_portion_paired check ((portion_label is null) = (portion_count is null)),
  constraint shopping_list_items_portion_label_check check (
    portion_label ~ '\S' and pg_catalog.char_length(portion_label) <= 200
  ),
  constraint shopping_list_items_portion_count_check check (portion_count > 0 and portion_count <= 10000),
  constraint shopping_list_items_sources_check check (
    pg_catalog.jsonb_typeof(sources) = 'array' and pg_catalog.jsonb_array_length(sources) <= 50
  ),
  constraint shopping_list_items_position_check check (position >= 0)
);

-- The list is read in order per owner, and the index also serves the cascade from `auth.users`,
-- which Postgres does not index on the referencing side. The plain index on `food_id` keeps the
-- foreign key check from scanning the table when a food is deleted, the reason Amendment 2 gives
-- for the same index on log entries.
create index shopping_list_items_owner_position_idx on public.shopping_list_items (owner_id, position);
create index shopping_list_items_food_idx on public.shopping_list_items (food_id);

alter table public.shopping_list_items enable row level security;

-- Set the table privileges explicitly so nothing relies on the default ones (see 0001_init.sql).
-- Start from a clean slate, then grant back only what the clients use. The anon role and the service
-- role keep nothing, because nothing server side reads the list.
revoke all on public.shopping_list_items from anon, authenticated, service_role;

-- `id` is insertable so that `save_shopping_items` can write a merge and its new rows in one
-- statement. `owner_id`, `id`, `food_id` and `created_at` never change afterwards, so an item never
-- changes owner or food. Ticking is an update of `checked_at`, and clearing ticked items deletes them.
grant select, delete on public.shopping_list_items to authenticated;

grant insert (id, owner_id, food_id, name, grams, portion_label, portion_count, sources, position, checked_at)
  on public.shopping_list_items to authenticated;

grant update (name, grams, portion_label, portion_count, sources, position, checked_at)
  on public.shopping_list_items to authenticated;

create policy "shopping_list_items_select_own" on public.shopping_list_items
  for select to authenticated
  using (owner_id = (select auth.uid()));

-- A foreign key is checked without row level security, so on its own it would let a user point an
-- item at another user's private food, and success against a failure would tell them whether the id
-- exists. The `exists` subquery runs as the caller, under the `foods` policy, so only global or own
-- foods pass, and an id that does not exist fails the same way as one that is not theirs.
create policy "shopping_list_items_insert_own" on public.shopping_list_items
  for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and (
      food_id is null
      or exists (select 1 from public.foods f where f.id = shopping_list_items.food_id)
    )
  );

create policy "shopping_list_items_update_own" on public.shopping_list_items
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "shopping_list_items_delete_own" on public.shopping_list_items
  for delete to authenticated
  using (owner_id = (select auth.uid()));

-- Writes several items of the caller's list in one statement: a new row for each object whose id is
-- null, and for each id that is already the caller's, its updatable columns. Adding recipes to the
-- list is one call, so a merge is all or nothing.
--
-- Why a function. PostgREST's upsert writes every column it is sent in its update clause, `id` and
-- `food_id` included, which the column grants above refuse by design, and separate calls would
-- leave half a merge after a failure. What to merge is worked out in core (`planListMerge`), so
-- this has no branch of its own beyond its input checks.
--
-- Security invoker, so every policy above applies: an id that is another user's fails the update
-- policy, a food the caller cannot see fails the insert policy, and any failed policy or constraint
-- rolls the call back.
--
-- Input. p_items is an array of at most 500 objects with id, food_id, name, grams, portion_label,
-- portion_count, sources and checked_at. Keys it does not know (owner_id, created_at) are ignored,
-- so the owner is the caller. A refusal of the input's shape is 22023 (invalid_parameter_value)
-- with a message that states the rule and quotes no value. A row that breaks a table rule reaches
-- the table's own error, which the ADR accepts because core builds those rows.
create function public.save_shopping_items(p_items jsonb)
returns void
language plpgsql
volatile
security invoker
set search_path = ''
as $$
begin
  if pg_catalog.jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'save_shopping_items needs the items as a JSON array'
      using errcode = '22023';
  end if;
  if pg_catalog.jsonb_array_length(p_items) > 500 then
    raise exception 'a call writes at most 500 items'
      using errcode = '22023';
  end if;
  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_items) as item
    where pg_catalog.jsonb_typeof(item) is distinct from 'object'
  ) then
    raise exception 'every item must be a JSON object'
      using errcode = '22023';
  end if;

  insert into public.shopping_list_items (
    id, food_id, name, grams, portion_label, portion_count, sources, position, checked_at
  )
  select
    coalesce(item.id, gen_random_uuid()),
    item.food_id,
    item.name,
    item.grams,
    item.portion_label,
    item.portion_count,
    item.sources,
    item.position,
    item.checked_at
  from pg_catalog.jsonb_to_recordset(p_items) as item(
    id uuid, food_id uuid, name text, grams numeric, portion_label text, portion_count numeric,
    sources jsonb, position integer, checked_at timestamptz
  )
  on conflict (id) do update set
    name = excluded.name,
    grams = excluded.grams,
    portion_label = excluded.portion_label,
    portion_count = excluded.portion_count,
    sources = excluded.sources,
    position = excluded.position,
    checked_at = excluded.checked_at;
end;
$$;

-- `create function` grants execute to public, and the Supabase default ACL grants it to the API
-- roles, so each is revoked by name. The function acts on the caller, so only authenticated holds it.
revoke execute on function public.save_shopping_items(jsonb) from public, anon, service_role;
grant execute on function public.save_shopping_items(jsonb) to authenticated;
