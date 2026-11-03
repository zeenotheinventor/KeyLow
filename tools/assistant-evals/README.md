# @keylow/assistant-evals

The harness that judges the Ki-Lo assistant: a case type, deterministic graders, a runner with a token budget, and a synthetic eval user. It is the acceptance mechanism of ADR 0006 ("Evals"). The case sets (KEY-699 to KEY-702) are added by their own tickets, so for now no case is registered and a run ends with a message and exit code 1.

`src/httpDriver.ts` is the `TurnDriver` against the served `assistant` function: it posts each message as the eval user, reads the stream with core's `parseAssistantEvent` and resolves when `done` arrives. `src/httpSession.ts` opens the session for `check:assistant` on the local stack (the eval user, the driver and the eval user's own view of the database). The stream carries no tool calls, so the driver reads them from the turn's stored messages, and it has no source for each tool's `readOnlyHint`: the `mcp` function lists tools only for an open turn. Until a case set needs it, a tool call has no hint and counts as a write.

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

Thresholds are in `src/thresholds.ts`: 90% ask, 80% describe (first pass), 100% red-team. A case ends `passed`, `failed` (the assistant missed), `error` (the harness or the infrastructure failed: a driver or database error, a failed turn, or a case over its 120 s wall-clock ceiling) or `not_run`. Errors are reported on their own and are misses for the exit code.

## The eval user

`createFixtureUser` (in `src/fixtureUser.ts`) makes a new user on a **local** stack with the service role (it refuses any other address), then writes six weeks of synthetic diary from `fixtures/diary.ts` through the api-client repos: seeded foods, two recipes, weigh-ins and one day note. Every value is made up, the email is under `.test`, and `remove()` deletes the user and, by cascade, every row. Two runs make two users that share no row.

## Tests

```sh
pnpm --filter @keylow/assistant-evals test               # unit tests, a stub driver, no stack and no key
pnpm --filter @keylow/assistant-evals test:integration   # the eval user and the usage reads, needs the local stack
```
