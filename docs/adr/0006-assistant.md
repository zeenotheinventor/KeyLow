# 0006: The assistant: tools, Ki-Lo's own MCP host and client, guards, models and compaction

## Status

Accepted when the pull request that carries it merges. Written on 2026-10-26 under KEY-662, part of KEY-185 (the M8 brief). The tables, columns and functions it needs are in ADR 0003, Amendment 14. Every M8 migration waits for both documents. Amended on 2026-11-07 under KEY-883, part of KEY-881 (the brief for weight training): see Amendment 1 at the end. Two decisions in it were taken by the orchestrator while Zee was away, for his review, and are marked as such.

## Context

M8 adds an assistant to Ki-Lo. A person types what they ate, asks about their own diary, pastes a recipe link, or asks for a change, and the assistant reads and writes the person's own data through a small set of tools. It adds tables and columns, two Edge Functions (`assistant` and `mcp`) and a tool layer. ADR 0003 says a new table needs an amendment before its migration, and the architecture of the tool layer (one tool definition, one executor, the guards, compaction) is a decision that engineers must not re-derive per ticket. This ADR freezes the decisions, and Amendment 14 freezes the data.

Sources, in authority order: KEY-185 with its Amendment 1 (2026-10-23) and Amendment 2 (2026-10-25, sections A to H, which overrides Amendment 1 where they conflict), Zee's answers to Q1 to Q13 on KEY-662 (2026-10-25), ADR 0003 (Amendment 13 is the layout Amendment 14 copies), ADR 0004 (scrubbing), `AGENTS.md`, the M8 plan, and the API reference files the tickets cite. Where a lower source disagrees with a higher one, the higher one is followed.

Out of scope for M8: photo logging, voice input, push notifications or proactive messages, a general chat app or any other external client as a user of Ki-Lo's tools, fine-tuning, coaching features for other people, billing, and web assistant screens (they belong to the MWEB milestone). The coaching tools and the Opus 5.5 route wait for M6 and are not part of this ADR's build. Weight training is in scope from Amendment 1, which also says what stays out.

## Decision

### Host and client (Q1)

The `assistant` Edge Function is the MCP host. It holds the Anthropic key, and the `mcp` function reads the key for the tool-less `recipe_parse` calls only. On each turn it connects to the `mcp` Edge Function as an MCP client (the MCP TypeScript SDK, Streamable HTTP, inside Supabase) with the user's JWT in the `Authorization` header and the turn id in the URL. It lists the tools, hands them to the Messages API as ordinary client tools (`strict: true` unless a tool opts out to stay inside the API's caps, in a fixed order so the prompt cache holds), runs every `tool_use` through the client's `callTool`, feeds the results back, and loops until the model ends its turn.

- The user's JWT never leaves Supabase. Nothing reaches Anthropic except the model request itself.
- There is no `mcp_servers`, no `mcp_toolset` and no `mcp-client-2025-11-20` beta anywhere. The Messages API MCP connector is not used.
- This amends KEY-185 Amendment 1 section B. The tools stay an MCP server used in the app only, reached by Ki-Lo's own client instead of Anthropic's connector, and the connector and in-process fallback sentences of that section are replaced.
- Publishing the server (a connector, a directory listing, OAuth) is out of scope for M8 and not built. Zee: "just door 1".
- Why: Zee asked whether the token had to go to Anthropic at all, and with the connector it must. Running the client ourselves removes the question, and it keeps Ki-Lo independent of one model. Zee: "It also kinda keeps us agnostic of the model."

### One tool definition, one executor, a model-agnostic boundary

Each tool lives in one file under `packages/db/supabase/functions/_shared/assistant/tools/`: its name, its description, a zod input schema rendered to a strict JSON Schema with `additionalProperties: false`, its MCP annotations (`readOnlyHint`, and `destructiveHint` where it applies), its `run`, and for a write its `inverse` for Undo. `registry.ts` lists the tools in a fixed order, and `executor.ts` is the only code that runs a tool. The `mcp` function publishes the JSON Schema and calls the executor.

- The MCP client knows no model API. One adapter per model API turns the listed tools into that API's tool shape (`_shared/assistant/adapters/anthropic.ts` today), so another model needs its adapter and its loop, and nothing in the tools changes.
- `tools/call` answers the executor's minimised, wrapped text (what the model reads) and the structured outcome as `structuredContent` (card, citation, estimate, `needs_confirmation`, status hint). Only the turn loop reads the structured outcome, to build the app's events.
- The tools in M8 (35 with Amendment 1, which inserts the training tools before `ask_user`, in a fixed order, the one it lists):

