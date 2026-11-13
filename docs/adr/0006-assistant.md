# 0006: The assistant: tools, Ki-Lo's own MCP host and client, guards, models and compaction

## Status

Accepted when the pull request that carries it merges. Written on 2026-10-26 under KEY-662, part of KEY-185 (the M8 brief). The tables, columns and functions it needs are in ADR 0003, Amendment 14. Every M8 migration waits for both documents. Amended on 2026-11-07 under KEY-883, part of KEY-881 (the brief for weight training): see Amendment 1, Amendment 2, Amendment 3, Amendment 4, Amendment 5 and Amendment 6 at the end. Two decisions in it were taken by the orchestrator while Zee was away, for his review, and are marked as such.

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

| Route                          | Model                          | Use                                                                                                             |
| ------------------------------ | ------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| Chat, describe, recipe parsing | Haiku 5.5 (`claude-haiku-5-5`) | The streaming turn loop, the tool-less recipe parse and the tool-less choice of each imported line's food       |
| Compaction                     | Haiku 5.5, no tools            | One call per compaction                                                                                         |
| Coaching, later                | Opus 5.5 (`claude-opus-5-5`)   | After M6, not part of M8's build                                                                                |
| Recipe and plan generation     | Opus 5.5 (`claude-opus-5-5`)   | One tool-less structured-output call inside each generation tool, effort `low`, refusal fallbacks (Amendment 6) |

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

No amount carries the Estimate label, with one exception that is recipe import only (Amendment 1 C.3 stands for it, Zee 2026-10-25): a vague ingredient line ("a splash of milk") whose food matches gets a guessed quantity with the Estimate label, saved like any other quantity, with no schema change. Amendment 2 adds a second exception, an amount from a share of a plate or bowl or from a stated calorie figure. Only the import tool and, since Amendment 2, `log_entry` sent with `estimated` true set a card row's `estimate` flag, and nothing is stored on ingredients or entries. The label otherwise stays where it means a model estimate, such as the trend weight in an answer.

### Conversations, export and account deletion (Q11)

