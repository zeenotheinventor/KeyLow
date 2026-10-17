-- recipes: the `recipes` and `recipe_ingredients` tables, the foreign key and policy that tie
-- `food_log_entries.recipe_id` to them, and `save_recipe` (KEY-283). Everything here is set out in
-- docs/adr/0003-data-model.md, Amendment 8, which wins over any other description. The bounds are
-- the table in its "The numbers".
--
-- These are health data tables, because a recipe reveals dietary habits. Nothing here logs a row
-- value, and `save_recipe` raises no notice and no error that quotes a name, an ingredient, an
-- amount, a step or a nutrient figure.
--
-- The migration is additive. Nothing writes `food_log_entries.recipe_id` before it, so the foreign
-- key finds no row to reject.

-- A step is not null, not blank (empty or only whitespace) and at most 1000 characters, and a recipe
-- has at most 50 of them in a one dimensional list. A `check` cannot hold a subquery, so the per-step
-- rule is this immutable function. A check runs it as whoever writes the row, so `authenticated` must
-- hold execute. It is pure, and nobody else has a reason to call it, so its execute is granted to
-- `authenticated` alone, as for the other functions here.
create function public.recipe_instructions_are_valid(steps text[])
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select
    steps is not null
    and pg_catalog.cardinality(steps) <= 50
    and coalesce(pg_catalog.array_ndims(steps) = 1, true)
    and not exists (
      select 1
      from pg_catalog.unnest(steps) as step
      where step is null or step !~ '\S' or pg_catalog.char_length(step) > 1000
    )
$$;

revoke execute on function public.recipe_instructions_are_valid(text[]) from public, anon, service_role;
grant execute on function public.recipe_instructions_are_valid(text[]) to authenticated;

-- A recipe belongs to its owner and is archived, never deleted. `computed` is the cache core writes
-- with the recipe (Amendment 8, "The computed cache"): the database stores it and does not verify it,
-- so it has no default. Amendment 1 gives both tables their `id` and `created_at`.
create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  servings numeric not null,
  yield_grams numeric,
  -- The ordered steps. The first element is step 1, and the whole list is replaced on every save.
  instructions text[] not null default '{}',
  computed jsonb not null,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),

  constraint recipes_name_not_blank check (name ~ '\S'),
  constraint recipes_name_length_check check (pg_catalog.char_length(name) <= 200),
  constraint recipes_servings_check check (servings > 0 and servings <= 1000),
  constraint recipes_yield_grams_check check (yield_grams > 0 and yield_grams <= 100000),
  constraint recipes_instructions_check check (public.recipe_instructions_are_valid(instructions)),
  constraint recipes_computed_is_object check (pg_catalog.jsonb_typeof(computed) = 'object')
);

-- The library lists the caller's recipes in name order, and the index also serves the cascade from
-- `auth.users`, which Postgres does not index on the referencing side. The trigram index serves the
-- name search, an `ilike` through PostgREST with no function of its own (Amendment 8, "Name search").
create index recipes_owner_name_idx on public.recipes (owner_id, name);
create index recipes_name_trgm_idx on public.recipes using gin (name extensions.gin_trgm_ops);

-- A stored ingredient is never edited in place. A save deletes a recipe's ingredients and inserts
-- the sent ones, so an ingredient's id is new each time and nothing may refer to it. `owner_id` is a
-- copy of the recipe's for row level security, as `food_portions` has. `food_id` has no cascade, the
-- rule of `food_log_entries.food_id`. `portion_id` is cleared when its portion is deleted, because
-- editing a custom food replaces its portions with new ids (Amendment 2): the snapshot keeps the
-- portion.
create table public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  position integer not null,
  food_id uuid not null references public.foods (id),
  quantity numeric not null,
  -- One of core's quantity units. Core validates it, and the database keeps no list of its own.
  unit text not null,
  portion_id uuid references public.food_portions (id) on delete set null,
  resolved_grams numeric not null,
  -- The food as it was when the ingredient was added, so a later edit of the food never moves it.
  snapshot jsonb not null,
  created_at timestamptz not null default now(),

  unique (recipe_id, position),
  constraint recipe_ingredients_position_check check (position >= 0),
  constraint recipe_ingredients_quantity_check check (quantity > 0),
  constraint recipe_ingredients_resolved_grams_check check (resolved_grams > 0 and resolved_grams <= 100000),
  constraint recipe_ingredients_snapshot_is_object check (pg_catalog.jsonb_typeof(snapshot) = 'object')
);

