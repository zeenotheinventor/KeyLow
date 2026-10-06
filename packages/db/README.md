# @keylow/db

The Supabase project for KeyLow: `supabase/` holds the config, migrations, seed data and pgTAP tests, and `src/types.gen.ts` holds the generated TypeScript types. The types are committed and CI checks them for drift.

```ts
import type { Database } from "@keylow/db";
```

## Prerequisites

Docker running, the Supabase CLI installed, and Node 22.18 or later (the scripts run TypeScript with Node's built-in type stripping).

Everything below except `dev:db` and `stop:db` needs the local stack to be running, so start it first.

## Commands

Run these from the repo root with `pnpm --filter @keylow/db run <script>`. `gen-types` and `check:integration` also have root shortcuts.

| Script              | What it does                                                                  |
| ------------------- | ----------------------------------------------------------------------------- |
| `dev:db`            | Starts the local stack (`supabase start`).                                    |
| `stop:db`           | Stops it.                                                                     |
| `db:reset`          | Recreates the database, applies the migrations and loads `supabase/seed.sql`. |
| `gen-types`         | Regenerates `src/types.gen.ts` from the running local database.               |
| `test:integration`  | Runs the pgTAP tests in `supabase/tests/` (`supabase test db`).               |
| `lint`, `typecheck` | Check the scripts and the source.                                             |

## Types

`pnpm gen-types` at the repo root runs `scripts/gen-types.ts`, which asks the Supabase CLI for the types, writes them to `src/types.gen.ts` and formats the file with Prettier. It connects by database URL, `postgresql://postgres:postgres@127.0.0.1:54322/postgres` by default. Set `SUPABASE_DB_URL` if the local stack uses a different database port. The CLI insists on an access token before it generates types, even over a database URL, so the script supplies a placeholder token itself when `SUPABASE_ACCESS_TOKEN` is not set. The placeholder is only format-checked and never sent anywhere, and a real `SUPABASE_ACCESS_TOKEN` is honoured if you have one. Never edit that file by hand. After a migration changes the schema, run `db:reset` and then `gen-types`, and commit the result. On a clean checkout against a freshly reset database, `gen-types` leaves no diff.

## Tests

`pnpm check:integration` at the repo root runs `test:integration` for every package that has it. Each file in `supabase/tests/` runs inside a transaction that is rolled back, as the `postgres` role, so tests change nothing. The Supabase CLI installs pgTAP itself before it runs them, so the migrations never enable it.

`profiles_rls.test.sql` acts as two users and as `anon` to assert the owner-only policies on `public.profiles`. A test acts as a user by setting `role authenticated` and the `request.jwt.claims` setting, then returns to `postgres` with `reset role`.
