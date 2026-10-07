# @keylow/db

The Supabase project for KeyLow: `supabase/` holds the config, migrations, seed data, pgTAP tests and Edge Functions, and `src/types.gen.ts` holds the generated TypeScript types. The types are committed and CI checks them for drift.

```ts
import type { Database } from "@keylow/db";
```

## Prerequisites

Docker running, the Supabase CLI installed, and Node 22.18 or later (the scripts run TypeScript with Node's built-in type stripping).

Everything below except `dev:db`, `stop:db`, `bundle-core-for-deno` and `check:functions` needs the local stack to be running, so start it first.

## Commands

Run these from the repo root with `pnpm --filter @keylow/db run <script>`. `gen-types` and `check:integration` also have root shortcuts.

| Script                 | What it does                                                                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `dev:db`               | Starts the local stack (`supabase start`).                                                                                                 |
| `stop:db`              | Stops it.                                                                                                                                  |
| `migration:up`         | Applies the migrations the local database does not have yet, keeping its data.                                                             |
| `db:reset`             | Recreates the database from nothing. Only for a broken local database, and announce it first. It wipes the database every checkout shares. |
| `gen-types`            | Regenerates `src/types.gen.ts` from the running local database.                                                                            |
| `test:integration`     | Runs the pgTAP tests in `supabase/tests/` (`supabase test db`).                                                                            |
| `bundle-core-for-deno` | Bundles `@keylow/core` into `supabase/functions/_shared/core/` for the Edge Functions.                                                     |
| `check:functions`      | Bundles core, then type-checks and lints the Edge Functions under Deno.                                                                    |
| `lint`, `typecheck`    | Check the scripts and the source.                                                                                                          |

## Types

`pnpm gen-types` at the repo root runs `scripts/gen-types.ts`, which asks the Supabase CLI for the types, writes them to `src/types.gen.ts` and formats the file with Prettier. It connects by database URL, `postgresql://postgres:postgres@127.0.0.1:54322/postgres` by default. Set `SUPABASE_DB_URL` if the local stack uses a different database port. The CLI insists on an access token before it generates types, even over a database URL, so the script supplies a placeholder token itself when `SUPABASE_ACCESS_TOKEN` is not set. The placeholder is only format-checked and never sent anywhere, and a real `SUPABASE_ACCESS_TOKEN` is honoured if you have one. Never edit that file by hand. After a migration changes the schema, apply it with `migration:up` (never `db:reset`, which wipes the database every checkout on the machine shares) and then run `gen-types`, and commit the result. On a clean checkout with every migration applied, `gen-types` leaves no diff.

## Edge Functions

`supabase/functions/` holds the Edge Functions and their shared helpers. They run under Deno, so ESLint and `tsc` skip them and `check:functions` covers them instead. Functions import `@keylow/core` through a bundle that `bundle-core-for-deno` writes to `supabase/functions/_shared/core/`. That folder is gitignored and easignored, so write it again after any change in `packages/core` and after a fresh clone. `check:functions` bundles core itself before it checks, and `pnpm check:integration` at the repo root runs it. The bundle also holds a copy of `src/types.gen.ts` as `database.types.ts`, which types the Supabase clients in the functions. How to serve the functions locally is in `docs/runbooks/local-dev.md`.

`supabase/functions/deno.json` pins `jsr:@supabase/supabase-js` to an exact version, the one the apps resolve. Bump the pin together with the apps' supabase-js. It also sets `"lock": false`, because otherwise every `deno check` writes an untracked `deno.lock` next to `deno.json`.

## Tests

`pnpm check:integration` at the repo root runs `test:integration` for every package that has it. Each file in `supabase/tests/` runs inside a transaction that is rolled back, as the `postgres` role, so tests change nothing. The Supabase CLI installs pgTAP itself before it runs them, so the migrations never enable it.

`profiles_rls.test.sql` acts as two users and as `anon` to assert the owner-only policies on `public.profiles`. A test acts as a user by setting `role authenticated` and the `request.jwt.claims` setting, then returns to `postgres` with `reset role`.