-- Postgres does not index the referencing side of a foreign key. These plain indexes keep the check
-- from scanning the table when a user's foods go with their account (`food_id`) or a portion is
-- deleted (`portion_id`), the reason Amendment 2 gives for the same index on log entries. The
-- unique key above serves the ingredients of a recipe in order and the cascade from `recipes`.
create index recipe_ingredients_food_idx on public.recipe_ingredients (food_id);
create index recipe_ingredients_portion_idx on public.recipe_ingredients (portion_id);

-- The foreign key from the diary. The default `no action` refuses a stray delete of a recipe that an
-- entry points at, and account deletion still succeeds because Postgres runs every foreign key check
-- after the cascade actions (proved on the real tables in recipes_rls.test.sql). `cascade` would
-- delete diary history and `set null` would break `food_log_entries_item_type_ids`. Nothing
-- writes the column before this migration, so no existing row can fail the constraint.
alter table public.food_log_entries
  add constraint food_log_entries_recipe_id_fkey
  foreign key (recipe_id) references public.recipes (id);

-- Most entries are foods and have no recipe, so the index is partial. The foreign key check looks
-- up `recipe_id = $1`, which this serves.
create index food_log_entries_recipe_idx
  on public.food_log_entries (recipe_id)
  where recipe_id is not null;

comment on column public.food_log_entries.recipe_id is
  'The recipe a recipe entry was logged from. Insert only. Its frozen figures are in snapshot. A recipe is archived and never deleted, and the foreign key refuses a delete while an entry points at it.';

alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;

-- Set the table privileges explicitly so nothing relies on the default ones (see 0001_init.sql).
-- Start from a clean slate, then grant back only what the clients use. The anon role keeps nothing.
-- The service role keeps nothing either, because nothing server side reads or writes recipes yet
-- (the export in M7 grants what it needs then).
revoke all on public.recipes, public.recipe_ingredients from anon, authenticated, service_role;

-- Recipes: `id`, `created_at` and `is_archived` are never written on insert, so a new recipe has
-- the database's id and starts live. `owner_id`, `id` and `created_at` never change afterwards.
-- There is no delete grant. A recipe is archived by setting `is_archived`, and clearing it undoes
-- that. Account deletion cascades regardless, because a foreign key action does not run as the caller.
grant select on public.recipes to authenticated;

grant insert (owner_id, name, servings, yield_grams, instructions, computed)
  on public.recipes to authenticated;

grant update (name, servings, yield_grams, instructions, computed, is_archived)
  on public.recipes to authenticated;

-- Ingredients are replaced as a whole, so there is delete and no update.
grant select, delete on public.recipe_ingredients to authenticated;

grant insert (recipe_id, owner_id, position, food_id, quantity, unit, portion_id, resolved_grams, snapshot)
  on public.recipe_ingredients to authenticated;

create policy "recipes_select_own" on public.recipes
  for select to authenticated
  using (owner_id = (select auth.uid()));

create policy "recipes_insert_own" on public.recipes
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy "recipes_update_own" on public.recipes
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "recipe_ingredients_select_own" on public.recipe_ingredients
  for select to authenticated
  using (owner_id = (select auth.uid()));

-- A foreign key is checked without row level security, so on its own it would let a user build a
-- recipe on another user's private food, and the ingredient would then block that user's account
-- deletion. The `exists` subqueries run as the caller, under the `recipes`, `foods` and
-- `food_portions` policies, so only the caller's own recipes and global or own foods and portions
-- pass, and an id that does not exist fails the same way as one that is not theirs.
create policy "recipe_ingredients_insert_own" on public.recipe_ingredients
  for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.recipes r
      where r.id = recipe_ingredients.recipe_id and r.owner_id = (select auth.uid())
    )
    and exists (select 1 from public.foods f where f.id = recipe_ingredients.food_id)
    and (
      portion_id is null
      or exists (select 1 from public.food_portions p where p.id = recipe_ingredients.portion_id)
    )
  );

create policy "recipe_ingredients_delete_own" on public.recipe_ingredients
  for delete to authenticated
  using (owner_id = (select auth.uid()));

