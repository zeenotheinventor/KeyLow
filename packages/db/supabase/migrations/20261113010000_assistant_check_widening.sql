-- Two checks widen for the kitchen (ADR 0003, Amendment 22, which wins over any other description).
--
-- `assistant_messages.role` gains `system`: the kitchen tool group stores a `tool_addition` message with
-- that role. `assistant_usage.route` gains `recipe_generate` (a recipe suggestion or adjustment) and
-- `plan_generate` (a meal plan or a replan), the routes of the tool-less generation call, so its spend
-- shows per job in the daily view. Both new routes use the `none` transport, which the transport check
-- already allows.
--
-- Nothing else changes: no column, no grant, no policy, no row. Each check keeps its name, and adding a
-- value to a check can never fail on existing rows, so this applies to a database that holds any data.

alter table public.assistant_messages drop constraint assistant_messages_role_check;
alter table public.assistant_messages
  add constraint assistant_messages_role_check check (role in ('user', 'assistant', 'system'));

alter table public.assistant_usage drop constraint assistant_usage_route_check;
alter table public.assistant_usage
  add constraint assistant_usage_route_check
  check (route in ('describe_or_ask', 'compact', 'recipe_parse', 'recipe_generate', 'plan_generate'));
