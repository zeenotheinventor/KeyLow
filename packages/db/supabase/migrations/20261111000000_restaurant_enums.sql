-- KEY-939, ADR 0003 Amendment 17: the two enum values restaurant foods need. Nothing else belongs in this
-- file, because a new enum value cannot be used in the transaction that adds it. The rules that use them
-- are in the next migration.
alter type public.food_source add value if not exists 'restaurant';
alter type public.nutrient_basis add value if not exists 'per_portion';
