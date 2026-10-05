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

## Scripts

```sh
pnpm --filter @keylow/api-client lint
pnpm --filter @keylow/api-client typecheck
pnpm --filter @keylow/api-client test
```
