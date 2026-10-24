# @keylow/api-client

The data-access package. It gives web and mobile one place to get a configured `SupabaseClient` and a TanStack Query context. It is consumed as source: there is no build step.

| Path                     | Holds                                                                  |
| ------------------------ | ---------------------------------------------------------------------- |
| `src/KeyLowProvider.tsx` | `KeyLowProvider` and the `useSupabase()` hook                          |
| `src/queryKeys.ts`       | The query-key factory, `keys`                                          |
| `src/edge.ts`            | `invokeEdgeFunction`, a thin wrapper over `client.functions.invoke`    |
| `src/repos/`             | Plain async functions over `SupabaseClient<Database>` (filled from M2) |
| `src/hooks/`             | TanStack Query hooks over the repos (filled from M2)                   |

## Peer dependencies

`react` (^19), `@tanstack/react-query` (^5) and `@supabase/supabase-js` (^2) are peer dependencies, so each app controls their versions.

## Wrapping an app

Create the Supabase client in the app and pass it to `KeyLowProvider` at the root. The provider creates a `QueryClient` for you, or accepts one through the `queryClient` prop.

```tsx
import { createClient } from "@supabase/supabase-js";
import { KeyLowProvider, type Database } from "@keylow/api-client";

const client = createClient<Database>(supabaseUrl, supabaseAnonKey);

export function Root({ children }: { children: React.ReactNode }) {
  return <KeyLowProvider client={client}>{children}</KeyLowProvider>;
}
```

Anything below the provider can call `useSupabase()` for the client and TanStack Query's `useQueryClient()` for the query client. `useSupabase()` throws when it is used outside the provider.

`queryClient` is read once, on the first render. Changing the prop later has no effect.

## Database type

`Database` is a placeholder until KEY-20 generates the real one at `packages/db/src/types.gen.ts`. The first consumer that needs the real type swaps the import in `src/database.types.ts`.

## Hooks worth knowing

| Hook                                   | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useFoodSearch(query)`                 | Debounced local search with an Open Food Facts fallback. `isDebouncing` says the user has typed and the search is waiting (see below).                                                                                                                                                                                                                                                                                                   |
| `useFoodByBarcode(code)`               | Local lookup, then Open Food Facts. Never retried, and not repeated on focus or reconnect.                                                                                                                                                                                                                                                                                                                                               |
| `useFoodWithPortions(id)`              | One screen state for a food: `loading`, `error`, `notFound` or `ready`. A failed background refetch never replaces a `ready` food.                                                                                                                                                                                                                                                                                                       |
| `useOwnFoods()`                        | The signed in user's own foods by name, a page of 50 at a time, with no query. `data` is every food loaded so far, and `fetchNextPage` loads the next page. Key `keys.foods.own`. Creating, updating or deleting a food refreshes every page loaded.                                                                                                                                                                                     |
| `useDiaryDay(localDate, { enabled })`  | One diary day: its live entries as a flat list ordered by `logged_at`, `created_at`, then `id` (group with `groupEntriesByHour` from core), its `day_logs` row and its `day_totals` row. Key `keys.diary.day(localDate)`.                                                                                                                                                                                                                |
| `useLogEntry(id, { enabled })`         | One live entry by its id, or null when there is none, for the screen that edits it. It starts from the entry in a cached day, and every write keeps it current. Key `keys.diary.entry(id)`.                                                                                                                                                                                                                                              |
| `useDiaryWeek(weekStart, { enabled })` | Seven days, Monday to Sunday, each with its totals and day log, or null. No day log means not complete. `weekStart` must be a Monday. Key `keys.diary.week(weekStart)`.                                                                                                                                                                                                                                                                  |
| `useCompleteDays(month, { enabled })`  | The dates in a month (`YYYY-MM`) marked complete, from `day_logs` only. Key `keys.diary.completeDays(month)`.                                                                                                                                                                                                                                                                                                                            |
| `useRecentFoods({ enabled })`          | The newest distinct foods logged, each with the snapshot of its last entry. Key `keys.diary.recentFoods`. It looks at the newest 200 live food entries only, so it can hold fewer foods than its limit (20).                                                                                                                                                                                                                             |
| `useTargets({ enabled, localDate })`   | The signed in user's targets (`kcal`, `protein_g`, `carbs_g`, `fat_g`), each null when not set. A null `kcal` is the diary's no-target state. While a program is active the current `targets` row (`source: 'engine'`, with `dowCaloriesKcal`), otherwise the profile's manual targets (`source: 'manual'`). With `localDate`, `kcal` is that day's figure (core's `dayTarget`), and without it the week's. Key `keys.profiles.targets`. |
| `useUpdateTargets()`                   | Saves your own targets after core's `validateTargets` (800 to 6,000 kcal, macros 0 or more; a refusal is a `TargetsValidationError`). Ends the active program first (`ended_on` and `updated_at` only), writes only the target columns, then invalidates `keys.profiles.targets`, `keys.program.all` and `keys.diary.all`.                                                                                                               |
| `useProfileTimeZone({ enabled })`      | The IANA time zone of the profile, which the diary reads its days and hours in. Key `keys.profiles.timeZone`.                                                                                                                                                                                                                                                                                                                            |
| `useDebouncedValue(v, ms)`             | The debounce `useFoodSearch` uses, exported so a screen does not need its own copy.                                                                                                                                                                                                                                                                                                                                                      |

### Diary reads and the terms gate

Every diary read takes `enabled`, and `enabled: false` makes no request. The mobile app stays mounted under the terms cover, so its screens pass `enabled: !needsTermsAcceptance(...)`. All four keys sit under `keys.diary.all`, so one invalidation refreshes a diary after a write. Rows are parsed with the core diary schemas, and a row that does not fit fails the read with an error that names the row id and the field paths only, never the values (they are health data).

### Diary writes

Food is logged at a time, not in a meal: no mutation takes or returns a meal slot. Writes need a connection (there is no offline queue). Entries are built with the core builders and `recomputeEntry` / `refreshEntryFromFood`, so the hooks only move data.

| Hook                | Takes and returns                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useLogFood()`      | `{ food, quantity, unit, portion?, loggedAt, localDate }`, where `loggedAt` (an ISO string) and `localDate` come from `defaultLoggedAt` in core. Resolves to the stored entry.                                                                                                                                                                                                                                                                             |
| `useQuickAdd()`     | `{ kcal, protein_g?, fat_g?, carbs_g?, label?, loggedAt, localDate }`. Resolves to the stored entry.                                                                                                                                                                                                                                                                                                                                                       |
| `useUpdateEntry()`  | `{ entry, amount?, useCurrentFoodData?, time? }` for a food, `{ entry, quick?, time? }` for a quick add (`quick` is `{ kcal, protein_g, carbs_g, fat_g, label }`, written as the whole `nutrients` object and the `snapshot`), written in one request. `amount` recomputes from the entry's own snapshot, `useCurrentFoodData` is "Update to current food data" (an unfiltered `getFood`), `time` is `{ loggedAt, timeZone }` and recomputes `local_date`. |
| `useDeleteEntry()`  | The entry. Soft deletes it (`deleted_at`).                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `useRestoreEntry()` | The entry. Clears `deleted_at` (the 5 s Undo).                                                                                                                                                                                                                                                                                                                                                                                                             |

