# Ki-Lo: working rules for agents

The product is Ki-Lo. The repository, the `@keylow/*` packages, the bundle ids and the Linear key
`KEY` keep the older name KeyLow on purpose. This file is what an agent needs before touching the
code. The README says what the app is, the documents under `docs/` say how things work, and this
file only points at them. Keep it under 80 lines: a rule that needs more than a sentence belongs in
`docs/` with a link here.

## Read before a ticket

- `docs/runbooks/local-dev.md`: setup, everyday commands, the shared-list rules, troubleshooting.
- `docs/ci.md`: the parallel gate, scoped runs, merging, stacked pull requests, red main.
- `docs/adr/`: six decisions that are frozen until amended. Deviating needs an amendment first.
- `docs/runbooks/error-monitoring.md`: Sentry, the scrubbing rules, where each secret lives.
- The Linear ticket is the spec. Its acceptance criteria, not the title, define done.

## Toolchain

- Node 22 (`.nvmrc`). Node 20 breaks the build. Use `corepack pnpm`, never npm or yarn.
- Packages are consumed as TypeScript source. There is no `dist/` and no build step between them.
- Four files are generated and ignored by git, never edit or commit them: the mobile kit barrel
  `components/ui/index.ts`, `Icon/iconMap.ts`, `Icon/iconColorTones.ts` and
  `.rnstorybook/storybook.requires.ts`. `pnpm generate:lists` writes them and turbo runs it for you.
- After a schema change: migration file, `pnpm --filter @keylow/db migration:up`, `pnpm gen-types`,
  a pgTAP test, and commit `packages/db/src/types.gen.ts`.

## Before you push

- Run `pnpm check:affected` from the checkout you are pushing from. Run `pnpm check` when a root
  file, a config or a shared package's public API changed. CI must never be the first to see a
  formatting or lint failure.
- Mobile: a new native dependency, config plugin or `app.json` change moves the Expo fingerprint. The
  CI comment on the pull request says so. It means a new build, not an over-the-air update, and the
  pull request description must say it.

## Git and lanes

- Work in a worktree under `../keylow-wt/<TICKET>`, cut from `origin/main` today. Never commit from
  the main checkout. Never run `git config` inside a worktree.
- One ticket, one branch, one pull request. Branch names are `KEY-123/short-slug`.
- Every pull request description has a "QA / How to test" section when it is opened, with the
  manual click path, the automated commands, and what is intentionally out of scope.
- Merging follows the Merging section of `docs/ci.md`. Squash only.
- When sweeping a diff, diff against the merge base, never against `origin/main`.

## Rules the gate enforces

- The source guard in `packages/config/test/source-guard/` fails raw hex outside `packages/tokens`,
  inline `style` objects (CSS custom properties through `vars()` are the one exception), and local
  copies of helpers that exist in `@keylow/core`. Styling is Tailwind and NativeWind utilities over
  the tokens, nothing else.
- Tests query by accessible role and name first. A test id is a last resort.
- Anything with a branch lives in `@keylow/core`. SQL keeps arithmetic, row-level security,
  `search_foods`, `day_totals` and `consume_rate_limit()`. Nutrient snapshots are computed in core at
  write time, and editing a food never changes a logged entry.
- Health data (weights, body stats, diary contents) never appears in logs, error messages, Sentry
  events, analytics or committed fixtures. A repository error carries the action and a code, never
  the database message or the row.
- Design gate: no screen or component ticket without a named frame in `docs/design/` or the canvas.
  Logic-only work is exempt.

## Prose

- No em dash and no `--` standing in for one. No semicolon joining two clauses. This applies to
  comments, documents, commit messages, pull request text and user-facing copy.
- User-facing copy lives in `packages/core/src/copy/` in British English and says Ki-Lo.

## Secrets

The repository is public. No DSN, token, key or account id goes in any file, issue or pull request.
Secret names and their homes are listed in `docs/runbooks/error-monitoring.md`, section 6.
