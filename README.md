# Ki-Lo

A MacroFactor-style nutrition app: recipe storage, calorie and macro tracking, weight trend, and an
adaptive engine that estimates energy expenditure from logged intake and weigh-ins and adjusts
calorie and macro targets weekly. Built by Zee for Zee, but to showcase quality: it must look and
behave like a product anyone could sign into.

Planning and engineering context live in Linear: project **KeyLow v1** and its document **Build Plan
& Engineering Context**. Read that document before picking up a ticket.

## Monorepo layout

pnpm workspaces + Turborepo. Packages are consumed as TypeScript source: no `dist/`, no `tsc -b`.

```
keylow/
├── apps/mobile           @keylow/mobile      Expo (current SDK), expo-router, NativeWind v4, dev client from day one (no Expo Go)
├── apps/web               @keylow/web         Next.js App Router, Tailwind + shadcn/ui, @supabase/ssr
├── packages/core          @keylow/core        pure domain logic: zod schemas, nutrient maths, unit conversion, engine/ (trend, expenditure, targets), dates/. Zero platform deps, no Node built-ins (runs in RN and Deno)
├── packages/db            @keylow/db          supabase/ (config, migrations, seed.sql, functions/, pgTAP tests), data/cofid/, scripts/ (import-cofid, gen-types, bundle-core-for-deno), src/types.gen.ts (committed, CI-checked)
├── packages/api-client    @keylow/api-client  KeyLowProvider, query-key factory, repos/ (plain async fns over SupabaseClient<Database>), hooks/ (TanStack Query), edge.ts. react / react-query / supabase-js as peerDependencies
├── packages/tokens        @keylow/tokens      colours, spacing, type scale as a Tailwind preset consumed by NativeWind and Tailwind
├── packages/config        @keylow/config      eslint flat configs, prettier, tsconfig fragments
└── docs/adr, docs/runbooks
```

The pnpm workspace globs are `apps/*`, `packages/*` and `tools/*`. `tools/*` holds developer tooling
that no app depends on (today `tools/design-export`, which renders the approved designs into
`docs/design/`).

## Tooling

Root prettier is the single formatting gate for the whole repo, so packages do not define their own
`format:check` script. The root prettier config becomes the shared `@keylow/config` one when KEY-15
lands.

## Local development

See [`docs/runbooks/local-dev.md`](docs/runbooks/local-dev.md) for the full setup and workflow. It is
the way to get both apps running against a local Supabase stack from a fresh clone.
