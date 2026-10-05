# @keylow/core

Pure domain logic shared by every Keylow app: zod schemas, nutrient maths, unit conversion, the engine and date helpers. It is consumed as TypeScript source, so there is no build step.

## Purity rules

Core runs in React Native and Deno, and the engine must stay reproducible (ADR 0002). So code in `src/`:

- has no platform dependencies: no React, React Native, Expo, Next.js or Supabase
- uses no Node built-ins, in either `node:` or bare form
- does no IO
- never calls `Date.now()` or `new Date()` without an argument
- uses no randomness

Dates are `YYYY-MM-DD` strings in the user's time zone, and time zones are always passed in, never defaulted.

ESLint enforces the dependency rules for `src/` (`import-x/no-nodejs-modules` and `no-restricted-imports`). `tsconfig.src.json` type-checks `src/` alone with `"types": []`, so Node globals and modules do not resolve there. (The main `tsconfig.json` also covers the tests and `vitest.config.ts`, and Vitest pulls the Node types into that program.) The clock and randomness rules are by convention.

## Layout

| Path             | Holds                                               | Status                     |
| ---------------- | --------------------------------------------------- | -------------------------- |
| `src/dates/`     | Date helpers (`toLocalDate`)                        | One helper                 |
| `src/schemas/`   | Zod schemas                                         | Empty, filled in M2        |
| `src/nutrition/` | Nutrient maths and unit conversion                  | Empty, filled in M2 and M5 |
| `src/engine/`    | Trend, expenditure and targets                      | Empty, filled in M6        |
| `test/`          | Vitest tests, mirroring the `src/` folder structure |                            |

Each folder is a subpath export (`@keylow/core/dates`, `@keylow/core/schemas`, `@keylow/core/nutrition`, `@keylow/core/engine`), and `@keylow/core` re-exports the public surface.

## Scripts

```sh
pnpm --filter @keylow/core lint
pnpm --filter @keylow/core typecheck
pnpm --filter @keylow/core test
```

Formatting is checked once at the repository root with `pnpm format:check`.
