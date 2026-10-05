# 0001: Monorepo, package layout and TypeScript source consumption

## Status

Accepted, 2026-09-22

## Context

KeyLow ships an Expo mobile app and a Next.js web app on one shared core (domain logic, data access, design tokens). The dependency manager, build orchestrator, package layout and TypeScript configuration strategy need to be fixed before the M1 scaffold ticket runs, so that engineers building M2 onward can rely on the layout instead of re-deriving it from the Build Plan & Engineering Context document each time.

## Decision

We use pnpm 10 workspaces with Turborepo 2. Packages are consumed as TypeScript source: no package `dist/`, no `tsc -b` project build step. Every consumer (Metro, Next.js, Vitest, and the Deno bundle used by edge functions) resolves workspace packages directly from source.

### Package layout

```
keylow/
├── apps/mobile          @keylow/mobile      Expo (current SDK), expo-router, NativeWind v4, dev client from day one (no Expo Go)
├── apps/web             @keylow/web         Next.js App Router, Tailwind + shadcn/ui, @supabase/ssr
├── packages/core        @keylow/core        pure domain logic: zod schemas, nutrient maths, unit conversion, engine/ (trend, expenditure, targets), dates/. Zero platform deps, no Node built-ins (runs in RN and Deno)
├── packages/db          @keylow/db          supabase/ (config, migrations, seed.sql, functions/, pgTAP tests), data/cofid/, scripts/ (import-cofid, gen-types, bundle-core-for-deno), src/types.gen.ts (committed, CI-checked)
├── packages/api-client  @keylow/api-client  KeyLowProvider, query-key factory, repos/ (plain async fns over SupabaseClient<Database>), hooks/ (TanStack Query), edge.ts. react / react-query / supabase-js as peerDependencies
├── packages/tokens      @keylow/tokens      colours, spacing, type scale as a Tailwind preset consumed by NativeWind and Tailwind
├── packages/config      @keylow/config      eslint flat configs, prettier, tsconfig fragments
└── docs/adr, docs/runbooks
```

### No shared UI package in v1

No shared UI package in v1. Share logic, hooks and tokens only. Mobile charts `victory-native`, web charts Recharts, both fed by the same hooks.

### TS config strategy

One `tsconfig.base.json` (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `moduleResolution: Bundler`, `noEmit`); packages extend it; mobile uses `"extends": ["expo/tsconfig.base", "../../tsconfig.base.json"]`; no `paths` aliases across packages. The base compiler options live in `packages/config/tsconfig/base.json` and the root `tsconfig.base.json` extends it, because tooling that resolves `extends` through the workspace symlink without realpathing it (Vite's tsconfig loader) cannot follow a relative path that leaves the package directory. Edge functions are excluded from Node tsconfigs and typed by Deno.

### Expo + pnpm gotchas

Belong in the M1 scaffold ticket: `.npmrc` with `node-linker=hoisted`; `pnpm.overrides` pinning one `react` / `react-dom` to the SDK's version; Metro config with `watchFolders = [workspaceRoot]`, `nodeModulesPaths` for both roots, `disableHierarchicalLookup: true`, wrapped in `withNativeWind`; workspace packages ship correct `exports` maps; `.easignore` excluding `apps/web`, e2e, docs, `packages/db/data`; jest-expo `transformIgnorePatterns` including `@keylow/.*`; `pnpm dedupe --check` and `expo-doctor` in CI; never put `react-native` or native modules in `packages/*`.

### Next.js package consumption

Next: `transpilePackages: ['@keylow/core','@keylow/api-client','@keylow/db','@keylow/tokens']`; Vercel root directory `apps/web`, include files outside root, `npx turbo-ignore` as the ignored-build step.

## Consequences

- No package ever publishes a build output. Adding a `dist/` step or a `tsc -b` project reference to any package reverses this decision and needs a new ADR.
- The package layout above is the fixed tree for v1. Adding, removing or moving a package updates this ADR.
- There is no shared UI package in v1. A future need for one is a new decision, not something to build ad hoc inside `packages/tokens` or an app.
- The TS config strategy (one base config, no cross-package `paths` aliases, Deno typing the edge functions separately) is a convention engineers must not undo.
- The Expo + pnpm gotchas list is the checklist the M1 scaffold ticket must implement. A regression against any item on it (for example, dropping `node-linker=hoisted` or letting a native module into `packages/*`) is a bug, not a style choice.