-- A recipe entry's recipe must be visible to the caller, as its food and portion already are. The
-- same reason applies: the foreign key ignores row level security, and with `no action` an entry on
-- another user's recipe would block that user's account deletion. The subquery runs under the
-- owner-only `recipes` policy, so an id that does not exist fails the same way as one that is not
-- theirs. `is_archived` is not looked at: archiving is a library filter and not a ban on logging.
-- The update policy is unchanged, because `recipe_id` is not updatable. A policy keeps its roles and
-- command when its expression is altered.
alter policy "food_log_entries_insert_own" on public.food_log_entries
  with check (
    (select auth.uid()) = user_id
    and (
      food_id is null
      or exists (select 1 from public.foods f where f.id = food_log_entries.food_id)
    )
    and (
      portion_id is null
      or exists (select 1 from public.food_portions p where p.id = food_log_entries.portion_id)
    )
    and (
      recipe_id is null
      or exists (select 1 from public.recipes r where r.id = food_log_entries.recipe_id)
    )
  );

-- Creates a recipe when p_recipe_id is null, and otherwise replaces the name, servings, yield,
-- instructions, cache and ingredients of the caller's recipe, all or nothing. It returns the id.
--
-- Why a function. PostgREST has no transaction between calls, and a save writes the recipe row,
-- replaces the ingredients and writes the cache. Separately, a failure after the delete would leave
-- a recipe with no ingredients under a cache that describes the old ones, and two devices could
-- end with one's ingredients under the other's cache. Here the whole save is one call.
--
-- Security invoker, so every policy above applies to its writes: the caller can only touch their own
-- recipe, can only name foods and portions they can see, and a failed policy or constraint rolls
-- the call back. The update of the recipe row stays the first write: its row lock serialises two
-- saves of one recipe, and the last to commit wins.
--
-- Input. p_recipe is an object with name, servings, yield_grams, instructions (an array of strings)
-- and computed (an object). p_ingredients is an array of objects with food_id, quantity, unit,
-- portion_id, resolved_grams and snapshot, in the order they are to be listed. Keys it does not
-- know (id, owner_id, is_archived, created_at, recipe_id, position) are ignored, so a caller cannot
-- set them: the owner is the caller, the database chooses a new recipe's id, an ingredient's
-- position is its index in the array, and is_archived is neither read nor changed.
--
-- Refusals. Everything a person types is checked before anything is written, with 22023
-- (invalid_parameter_value) and a message that states the rule and quotes no value. A recipe that
-- does not exist or is not the caller's raises P0002 (no_data_found), and the two look the same.
-- A malformed ingredient row (a number where text belongs, say) reaches the table's own error,
-- which the ADR accepts because core builds those rows.
create function public.save_recipe(p_recipe_id uuid, p_recipe jsonb, p_ingredients jsonb)
returns uuid
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  recipe_servings numeric;
  recipe_yield numeric;
  recipe_steps jsonb;
  saved_id uuid;
