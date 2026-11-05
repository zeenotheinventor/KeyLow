# @keylow/assistant-evals

The harness that judges the Ki-Lo assistant: a case type, deterministic graders, a runner with a token budget, and a synthetic eval user. It is the acceptance mechanism of ADR 0006 ("Evals"). The case sets (KEY-699 to KEY-702) are added by their own tickets. The ask set (KEY-699, `cases/ask.ts`) and the compaction set (KEY-706, `cases/compaction.ts`) are registered so far.

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

The set is meant to be copied by the next sets: a spec in plain data (`AskSpec`), the graders made from it, and one test that builds the reply a model would give if it were right and checks that every grader passes it.

## The compaction set

`cases/compaction.ts` has one case. It seeds a long, text-only conversation for the run's own eval user (45 turns, one early reply that says "Your average last week was 1,850 kcal a day"), sends one short message so the prompt passes the 20,000 token compaction threshold, waits for the note to be stored (`compacted_through_turn_id` set, polled once a second for up to 60 s), and then asks what the assistant said the average was. It passes when the note was stored for the first turn and the answer holds 1,850. The turns are seeded by `src/caseEnvironment.ts` with the service role, because only the service role writes the conversation tables. About 55,000 to 65,000 tokens are expected for the whole set (an estimate, not yet measured: the first live run, through the `assistant-evals` workflow, gives the figure).

## The eval user

`createFixtureUser` (in `src/fixtureUser.ts`) makes a new user on a **local** stack with the service role (it refuses any other address), then writes six weeks of synthetic diary from `fixtures/diary.ts` through the api-client repos: seeded foods, two recipes, weigh-ins and one day note. It also gets an `unlimited` plan for the `assistant` feature (the free plan stops at 15 turns a day, so turn 16 of a run would answer `day_limit`). Every value is made up, the email is under `.test`, and `remove()` deletes the user and, by cascade, every row. Two runs make two users that share no row.

## Tests

```sh
pnpm --filter @keylow/assistant-evals test               # unit tests, a stub driver, no stack and no key
pnpm --filter @keylow/assistant-evals test:integration   # the eval user and the usage reads, needs the local stack
```
