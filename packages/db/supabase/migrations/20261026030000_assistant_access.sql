-- assistant_access: the `entitlements` table, the functions `assistant_access()` and `has_entitlement()`, the
-- two consent columns on `profiles`, `recipes.source_url` and the replacement of `save_recipe` that writes it
-- (KEY-666).
-- Everything here is set out in docs/adr/0003-data-model.md, Amendment 14, which wins over any other
-- description. The conversations and the actions and usage tables are the two migrations before this one,
-- and the function that reads the access is its own ticket.
--
-- The migration inserts no row and fills no column, so it applies to a database that holds any data. Every
-- existing profile gets both consent columns null, which leaves the assistant off, and every existing
-- recipe gets no link.

-- A person's plan for one feature. The free plan is the default and not a row, so no user has one until
-- someone grants a paid or unlimited plan, and a later paid tier is a data change. Granting unlimited
-- access is one row added in the Supabase dashboard table editor, and removing the row restores the free
-- plan. `expires_at` null means the row does not expire. `daily_turns` is the row's own daily limit and
-- must be at least 1, because `consume_rate_limit()` raises for a limit below 1. `source` says where the
-- row came from, `manual` for one added in the dashboard. It has no default, so a row always says.
create table public.entitlements (
  user_id uuid not null references auth.users (id) on delete cascade,
  feature text not null,
  plan text not null,
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  source text not null,
  daily_turns integer,

  -- The primary key leads with `user_id`, so the cascade from `auth.users` has an index.
  constraint entitlements_pkey primary key (user_id, feature),
  constraint entitlements_feature_check check (feature in ('assistant')),
  constraint entitlements_plan_check check (plan in ('free', 'plus', 'unlimited')),
  constraint entitlements_daily_turns_check check (daily_turns is null or daily_turns > 0)
);

alter table public.entitlements enable row level security;

-- Set the table privileges explicitly so nothing relies on the default ones (see 0001_init.sql).
-- Start from a clean slate, then grant back only what is needed. A person reads their own plan and cannot
-- write it, so no client can raise its own limit. The service role holds the write privileges the
-- Amendment gives it. The anon role keeps nothing.
revoke all on public.entitlements from anon, authenticated, service_role;

grant select on public.entitlements to authenticated;
grant insert, update, delete on public.entitlements to service_role;

-- Owner only. The table carries `user_id`, so the policy does not join. Terms acceptance is not in the
-- policy (Amendment 9, "Privileges and row level security").
create policy "entitlements_select_own" on public.entitlements
  for select to authenticated
  using (user_id = (select auth.uid()));

-- The plan the assistant applies to a user right now. The user's unexpired `assistant` row wins, and
-- without one the answer is the free default. A row that expires at this very instant has expired.
--   * `unlimited` returns a null `daily_turns` whatever the column holds, and null means no daily cap.
--   * `free` and `plus` return the row's own limit, or 15 when the row holds none, so a null column can
--     never lift the cap by accident.
-- It is `security definer` because the service role has no select on `entitlements`, and its
-- `search_path` is empty, so it names every object with its schema. It always returns exactly one row.
create function public.assistant_access(p_user_id uuid)
returns table (plan text, daily_turns integer, source text)
language sql
stable
security definer
set search_path = ''
as $$
  with live_entitlement as (
    select
      entitlement.plan,
      case entitlement.plan
        when 'unlimited' then null
        else coalesce(entitlement.daily_turns, 15)
      end as daily_turns,
      entitlement.source
    from public.entitlements as entitlement
    where entitlement.user_id = p_user_id
      and entitlement.feature = 'assistant'
      and (entitlement.expires_at is null or entitlement.expires_at > pg_catalog.now())
  )
  select live_entitlement.plan, live_entitlement.daily_turns, live_entitlement.source
  from live_entitlement
  union all
  select 'free'::text, 15, 'default'::text
  where not exists (select 1 from live_entitlement)
$$;

