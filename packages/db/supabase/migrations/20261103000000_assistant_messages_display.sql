-- assistant_messages.display: what the app draws under a tool result, kept beside the raw content
-- (KEY-686, ADR 0003 Amendment 14, addendum of 2026-11-03).
-- `content` holds the Messages API blocks as the model saw them, so a tool result there is only the
-- tool's model-facing text. The action card, the confirmation, the citation and the estimate reach the
-- app through the executor's structured outcome, which never reaches the model, so a conversation read
-- back later would have no card. This column keeps them. It is written by the same service role insert
-- as the message, and the existing owner-only select policy and the table grants already cover it.
--
-- It is health data, like the content next to it: a card holds foods, amounts and energy. Nothing here
-- logs a row value or raises a notice with one. The migration inserts no row and every existing message
-- starts null, so it applies to a database that holds any data.

alter table public.assistant_messages add column display jsonb;

comment on column public.assistant_messages.display is
  'On the user-role message that carries tool_result blocks: a map keyed by tool_use_id of what the app draws for that result, { card?, confirm?, citation?, estimate? }. Null on every other message. Never sent to the model.';
