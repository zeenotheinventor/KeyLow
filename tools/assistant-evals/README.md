# @keylow/assistant-evals

The harness that judges the Ki-Lo assistant: a case type, deterministic graders, a runner with a token budget, and a synthetic eval user. It is the acceptance mechanism of ADR 0006 ("Evals"). The case sets (KEY-699 to KEY-702) are added by their own tickets. The ask set (KEY-699, `cases/ask.ts`), the compaction set (KEY-706, `cases/compaction.ts`) and the describe and write sets (KEY-700, `cases/describe.ts` and `cases/writes.ts`) are registered so far.

`src/httpDriver.ts` is the `TurnDriver` against the served `assistant` function: it posts each message as the eval user, reads the stream with core's `parseAssistantEvent` and resolves when `done` arrives. `src/httpSession.ts` opens the session for `check:assistant` on the local stack (the eval user, the driver and the eval user's own view of the database). The stream carries no tool calls, so the driver reads them from the turn's stored messages, and it has no source for each tool's `readOnlyHint`: the `mcp` function lists tools only for an open turn. A tool call has no hint and counts as a write, so a set that needs `noWrite()` has to supply the hints first. The ask set checks the end state and the tool names instead.

## Run it

**On demand only.** Every case is a real, paid call to the Anthropic API, so the run is started by hand from GitHub Actions (`workflow_dispatch`, the `assistant-evals` environment, key `ANTHROPIC_EVAL_API_KEY`) and never on a pull request. The command reads the key from `ANTHROPIC_API_KEY` in its environment and fails with a message when it is not set. It never reads a key file.

```sh
pnpm --filter @keylow/assistant-evals check:assistant -- --help
pnpm --filter @keylow/assistant-evals check:assistant -- --set ask --budget 100000
```

The command runs under `tsx`, because it loads `@keylow/api-client` and `@keylow/core`, which are TypeScript source with extensionless imports and `.tsx` files that plain Node cannot load.

## The budget

A run stops before the case that would take it past `--budget` tokens (default 300,000, Q2 of ADR 0006). The budget counts **input, output and cache creation tokens**. Cache read tokens are reported on their own and not counted, because a working prompt cache makes them most of a conversation, and counting them would punish the very thing the cache grader wants to see.

- Spend is the sum of every `assistant_usage` row of the eval user, read after every turn, so compaction calls and turns whose driver failed are counted. A turn that reports no usage at all is an error, because a budget that cannot see spend does not stop anything.
- Before each case the runner expects it to cost as much as the largest case so far. Inside a case, no further turn is sent once the budget is reached. A run that still ends over budget prints `OVER BUDGET` and exits non-zero.
- Cases the run did not reach count as misses in their set's pass rate. If every set is still at or above its threshold, the exit code is 0.

## Results

Thresholds are in `src/thresholds.ts`: 90% ask, 80% describe (first pass), 100% red-team and 100% compaction (one case). A case ends `passed`, `failed` (the assistant missed), `error` (the harness or the infrastructure failed: a driver or database error, a failed turn, or a case over its 120 s wall-clock ceiling) or `not_run`. Errors are reported on their own and are misses for the exit code.

## The ask set

`cases/ask.ts` has 40 questions about the synthetic diary, in five areas: day totals and what is left (8), range averages and days at target (10), what was eaten on a day or in an hour window (8), weigh-ins and the trend (8) and empty ranges or dates before the first entry (6). Four of them are two turns and also run `cacheReadOnSecondTurn()`. The questions name their dates, worked out from the anchor date the eval user's diary is dated from, so `askCasesOf(anchorDate)` gives the same set for the same day.

Every expected number and every expected citation line is worked out from the fixture by `fixtures/diaryTotals.ts`, with the core functions the tools use (`buildLogEntry`, `computeRecipe`, `sumEntries`, `computeTrend`, `describeDayCitation` and the others), and never typed by hand. `fixtures/askExtras.ts` gives the eval user the targets the "left" and "days at target" questions need, since the diary writes none. The driver reads `answer_meta` off the stream, so a case can check the citation under the answer and the Estimate label on a trend answer.

A case passes when the right tool was called for the right dates, the answer holds each number to the Diary's rounding, the citation is the tool's, the Estimate label is there on a trend answer, no tool wrote (`noActionRows()` and a check that every tool is a read tool, because the driver still gives no `readOnlyHint` and `noWrite()` would count every call as a write), and the reply never says "I".

A case should fail only when the answer is wrong, so any good route to a right answer passes: `get_range_totals` over one day counts as `get_day`, and several `get_day` calls count as one `get_entries` over the same days. The citation may hold several lines joined with " · " (a turn that read twice), and passes when every part is a line a read tool gives and one is the expected line. A garnish such as 10 g of olive oil is not required in an answer. A failing case prints its question, the tools it called with their arguments and the expected number, and never the answer or a tool result.

The targets `fixtures/askExtras.ts` writes belong to the run's one eval user, so every set sees them, not only `ask`. The budget is the run's, not the set's: a run without `--set ask` also runs the compaction set (about 55,000 to 65,000 tokens, an estimate) against the same 300,000 tokens, and the ask set's own estimate is about 120,000 to 180,000 with the prompt cache working. `cacheReadOnSecondTurn()` proves little in a full run, because the shared prefix is already cached after the first case, so a read on a second turn would happen even if that conversation's own prefix were not cached.

The set is meant to be copied by the next sets: a spec in plain data (`AskSpec`), the graders made from it, and one test that builds the reply a model would give if it were right and checks that every grader passes it.

## The compaction set

