-- KEY-939, ADR 0003 Amendment 17: the data model of restaurant foods.
--
-- A restaurant food is stored in one of two shapes. Where the chain publishes a weight, it is a `per_100g`
-- food like any other. Where it publishes none, it is `per_portion`: the nutrient columns are the values of
-- one default portion, and that portion is a count portion with no grams and no ml. Only a restaurant food
-- may be `per_portion`, and only a `per_portion` food may have a portion with no size.

-- People write foods through column grants and policies that allow only source 'user', so this check
-- is what stops them creating a per portion food. Widening it later is a new amendment.
alter table public.foods
  add constraint foods_per_portion_only_restaurant check (basis <> 'per_portion' or source = 'restaurant');

-- A portion may have a size in grams or in ml, never both, or no size at all. Whether it may have none is
-- the food's basis to say, which a check cannot read, so the trigger below holds that half. The old name
-- said "exactly one", which is no longer true, so the constraint is replaced under a name that is.
alter table public.food_portions
  drop constraint food_portions_exactly_one_of_grams_ml,
  add constraint food_portions_at_most_one_of_grams_ml check (num_nonnulls(grams, ml) <= 1);

-- A portion with no size belongs to a per portion food and only to one, and a per portion food has no
-- other kind. RLS lets people write portions on their own foods, so the check above alone would let a
-- person store a weightless portion on a food that has a weight. The trigger runs as the caller, who
-- can read the food they are writing a portion to. A food that cannot be read is a foreign key failure
-- in any case.
create function public.food_portions_size_matches_basis()
returns trigger
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  food_basis public.nutrient_basis;
  has_size boolean := new.grams is not null or new.ml is not null;
begin
  select basis into food_basis from public.foods where id = new.food_id;
  if food_basis = 'per_portion' and has_size then
    raise exception 'A portion of a food per portion has no size'
      using errcode = '23514', constraint = 'food_portions_size_matches_basis';
  elsif food_basis <> 'per_portion' and not has_size then
    raise exception 'A portion needs a size in grams or ml unless its food is per portion'
      using errcode = '23514', constraint = 'food_portions_size_matches_basis';
  end if;
  return new;
end;
$$;

-- Only the trigger runs this function, and firing a trigger needs no execute privilege, so nobody holds
-- it. `create function` grants execute to public and the Supabase default ACL grants it to the API
-- roles, so each is revoked by name. The table keeps the grants it already had.
revoke execute on function public.food_portions_size_matches_basis() from public, anon, authenticated, service_role;

create trigger food_portions_size_matches_basis
  before insert or update on public.food_portions
  for each row
  execute function public.food_portions_size_matches_basis();