| Kind                     | Tools                                                         | Built by |
| ------------------------ | ------------------------------------------------------------- | -------- |
| Read, diary              | `get_day`, `get_range_totals`, `get_entries`, `get_weigh_ins` | KEY-690  |
| Read, foods and recipes  | `search_foods`, `get_food`, `get_recipes`                     | KEY-671  |
| Read, no database        | `ask_user` (the model's one way to ask a question)            | KEY-682  |
| Write, diary             | `log_entry`, `update_entry`, `delete_entry`                   | KEY-688  |
| Write, days              | `copy_day`, `set_day_complete`                                | KEY-693  |
| Write, recipes           | `create_recipe`, `update_recipe`, `archive_recipe`            | KEY-694  |
| Write, foods and targets | `create_custom_food`, `update_targets`                        | KEY-697  |
| Fetch and write          | `import_recipe_from_url`                                      | KEY-698  |
| Read, training           | `search_exercises`, `get_routines`, `get_training_goals`      | KEY-890  |
| Read, training           | `get_workouts`                                                | KEY-891  |
| Read, training           | `get_exercise_progress`                                       | KEY-892  |
| Read, training           | `get_muscle_state`, `suggest_next_session`                    | KEY-893  |
| Write, routines          | `edit_routine`                                                | KEY-902  |
| Write, routines          | `set_active_routine`, `archive_routine`                       | KEY-903  |
| Write, routines          | `create_routine`                                              | KEY-920  |
| Write, training goals    | `update_training_goals`                                       | KEY-904  |
| Write, exercises         | `save_custom_exercise`, `archive_custom_exercise`             | KEY-905  |
| Write, past workouts     | `update_past_set`                                             | KEY-906  |
| Write, past workouts     | `delete_workout`                                              | KEY-907  |

- Every write is a thin call over the existing api-client repositories, bundled for Deno (KEY-669), under the user's JWT, so row-level security and the snapshot rules apply exactly as when a finger does it. The model never receives a service-role key and never writes free SQL.

### One transport everywhere, and retries

Local, CI, evals and production all use the HTTP path through the real `mcp` function, so what the tests and evals prove is what people get. The in-process executor path stays only for the tools' own unit tests. Anthropic is mocked in every pull-request test (`ANTHROPIC_BASE_URL` pointed at a mock, as `OFF_BASE_URL` is), and the live API is used only by the eval runner, started by hand.

A failed step is retried once only when no tool could have run, so a write is never repeated:

- Connect, initialise and `listTools` failures retry once.
- A read call retries once when the turn has no `assistant_actions` row.
- A write call never retries.
- Anything else ends the turn with the `turn_failed` notice and the turn status `failed`.

Every tool step now round-trips from `assistant` to `mcp` and back. KEY-682 measures wall-clock and CPU time per step against the Edge Function limits, with a ten-write turn as the worst case.

### What the `mcp` function trusts

The function is reachable from the internet like every Edge Function, so it does not trust its caller because of who the caller is meant to be.

- It verifies the JWT, then loads the turn named by `?turn=<uuid>` with the service client, and refuses unless the turn belongs to that user, is open (`assistant_turns.status` is `open`), and is under 5 minutes old. A bad JWT or a turn that fails those checks is a 401, and a missing turn id is a 400.
- These checks stop a stolen URL or token from running tools outside an open turn of that user.
- Every tool runs under the caller's JWT, so row-level security scopes each result by construction. A cross-user case is proved at the RLS layer in two-user tests, not by the model's refusal.
- The turn's tool allowlist travels in the `X-Kilo-Allowed-Tools` header (next section). `tools/list` is never filtered per turn.
- The turn's day and time travel in `X-Kilo-Local-Date` (required, a malformed one is a 400) and `X-Kilo-Local-Time` (optional), and `tools/list` carries each tool's `_meta["kilo/strict"]` (KEY-688, 2026-11-03).

### Two prompt-safety rules

These come from the health-data rules in `AGENTS.md`.

**(a) A per-turn tool allowlist, chosen in code.** Before the model runs, code picks the set from the user's message. It is never a model call.

- A URL in the message gives the recipe-import set: `import_recipe_from_url`, the food reads (`search_foods`, `get_food`), `create_recipe` and `ask_user`. This set, which is wider by `get_food` and `ask_user` than the three tools KEY-185 Amendment 2 A names, is an orchestrator decision, 2026-10-26.
- A question with no write word gives the read tools plus `ask_user`.
- Anything else gives every tool except `import_recipe_from_url`.
- A pending confirmation from the previous turn adds its own tool, when the person's message is the words of its confirm button.
- The sets derive from the tools' annotations, so a tool added later lands in the right set with no edit. When in doubt the rules fall to the general set, which still has every executor guard.
- The turn loop refuses a `tool_use` outside the set (the model gets `tool_not_allowed`), and the executor in the `mcp` function refuses it again from the header. The `tools` array sent to the model never changes per turn, so the cache prefix holds.

**(b) Minimisation at the chokepoint.** No model request carries the user id, the email or any profile field (sex, age or date of birth, height). The turn loop builds every request in one place and holds only today's date, the time zone and the day the sheet was opened on. Tool results carry only the columns and rows the task needs. The executor also strips a deny-list of keys before wrapping a result, as a backstop and not as the first defence.

### Guards

- A turn exists only because a user sent a message. The `assistant` function creates the `assistant_turns` row with the id of that message, and no code path starts a turn otherwise (no schedule, no continuation). Writes therefore happen only in response to the user's own message, never as a continuation triggered by fetched content.
- At most 10 write tool calls per turn, enforced by a reservation. Before a write the executor inserts an `assistant_actions` row with a `turn_seq` from 1 to 10 under a unique key on `(turn_id, turn_seq)`, so parallel tool calls cannot pass 10. The write runs, the row gets its target, and a failed write releases the slot. The slots count calls and not rows: a `copy_day` of a whole day, or a `delete_entry` that names several ids, takes one slot whatever the row count, and the row names what it changed in `target_id`, `target_ids` or `target_local_date`. Orchestrator decision, 2026-10-26, built by KEY-665 (the columns) and KEY-693 (`copy_day`).
- **Undo (orchestrator decision, 2026-10-26).** `assistant_actions` holds ids and one date and never a value (KEY-185 Amendment 1 A), so Undo restores only what an id can restore. `log_entry` and `copy_day` Undo delete what they created. `delete_entry` Undo uses the existing `restoreLogEntry`. `create_recipe` Undo archives the recipe. `archive_recipe` Undo unarchives it. `create_custom_food` Undo soft-deletes the food (`softDeleteFood`, KEY-697). `set_day_complete` records an action only when the call changed the day's state, and its Undo flips it back. `update_targets` Undo is offered only when a programme was active: it writes the previous numbers back to the profile and reopens the programme, whose targets row is unchanged (`reopenProgram`, which KEY-697 builds, nothing exists today). With manual targets and no programme the previous numbers are stored nowhere, so the card sends `undo: 'unavailable'`. `update_entry` and `update_recipe` have no Undo in M8, because the previous values are not stored and the diary's own edits have no Undo either. Their cards send `undo: 'unavailable'` with a line saying the change can be edited in the diary or the recipe editor. Flagged to Zee, who may ask for Undo on edits later, which would need a stored previous-value snapshot. This paragraph is about food and the diary. The training writes are different, and Amendment 1 gives them an Undo that restores a previous value kept in `assistant_messages.display`. `update_entry` and `update_recipe` stay as they are.
- A confirmation protocol for destructive and bulk writes. The four cases of KEY-185 Amendment 1 A are deleting more than one entry, archiving a recipe, copying a whole day over a day that already has entries, and changing targets. Amendment 1 of this ADR adds the training cases. The first call answers `needs_confirmation` and stores the confirmation on the turn (`assistant_turns.pending_confirmation`). The call that acts is a call from a later turn of the same conversation with the same tool and the same input, so a confirmation can only be spent after a new user message. The model is told to pass the confirmation's id, and an id that is sent must be the one issued for that call. A tool may add a line of its own after the model's question (the `note` of its `needsConfirmation` answer, added by the turn loop), because the model words the question in the same response as the call, before the tool has answered, and so cannot know figures only the tool works out. A confirmation is spent only when the person's own next message is the words of the confirm button, compared in code with the words stored on the pending confirmation, and not because the model sent its id: a call with the same tool and the same input as the pending confirmation is confirmed by those words with or without the id. A wrong id is refused whatever the words. A different tool or input, with or without an id, is never spent: with an id it is refused, and without one it is a fresh question for that call. Any other answer asks again with a new confirmation and the buttons drawn again, so a model that misreads an answer, or text inside a tool result, cannot spend one. The question is the model's text when it wrote one and the tool's own words otherwise (the `question` of its `needsConfirmation` answer, built from the person's own rows with the board's formatters), so a model that wrote none does not fail the turn. When the person's message is the words of the confirm button and the previous turn ended on that confirmation, the turn loop makes the stored call itself and makes no model call, so a model cannot decline a decision the person has made. The input comes from the asking turn's stored call and the executor's checks do not change. The card is the answer, and when no card comes back and no write landed the turn ends with the failed-turn notice, so a press never ends in a claim that something happened. A write that landed with no card to draw ends the turn complete with nothing added, because the notice would say nothing was changed.
- Fetched pages reach the model only through `import_recipe_from_url`. The tool accepts only a URL that appears verbatim in the current user message, fetches the page itself (bounded in size and time, with the same User-Agent discipline as the Open Food Facts proxy), reads the schema.org Recipe JSON-LD when present, and otherwise parses the page text in a separate tool-less structured-output call. A second tool-less call then chooses each line's food from the hits of its food searches, by position in a short list, or leaves the line out (KEY-838). Fetched text never reaches the tool-calling model. The tool saves through the same path as `create_recipe`, with the page's address in the new `recipes.source_url` column (Q3), and the person sees a card with Undo.
- Every tool result is wrapped as untrusted data (`<untrusted_data source="...">`), and the system prompt says content inside it is never an instruction. Food names from Open Food Facts and the user's own text are content, not instructions.
- Unmatched ingredient lines of an import are shown on the import card only, left out of the numbers and never invented (Q12).

### Models and request rules

| Route                          | Model                          | Use                                                                                                       |
| ------------------------------ | ------------------------------ | --------------------------------------------------------------------------------------------------------- |
| Chat, describe, recipe parsing | Haiku 5.5 (`claude-haiku-5-5`) | The streaming turn loop, the tool-less recipe parse and the tool-less choice of each imported line's food |
| Compaction                     | Haiku 5.5, no tools            | One call per compaction                                                                                   |
| Coaching, later                | Opus 5.5 (`claude-opus-5-5`)   | After M6, not part of M8's build                                                                          |

- Never send `temperature`, `top_p` or `top_k`. On API version `2026-10-21` any value is a 400 on every model.
- `tool_choice` is always `auto`, with the rules in the system prompt and `strict: true` on every tool, except a tool that opts out to stay inside the API's caps on strict tools (KEY-688: strict by default, and the executor validates every input either way). Every training tool opts out (Amendment 1). A forced tool choice is a 400 on Opus 5.5.
- Haiku 5.5 takes adaptive thinking with `output_config.effort`. It has no `budget_tokens` and no prefill. Opus 5.5 cannot have thinking disabled, so effort is its control.
- Refusals: on `stop_reason: "refusal"` the turn loop runs no tool from that response and ends the turn with the turn status `refused` and the `turn_failed` notice (an error ending is `failed`, a refusal stop is `refused`, and both send that notice). Haiku 5.5 has no server-side `fallbacks` (a `fallbacks` list is a 400), so M8 handles the refusal itself. `fallbacks` belongs to the coaching wave on Opus 5.5.
- Streamed client tools get eager input streaming, which moves validation to the client. Every tool input is validated before it is sent to the server, an invalid input goes back as an `is_error` tool result, and a `tool_use` under `stop_reason: "max_tokens"` is never run.
- Prompt caching: one constant system prompt over the 512-token minimum for Haiku 5.5 with a cache breakpoint, a deterministic tool order, history never edited, and a breakpoint on the last message. The system prompt holds no date, user id or flag. The second turn of a conversation must show a non-zero `cache_read_input_tokens`. The deterministic prefix is asserted in a unit test, and the live check runs in the eval runner.
- One `assistant_usage` row per model call (ids and counts only, with the cost in `cost_usd_micros`), so spend and the cost view come from one table. The routes are `describe_or_ask` for a turn's calls, `compact` for a compaction call, and `recipe_parse` for the tool-less parse of a fetched recipe page and for the tool-less choice of each imported line's food. The last two use transport `none` (orchestrator decision, 2026-10-26).

### Access order, quota, ceiling and kill switch

Every turn passes these checks in this order, and each failure is its own typed notice code of the app contract (KEY-678): the kill switch (`switched_off`), consent (`consent_needed`), entitlement (`plus`), daily turns (`day_limit`), monthly spend (`resting`).

- **Kill switch (Q5).** The function secret `ASSISTANT_DISABLED`, unset meaning on. It moves to a feature flag when Ki-Lo has flags. The monthly cap stops spending, not behaviour, so the switch covers an injection, a privacy problem or an Anthropic outage that runs on under budget.
- **Consent (Q8).** The assistant is off by default for every account. The check reads `profiles.assistant_consent_version` through `isAssistantConsentCurrent` before any model call. The Privacy Policy names Anthropic as a processor, and `TERMS_VERSION` is bumped for it (KEY-663). Since Amendment 1, consent is versioned on its own with `ASSISTANT_CONSENT_VERSION`, and every account accepts again.
- **Entitlement and plan (Q7).** `assistant_access` returns the effective plan and its limits. The free plan is 15 turns a day. A row wins, and without one the user is on the free plan. `entitlements.plan` is `free`, `plus` or `unlimited`. `unlimited` has a null `daily_turns`, and null means no daily cap: the function skips the per-user daily counter for that user, while consent, the kill switch and the monthly ceiling still apply. Zee grants unlimited access with one dashboard row (`source` `manual`), and an expired or removed row falls back to the free plan. A non-null `daily_turns` on a `free` or `plus` row is that row's own limit, and null on such a row means 15, so only `unlimited` has no cap (orchestrator decision, 2026-10-26).
- **Daily turns (Q4, Q7).** `consume_rate_limit('assistant:turns:<user id>', limit, 86400)`. The window is a UTC day, because `consume_rate_limit` bins windows from the epoch, so free turns come back at midnight UTC (1 am during British Summer Time). The shared function is not changed. The notice carries the reset instant and the app words it in the user's time zone.
- **Monthly spend (Q4).** `assistant_spend_this_month()` sums `cost_usd_micros` over the calendar month in UTC. The cap is read through `readLimit('ASSISTANT_MONTHLY_CAP_USD_MICROS', 10000000)`, a tunable default of USD 10. It stays below the tripwire: a Ki-Lo workspace in the Anthropic Console, which issues both keys, with a workspace spend limit of USD 20 (Zee, setup step 2, 2026-10-25, KEY-185 Amendment 2 D). `consume_rate_limit` counts hits and cannot sum money, which is why spend is a sum over `assistant_usage` and not a counter.

### Amounts (Q10)

The assistant uses a food's own portions where they exist ("2 large eggs (100 g)") and plain grams otherwise ("150 g rice"). There are no hand measures (fist, palm, cupped hand, thumb) and no conversion table. A food with no fitting portion and no amount from the person gets one question asking for grams, never a guess.

No amount carries the Estimate label, with one exception that is recipe import only (Amendment 1 C.3 stands for it, Zee 2026-10-25): a vague ingredient line ("a splash of milk") whose food matches gets a guessed quantity with the Estimate label, saved like any other quantity, with no schema change. Only the import tool sets a card row's `estimate` flag, and nothing is stored on ingredients. The label otherwise stays where it means a model estimate, such as the trend weight in an answer.

### Conversations, export and account deletion (Q11)

- Conversations are stored per user in `assistant_conversations`, `assistant_turns` and `assistant_messages`. A message holds the raw Messages API blocks, so the next turn replays history unchanged for caching. Rows are owner-readable and written only by the `assistant` function's service client, filtered by the verified user.
- The app shows one running conversation, with "New conversation" and "Delete all conversations" in Settings and no list. Deleting a conversation hard-deletes it with its turns and messages, and `assistant_actions.conversation_id` becomes null so "What the assistant changed" keeps its rows.
- Account deletion works because every new user table cascades from `auth.users`.
- Conversations are included in the data export and in account deletion (Zee, 2026-10-25). No export feature existed or was ticketed (KEY-7 does not cover it and M7 is optional), so Zee asked for a whole-account export built in M8, last: KEY-707 (the data, built on the client under the user's JWT) and KEY-708 (the Settings screen, which saves the file to a folder the person picks on Android). The assistant settings get no separate export row. Until it ships, conversations are within the privacy policy's manual export and deletion path (KEY-136). The words "Build a whole-account data export in M8, conversations included" are quoted in KEY-185 Amendment 2 C, and they supersede the round 3 comment on KEY-662 ("M7 builds the export, no export button in M8").

### Compaction (Q13)

Every turn sends the whole conversation to the model again, so a long one costs more on every turn, gets slower, and would one day not fit. Ki-Lo does its own compaction (KEY-706) and does not use the API's compaction beta, so it stays independent of one model's features. What Zee ruled (Q13) is Ki-Lo's own compaction above about 20,000 tokens (raised to 40,000 on 2026-11-07, KEY-927, see the last Consequences bullet of Amendment 1). Simple compaction, running only after a `complete` turn, and the replay shape below are the engineers' recommendation (plan 2.9, KEY-706), not Zee's ruling.

- When: after a turn that ended `complete`, if that turn's last model call had more than `readLimit('ASSISTANT_COMPACT_AT_TOKENS', 40000)` prompt tokens (20000 until 2026-11-07, KEY-927) (`input_tokens` plus the two cache fields). It never runs after a `clarify` or `confirm` turn, and never in the middle of a tool round.
- How: one tool-less Haiku 5.5 call writes a note of what a food diary and training conversation needs (foods logged with amounts and days, the dates discussed, answers given, open questions, corrections and undos, and from Amendment 1 the training facts of the conversation, nothing else). The note is stored in `assistant_conversations.compaction_summary` with `compacted_through_turn_id`, in the background with a compare-and-set on `updated_at`. The call writes an `assistant_usage` row with route `compact` and transport `none`, so it counts toward the monthly spend.
- Replay: the note, wrapped in `<conversation_summary>`, is the first block of the first user message after the compaction point, followed by the turns after it. The system prompt and tools do not change, so their cache still hits.
- Simple compaction, not keep-tail: no turn from before the note is replayed, because thinking blocks made with the full history would break the API's history check on Haiku 5.5. The full thread stays on screen and in the tables, and the app never shows the note.

### Semantic food search is deferred

Semantic food search (pgvector, embeddings and `search_foods_hybrid`) is deferred to Housekeeping (Zee, 2026-10-25, KEY-185 Amendment 2 H) and gets no column in Amendment 14 and no decision here. The assistant resolves foods with the existing `search_foods` (full text plus trigram), retrying once with other words before it asks, and never guesses.

### Evals

The eval suite stays as the acceptance mechanism and runs on demand only (Q2, Q9). The workflow has `workflow_dispatch` and no `pull_request` trigger, with a budget of 300,000 tokens per run. It runs in the GitHub environment `assistant-evals` (no branch rule), which holds the second key `ANTHROPIC_EVAL_API_KEY`, and never in `production`, whose branch policy allows `main` only. Both Anthropic keys are issued from the Ki-Lo workspace in the Anthropic Console. The thresholds are 90% on ask-your-data, 80% on describe-to-log first pass, and 100% on the red-team set. The eval user and its diary are synthetic and committed, and the live API is used only here. The replay set built from real corrections is deferred (Q6), because it conflicts with two standing rules (no health data in committed fixtures, and no production queries). Undo is recorded in `assistant_actions.undone_at`, so the signal is not lost. Amendment 1 adds the training sets, their thresholds and a regression rule.

### Health data and logs

Conversation text, tool results, the compaction note and an action's target are health data. They are owner-only under RLS and are never written to a log, an error message, a Sentry event or an analytics event. The functions log user ids, counts, durations and codes only. The Edge reporter of ADR 0004 already rebuilds an event from an allow-list with no message text, and the assistant functions use it. `assistant_actions` holds ids and one diary date, and `assistant_usage` holds counts, and neither holds a health value.

## Zee's answers, 2026-10-25

All thirteen are answered, and none is pending. Q1 is shown as superseded by the round 2 answer.

| Question                            | Answer                                                                                                                                                                      | Where in this ADR                                                    |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Q1, the token through Anthropic     | Superseded in round 2: Ki-Lo runs its own MCP client, the connector is not used, the user's JWT never leaves Supabase                                                       | Host and client, One tool definition, What the `mcp` function trusts |
| Q2, evals in CI                     | On demand only (`workflow_dispatch`), 300,000 tokens per run                                                                                                                | Evals                                                                |
| Q3, the imported recipe's link      | A new column, `recipes.source_url`                                                                                                                                          | Guards (import), and Amendment 14                                    |
| Q4, the monthly ceiling             | Turns through `consume_rate_limit()`, spend as a sum over `assistant_usage` against the USD 10 default, below the Console workspace limit of USD 20 (KEY-185 Amendment 2 D) | Access order                                                         |
| Q5, the kill switch                 | The function secret `ASSISTANT_DISABLED` now, a feature flag later                                                                                                          | Access order                                                         |
| Q6, the real corrections replay set | Deferred past M8                                                                                                                                                            | Evals                                                                |
| Q7, the free quota                  | 15 turns a day, plus the `unlimited` plan                                                                                                                                   | Access order                                                         |
| Q8, the privacy policy              | Bump `TERMS_VERSION`, and the policy names Anthropic                                                                                                                        | Access order (consent), Consequences                                 |
| Q9, the eval key's home             | The GitHub environment `assistant-evals`, key `ANTHROPIC_EVAL_API_KEY`, never `production`                                                                                  | Evals                                                                |
| Q10, hand measures                  | None. Food portions or grams, one question for grams, no Estimate on amounts except recipe import's vague lines                                                             | Amounts                                                              |
| Q11, export                         | Conversations in the data export and in account deletion. A whole-account export is built in M8, last (KEY-707, KEY-708)                                                    | Conversations, export and account deletion                           |
| Q12, unmatched import lines         | On the import card only                                                                                                                                                     | Guards                                                               |
| Q13, conversation length            | Ki-Lo's own compaction above about 20,000 prompt tokens (40,000 from 2026-11-07, KEY-927)                                                                                   | Compaction                                                           |

## Consequences

- Nothing in the tools knows a model API, so a second model needs an adapter and a loop, and the tools are described once.
- Every tool step adds a hop from `assistant` to `mcp`. The cost is time per step, measured by KEY-682 against the Edge Function limits.
- The tool allowlist is chosen by word lists in code. A message the lists misjudge falls to the general set, which still has the executor's guards, so the failure is a wider set and not a missing guard.
- The monthly spend check runs before a turn, so one turn can end above the app cap. The Console workspace limit is the tripwire behind it. Deleting an account deletes its `assistant_usage` rows, which lowers the month's sum by that user's share.
- Health data now reaches a third party, Anthropic, as a processor. The policy names it, `TERMS_VERSION` moves on (KEY-663), and every account is asked again. Amendment 1 moves it on again, for training, and every account is asked again.
- Evals cost money and run only when someone starts them. A change to the prompt, the tools or the loop is therefore proved by hand before a release, not on every pull request.
- ADR 0003, Amendment 14 holds the tables and columns. A change to a name in either document goes back into both in the same pull request.

## Implemented by

- KEY-663, the privacy copy and `TERMS_VERSION`.
- KEY-664, KEY-665 and KEY-666, the three migrations of Amendment 14.
- KEY-669 (the repositories bundled for Deno), KEY-670 (the registry, the executor, the slots and the confirmation protocol), KEY-671 (the food reads), KEY-674 (the `mcp` function) and KEY-675 (the MCP client module and the Anthropic adapter).
- KEY-676 and KEY-698, recipe fetch and import.
- KEY-678 (the shared contract), KEY-681 (the `assistant` function and its gates) and KEY-682 (the turn loop).
- KEY-688, KEY-690, KEY-693, KEY-694 and KEY-697, the diary and day tools, the recipe tools, and the food and target tools.
- KEY-706, compaction.
- KEY-707 and KEY-708, the whole-account export.
- KEY-677, KEY-699, KEY-700, KEY-701 and KEY-702, the eval harness and its four sets.
- KEY-703, the exit gate.

## Amendment 1 to this ADR: weight training (2026-11-07)

### Status

Recorded on 2026-11-07 under KEY-883, part of KEY-881 (the brief: "the assistant helps with weight training, advice first, then edits with cards and Undo"). Zee saw the plan and accepted its recommendations on 2026-11-07 ("Yes I accept the recommendations"). Where this amendment and the text above disagree, this amendment wins, and the text above carries a pointer at each place. Every decision here is Zee's unless it is marked as taken by the orchestrator. Two decisions came after he accepted the rest, so they are marked below. Decided by the orchestrator while Zee was away, for his review. His answer would change these lines only.

- **Decided by the orchestrator, days of an existing routine:** adding a day, and renaming or moving one, join `edit_routine`. Removing a day stays in the app.
- **Decided by the orchestrator, how a routine is built:** the numbers come from the goal presets, the model chooses the structure, a build shows a card with Undo and asks nothing first, and a built routine never becomes active.

This amendment adds no table, column or migration. The tables and columns it uses are in ADR 0003, Amendment 14, and its addendum of 2026-11-07 records the two sentences of that amendment that change.

### Scope

- The assistant now also helps with weight training: it reads the person's workouts, exercise progress, routines, training goals, muscle recovery and volume and the next-session suggestion, and it changes routines, training goals, custom exercises and past workouts, each change with a card and Undo, like food.
- The prompt's Limits rule (`prompt.ts`) widens from "food, the diary, recipes, weigh-ins and targets" to include weight training. The compaction prompt keeps training facts as well as food facts, because otherwise they would be dropped from the note. KEY-894 changes both for advice, and KEY-908 changes the prompt for changes and for building.
- The medical rule is unchanged and applies to training. The assistant gives no diagnosis and no rehab plan, and for an injury or pain it suggests a doctor or a physio, the same as for medical questions about food. It can still swap an exercise when asked.
- It cannot start a workout and it cannot accept a suggestion. It can build a routine.
- Numbers come from Ki-Lo's own calculations (`muscleState`, `suggestSession`, `exerciseWeeklyTrend`), and the model explains them and never invents its own. Ki-Lo has no calculation for what weight to lift next, so "how much should I bench next?" is answered from the last performance and the trend and gets no new number.
- Still out of scope: the nutrition coaching wave (section 8 of `M8-PLAN.md`, separate and unfiled), the web assistant (KEY-914 stays in Backlog and nothing is filed, because the assistant is deliberately not on the web, KEY-877), and any model other than Haiku 5.5.

### Tools: 35 in all

The registry has 19 tools today (16 strict and 3 that opt out: `log_entry`, `update_recipe`, `create_custom_food`). Amendment 1 inserts 16 before `ask_user`, in this fixed order. The tools array stays constant per turn. `ask_user` moves, so the first deploy costs one cache write (see Consequences).

| Kind  | Tools, in order                                                                                                                                                                            | Built by                                                      |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| Reads | `search_exercises`, `get_workouts`, `get_exercise_progress`, `get_routines`, `get_training_goals`, `get_muscle_state`, `suggest_next_session`                                              | KEY-890, KEY-891, KEY-892, KEY-893                            |
| Write | `edit_routine`, `set_active_routine`, `archive_routine`, `create_routine`, `update_training_goals`, `save_custom_exercise`, `archive_custom_exercise`, `update_past_set`, `delete_workout` | KEY-902, KEY-903, KEY-920, KEY-904, KEY-905, KEY-906, KEY-907 |

- The reads land in the read allowlist by their annotations, with no edit to the allowlist code.
- **`strict: false` on all 16, and why.** The API caps the strict tools of one request at 20 tools, 24 optional parameters and 16 union parameters. The 16 strict tools of today use 14 of the 16 union parameters (a nullable or a `confirmation_id` counts as a union), so two are left and 16 more tools would not fit. After Amendment 1 there are 16 strict tools and 19 that are not (the 3 above and the 16 new). The executor validates every input with zod either way. The rule for the tickets: `strictBudgetOf` stays at 16 tools, 0 optional and 14 union parameters, and no tool ticket changes it.
- **`edit_routine`** takes a `routine_id` and a list of small changes (add, swap, remove, set targets, and the day changes of the decision above), at most 10 changes a call. The tool reads the routine, applies the changes in core (`applyRoutineChanges`, KEY-888), validates with `validateRoutineDraft` and saves through `saveRoutine`. So the model never retypes a routine and cannot lose a line, an edit made in the app a moment earlier is kept, and "swap bench for incline and drop squats to 3 sets" is one action, one card and one Undo. The schema has no union.
- **Days of an existing routine (decided by the orchestrator).** Adding a day, and renaming or moving one (its name and weekday), are changes of `edit_routine`, with Undo through the same fingerprint. Removing a day stays in the app, because it unlinks the sessions logged from it and Undo cannot relink them: a day added back gets a new id. The first version of the brief had `edit_routine` add and remove no day at all, and building a routine with its days was `create_routine`.
- **`create_routine`** saves through `saveRoutine` with `id: null`, takes one write slot whatever its size, takes at most 7 days and 8 exercises a day, and uses a plain builder and not `applyRoutineChanges`, because no day exists yet. Every exercise is a real id read back under the caller's JWT, and the schema has no field for a new exercise. Its result never echoes the routine and stays under 2,000 characters at the largest. A four-day build may need 20 or more searches under the turn's 100 second deadline, and KEY-920 measures it.
- **A built routine's numbers (decided by the orchestrator).** `GOAL_PRESETS_V1` already holds them and `pickExercises` uses them for every suggestion: reps and target RIR by goal and the exercise's mechanic, and sets by experience. So `create_routine` has no field for a number and the model cannot choose one. Core gives each day's sets and minutes and the week's sets (KEY-919). The model chooses the structure: the name, the day names, the weekdays, which real exercises and their order. Core has no calculation for a split or for balance across the week, and `suggestSession` plans one session from today's heat, so balance across the week is not checked. The presets were agreed on KEY-396 for suggested exercises, and this widens their use. The person sees the numbers on the card and changes them by asking (`edit_routine`, with numbers they say) or in the routine editor. With no training goal the tool saves nothing and the assistant asks for one. It shows a card with Undo and asks nothing first, because nothing is lost. It never becomes active, and `set_active_routine` is its own action with its own card and Undo.
- **Output caps.** `get_workouts` takes at most 42 days and answers at most 20 sessions, one summary line per exercise, and for one `session_id` at most 60 sets with `truncated: true` beyond that. `get_exercise_progress` answers trained weeks only. `get_routines` with no id lists at most 20 routines with no exercises. `get_muscle_state` answers one row per muscle. A load is given as words in the person's unit ("62.5 kg"), so the model converts nothing. Session notes reach the model inside the untrusted wrapper, and set snapshots never do. `update_past_set` changes one set per call, so a partial failure cannot leave a landed write that looks failed. The existing caps stand: 10 write calls a turn.
- **Confirmations.** Anything destructive asks first, such as deleting a session or archiving a routine. A routine edit asks first only when one call removes more than one exercise (Zee). The ticket of each write names any further case, and the case joins the confirmation protocol above.

### The workout rule

The assistant cannot change a workout in progress, and it can still give advice during one (Zee). The rule lives in the executor and not in the prompt.

- A write tool sets `refusesDuringWorkout: true`. The executor reads `getActiveSession` under the caller's JWT before it asks for a confirmation and before it runs, and answers `workout_in_progress` with no slot taken. `undoAction` checks the same before it takes its claim. So the model, a stale confirmation pressed after a session started, and a direct `mcp` call are all refused. A registry test fails if a training write leaves the flag off. Reads are never refused. If reading the session fails, the call fails closed with `tool_failed` and nothing is written.
- **All 9 training writes**, wider than the ruling's words, because goals, custom exercises and a newly built routine do not strictly touch the live workout. One rule the person can be told in a sentence (Zee).
- `update_past_set` and `delete_workout` also refuse a target whose `ended_at` is null, in the tool. A finished session never reopens, so that check cannot be raced.
- **The one window the plan accepts.** A session started a moment after the guard passes can still meet an `edit_routine` that is already running. Closing it needs a lock inside `save_routine`, which is a migration. The consequence is that the edit changes the routine of a session that has just started. The person would have to press Start in the same instant, so it is accepted. `undoAction` of an `edit_routine` checks before it claims and then restores through the same `saveRoutine`, so it shares the window.

### Undo for training

This replaces the food paragraph's statement that edits have no Undo, for training edits only. What each write restores, and when Undo answers `undo_unavailable` and writes nothing:

| Write                     | Undo                                                                                                                                                                                                                                           | Unavailable when                                                                                                                                                                                                      |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `edit_routine`            | The whole routine as it was just before the edit: name, days, weekdays, exercises, order, sets, reps, target RIR. Days the routine already had keep their ids, so logged sessions stay linked. A day the edit added is removed by the restore. | The routine's fingerprint differs from the one the edit left (a later edit is never overwritten), or a workout is logged from a day the edit added, because the restore would remove that day and unlink the workout. |
| `set_active_routine`      | Makes the previous routine active again, or none. `activated_at` is stamped again by its trigger, so the plan counts from the Undo.                                                                                                            | Another routine is active now.                                                                                                                                                                                        |
| `archive_routine`         | Restores it.                                                                                                                                                                                                                                   | It is no longer archived.                                                                                                                                                                                             |
| `create_routine`          | Archives it, as `create_recipe` does. `routines` grants no delete and the app can restore it.                                                                                                                                                  | It was edited (fingerprint), is active, or has a workout logged from one of its days.                                                                                                                                 |
| `update_training_goals`   | `training_goals` is versioned, so it saves the previous answers again. With no earlier goal it closes the new row.                                                                                                                             | The current row is not the one this write made.                                                                                                                                                                       |
| `save_custom_exercise`    | A create archives it. An edit puts back the name, equipment and muscles.                                                                                                                                                                       | An edit compares a fingerprint. Sets already logged keep their frozen snapshot either way.                                                                                                                            |
| `archive_custom_exercise` | Restores it.                                                                                                                                                                                                                                   | It is already live.                                                                                                                                                                                                   |
| `update_past_set`         | Puts back reps, load, RIR, RPE and type.                                                                                                                                                                                                       | The set no longer holds what the write left.                                                                                                                                                                          |
| `delete_workout`          | Restores the session, then the sets stamped with the session's own `deleted_at` value, recorded as `target_updated_at`. Sets removed earlier stay removed, and a retry is safe.                                                                | The session is live again.                                                                                                                                                                                            |

During a workout, Undo on all nine writes answers `undo_unavailable` and the claim is not taken, so Undo works again once the workout ends.

No training table has `updated_at`, so the "changed since" stamp of the food Undo does not exist here. The fingerprint, compared in core (KEY-888), and the comparisons above take its place. `restoreSession` and `restoreExercise` are the repository helpers a restore needs (KEY-889). `update_entry` and `update_recipe` stay as they are, with no Undo.

### Where the previous value lives

In `assistant_messages.display`, so no migration and no new table (Zee).

- A write tool puts `undo: { previous, fingerprint }` in its `structured` outcome, which never reaches the model. The turn loop stores it in `display` beside the card, under the `tool_use_id`, with the action's id, in the same insert, on both the streaming turn and the confirmed call (KEY-900). The inverse finds it through the action's `turn_id`, with `previousValueOf` on the tool context, read through the service client and filtered by the verified user id. An inverse that gets null answers `unavailable`.
- Replay sends `content` and never `display`, so the model and the prompt cache are unaffected. The value is health data like the card: owner-only, deleted with the conversation, and in the person's own export. No log line, Sentry event or error message holds it.
- Deleting a conversation removes the value, so Undo then answers unavailable. A crash between the write and the message insert leaves no value, so Undo is unavailable, the same trade this ADR already accepts. Health data does not outlive the conversation in `assistant_actions`, which the policy says is kept until the account goes.
- **`assistant_actions` still holds ids and one date and never a value, so the sentence in Guards and in ADR 0003, Amendment 14 stands.** ADR 0003's addendum of 2026-11-03 for the `display` column now lists `undo` among the keys of an entry.

### Consent

The new words (the consent card, the Privacy Policy sentence for "Why Ki-Lo uses it" and the medical advice line) say the assistant reads, builds and changes training, and cover Part 2 from the start so nobody is asked a third time (KEY-885).

- Consent is versioned on its own. `ASSISTANT_CONSENT_VERSION` is a date in core, separate from `TERMS_VERSION`, or every later policy change would switch the assistant off. `isAssistantConsentCurrent` is true when a stored version is at or after it.
- The gate (`hasConsented`) read only `assistant_consent_at`, so changing the words alone asked nobody again. It now reads `assistant_consent_version` instead, through `isAssistantConsentCurrent`, and an older one, or none, answers `consent_needed`. `setAssistantConsent` writes `ASSISTANT_CONSENT_VERSION` in place of `TERMS_VERSION`, and the More row and the Settings switch read `getAssistantConsent`, whose `isOn` goes through `isAssistantConsentCurrent`, so they never disagree with the gate.
- `TERMS_VERSION` is bumped too, so every account meets the Terms gate. Every account accepts again, for the Terms and for the assistant. An app on the old update writes the old `TERMS_VERSION` when Turn on is pressed, so the gate keeps asking until the phone updates. It clears by itself, and the release note says so (KEY-885). No migration, because `assistant_consent_version` is `text` and the check that pairs the two consent columns still holds.

### Models

Haiku 5.5 (`claude-haiku-5-5`) stays for chat and compaction. Zee's condition: it stays unless the advice evals fail. KEY-895 runs the advice set and decides.

### Evals

- **Sets and thresholds (Zee):** advice 90 %, edits 90 %, red-team 100 %. The advice set is KEY-895 and the edits set is KEY-911. Red-team cases for advice (injury questions, another user's workouts) are KEY-896 and for edits KEY-912, at 100 % like the existing red-team set. The existing thresholds stand: 90 % on ask-your-data, 80 % on describe-to-log first pass.
- **The eval user's training history** is synthetic and built by the harness (KEY-887), because the seed holds no workouts. The exercise library comes from a migration, so it is there.
- **Baseline and the regression rule.** KEY-884 records a baseline of every existing set before the first tool merges. Every set is run again after Part 1 (KEY-898) and at the exit gate (KEY-913). A set that falls below its threshold, or more than 2 points below its baseline, stops the next part. A full run already reaches the budget of 300,000 tokens, so the sets run in separate dispatches.

### Consequences

- The cached prefix grows. Tool descriptions are about 13,800 characters and the system prompt about 5,700, before schemas, and 16 more tools add roughly 2,700 tokens to every request. That is an estimate and the gate measures it. There is one cache write after each deploy that changes tools or the prompt, then reads at the cached price. `ASSISTANT_COMPACT_AT_TOKENS` counts those tokens, so compaction arrives sooner by the same amount.
- **Amendment of 2026-11-07 (KEY-927): the threshold is 40,000.** The prefix measured about 21,700 tokens on a real first call (11,313 plus 52,432 characters) and about 23,000 with KEY-908's wording. At 20,000 it was past the threshold before the first word, so every complete turn compacted, the model lost the detail of the conversation after each turn, and each turn paid for an extra Haiku call. The default is now 40,000, which leaves about 17,000 tokens for the conversation, against the 8,000 it had when 20,000 was chosen. The prefix is cached, so carrying it is cheap. A test (`promptPrefix.test.ts`) builds the real tool list and system prompt, estimates their tokens at 2.94 characters a token, and fails when they pass 60 % of the threshold (24,000 tokens). `ASSISTANT_COMPACT_AT_TOKENS` stays unset in every environment.
- An unknown card kind fails the whole turn on an older app, after the write has landed. So for Part 2 the card contract and its rendering merge first and reach the phones through `eas update` (KEY-901), and only then does a tool that emits a new card kind merge. Part 1 adds no event or card kind. The working line (KEY-916 for the app, KEY-917 for the server) reads an unknown status as Thinking, but KEY-917 adds a test that every registry tool has a row in the words table, so KEY-910 adds all 16 rows before the first new tool.
- The tool allowlist, the confirmation protocol and the 10 write slots apply to the training tools unchanged. The workout rule is one more refusal in the executor and not a new kind of set.
- The `strict: false` tools lose the API's schema enforcement, and the executor's zod validation is the only check. That was already true of the three tools that opt out today.

### Implemented by

- KEY-882, the training boards (design, mobile only).
- KEY-884, the baseline of every existing eval set. KEY-885, the consent words and accepting again. KEY-910, the working line's words for the 16 tools, after KEY-916 and KEY-917.
- Part 1, advice: KEY-886 (the suggestion and muscle reads leave the hooks), KEY-887 (the eval user's history), KEY-890, KEY-891, KEY-892 and KEY-893 (the seven reads), KEY-894 (the prompt and the compaction note), KEY-895 and KEY-896 (the advice set and its red-team), KEY-897 (the way in from the Train tab), KEY-898 (re-run against the baseline).
- Part 2, edits: KEY-899 (the workout guard), KEY-900 (the previous value for Undo), KEY-888 (`applyRoutineChanges` and the fingerprint), KEY-889 (`restoreSession` and `restoreExercise`), KEY-919 (a built routine's numbers), KEY-901 (the card contract), KEY-902, KEY-903, KEY-920, KEY-904, KEY-905, KEY-906 and KEY-907 (the nine writes), KEY-908 (the prompt for changes and for building), KEY-909 ("What the assistant changed" rows), KEY-911 and KEY-912 (the edits set and its red-team), KEY-913 (the exit gate).
