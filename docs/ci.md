# CI and deployments

## Vercel deploys `main` only

Vercel does not build pull requests. `apps/web/vercel.json` turns off automatic deployments for every branch except `main`:

```json
"git": { "deploymentEnabled": { "main": true, "**": false } }
```

A merge to `main` still deploys production automatically, and `ignoreCommand: npx turbo-ignore` still skips that build when the web app is unaffected. A pull request creates no deployment, so there is no preview URL, and no Vercel check is expected on it.

### Why

- On 2026-10-15 Vercel rate-limited the account for 24 hours because every push to a pull request made a preview deployment. The Vercel status on the `main` commit read "Deployment rate limited, retry in 24 hours", so the limit blocked production deploys too.
- CI builds the web app itself on every web-affecting pull request, so a preview adds no signal.
- Turning the preview off with `ignoreCommand` instead would not help: Vercel counts a build cancelled by the ignored build step as a full deployment against the deployment quotas. `git.deploymentEnabled` stops the deployment from being created at all.

### Why `**` and not `*`

Branch keys use minimatch syntax. `*` does not match a `/`, so it would miss branches such as `KEY-243/no-vercel-previews` or `dependabot/npm_and_yarn/...`, and those would still deploy. `**` matches every branch name. A branch that matches several rules deploys if any rule is `true`, so `main` matches both keys and deploys.

### Turn previews back on

Remove the `git` line from `apps/web/vercel.json` (or set `"**"` to `true`). This is a repo change only, nothing in the Vercel dashboard needs to change.

Sources: <https://vercel.com/docs/project-configuration/git-configuration> and <https://vercel.com/docs/project-configuration/project-settings#ignored-build-step>.

## Merge conflicts on shared files

Several pull requests merge in parallel, so the files every feature used to edit are derived from folders instead (see "Adding to the shared lists" in [docs/runbooks/local-dev.md](runbooks/local-dev.md)). Two things still conflict, and neither is machinery worth adding:

- **`pnpm-lock.yaml`**: when two branches change dependencies, take either side and run `pnpm install`. pnpm repairs the lockfile. Commit the result.
- **`packages/core/src/copy/index.ts`**: one `export *` line per copy module, so two pull requests that each add a new module conflict. `.gitattributes` marks it `merge=union`, which makes a local rebase or merge clean, but GitHub ignores `.gitattributes` when it works out mergeability. It shows both pull requests as conflicting until main is merged or rebased into the second one locally. Do that, check that both lines are there once each, and push.

## CI runs the full gate as parallel jobs

`.github/workflows/ci.yml` runs on every pull request and every push to `main`. `scope` decides what the change needs, then `core`, `functions`, `db`, `mobile`, `web` and `web-storybook` run in parallel, and `checks` collects their results. `checks` is the only required check, and the name `checks` is what branch protection lists.

- A pull request runs only the jobs its change can affect, and inside them only the affected packages. A change outside `apps/`, `packages/` and `tools/` (root config, the lockfile, a workflow) and every push to `main` run everything. A job that is not needed shows as skipped, and `checks` counts a skipped job as passed. A failed or cancelled job fails `checks`.
- The workflow has no `paths` filter and must never get one. A required check that is never reported blocks the pull request for good.
- A new job is added to the `needs` list of `checks`, nothing else changes in the settings.
- `scope` runs turbo through npx, so it needs no install and takes a few seconds.
- `mobile-fingerprint.yml` is separate and is not a required check. It comments on pull requests and needs write access to them.

## Checking before a push

CI runs the full gate on the pull request, so before a push run `pnpm check:affected`, which checks only what the change can affect (see [local-dev.md](runbooks/local-dev.md)). Run the full `pnpm check` when a root file, a shared package's public API or a config changes, or when asked.

`pnpm check:affected` (`scripts/ci-scope.mjs`) compares the working tree with `origin/main`. A change to a file outside `apps/`, `packages/` and `tools/` (Markdown aside) runs everything, and a clean branch runs nothing. CI has its own scope step in `ci.yml`.

Local test runs use half the cores. The Vitest configs and `apps/mobile/jest.config.js` set `maxWorkers` only when `CI` is unset, so CI keeps each tool's default. Testing Library's `waitFor` and `findBy*` wait up to 5 s, not the 1 s default, which flaked on a busy machine.
