# @keylow/config

Shared lint, format and TypeScript configuration. Every app and package extends it, so nobody hand-rolls config per package. It is consumed as source: there is no build step.

Add it to a package with `"@keylow/config": "workspace:*"` in `devDependencies`. The ESLint and TypeScript versions it needs are declared here, and `eslint` and `typescript` must also be devDependencies of the consuming package, because the package binaries run from there.

## ESLint

Each export is a flat config array. Use one per package, in that package's `eslint.config.mjs`. A package without `"type": "module"` should use the `.mjs` extension, otherwise Node reparses the config as ESM and prints a warning on every run.

| Export                               | Use for                                                                                     |
| ------------------------------------ | ------------------------------------------------------------------------------------------- |
| `@keylow/config/eslint/base`         | Plain TypeScript packages (core, db, api-client, tokens)                                    |
| `@keylow/config/eslint/react`        | Next.js and web code: base, React, React Hooks, jsx-a11y                                    |
| `@keylow/config/eslint/react-native` | Expo and mobile code: base, React, React Hooks, Expo rules                                  |
| `@keylow/config/eslint/hermes`       | Bans the `Intl` APIs Hermes lacks. Already in `react-native`; add it to core and api-client |

```js
// eslint.config.mjs
import base from "@keylow/config/eslint/base";

export default [...base, { ignores: ["**/dist/"] }];
```

The base config is `typescript-eslint` `strictTypeChecked`, so it needs type information. Every linted `.ts` or `.tsx` file must be covered by the `include` of the nearest `tsconfig.json`. Plain JavaScript files are linted without type information. The configs carry no `ignores`: add the ones your package needs (`dist`, `.next`, `.expo`).

## Prettier

The root `package.json` points Prettier at this config, so `prettier --check .` at the root is the only formatting gate. Packages define no `format:check` script and need no Prettier config of their own.

```json
{ "prettier": "@keylow/config/prettier" }
```

## TypeScript

The strictness lives in `tsconfig/base.json`. Each fragment extends it and adds only what its app type needs. The root `tsconfig.base.json` is a pointer to `@keylow/config/tsconfig/base.json`, so ADR 0001's "one `tsconfig.base.json`" still holds.

| Export                                      | Adds                                                   |
| ------------------------------------------- | ------------------------------------------------------ |
| `@keylow/config/tsconfig/node.json`         | `lib: ES2022` and `types: ["node"]`                    |
| `@keylow/config/tsconfig/react.json`        | `jsx: react-jsx` and the DOM libraries                 |
| `@keylow/config/tsconfig/next.json`         | `jsx: preserve`, the DOM libraries and the Next plugin |
| `@keylow/config/tsconfig/react-native.json` | `jsx: react-native`, no DOM libraries                  |

```json
{
  "extends": "@keylow/config/tsconfig/react.json",
  "include": ["src"]
}
```

Extend a fragment by package specifier, as above. A fragment itself must only extend files inside this package, and never a relative path that leaves it (such as `../../../tsconfig.base.json`). Consumers reach the package through the `node_modules/@keylow/config` workspace symlink. `tsc` realpaths that symlink, but Vite's tsconfig loader (used by Vitest) does not, so a relative `extends` that climbs out of the package lands in `node_modules/` and fails with `TSCONFIG_ERROR ... Tsconfig not found`. The `tsconfig-vitest` test runs Vitest over a fixture that extends a fragment by package specifier to catch a regression.

For the mobile app, extend `expo/tsconfig.base` first and then a fragment or `tsconfig.base.json`, as ADR 0001 describes: `"extends": ["expo/tsconfig.base", "../../tsconfig.base.json"]`.

## Scripts

```sh
pnpm --filter @keylow/config lint
pnpm --filter @keylow/config typecheck
pnpm --filter @keylow/config test
```
