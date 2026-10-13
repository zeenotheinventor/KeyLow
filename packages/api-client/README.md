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

| Hook                       | Notes                                                                                                                                  |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `useFoodSearch(query)`     | Debounced local search with an Open Food Facts fallback. `isDebouncing` says the user has typed and the search is waiting (see below). |
| `useFoodByBarcode(code)`   | Local lookup, then Open Food Facts. Never retried, and not repeated on focus or reconnect.                                             |
| `useFoodWithPortions(id)`  | One screen state for a food: `loading`, `error`, `notFound` or `ready`. A failed background refetch never replaces a `ready` food.     |
| `useOwnFoods()`            | The signed in user's own foods by name, up to 200, with no query. Key `keys.foods.own`. Creating or updating a food refreshes it.      |
| `useDebouncedValue(v, ms)` | The debounce `useFoodSearch` uses, exported so a screen does not need its own copy.                                                    |

### The debounce signal

`useFoodSearch` returns `isDebouncing`. It is true from the moment the trimmed query changes until the query has stayed the same for `debounceMs` and so starts to be searched. In that gap the results on show belong to the previous query, so an empty list there means "typed and waiting", not "searched and found nothing". It is a state of the query, so the name says what is happening (`isDebouncing`) instead of what it is not (`isIdle`, which would also be true before anything is typed). With `debounceMs: 0` the gap is a single render. It is false when `enabled` is false and when only the whitespace around the query changed.

### Error kinds

The Open Food Facts error of `useFoodSearch` and `useFoodByBarcode` (`FoodSearchOffError`) carries a `kind` and no sentence. A `kind` is one of the six Edge Function codes (`not_found`, `rate_limited`, `upstream_error`, `invalid_request`, `unauthorized`, `internal_error`) or `failed` when the failure was not a typed answer (no network, or a body that was not an edge error). The local search error (`localError`) always has the kind `failed`, and the `error` state of `useFoodWithPortions` carries only a `debugMessage`. A rate limit also carries `retryAfterSeconds` when the server said how long to wait.

The screen turns a kind into words with `describeEdgeError` from `@keylow/core`, at the call site. The raw text of a failure is in `debugMessage`, for logs and bug reports only. It can carry upstream or database wording, so the UI must never render it. `message` on the same objects holds the same text and stays only until the screens stop reading it.

## Scripts

```sh
pnpm --filter @keylow/api-client lint
pnpm --filter @keylow/api-client typecheck
pnpm --filter @keylow/api-client test
```
