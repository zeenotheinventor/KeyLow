-- A weightless restaurant food can be a recipe ingredient, counted in portions (KEY-944, ADR 0003
-- Amendment 19). It lifts Amendment 18's rule that a food per portion is never a recipe ingredient.
--
-- A food per portion has no weight, so its ingredient row stores 0 grams and the unit portion. Both
-- rules read only the row, so they are plain checks. The old check refused 0 for every row, so it is
-- replaced by one that allows 0 when the frozen snapshot says the basis is per_portion.
--
-- A recipe with such an ingredient has no cooked weight, so `save_recipe` refuses a yield for it. It is
-- `save_recipe` as it was (20261026030000_assistant_access.sql) with that one refusal added, after the
-- yield checks that were already there, so a payload that failed before fails with the same message now.
-- The signature is unchanged, so the grants stay and are restated below. The cached `computed` stays
-- written by the client and is not verified, as Amendment 8 says. No table is rewritten and no row
-- changes: every stored ingredient has grams above 0, so both checks hold for it. A snapshot with no basis
-- reads as no per portion food, so a row of 0 grams with one is still refused.

alter table public.recipe_ingredients
  drop constraint recipe_ingredients_resolved_grams_check;

alter table public.recipe_ingredients
  add constraint recipe_ingredients_resolved_grams_check
    check (
      (resolved_grams > 0 and resolved_grams <= 100000)
      or (resolved_grams = 0 and snapshot ->> 'basis' is not distinct from 'per_portion')
    );

alter table public.recipe_ingredients
  add constraint recipe_ingredients_per_portion_is_portion_check
    check (snapshot ->> 'basis' is distinct from 'per_portion' or unit = 'portion');

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

  -- A recipe with a food per portion has no cooked weight (ADR 0003, Amendment 19): its weight is not a sum
  -- of grams, so a measured one would be false. The message states the rule and quotes no value.
  if recipe_yield is not null and exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_ingredients) as ingredient
    where ingredient -> 'snapshot' ->> 'basis' = 'per_portion'
  ) then
    raise exception 'a recipe with a food per portion has no cooked weight'
      using errcode = '22023';
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
