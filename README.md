# Ki-Lo

Ki-Lo is a MacroFactor-style nutrition app: food and recipe logging and calorie and macro tracking
today, with a weight trend and an adaptive engine (it estimates energy expenditure from logged
intake and weigh-ins and adjusts targets weekly) still to come. It is an Expo app, built for Android
first, and a Next.js web app, both on one Supabase backend.

Zee built it for Zee, and to showcase quality: it must look and behave like a product anyone could
sign into. The product has been called Ki-Lo since 2026-10-08. The repository, the `@keylow/*`
packages, the bundle ids (`com.sojisoft.keylow`) and the Linear key `KEY` keep the KeyLow name on
purpose, so nothing that depends on them had to move.

## What works today

Everything below is merged to `main` and reachable through a route in `apps/*/app`.

**Mobile (Android dev client and production build)**

- Sign-up and sign-in with email or Google. Accepting the terms is required before anything else.
- Dashboard with today's nutrition and a this-week card.
- Food search over CoFID and Open Food Facts, with camera barcode scanning.
- Custom foods: create, edit and copy a food.
- Diary: an hour-by-hour timeline, portion picker, quick add, edit, delete with undo, copy
  yesterday, and a day-complete flag.
- Recipes: editor, library, archive, and logging a serving to the diary.
- Targets, appearance (light and dark), and About with the version and commit.

**Web (Next.js)**

- The same sign-up, sign-in and terms acceptance flows.
- Dashboard, food search (the barcode is typed, as the web has no camera) and custom foods.
- Diary day and week views with quick add, edit, delete with undo, copy yesterday and a day-complete flag for food entries.
- Recipes: editor, library and archive. The Your recipes group in Add food logs one serving with a tap. Choosing another amount, refreshing ingredients and editing a logged recipe are not on the web yet.
- Targets, appearance, About, and the public `/privacy` and `/terms` pages.