begin
  if pg_catalog.jsonb_typeof(p_recipe) is distinct from 'object' then
    raise exception 'save_recipe needs the recipe as a JSON object'
      using errcode = '22023';
  end if;
  if pg_catalog.jsonb_typeof(p_ingredients) is distinct from 'array' then
    raise exception 'save_recipe needs the ingredients as a JSON array'
      using errcode = '22023';
  end if;
  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_ingredients) as ingredient
    where pg_catalog.jsonb_typeof(ingredient) is distinct from 'object'
  ) then
    raise exception 'every ingredient must be a JSON object'
      using errcode = '22023';
  end if;
  if pg_catalog.jsonb_array_length(p_ingredients) > 100 then
    raise exception 'a recipe has at most 100 ingredients'
      using errcode = '22023';
  end if;

  if pg_catalog.jsonb_typeof(p_recipe -> 'name') is distinct from 'string' then
    raise exception 'the recipe name must be text'
      using errcode = '22023';
  end if;
  if (p_recipe ->> 'name') !~ '\S' then
    raise exception 'the recipe name must not be blank'
      using errcode = '22023';
  end if;
  if pg_catalog.char_length(p_recipe ->> 'name') > 200 then
    raise exception 'the recipe name has at most 200 characters'
      using errcode = '22023';
  end if;

  if pg_catalog.jsonb_typeof(p_recipe -> 'servings') is distinct from 'number' then
    raise exception 'the servings must be a number'
      using errcode = '22023';
  end if;
  recipe_servings := (p_recipe ->> 'servings')::numeric;
  if recipe_servings <= 0 or recipe_servings > 1000 then
    raise exception 'the servings must be more than 0 and at most 1000'
      using errcode = '22023';
  end if;

  -- A missing or null yield means no measured cooked weight.
  if pg_catalog.jsonb_typeof(p_recipe -> 'yield_grams') not in ('number', 'null') and p_recipe ? 'yield_grams' then
    raise exception 'the yield must be a number or null'
      using errcode = '22023';
  end if;
  if pg_catalog.jsonb_typeof(p_recipe -> 'yield_grams') = 'number' then
    recipe_yield := (p_recipe ->> 'yield_grams')::numeric;
    if recipe_yield <= 0 or recipe_yield > 100000 then
      raise exception 'the yield must be more than 0 and at most 100000'
        using errcode = '22023';
    end if;
  end if;

  recipe_steps := p_recipe -> 'instructions';
  if pg_catalog.jsonb_typeof(recipe_steps) is distinct from 'array' then
    raise exception 'the instructions must be a JSON array of text'
      using errcode = '22023';
  end if;
  if pg_catalog.jsonb_array_length(recipe_steps) > 50 then
    raise exception 'a recipe has at most 50 steps'
      using errcode = '22023';
  end if;
  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(recipe_steps) as step
    where pg_catalog.jsonb_typeof(step) is distinct from 'string'
  ) then
    raise exception 'every step must be text'
      using errcode = '22023';
  end if;
  if exists (
    select 1
    from pg_catalog.jsonb_array_elements_text(recipe_steps) as step
    where step !~ '\S'
  ) then
    raise exception 'a step must not be blank'
      using errcode = '22023';
  end if;
  if exists (
    select 1
    from pg_catalog.jsonb_array_elements_text(recipe_steps) as step
    where pg_catalog.char_length(step) > 1000
  ) then
    raise exception 'a step has at most 1000 characters'
      using errcode = '22023';
  end if;

  if pg_catalog.jsonb_typeof(p_recipe -> 'computed') is distinct from 'object' then
    raise exception 'the computed cache must be a JSON object'
      using errcode = '22023';
  end if;

  -- The first write. For an update it takes the row lock that every other save of this recipe
  -- queues behind, and row level security decides whether the caller may see the row at all.
  if p_recipe_id is null then
    insert into public.recipes (name, servings, yield_grams, instructions, computed)
    values (
      p_recipe ->> 'name',
      recipe_servings,
      recipe_yield,
      array(
        select step.value
        from pg_catalog.jsonb_array_elements_text(recipe_steps) with ordinality as step(value, number)
        order by step.number
      ),
      p_recipe -> 'computed'
    )
    returning id into saved_id;
  else
    update public.recipes
    set
      name = p_recipe ->> 'name',
      servings = recipe_servings,
      yield_grams = recipe_yield,
      instructions = array(
        select step.value
        from pg_catalog.jsonb_array_elements_text(recipe_steps) with ordinality as step(value, number)
        order by step.number
      ),
      computed = p_recipe -> 'computed'
    where id = p_recipe_id
    returning id into saved_id;

    if not found then
      raise exception 'the recipe does not exist or is not yours'
        using errcode = 'P0002';
    end if;
  end if;

  delete from public.recipe_ingredients where recipe_id = saved_id;

  insert into public.recipe_ingredients (
    recipe_id, position, food_id, quantity, unit, portion_id, resolved_grams, snapshot
  )
  select
    saved_id,
    (element.number - 1)::integer,
    ingredient.food_id,
    ingredient.quantity,
    ingredient.unit,
    ingredient.portion_id,
    ingredient.resolved_grams,
    ingredient.snapshot
  from pg_catalog.jsonb_array_elements(p_ingredients) with ordinality as element(item, number),
    lateral pg_catalog.jsonb_to_record(element.item) as ingredient(
      food_id uuid, quantity numeric, unit text, portion_id uuid, resolved_grams numeric, snapshot jsonb
    );

  return saved_id;
end;
$$;

-- `create function` grants execute to public, and the Supabase default ACL grants it to the API
-- roles, so each is revoked by name. The function acts on the caller, so only authenticated holds it
-- (the service role has no caller).
revoke execute on function public.save_recipe(uuid, jsonb, jsonb) from public, anon, service_role;
grant execute on function public.save_recipe(uuid, jsonb, jsonb) to authenticated;