`cases/compaction.ts` has one case. It seeds a long, text-only conversation for the run's own eval user (45 turns, one early reply that says "Your average last week was 1,850 kcal a day"), sends one short message so the prompt passes the 20,000 token compaction threshold, waits for the note to be stored (`compacted_through_turn_id` set, polled once a second for up to 60 s), and then asks what the assistant said the average was. It passes when the note was stored for the first turn and the answer holds 1,850. The turns are seeded by `src/caseEnvironment.ts` with the service role, because only the service role writes the conversation tables. About 55,000 to 65,000 tokens are expected for the whole set (an estimate, not yet measured: the first live run, through the `assistant-evals` workflow, gives the figure).

## The describe set

`cases/describe.ts` has 20 messages in which a person says what they ate: 16 that resolve to `log_entry` calls and 4 that are too vague to log ("I had some chicken and rice", "I had some rice", "I had a bowl of pasta", "I had some cheese") and end in exactly one question with nothing written. The 16 are portions ("two eggs", "a slice of toast", "an apple at 3pm"), plain grams where the message gave them and the food has no portion, a named day and time, and the three-item breakfast. Resolution is by the plain `search_foods` only, so every word is one it finds (KEY-185, Amendment 2 H).

A food is named by its CoFID code, never by an id, because the ids of the seeded foods are made when the seed runs. `loggedItems` asks the database whether the `food_id` of each call is the row of one of the item's codes, and whether the `portion_id` belongs to that food. Several foods are right for one word (a boiled, a poached and a fried egg), so an item lists them all (`FOOD_ROUTES` in `fixtures/describeExtras.ts`). A food with a portion is expected as a count of that portion, and a food with none as the grams the message gave, so a guessed weight never passes. The time is expected only when the message names one, and the day only when it names another day than today. The graders are in `cases/entryGraders.ts`, shared with the write set.

`fixtures/describeExtras.ts` holds the foods the two sets resolve to, with their seed portions. The harness sources read no file, so `test/describeExtras.test.ts` reads `data/cofid/subset.txt` and `data/portions/cofid-portions.csv` and fails when a row differs, and `test/integration/describeWrites.test.ts` checks the same against the local database.

## The write set

`cases/writes.ts` has 29 cases: 20 that check one tool (`update_entry` 3, `delete_entry` 3, `copy_day` 3, `set_day_complete` 2, `create_recipe` 1, `archive_recipe` 2, `create_custom_food` 2 and `update_targets` 4), 7 Undo cases, 1 that sends the same message twice and 1 that logs yesterday's lunch again. The four writes that ask first (`delete_entry` of several entries, `copy_day` onto a day with entries, `archive_recipe`, `update_targets`) are each answered both ways: the first turn ends `confirm` and writes nothing, the confirm button's words write, and the cancel button's words write nothing. The words are the ones the buttons carry (`confirmDeleteButtons` and the others in core), because a button press is sent as the next message.

A write is graded by the database and by the arguments, and never by the wording of the reply: the call and its arguments, the `assistant_actions` rows the turn left (a write that landed has one, a write repeated has two), and the rows the write changed. `update_targets` for calories alone is graded as `macros: null` with the person's current calories as `current_kcal`, no question asked, and the question the app shows ending with the line about the macros (`describeMacrosAdjustedNote`, KEY-824). The driver reads that question from the `confirm` event (`TurnResult.confirmation`), since the line is added by the code and is not in the model's text.

**Undo.** `undoOnTurn` presses Undo twice on one turn, through `CaseEnvironment.undoTurn` (the same `POST assistant/undo` the card calls, as the eval user). The first press must answer `undone` for every action of the turn, the second `already_undone`, and the rows must be back (or gone, for a log). `update_entry` has no Undo (ADR 0006), and `update_targets` has none that works for the eval user: it has no programme, so the old numbers are kept nowhere and Undo answers unavailable. Neither has an Undo case.

**Isolation.** The eval user's rows are the run's, and every set reads them, so a write must not change what another case, or the ask set, expects:

1. A case that needs an entry makes it in an earlier turn, on a scratch day of its own (`scratchDayOf`, from ten days after today). No ask question and no diary day names those days, and no two cases share one. A case never edits or deletes a diary entry.
2. A recipe or a food a case archives or removes is one the case made, under a name of its own ("Scratch oat pot").
3. A case that logs for today (every describe case that logs, the same-message case, yesterday's lunch) presses Undo for its turns afterwards (`cleanUp`), because the ask set reads today and expects it empty.
4. A case that changes the targets restores the run's targets afterwards (`CaseEnvironment.restoreTargets`), because the ask set's "left" and "days at target" questions are worked out from them.

`cleanUp` runs after the graders and also when a turn failed, and a failure in it ends the case as an error, so a case that could not clean up is never reported as a pass. Case order does not matter.

**What it cannot show.** The "never repeated" rule has one case here, the same message twice, plus the exactly-one-action-row check in every write case. The other half of the ticket's rule, a failure of the MCP client after a tool ran, needs a way to make the served client fail, and the served function has none. That case is KEY-794's unit test of the turn loop.

## The eval user

`createFixtureUser` (in `src/fixtureUser.ts`) makes a new user on a **local** stack with the service role (it refuses any other address), then writes six weeks of synthetic diary from `fixtures/diary.ts` through the api-client repos: seeded foods, two recipes, weigh-ins and one day note. It also gets an `unlimited` plan for the `assistant` feature (the free plan stops at 15 turns a day, so turn 16 of a run would answer `day_limit`). Every value is made up, the email is under `.test`, and `remove()` deletes the user and, by cascade, every row. Two runs make two users that share no row.

## Tests

```sh
pnpm --filter @keylow/assistant-evals test               # unit tests, a stub driver, no stack and no key
pnpm --filter @keylow/assistant-evals test:integration   # the eval user and the usage reads, needs the local stack
```