-- True for the free default and for an unexpired row of that feature. The free default exists for the
-- assistant and for no other feature, so a feature with neither answers false. Today the check constraint
-- allows only `assistant`, so the `exists` branch serves features added later.
create function public.has_entitlement(p_user_id uuid, p_feature text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_feature = 'assistant'
    or exists (
      select 1
      from public.entitlements as entitlement
      where entitlement.user_id = p_user_id
        and entitlement.feature = p_feature
        and (entitlement.expires_at is null or entitlement.expires_at > pg_catalog.now())
    )
$$;

-- Only the service role may execute them. Revoking from `public` alone would leave the explicit grants
-- that Supabase's default privileges give `anon` and `authenticated`.
revoke execute on function public.assistant_access(uuid) from public, anon, authenticated;
grant execute on function public.assistant_access(uuid) to service_role;
revoke execute on function public.has_entitlement(uuid, text) from public, anon, authenticated;
grant execute on function public.has_entitlement(uuid, text) to service_role;

-- Consent to the assistant. Both columns are null until the person switches it on, so it is off by
-- default. `assistant_consent_version` holds the terms version the person saw, and the database does not
-- know which version is current. The pair is set together or cleared together.
alter table public.profiles
  add column assistant_consent_at timestamptz,
  add column assistant_consent_version text;

alter table public.profiles
  add constraint profiles_assistant_consent_paired
  check ((assistant_consent_at is null) = (assistant_consent_version is null));

-- The owner's client writes both with the client's clock, unlike the terms columns, because consent here
-- only gates the person's own use of the assistant. They go in the update grant and not the insert grant,
-- because the sign-up trigger creates the row with both null. The existing `profiles_update_own` policy
-- applies unchanged, and select is table wide.
grant update (assistant_consent_at, assistant_consent_version) on public.profiles to authenticated;

-- The page a recipe was imported from, since `recipes.notes` no longer exists. `^https?://` refuses a
-- `javascript:` address.
alter table public.recipes add column source_url text;

alter table public.recipes
  add constraint recipes_source_url_check
  check (source_url is null or source_url ~ '^https?://');

-- Written by the owner like the other recipe columns. A save goes through `save_recipe` below.
grant insert (source_url) on public.recipes to authenticated;
grant update (source_url) on public.recipes to authenticated;

-- `save_recipe` as it was (20261017020000_recipes.sql) with one addition: an optional `source_url` key.
-- A text value must start with http:// or https:// and is stored. A JSON null on create means no link,
-- and on update clears the link. An absent key on create means no link, and on update keeps the stored
-- value, as `is_archived` is kept. Anything else is refused with 22023 and a message that quotes no
-- value. The refusal comes after the checks that were already there, so a payload that failed before fails
-- with the same message now. The signature is unchanged, so the grants stay and are restated below.
create or replace function public.save_recipe(p_recipe_id uuid, p_recipe jsonb, p_ingredients jsonb)
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

  -- The link is optional. When the key is there it must be text that starts with a scheme, or null.
  if p_recipe ? 'source_url' and pg_catalog.jsonb_typeof(p_recipe -> 'source_url') not in ('string', 'null') then
    raise exception 'the source link must be text or null'
      using errcode = '22023';
  end if;
  if pg_catalog.jsonb_typeof(p_recipe -> 'source_url') = 'string'
    and (p_recipe ->> 'source_url') !~ '^https?://' then
    raise exception 'the source link must start with http:// or https://'
      using errcode = '22023';
  end if;

  -- The first write. For an update it takes the row lock that every other save of this recipe
  -- queues behind, and row level security decides whether the caller may see the row at all.
  if p_recipe_id is null then
    insert into public.recipes (name, servings, yield_grams, instructions, computed, source_url)
    values (
      p_recipe ->> 'name',
      recipe_servings,
      recipe_yield,
      array(
        select step.value
        from pg_catalog.jsonb_array_elements_text(recipe_steps) with ordinality as step(value, number)
        order by step.number
      ),
      p_recipe -> 'computed',
      p_recipe ->> 'source_url'
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
      computed = p_recipe -> 'computed',
      source_url = case when p_recipe ? 'source_url' then p_recipe ->> 'source_url' else source_url end
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

-- `create or replace` keeps the grants, and they are restated so this file says who may call it. The
-- function acts on the caller, so only authenticated holds it (the service role has no caller).
revoke execute on function public.save_recipe(uuid, jsonb, jsonb) from public, anon, service_role;
grant execute on function public.save_recipe(uuid, jsonb, jsonb) to authenticated;