For the one-tap plus, call `mutateAsync` of `useLogFood` once per tap: calls do not wait for each other and each resolves to the entry it stored, so the toast's Undo passes that entry to `useDeleteEntry` and removes only it. (`mutate` callbacks fire for the latest call only.)

Cache: a stored or edited entry is put into its cached day in time order at once, a delete and a restore update the day before the request answers (and undo that if it fails), and then every cached day, every cached week and the recent foods are marked stale and refetched if on screen. The complete days are not touched. Day totals are not adjusted by hand: they come from the database on the refetch.

### Copying a day and marking a day complete

`useCopyDay()` copies a whole day, never one meal (brief 16). Call `mutate({ from, to, timeZone })` with both days as `YYYY-MM-DD` and the profile's IANA time zone. `from` and `to` must be different days, or it throws a `RangeError` before any request. Every live entry of `from` is copied with its snapshot and nutrients unchanged, at the same clock time on `to` as the zone's wall clock reads it (08:05 stays 08:05 across a clock change), keeping the seconds of the original, so a copy is the same clock instant on the target day. A time the clocks skip on the target day moves forward: 01:30 copied onto the day the clocks go forward in London becomes 02:30.

The result is `{ localDate, count, entryIds }`: `count` is the number for the toast ("Copied 8 entries from yesterday"), and a day with nothing logged writes nothing and gives 0. The timeline orders by instant, then `created_at`. Copies are added after what the day holds: they are inserted as sequential round trips in the order of the source day, so each gets a later `created_at` than the one before and than any entry already on the day. A copy at the same instant as an existing entry therefore sorts after it, and copies at the same instant keep their order.

A copy that fails part way takes back the rows it wrote, so a copy is all of the day or none of it. If they cannot be taken back either, it throws a `CopyDayPartialWriteError` whose `entryIds` are the copies left on the day, which the UI can pass to `undoCopyDay` to finish the clean-up. The error never carries the database's own error, whose details can quote a row. Pass the result of a copy to `useUndoCopyDay()`, which soft deletes exactly those rows by id and leaves anything logged since. Both refresh the target day, its week and the recent foods.

`useSetDayComplete()` takes `{ localDate, complete }`. The cached day and week show the change at once and are put back if the write fails. Toggles run one after the other, in the order they were made, so the last tap is what the server keeps. After the write the day, its week and the month's complete days are refreshed. It writes `day_logs` with an update and then an insert rather than an upsert, because clients may update `is_complete`, `completed_at` and `note` only, and an upsert's `DO UPDATE` also sets the key columns.

### The debounce signal

`useFoodSearch` returns `isDebouncing`. It is true from the moment the trimmed query changes until the query has stayed the same for `debounceMs` and so starts to be searched. In that gap the results on show belong to the previous query, so an empty list there means "typed and waiting", not "searched and found nothing". It is a state of the query, so the name says what is happening (`isDebouncing`) instead of what it is not (`isIdle`, which would also be true before anything is typed). With `debounceMs: 0` the gap is a single render. It is false when `enabled` is false and when only the whitespace around the query changed.

### Error kinds

The Open Food Facts error of `useFoodSearch` and `useFoodByBarcode` (`FoodSearchOffError`) carries a `kind` and no sentence. A `kind` is one of the nine Edge Function codes (`not_found`, `rate_limited`, `upstream_error`, `invalid_request`, `unauthorized`, `internal_error`, `bad_mode`, `no_program`, `missing_stats`) or `failed` when the failure was not a typed answer (no network, or a body that was not an edge error). The local search error (`localError`) always has the kind `failed`, and the `error` state of `useFoodWithPortions` carries only a `debugMessage`. A rate limit also carries `retryAfterSeconds` when the server said how long to wait.

The screen turns a kind into words with `describeEdgeError` from `@keylow/core`, at the call site. The raw text of a failure is in `debugMessage`, for logs and bug reports only. It can carry upstream or database wording, so the UI must never render it. `message` on the same objects holds the same text and stays only until the screens stop reading it.

## Scripts

```sh
pnpm --filter @keylow/api-client lint
pnpm --filter @keylow/api-client typecheck
pnpm --filter @keylow/api-client test
```