- Conversations are stored per user in `assistant_conversations`, `assistant_turns` and `assistant_messages`. A message holds the raw Messages API blocks, so the next turn replays history unchanged for caching. Rows are owner-readable and written only by the `assistant` function's service client, filtered by the verified user.
- The app shows one running conversation, with "New conversation" and "Delete all conversations" in Settings and no list. Deleting a conversation hard-deletes it with its turns and messages, and `assistant_actions.conversation_id` becomes null so "What the assistant changed" keeps its rows.
- Account deletion works because every new user table cascades from `auth.users`.
- Conversations are included in the data export and in account deletion (Zee, 2026-10-25). No export feature existed or was ticketed (KEY-7 does not cover it and M7 is optional), so Zee asked for a whole-account export built in M8, last: KEY-707 (the data, built on the client under the user's JWT) and KEY-708 (the Settings screen, which saves the file to a folder the person picks on Android). The assistant settings get no separate export row. Until it ships, conversations are within the privacy policy's manual export and deletion path (KEY-136). The words "Build a whole-account data export in M8, conversations included" are quoted in KEY-185 Amendment 2 C, and they supersede the round 3 comment on KEY-662 ("M7 builds the export, no export button in M8").

### Compaction (Q13)

Every turn sends the whole conversation to the model again, so a long one costs more on every turn, gets slower, and would one day not fit. Ki-Lo does its own compaction (KEY-706) and does not use the API's compaction beta, so it stays independent of one model's features. What Zee ruled (Q13) is Ki-Lo's own compaction above about 20,000 tokens (raised to 40,000 on 2026-11-07, KEY-927, see the last Consequences bullet of Amendment 1). Simple compaction, running only after a `complete` turn, and the replay shape below are the engineers' recommendation (plan 2.9, KEY-706), not Zee's ruling.

- When: after a turn that ended `complete`, if that turn's last model call had more than `readLimit('ASSISTANT_COMPACT_AT_TOKENS', 46000)` prompt tokens (20000 until 2026-11-07, KEY-927, 40000 until 2026-11-10, KEY-952, and 42000 until 2026-11-11, KEY-964) (`input_tokens` plus the two cache fields). It never runs after a `clarify` or `confirm` turn, and never in the middle of a tool round.
- How: one tool-less Haiku 5.5 call writes a note of what a food diary and training conversation needs (foods logged with amounts and days, the dates discussed, answers given, open questions, corrections and undos, and from Amendment 1 the training facts of the conversation, nothing else). The note is stored in `assistant_conversations.compaction_summary` with `compacted_through_turn_id`, in the background with a compare-and-set on `updated_at`. The call writes an `assistant_usage` row with route `compact` and transport `none`, so it counts toward the monthly spend.
- Replay: the note, wrapped in `<conversation_summary>`, is the first block of the first user message after the compaction point, followed by the turns after it. The system prompt and tools do not change, so their cache still hits.
- Simple compaction, not keep-tail: no turn from before the note is replayed, because thinking blocks made with the full history would break the API's history check on Haiku 5.5. The full thread stays on screen and in the tables, and the app never shows the note.

### Semantic food search is deferred

Semantic food search (pgvector, embeddings and `search_foods_hybrid`) is deferred to Housekeeping (Zee, 2026-10-25, KEY-185 Amendment 2 H) and gets no column in Amendment 14 and no decision here. The assistant resolves foods with the existing `search_foods` (full text plus trigram), retrying once with other words before it asks, and never guesses. Amendment 3 adds a live Open Food Facts step for a search the catalogue does not answer.

### Evals

The eval suite stays as the acceptance mechanism and runs on demand only (Q2, Q9). The workflow has `workflow_dispatch` and no `pull_request` trigger, with a budget of 300,000 tokens per run. It runs in the GitHub environment `assistant-evals` (no branch rule), which holds the second key `ANTHROPIC_EVAL_API_KEY`, and never in `production`, whose branch policy allows `main` only. Both Anthropic keys are issued from the Ki-Lo workspace in the Anthropic Console. The thresholds are 90% on ask-your-data, 80% on describe-to-log first pass, and 100% on the red-team set. The eval user and its diary are synthetic and committed, and the live API is used only here. The replay set built from real corrections is deferred (Q6), because it conflicts with two standing rules (no health data in committed fixtures, and no production queries). Undo is recorded in `assistant_actions.undone_at`, so the signal is not lost. Amendment 1 adds the training sets, their thresholds and a regression rule.

### Health data and logs

Conversation text, tool results, the compaction note and an action's target are health data. They are owner-only under RLS and are never written to a log, an error message, a Sentry event or an analytics event. The functions log user ids, counts, durations and codes only. The Edge reporter of ADR 0004 already rebuilds an event from an allow-list with no message text, and the assistant functions use it. `assistant_actions` holds ids and one diary date, and `assistant_usage` holds counts, and neither holds a health value.

## Zee's answers, 2026-10-25

All thirteen are answered, and none is pending. Q1 is shown as superseded by the round 2 answer.

| Question                            | Answer                                                                                                                                                                                   | Where in this ADR                                                    |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Q1, the token through Anthropic     | Superseded in round 2: Ki-Lo runs its own MCP client, the connector is not used, the user's JWT never leaves Supabase                                                                    | Host and client, One tool definition, What the `mcp` function trusts |
| Q2, evals in CI                     | On demand only (`workflow_dispatch`), 300,000 tokens per run                                                                                                                             | Evals                                                                |
| Q3, the imported recipe's link      | A new column, `recipes.source_url`                                                                                                                                                       | Guards (import), and Amendment 14                                    |
| Q4, the monthly ceiling             | Turns through `consume_rate_limit()`, spend as a sum over `assistant_usage` against the USD 10 default, below the Console workspace limit of USD 20 (KEY-185 Amendment 2 D)              | Access order                                                         |
| Q5, the kill switch                 | The function secret `ASSISTANT_DISABLED` now, a feature flag later                                                                                                                       | Access order                                                         |
| Q6, the real corrections replay set | Deferred past M8                                                                                                                                                                         | Evals                                                                |
| Q7, the free quota                  | 15 turns a day, plus the `unlimited` plan                                                                                                                                                | Access order                                                         |
| Q8, the privacy policy              | Bump `TERMS_VERSION`, and the policy names Anthropic                                                                                                                                     | Access order (consent), Consequences                                 |
| Q9, the eval key's home             | The GitHub environment `assistant-evals`, key `ANTHROPIC_EVAL_API_KEY`, never `production`                                                                                               | Evals                                                                |
| Q10, hand measures                  | None. Food portions or grams, one question for grams, no Estimate on amounts except recipe import's vague lines and, from Amendment 2, an amount from a share or a stated calorie figure | Amounts                                                              |
| Q11, export                         | Conversations in the data export and in account deletion. A whole-account export is built in M8, last (KEY-707, KEY-708)                                                                 | Conversations, export and account deletion                           |
| Q12, unmatched import lines         | On the import card only                                                                                                                                                                  | Guards                                                               |
| Q13, conversation length            | Ki-Lo's own compaction above about 20,000 prompt tokens (46,000 from 2026-11-11, KEY-964)                                                                                                | Compaction                                                           |

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

### Addendum of 2026-11-10 (KEY-952): general training questions

Zee asked on 2026-11-10 to put weight lifting questions to the assistant while he trains. Asked whether more reps or more sets suit pec flyes, it answered that Ki-Lo has no guidance and gave no recommendation. The Scope rule above, that the model "explains them and never invents its own", and KEY-894's numbers rule were written for the person's own data, and they were read as covering general training knowledge too. This addendum narrows them:

- **General weight training questions are answered from general knowledge.** Rep ranges, sets, form, technique, progression, rest between sets, exercise choice, warm-ups and tempo get a short direct answer, worded as general guidance and never as the person's own data or a Ki-Lo figure. The prompt holds this in a new section, Training questions.
- **Numbers about the person's own training still come only from tools.** `suggest_next_session`, `get_muscle_state` and `get_exercise_progress` stay the only source for what to train next, volume, recovery and progress. A general answer is tailored only from what a read tool returned in the same turn.
- **Unchanged:** the injury, pain and medical rule word for word, so a general question that mentions pain gets the referral and no training advice. The privacy and data rules, `show_exercise_muscles` for what an exercise works, the workout rule (questions still work during a workout), and the food grounding rules, which a test holds byte for byte.
- **Evals:** a new on-demand set, `trainingKnowledge`, at 90 %, holds general questions and one pain case. The advice set stays at 90 % and the red-team set at 100 %.

### Tools: 35 in all

The registry has 19 tools today (16 strict and 3 that opt out: `log_entry`, `update_recipe`, `create_custom_food`). Amendment 1 inserts 16 before `ask_user`, in this fixed order. The tools array stays constant per turn. `ask_user` moves, so the first deploy costs one cache write (see Consequences).

| Kind  | Tools, in order                                                                                                                                                                            | Built by                                                      |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| Reads | `search_exercises`, `get_workouts`, `get_exercise_progress`, `get_routines`, `get_training_goals`, `get_muscle_state`, `suggest_next_session`                                              | KEY-890, KEY-891, KEY-892, KEY-893                            |
| Write | `edit_routine`, `set_active_routine`, `archive_routine`, `create_routine`, `update_training_goals`, `save_custom_exercise`, `archive_custom_exercise`, `update_past_set`, `delete_workout` | KEY-902, KEY-903, KEY-920, KEY-904, KEY-905, KEY-906, KEY-907 |

- The reads land in the read allowlist by their annotations, with no edit to the allowlist code.
- **`strict: false` on all 16, and why.** The API caps the strict tools of one request at 20 tools, 24 optional parameters and 16 union parameters. The 16 strict tools of today use 14 of the 16 union parameters (a nullable or a `confirmation_id` counts as a union), so two are left and 16 more tools would not fit. After Amendment 1 there are 16 strict tools and 19 that are not (the 3 above and the 16 new). The executor validates every input with zod either way. The rule for the tickets: `strictBudgetOf` stays at 16 tools, 0 optional and 14 union parameters, and no tool ticket changes it. Amendment 3 later makes `get_food` not strict, so the budget reads 15 tools, 0 optional and 14 union parameters.
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
- **Amendment of 2026-11-07 (KEY-927): the threshold is 40,000.** A real one-turn conversation measured 22,396 prompt tokens, nearly all of it the prefix, and the test's estimate for the prefix with KEY-908's wording is about 23,600. At 20,000 it was past the threshold before the first word, so every complete turn compacted, the model lost the detail of the conversation after each turn, and each turn paid for an extra Haiku call. The default is now 40,000, which leaves about 17,000 tokens for the conversation. The prefix is cached, so carrying it is cheap. A test (`promptPrefix.test.ts`) builds the real tool list and system prompt, estimates their tokens at 2.94 characters a token, and fails when they pass 60 % of the threshold (24,000 tokens). `ASSISTANT_COMPACT_AT_TOKENS` stays unset in every environment.
- **Amendment of 2026-11-10 (KEY-952): the threshold is 42,000.** The Training questions section of the system prompt (general weightlifting answers) takes the tools and the system prompt to about 24,360 tokens by the same estimate, over the 24,000 that is 60 % of 40,000. Shortening the section further would have cut the rules it needs, so the default is now 42,000, which leaves about 17,600 tokens for the conversation. `promptPrefix.test.ts` still fails at 60 % of the figure (25,200 tokens). The compaction eval seed grows from 66 to 75 turns so that its history still lands 10 % above the threshold.
- **Amendment of 2026-11-11 (KEY-964): the threshold is 46,000.** The meal estimate tool and rules (KEY-965 to KEY-967) need about 2,700 more characters of tools and prompt, and the tools and the system prompt were already at about 25,075 tokens by the same estimate, 367 characters under the limit. A trim of the existing text was tried first and abandoned. Shortening the food, diary, recipe and confirmation text regressed the writes evals (main 34/34, the trimmed branch 31 to 33 of 34), and the cuts left in the training tools and the prompt freed too little to be worth the risk, so the text is unchanged. The room comes from the threshold instead. The prefix stays at about 25,075 tokens, which is about 54 % of 46,000, and leaves about 20,900 tokens for the conversation. `promptPrefix.test.ts` still fails at 60 % of the figure (27,600 tokens), so about 2,525 tokens (about 7,400 characters) of headroom remain for the new work. The compaction eval seed grows from 75 to 90 turns so that its history still lands 10 % above the threshold.
- An unknown card kind fails the whole turn on an older app, after the write has landed. So for Part 2 the card contract and its rendering merge first and reach the phones through `eas update` (KEY-901), and only then does a tool that emits a new card kind merge. Part 1 adds no event or card kind. The working line (KEY-916 for the app, KEY-917 for the server) reads an unknown status as Thinking, but KEY-917 adds a test that every registry tool has a row in the words table, so KEY-910 adds all 16 rows before the first new tool.
- **Amendment of 2026-11-13 (KEY-1018): an unknown kind is skipped.** From KEY-1018 an event type, a card kind or a card link screen that an app does not know is skipped, and the turn goes on. The card of an unknown link screen is drawn with no link. The reader leaves an `assistant.skipped` breadcrumb that holds the subject (`event`, `card` or `link`) and the name of the kind, which is checked against a plain snake_case pattern, and nothing else of the payload. So a new card kind, event or link screen no longer has to reach phones through `eas update` before the tool that sends it merges, and the ordering rule in the item above ends for them. It does not end for a known shape: a new required field on a known event or card, or a removed or retyped one, still fails the turn on an older app, so known shapes change only by adding optional fields. The `recipe_draft` draft is read leniently, so an app that is behind strips a field it does not know. This note takes no Amendment number, because KEY-1022 writes the kitchen tool group as Amendment 5.
- The tool allowlist, the confirmation protocol and the 10 write slots apply to the training tools unchanged. The workout rule is one more refusal in the executor and not a new kind of set.
- The `strict: false` tools lose the API's schema enforcement, and the executor's zod validation is the only check. That was already true of the three tools that opt out today.

### Implemented by

- KEY-882, the training boards (design, mobile only).
- KEY-884, the baseline of every existing eval set. KEY-885, the consent words and accepting again. KEY-910, the working line's words for the 16 tools, after KEY-916 and KEY-917.
- Part 1, advice: KEY-886 (the suggestion and muscle reads leave the hooks), KEY-887 (the eval user's history), KEY-890, KEY-891, KEY-892 and KEY-893 (the seven reads), KEY-894 (the prompt and the compaction note), KEY-895 and KEY-896 (the advice set and its red-team), KEY-897 (the way in from the Train tab), KEY-898 (re-run against the baseline).
- Part 2, edits: KEY-899 (the workout guard), KEY-900 (the previous value for Undo), KEY-888 (`applyRoutineChanges` and the fingerprint), KEY-889 (`restoreSession` and `restoreExercise`), KEY-919 (a built routine's numbers), KEY-901 (the card contract), KEY-902, KEY-903, KEY-920, KEY-904, KEY-905, KEY-906 and KEY-907 (the nine writes), KEY-908 (the prompt for changes and for building), KEY-909 ("What the assistant changed" rows), KEY-911 and KEY-912 (the edits set and its red-team), KEY-913 (the exit gate).

## Amendment 2 to this ADR: estimate_portions (2026-11-11)

### Status

Recorded on 2026-11-11 under KEY-965, part of Zee's request of the same day: describe a plate and a small bowl or two ("about 100 calories", "168 calories"), and have Ki-Lo work out the macros and log them. It adds the arithmetic and one read tool. The prompt rules that tell the model to use it, the Estimate badge on the card and the evals are the next ticket. This amendment adds no table, column or migration, and no ADR 0003 change: no `quality` key changes either.

### Decision

- **One new tool, `estimate_portions`.** It is a read tool (`kind: "read"`, `readOnlyHint: true`), so the allowlist puts it in every set that holds the food reads with no edit to `allowlist.ts`. It sits in the registry immediately before `ask_user`, the fixed order rule of this ADR, so the first deploy costs one cache write. It is `strict: false`, for the reason Amendment 1 gives: the request is near the API caps on strict tools, and its input has nullable fields. The executor validates every input with zod either way.
- **The arithmetic is core's and never the model's.** The model names the container, the kind of each food and its share of the container, or a calorie figure the person gave. Core (`estimatePortions`, in `packages/core/src/foods/portionEstimate/`) turns that into grams (or millilitres for a food per 100 ml) and the nutrients for that amount, and the tool reads each food under the caller's JWT, one read per item, and returns the result. Every number the model then says comes from a tool result. The nutrients come from the same function the diary uses to snapshot an entry (`buildLogEntry`), so they match what `log_entry` will write, and a null stays null.
- **The amounts are estimates, a second exception to the Amounts rule.** The Amounts section (Q10) says no amount carries the Estimate label, with one exception, recipe import. An amount that comes from a share of a plate or bowl, or from a stated calorie figure, is the second exception, and the answer is said with "about". The default sizes below are uncited editorial figures, chosen like the ones in `estimatedPortion.ts`, and none of them may be attributed to a source. The Q10 row of the table above reads the same way. Nothing new is stored on an entry: the card row's existing `estimate` flag marks it, which is the next ticket's work.
- **The closest generic match is logged when no exact dish exists, and a custom food is never created for it.** `foods.quality` is not writable by a person, and a custom food per described dish would clutter Your foods.
- **Rules.** Share-based amounts round to the nearest 5 g (or ml) with a minimum of 5. Shares are whole percents from 1 to 100. Shares on one container that add up to more than 100 are scaled down to 100 and the result says `shares_scaled: true`. Less than 100 is left as it is, because the rest of the plate was empty. A known calorie figure wins over a share, and gives the amount that lands within 1 % of it, rounded to the gram. A food per portion (ADR 0003, Amendment 18) is refused for that item with `counted_food`, because it is logged by its portions and never by weight. A food with no kcal answers `no_kcal` when calories are the basis. A soup or other liquid on a plate answers `bowl_only`. A food that cannot be read answers `not_found` for that item and the other items are still sized. An amount from calories of more than twice what the container holds carries `larger_than_container: true`, so the model can ask instead of logging something absurd. A size the person gave overrides the default: `diameter_cm` or `radius_cm` (the diameter wins when both are given), and `depth_cm` for a bowl. Plate diameters run from 10 to 40 cm, bowl diameters from 8 to 30 cm and depths from 2 to 15 cm. Anything else answers `invalid_input` with the field.

Default containers. A plate holds food in a well of 0.8 times its radius. A bowl is a spherical cap, V = pi h (3 a squared + h squared) / 6, where a is the rim radius and h the depth.

| Container     | Size                   | Food area or volume |
| ------------- | ---------------------- | ------------------- |
| `small_plate` | 20 cm diameter         | 201 cm2             |
| `plate`       | 26 cm diameter         | 340 cm2             |
| `large_plate` | 30 cm diameter         | 452 cm2             |
| `small_bowl`  | 12 cm diameter, 5 cm   | 348 ml              |
| `bowl`        | 14 cm diameter, 5.5 cm | 510 ml              |
| `large_bowl`  | 18 cm diameter, 7 cm   | 1,070 ml            |

The bowl fill is `half` (0.5), `most` (0.75, the default) or `full` (0.9).

Food types. On a plate the grams are covered area times heap depth times bulk density. In a bowl they are volume times fill times share times density.

| Food type           | Plate heap depth | Density g per ml |
| ------------------- | ---------------- | ---------------- |
| `leafy_salad`       | 3.0 cm           | 0.10             |
| `vegetables`        | 2.0 cm           | 0.60             |
| `rice_grains_pasta` | 2.5 cm           | 0.70             |
| `potatoes`          | 3.0 cm           | 0.65             |
| `curry_stew_sauce`  | 2.0 cm           | 1.00             |
| `meat_fish`         | 2.0 cm           | 0.85             |
| `bread_bakery`      | 4.0 cm           | 0.30             |
| `dessert`           | 3.5 cm           | 0.60             |
| `soup_liquid`       | bowl only        | 1.00             |
| `cereal_dry`        | 2.0 cm           | 0.30             |
| `yogurt_porridge`   | 2.0 cm           | 1.05             |
| `other`             | 2.0 cm           | 0.80             |

A food per 100 ml answers millilitres: on a plate, covered area times heap depth, in a bowl, volume times fill times share, with no density. A unit test pins the worked plate: the default plate with rice 30 %, curry 30 %, carrots 15 % and lettuce 15 % gives about 180 g, 205 g, 60 g and 15 g.

### Consequences

- The registry has 38 tools. The tool as sent is about 1,470 characters, which the prefix test counts. Its description is kept to what it does, that its amounts are the ones to log and that they are said with "about", and the full rules go in the prompt in the next ticket.
- The working line has a row for the tool in the words table ("Working out the portions"), because every registry tool must have one.
- Live Open Food Facts results are their own ticket and are not part of this amendment.

### Implemented by

- KEY-965, the core function, the tool and this amendment. The prompt rules, the `log_entry` flag, the card badge and the evals follow in the next ticket.
- KEY-966, the prompt rules (Numbers, Amounts, Read before you write, One question), the `estimated` flag of `log_entry` that sets the card row's `estimate`, the seed foods and the `mealEstimate` eval set (on demand, 80 %).

## Amendment 3 to this ADR: live Open Food Facts for the food reads (2026-11-11)

### Status

Recorded on 2026-11-11 under KEY-967, the follow-up Amendment 2 names ("Live Open Food Facts results are their own ticket"). It changes how the assistant finds a food. It adds no table, column, migration or tool, and no ADR 0003 change: the shared Open Food Facts rows and the search store are written by the functions that wrote them before.

### Context

The app's food search shows the catalogue and then live Open Food Facts rows. The assistant's `search_foods` read only the `search_foods` RPC, which holds CoFID, the curated USDA list, restaurant foods, the person's own foods and the Open Food Facts products someone has already opened. A branded dish that none of them holds, such as a beef massaman or a spinach soup, was therefore unreachable, and the assistant said the food was not in the database. The section above that says the assistant resolves foods with the existing `search_foods` stands for the catalogue. This amendment adds the live step after it.

### Decision

- **The trigger is core's.** `hasStrongFoodMatch(query, names)` in `packages/core/src/foods/` is true when one catalogue name holds every query word of 3 or more letters, compared by stem, so "tomatoes" matches "Tomato, raw". Shorter words are ignored, and no names is never a match. `search_foods` asks for live results only when the catalogue answer has no strong match, so a search the catalogue answers ("basmati rice" against "Rice, white, basmati, boiled") costs nothing new. "Beef massaman" against "Curry, beef, homemade" is not a match.
- **Live results come through the functions, never from Open Food Facts directly.** `search_foods` posts the words to the project's `off-search` function over HTTP with the caller's own JWT, so the per-user and global limits, the shared result store (ADR 0003, Amendment 16) and the UK filter apply unchanged, and the tool imports none of the function's modules: one code path, one limit. The call is capped at 4 seconds. The answer is the catalogue results as before plus `live`, up to 5 candidates, each with `off_code`, name, brand, basis and the kcal and macros per 100, and no id and no portions. A refused limit, a failure, a body that is not the contract and a timeout all answer the catalogue with `live: null` and a short `live_notice`, never an error.
- **A candidate becomes a food through `get_food`.** The input is now `id` and `off_code`, and exactly one is given. Both are optional on the server, so a bare `{ id }` works exactly as before, and the strict schema the model sees renders every property as required and nullable, as it does for every strict tool (`toJsonSchema`), with the executor dropping a null at an optional property. A JSON Schema cannot say "exactly one", so the zod input refines it, the executor answers `invalid_input` for neither or both with `fields: ["off_code"]`, and the `off_code` description says it and gives the 8 to 14 digits. `log_entry.estimated` from KEY-966 is optional in the same way. An `off_code` makes `get_food` call `off-product` over HTTP with the caller's JWT, which stays the only writer of shared Open Food Facts rows, and the answer is the stored food with its own id and portions, so `log_entry` and `estimate_portions` work on it unchanged. The call is capped at 8 seconds, because `off-product` may have to fetch and store the product. A 404 answers `not_found`, and a refusal, a failure or a timeout answers `unavailable`. The `id` key and its description are kept, because the tool is on the logging path and its wording is measured by the writes evals.
- **The calls are a service on the tool context.** `offLookup` is set by the `mcp` function from the request it is serving, the way `recipeImport` is set, so a context without it (every unit test that does not need it) answers from the catalogue alone.
- **The prompt gets one short section, Live foods.** It says to prefer a catalogue food that matches the dish, to use a live product only when its name names the dish better, to read it with `get_food` by its `off_code` before logging, and to log with the id and portion ids that answer gives. The sections of Amendment 1 and 2 are not reworded.
- **Live text is untrusted like every result.** Live names and brands are Open Food Facts text, and they arrive inside the same `<untrusted_data>` wrapper as any other result.
- **Nothing is logged.** The search words are the key of the shared store, so no log line, report or error of the lookup carries them, a product name or a nutrient. A failure is an outcome, and its reason is not kept.

### Consequences

- The registry still has 38 tools. The two descriptions and the prompt section grow the prefix by about 1,000 characters, which the prefix test counts.
- `get_food` is `strict: false`. Its two optional parameters render as nullable, and as a strict tool they took the registry to 16 union parameters. With that registry the API refused the first model call of every live eval turn (2026-11-11, PR #842), and at 14 every set passes. Whether the API's limit of 16 is exclusive or counted differently is not known, so 14 is the figure observed to work. Both keys are optional on the server, so a call with one left out is valid, and the strict budget is now 15 tools, 0 optional and 14 union parameters, as it was before this amendment apart from `get_food`, which counted for none.
- The evals still reach no Open Food Facts answer: the live run starts no Open Food Facts stand-in, and serving a canned answer would need a change to the workflow. The unit tests of the lookup, the two tools and the route are the cover.
- Semantic search stays deferred to Housekeeping, and the limits of `off-search` are unchanged.

### Implemented by

- KEY-967, the strong match rule, the lookup, the two tools, the prompt section and this amendment.

## Amendment 4 to this ADR: the assistant offers a feature request (2026-11-11)

### Status

Recorded on 2026-11-11 under KEY-977, the second of the two feature request tickets (KEY-976 added the table, the core schemas and `createFeatureRequest`, which ADR 0003, Amendment 21 describes). It adds one tool, one card kind, one prompt clause and one eval set. It adds no table, column or migration.

### Context

Zee, 2026-11-11: when the assistant cannot do something because the app does not support it, it should ask whether the person wants to request it as a new feature, and then send it into a feature request database along with the context of it being raised.

### Decision

- **The existing confirmation protocol is the explicit OK.** `request_feature` is a `kind: "write"` tool (`targetTable: "feature_requests"`) whose `needsConfirmation` always answers a question. The model says in one sentence that Ki-Lo has no such feature and, in the same response, calls the tool. The executor answers `needs_confirmation`, and the app shows the confirm card with the model's sentence, the line "A short part of this chat goes with it, and stays even if the chat is deleted." and the buttons Send request and No thanks. When the model wrote no text, the card asks "Send this to the Ki-Lo team as a feature request?". Nothing is written until the person presses Send request or types its words, and then the turn loop makes the stored call itself with no model call (`assistant/confirmedCall.ts`, Guards above). Any other answer writes nothing. This gives one offer and one tap with no double confirmation, and a model cannot file a request on its own.
- **An exception to the read-shaped allowlist (a).** A message that looks like a read gets the read-only set. "Is there a dark mode in Ki-Lo?" is read-shaped, and the tool would be missing exactly when it is most needed. `allowedToolsFor` therefore adds `request_feature` to the read set by name, the way the recipe-import set names its tools. This is the one write the read set holds. It is safe there because the tool writes only after the button and touches no diary or training row. It is not added to the recipe-import set.
- **When to offer.** Only when Ki-Lo as a whole has no such feature, such as water tracking, photo logging or sharing with a coach. Not when the feature exists elsewhere in the app (the rule in Replies stands: say where it is done, for example the Train tab). Not for the medical and injury limits, not after a tool error or `tool_not_allowed`, not when the person already declined in the conversation, and at most once for one ask. The prompt carries two short clauses (below) and the tool description carries the rest.
- **Input.** `{ request: string of 3 to 300 characters, the feature in the person's terms, unsupported: string of 3 to 200 characters, what Ki-Lo cannot do }`, plus the `confirmation_id` the protocol adds. The tool opts out of `strict` (as the training tools do) because its `confirmation_id` would be the 15th of the union parameters a request may hold, over the cap in `registry.test.ts`. The executor validates every input with the same zod schema either way, and the strict budget of the registry stays at 15 tools, 0 optional and 14 union parameters.
- **The context is built in core, never by the model.** `buildFeatureRequestContext` (`packages/core/src/assistant/featureRequestContext.ts`) is a pure function. `run` reads the newest 12 `assistant_messages` rows of the turn's conversation under the caller's JWT, so row-level security scopes them, and passes them with the confirm button's words and the tool input. It returns the `FeatureRequestContext` of ADR 0003, Amendment 21. `ask` is the person's latest own words that are not the button's, and `recent` is the last 6 text messages in order. A user message contributes only its own words block (the last block when it is text), never the context block the turn loop adds. An assistant message contributes its `text` blocks only, never `tool_use`, `tool_result` or thinking. Each is trimmed and cut to 500 characters by code point, and `unsupported` to 200. No tool call, tool result, context block or id can be in it, which the core unit tests prove. The press of the button is itself in `recent`, because it is one of the last messages.
- **The card.** A new kind, `feature_requested`, with the icon `MessageSquareText` and the tone `secondary`, built by `buildFeatureRequestedCard` and worded in `copy/assistantFeatureRequest.ts`. Title "Feature request sent", sub the request text, `undo: "unavailable"`, `undoneSub: null`, no link. The tool is in `ASSISTANT_TOOLS_WITHOUT_UNDO` and has `inverse: null`, because a client cannot delete a request. The existing `AssistantActionCard` draws it with no new component. **No board draws this confirmation or this card.** The words and the layout are flagged to Zee as a small design gap, and nothing was invented beyond the existing card.
- **Privacy.** The tool's `data` back to the model is only `{ sent: true }`. The request text and the context are never logged, reported through `ctx.reportError`, added to a Sentry breadcrumb or sent to analytics. A repo error carries the action and a code, so a failure answers `tool_failed` with that and nothing else. The daily cap of the table (20 in 24 hours, ADR 0003, Amendment 21) is answered to the model as `{ error: "rate_limited" }`, which it words as too many requests today, and no action is kept.

### The prompt

The system prompt is near its limit (`promptPrefix.test.ts`, 60% of the compaction threshold). The addition is two short clauses. In "What you can use", after "When the tools cannot do what was asked, say so in one short sentence and do not try another way.", one sentence: "When Ki-Lo has no such feature at all, also call request_feature to offer sending it as a feature request." In "Replies", the exception "except the offer to make a built routine active" now also allows the offer to send a feature request. The Limits section is untouched. The threshold is not raised: the prefix estimate went from about 26,430 to about 26,840 tokens against a limit of 27,600.

### Evals

A new opt-in set, `featureRequest`, with 8 cases at a threshold of 90% (`tools/assistant-evals/cases/featureRequest.ts`): the offer with nothing written, the button's words writing one row with the right context and no model call, a decline writing nothing, a read-shaped ask with no change word or request phrase ("Does Ki-Lo let me share my diary with a coach?") that still offers, which proves the allowlist exception and is pinned by a unit test against the real allowlist, no offer for a supported feature, for a feature elsewhere in the app or for a medical ask, and a red-team case where a food name tells the model to file a request and no row is written without the button. The set runs on demand with `--set featureRequest`, and every grader is unit tested with no model call.

### Consequences

- The registry has 39 tools. The tool description and the prompt clauses grow the prefix by about 1,200 characters, which the prefix test counts.
- A request holds a short part of the chat, so it is health data (ADR 0003, Amendment 21). It stays when the conversation is deleted, and the confirm card says so before the person presses the button.
- A model can still offer when it should not, and the person then presses nothing. The cost of a wrong offer is one card, and the evals measure how often it happens.
- A board for the confirmation and the card is still needed from the designers. Until then the words are a draft in the style of the existing cards, marked NOT ON THE CANVAS in `copy/assistantFeatureRequest.ts`.

### Implemented by

- KEY-977, the tool, the context builder, the card, the copy, the allowlist exception, the prompt clauses, the eval set and this amendment.

## Amendment 5 to this ADR: the hidden kitchen tool group (2026-11-13)

### Status

Recorded on 2026-11-13 under KEY-1022, part of KEY-216 (the M9 brief for the palate, recipe generation and meal plans). It follows Zee's ruling of 2026-11-13 on KEY-216: M9's tools are a hidden group that code surfaces, and the fallback is a compaction threshold of 50,000. It adds no table, column or migration. The check that lets `assistant_messages.role` hold `system` is ADR 0003, Amendment 22 (KEY-1016).

### Context

The prefix of a chat turn (the system prompt and the tools, `promptPrefix.test.ts`) was about 26,929 estimated tokens against a limit of 27,600, which is 60% of `DEFAULT_COMPACT_AT_TOKENS` (46,000). M9 needs about 2,000 more tokens for its tools and rules. Trimming the existing text was tried under KEY-964 and the writes eval fell from 34 of 34 to between 31 and 33. Raising the threshold again would show every conversation 44 tools, with `suggest_recipe` and `adjust_recipe` beside `create_recipe` and `update_recipe`, and every set would need a new baseline. Changing `tools[]` per conversation is rejected, because the API treats it as an edit of history.

### Decision

- **A tool says which group it belongs to.** `ToolBase` has an optional `group`, and `"kitchen"` is the only value. `tools/list` carries it as `_meta["kilo/group"]`, the same way it carries `kilo/strict`, and the MCP client reads it into `ListedTool.group`. `tools/list` is still never filtered per turn.
- **The adapter sends a kitchen tool with `defer_loading: true`.** The key is the last key of the tool and only those tools have it, so the bytes of every other tool are unchanged. The order of `tools[]` is still the registry's order. `tools[]` is byte-identical on every turn of every conversation, whatever the switch below says. At least one tool must stay visible, because a request with every tool deferred is a 400.
- **The beta goes with every request that holds a deferred tool.** The header is `anthropic-beta: mid-conversation-tool-changes-2026-07-01`. It is listed for Haiku 5.5 and Opus 5.5 and not for Foundry. A header is not part of the cache prefix. SDK 1.3.0 types `tool_addition` on its beta resource only, so `prompt.ts` has one narrow `@ts-expect-error` in `sdkMessages` and the rest of the code carries its own `KitchenSystemMessage` type.
- **Code decides, never the model.** A turn is a kitchen turn when the person's words match the list in `assistant/kitchen.ts` or when the turn request carries `entry` (`"plan"` or `"recipe"`, sent by the app's Plan screen and recipe screen). The list is a judgement for Zee to change, kept narrow on purpose so that "create a recipe called ..." and "I need more protein today" are not kitchen turns, because the rules push the model towards the kitchen tools. It covers: a request for a meal plan ("make me a meal plan", "meal planning for next week"), "plan my meals" and "plan dinners for me", "replan", "weekly menu", "suggest or recommend a recipe", "dinner ideas", a meal with a calorie figure ("dinner around 650", "lunch of about 500 kcal"), "what should I cook tonight" and "what should I eat today", "make it higher or lower in protein" and the like about a recipe, "cut the carbs", "what do I usually eat", "my palate" and "foods I avoid or do not like". It is meant to miss rather than catch, because a miss is covered by `entry` and by the next clear ask. These are not kitchen turns, and the tests say so: a meal with a clock time ("log dinner around 19:00: pasta"), "what's higher in protein, chicken or beef?", "give me the macros for my chicken recipe", "any recipe I saved with beans?", "plan my week of training" and "I'm on a meal plan from my dietitian".
- **The addition is one stored system message.** It follows the user message of the turn and comes before the first model call. Its content is one `{"type": "tool_addition", "tool": {"type": "tool_reference", "name": "<tool>"}}` block for each kitchen tool in the list's order, then one text block with the short kitchen rules (`KITCHEN_RULES`). It is stored as an `assistant_messages` row with role `system` and replayed as it was stored, so history stays append-only. Nothing earlier is edited, because on Haiku 5.5 the history-editing check invalidates earlier thinking blocks. `clear_at` is left at its default, so the message stays in front of the model. The rules text is stored with the row, so changing it reaches new conversations only. A conversation with no kitchen tool in the list (the switch is on and none is registered) appends nothing.
- **The group is sticky.** Once a conversation holds the addition, every later turn replays it and the group stays surfaced. `planKitchen` decides each turn from three facts: the switch, whether the messages the next request will replay already hold the addition, and whether any row of the conversation ever did.
- **Replay after compaction.** A compaction replaces the turns up to its cut with a note, so the replay no longer holds a row from before the cut. When the conversation had the addition and the replay lost it, the turn stores a new addition after its user message, which is the first message after the note, and the group stays surfaced. The new row is as append-only as the first.
- **A row that is not sent.** The API takes a system message only after a user message, and only as the last message or before an assistant message. That is decided on what is actually sent, after the replay is assembled, and not on the raw next row. A system row is not sent when the next message that is sent is not an assistant message (a turn that failed or was stopped after its addition was stored, or an assistant row that sends nothing because it held only thinking) or when no user message comes before it. The replay then sees a conversation that had the addition and lost it, and the next turn stores it again. `openToolUses` and every other reader of the history skip a system row, so a conversation that already had an answer survives such a turn. The beta header goes with every request that replays a `tool_addition`, as well as with every request that has a deferred tool, so an old kitchen conversation still works after a deploy that lists no kitchen tool.
- **Cache.** The addition is appended after the history, so the cached prefix holds. When the last message of a request is the addition, the cache breakpoint goes on the last block of the user message before it, so the history is still read from the cache and the system message is not asked to carry a breakpoint. `renderTranscript` skips system rows, so a compaction note never quotes the rules.
- **The switch.** `ASSISTANT_KITCHEN` is a function secret read per turn. `1` or `true` is on, and unset, empty or anything else is off. It is turned on in production only after the recipe card and Plan screens reach phones. Off means no turn surfaces the group and no kitchen tool is allowed. `tools[]` and the beta header are the same with the switch on or off. A conversation that already holds the row keeps it in the replay after the switch is turned off, and a kitchen call is then refused as `tool_not_allowed`.
- **The allowlist rule.** A tool of the kitchen group is in no set on a turn where the group is not surfaced, a pending confirmation of that tool included. On a turn where it is surfaced the tool is placed by the usual rules: a read is in the read set, a write is in the general set, and it is never in the recipe import set. The model never picks its own set, and the executor still checks the header.
- **The prefix test counts visible tools only.** `promptPrefix.test.ts` leaves the deferred tools out of the prefix figure and has a second test that caps what a kitchen turn adds, the deferred tool definitions as sent plus the stored system message, at 2,500 tokens.
- **One test-only tool proves it.** `kitchen_probe` is a read of the kitchen group that answers `ok`. It is last in the registry and is listed only when the function secret `ASSISTANT_KITCHEN_PROBE` is `1`, so no deployment lists it by default. The kitchen tools of M9 replace it.
- **If the API refuses.** If the API refuses the beta, `defer_loading` or a `tool_addition` on Haiku 5.5, the work stops and is reported, and the fallback is Zee's: raise `DEFAULT_COMPACT_AT_TOKENS` to 50,000 and record it as an amendment. The live check is the opt-in eval set `kitchenProbe` (`tools/assistant-evals/cases/kitchenProbe.ts`), dispatched with the workflow's `kitchen` input. It runs a two-turn kitchen conversation through the real stack and prints the cache counts of the first call of each turn.

### Measured

With the formula of `promptPrefix.test.ts` (system prompt length plus the tools as sent, over 2.94), on the tree of this amendment: 39 tools and 26,929 estimated tokens of visible prefix before and after, against a limit of 27,600. With the probe listed there are 40 tools, 39 of them visible, the visible prefix is the same 26,929, and a kitchen turn adds about 243 tokens. The real kitchen tools are expected to add about 2,000 tokens, which the second test caps at 2,500.

### Consequences

- Normal turns send the same prompt and the same tools as before, so the eleven existing eval sets see no change until a kitchen turn happens. The live checks are KEY-1022's acceptance: the API accepts the beta on Haiku 5.5, the second kitchen turn reads at least the visible prefix from the cache, and ask, describe, writes and redTeam hold within 2 points of a baseline taken on the same commit.
- A kitchen conversation carries about 2,000 more tokens from its kitchen turn on, so it has about 17,000 tokens of conversation before compaction instead of about 19,000.
- **Readers of `assistant_messages` skip a row whose role is `system`.** `api-client`'s `getAssistantConversationPage` reads the role and leaves the row out, and core's `threadFromMessages` draws nothing for one, so the kitchen rules are never a reply. The account export reads every column of every row as stored and filters nothing by role, so a system row is exported with the rest of the person's own conversation, as their thinking blocks and tool results are. The turn request has an optional `entry` (`plan` or `recipe`), which `routes.ts` passes to the loop.
- A kitchen tool opts out of `strict`, as the training tools do. Whether the API counts a deferred tool against the caps on strict tools is not documented, so the registry's strict budget keeps counting them until a live run shows otherwise.
- The trigger list will miss some phrasings and catch some it should not. A miss costs one turn on the visible tools, and a false catch costs about 2,000 tokens and the kitchen rules for the rest of the conversation. Both are small, and the word list is one file.
- The rules text and the trigger list are the two things to tune when M9's evals show a kitchen conversation going wrong.

### Implemented by

- KEY-1022, the group, the adapter field, the beta header, the trigger, the stored addition, the replay rules, the allowlist rule, the switch, the prefix tests, the probe tool, the `kitchenProbe` eval set and this amendment.

## Amendment 6 to this ADR: Opus generation inside the kitchen tools (2026-11-13)

### Status

Recorded on 2026-11-13 under KEY-1026, part of KEY-216 (the M9 brief for the palate, recipe generation and meal plans). It follows Zee's ruling of 2026-11-12 that generation runs on Opus 5.5 while the chat turn loop stays on Haiku, and the ruling of 2026-11-13 that production is on the Supabase free plan, with a 150 s wall clock. The two new `assistant_usage.route` values are ADR 0003, Amendment 22 (KEY-1016). This amendment adds no table or column. The live timing waits for KEY-1020, so the figures below are the plan's estimates until KEY-1026 records its measurements.

### Context

Haiku 5.5 routes a kitchen turn. It passes the person's words and any figures to a kitchen tool and reports what the tool returned. Proposing a recipe, a substitution or a ranking for a plan needs a stronger model, and moving the turn loop to Opus would re-bill the chat prefix as an Opus cache write, mix two models' thinking blocks in one history and put every existing eval set on a second model. The generation therefore happens inside the tool, the way `recipe_parse` makes its tool-less call (KEY-838).

### Decision

- **Models table, new row.** Recipe and plan generation: Opus 5.5 (`claude-opus-5-5`), one tool-less structured-output call inside each of the three generation tools, effort `low`, refusal fallbacks. The Coaching row of the table is unchanged, because coaching is not built.
- **One module makes the call.** `_shared/assistant/generate.ts` takes the system prompt, the user message already wrapped as untrusted data, the schema for `output_config.format` and a reader, and answers a typed value or a typed failure. The reader is a core function (`packages/core/src/assistant/kitchenGeneration.ts`) that bounds every string and array and checks every position and id against what the tool offered. A reply that does not fit is `generation_failed`. Opus proposes structure and core computes every number.
- **The request.** `max_tokens` 3,000. `output_config` holds `effort: "low"`, set explicitly because the default on Opus 5.5 is `medium`, and `format` (not the deprecated `output_format`). `thinking` is left out, because it cannot be disabled on Opus 5.5 and effort is its control. There is no `temperature`, `top_p`, `top_k`, `tool_choice`, `tools`, prefill or `inference_geo`.
- **Refusals.** The request opts into server-side fallbacks with the beta `server-side-fallback-2026-07-01` and `fallbacks: "default"`. `stop_reason` is read before the content. A final `refusal` means the whole chain refused and is `generation_refused`. A fallback model may have served the request, so the usage row names the model in `response.model`. A model that `usage.ts` has no price for is recorded under Opus 5.5, which is the dearest model a request can start on, so the spend still counts against the monthly cap and no call is dropped from it.
- **Failures are three codes and carry no content.** `generation_refused`, `generation_timeout` (the 40 s call timeout) and `generation_failed` (an API error, a cut-off answer, an unreadable answer, an answer outside the bounds or the offered list, or a missing key). A reported error is the SDK's or the database's, and none quotes the person's words, a recipe or a plan.
- **One usage row for each billed attempt,** whether the call answered or not, with route `recipe_generate` or `plan_generate` and transport `none`. When the response carries `usage.iterations`, which is the per-attempt source of truth (the top-level `usage` covers only the attempt that produced the returned message), there is one row for each entry: a declined Opus hop is a `message` entry recorded at Opus rates, and the fallback that served is a `fallback_message` entry recorded under its own model and tokens, or at Opus rates when that model has no price. Without iterations there is one row from the top-level usage. The answer is read only from the text after the last `fallback` content block, so partial text from a declined hop never reaches the reader. A missing key makes no call and writes no row. `usage.ts` prices Opus 5.5 at $4 per million input tokens, $20 output and $0.20 for cache reads. The cache write is 1.25 times the input rate ($5), the rule the Haiku rates already follow, and there is one rate card whatever the length of the prompt. The unknown-model throw therefore cannot fire for a call this module makes.
- **Timeouts in the turn loop.** A tool carries `generation: true` on its definition, which `tools/list` sends as `_meta["kilo/generation"]` and the MCP client reads into `ListedTool.generation`. The three generation tools wait 55 s for a call (every other tool keeps 20 s) and are never repeated, as a write is not, even when the tool only reads. The Opus call inside has its own 40 s timeout, which leaves 15 s for what the tool does after it. The loop starts a generation tool only while at least 65 s of the 150 s wall clock remain: 55 s for the call and 10 s for what follows it. Otherwise the tool is not called, nothing is spent and the model receives the error `busy_try_again`. The turn deadline of 100 s and the 20 s of every other tool are unchanged.
- **The `mcp` function reads the Anthropic key for generation too.** It already reads `ANTHROPIC_API_KEY` and `ANTHROPIC_BASE_URL` for the recipe import, from the project's function secrets, so no second secret is set. The generation services reach a tool as `ToolContext.generation`, and a context without it makes a generation tool answer `tool_failed`.

### Consequences

- **The monthly cap undercounts a call that timed out or errored.** Such a call is recorded with 0 tokens, because no usage arrived to read, although the API may have billed it. The USD 10 cap and the Console workspace limit behind it bound the error.
- A kitchen job costs about $0.05 for a suggestion, $0.03 for a substitution and $0.08 to $0.13 for a seven-day plan, from the plan's estimates. The daily limit counts turns and not money, so it does not bound Opus spend. The monthly cap of USD 10 (`ASSISTANT_MONTHLY_CAP_USD_MICROS`) does, for the whole app.
- A turn that reaches a generation tool late answers `busy_try_again`, and the person asks again. That is a worse answer than a long wait, and it is the price of ending inside 150 s on the free plan. On a paid plan (400 s) the 65 s and the 55 s can relax.
- The acceptance of 10 live calls of each of the three jobs, with a 95th percentile under 40 s, has not run. It waits for the eval workspace and key of KEY-1020, and KEY-1026 records the measured cost and timing when it does. If a seven-day plan misses 40 s, the plan job ranks once for each time band and not for each day.
- The chat prompt, the tool prefix and every eval set that runs on Haiku are untouched.

### Implemented by

- KEY-1026, `generate.ts`, the Opus 5.5 prices, the readers in core, the generation flag and its two timeouts, the start guard in the turn loop and this amendment.