**Milestones** in the Linear project [KeyLow v1](https://linear.app/sojisoft/project/keylow-v1-7d18906a267f):

- M1 Foundations: done.
- M2 Food data and search: done.
- M3 Food diary: built on both apps, with a few polish tickets still open.
- M4 Recipes: built on mobile and mostly on the web, then its exit gate.
- M5 Weight and trend: under way. Weigh-in screens are not in the apps yet.
- M6 Adaptive engine and program, M7 Stats, QA and personal install, M8 AI assistant, and M9 Assistant: palate, recipe generation and meal plans are planned.

Strength training is a second Linear project,
[KeyLow Strength Training](https://linear.app/sojisoft/project/keylow-strength-training-16f672df3163).
Its data model and heat model are in, and it has no screens yet.

## Architecture

pnpm workspaces and Turborepo. Packages are consumed as TypeScript source, so there is no `dist/`
and no `tsc -b`. The stack is Expo SDK 57 with a dev client (no Expo Go), expo-router, NativeWind,
Reanimated, Skia, Victory Native, Geist and Lucide on mobile. The web app is Next.js 16 (App Router)
with Tailwind and `@supabase/ssr`.

```
keylow/
├── apps/mobile          @keylow/mobile      Expo app
├── apps/web             @keylow/web         Next.js app, plus its Storybook
├── packages/core        @keylow/core        pure domain logic: schemas, nutrient maths, engine, dates, copy
├── packages/db          @keylow/db          Supabase migrations, seeds, Edge Functions, pgTAP tests, generated types
├── packages/api-client  @keylow/api-client  query keys, repos and TanStack Query hooks over Supabase
├── packages/tokens      @keylow/tokens      colours, spacing and type as a Tailwind preset for both apps
├── packages/config      @keylow/config      eslint, prettier and tsconfig fragments
├── tools/               design-export, expo-doctor-gate, generate-lists
├── scripts/             ci-scope.mjs, which picks what a change affects
└── docs/
    ├── adr/             architecture decisions
    ├── runbooks/        local-dev.md, error-monitoring.md
    ├── design/          the approved screen designs, exported
    └── ci.md            CI and deployment
```

Two rules shape the code. Anything with a branch lives in `@keylow/core` (see
[the recipe cache in ADR 0003](docs/adr/0003-data-model.md#the-computed-cache)), and only plain
arithmetic is repeated in SQL. Core has no platform dependencies and runs in React Native, Node and
Deno. Snapshots (a diary entry's nutrients, a recipe ingredient's food) are computed in core at
write time, so editing a food later never rewrites history.

The decisions are recorded as ADRs:

- [0001: Monorepo, package layout and TypeScript source consumption](docs/adr/0001-monorepo.md)
- [0002: Adaptive engine shape, keylow-engine-v1](docs/adr/0002-engine-v1.md)
- [0003: Data model (Supabase Postgres)](docs/adr/0003-data-model.md)
- [0004: Error monitoring with Sentry](docs/adr/0004-error-monitoring.md)
- [0005: Workout tracking, muscle heat model and body map, keylow-training-v1](docs/adr/0005-training-v1.md)

## Running it locally

```sh
pnpm install
pnpm dev:db
pnpm --filter @keylow/web dev
```

The mobile app runs on a development client over your LAN, with `pnpm mobile:dev`. The prerequisites,
env files, seeds and phone setup are in [`docs/runbooks/local-dev.md`](docs/runbooks/local-dev.md).

## Checks and CI

Run these from the repo root:

- `pnpm check`: format, lint, typecheck and test across the whole repo.
- `pnpm check:affected`: the same checks, limited to what your change can reach.
- `pnpm check:integration`: Edge Function checks and the pgTAP and function suites. Needs the local stack running and the functions served.
- `pnpm generate:lists`: writes the generated, uncommitted lists the mobile app needs.
- `pnpm mobile:dev`: pulls, installs and starts Metro for the dev client.
- `pnpm storybook`: starts the web Storybook on port 6006.
- `pnpm gen-types`: regenerates the database types. Run it after every migration.
- `pnpm dev:db`: starts the local Supabase stack.

Run `pnpm check:affected` from inside the checkout you are pushing from, and fix failures locally.
CI should never be the first place a formatting or lint error shows up. The parallel jobs, the
`checks` aggregator, auto-merge on approval and scoped runs are described in [`docs/ci.md`](docs/ci.md).

## Shipping

- **Web:** Vercel deploys `main` only. Pull requests get no preview (see [`docs/ci.md`](docs/ci.md)).
- **Database and Edge Functions:** `deploy-supabase.yml` applies migrations and deploys functions
  when a merge touches `packages/db/supabase` or `packages/core/src`.
- **Mobile, JavaScript changes:** `eas-update.yml` publishes an over-the-air update to the
  `production` channel on every qualifying merge. It sets the commit in `EXPO_PUBLIC_COMMIT_SHA`,
  which About shows.
- **Mobile, native changes:** a new native dependency, config plugin or SDK bump moves the
  fingerprint. OTA updates stop reaching old builds, so a new `production-apk` build is needed.

A phone can hold the dev client and the production app side by side, because they have different
package ids. See [Two Ki-Lo apps on one phone](docs/runbooks/local-dev.md#two-ki-lo-apps-on-one-phone).

## Monitoring and privacy

Sentry reports errors from mobile, web and the Edge Functions, in the EU region. Each event is rebuilt
from an allow-list: no email, name or message text, no session replay, and on mobile and web the
account id as the only user detail. The rules and the reasons are in
[ADR 0004](docs/adr/0004-error-monitoring.md), and reading an event or rolling back a bad update is
in [`docs/runbooks/error-monitoring.md`](docs/runbooks/error-monitoring.md).

The privacy policy and terms are served by the web app at `/privacy` and `/terms`, and the mobile
About screen links to them. Sojisoft Limited is the data controller. Weight, diary and body stats
are health data, so no health values go into logs, error reports or analytics.

Food data comes with licence conditions that the apps show on About:

- Open Food Facts, under the Open Database Licence (ODbL) v1.0.
- McCance and Widdowson's CoFID, under the Open Government Licence v3.0.

## Conventions

- No em dashes in prose, and no `--` standing in for one.
- No raw hex colours and no inline `style`. Use design tokens and Tailwind or NativeWind utilities.
- In tests, query by role and accessible name first. A test id is the last resort.
- No frame, no screen ticket: UI work follows an approved design in
  [`docs/design`](docs/design/README.md), and a design change goes back to Zee, not into the code.
- One ticket per pull request, and every pull request has a QA section with the click-path.
- Work in a git worktree per ticket, and never commit from the main checkout.
