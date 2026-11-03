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

`.github/workflows/ci.yml` runs on every pull request, every push to `main` and on demand. `scope` decides what the change needs, then `core`, `lockfile`, `functions`, `db`, `mobile`, `web` and `web-storybook` run in parallel, and `checks` collects their results. `checks` is the only required check, and the name `checks` is what branch protection lists.

The long jobs are split into legs, which are the entries of one job's matrix. Each leg runs on its own runner, so a job takes as long as its slowest leg, and `checks` waits for every leg of every job. A failed leg fails `checks`, and the other legs of the job still finish (`fail-fast` is off), so one run reports every failure.

| Job      | Legs                     | What each leg runs                                                                       |
| -------- | ------------------------ | ---------------------------------------------------------------------------------------- |
| `core`   | `format`                 | Prettier over the whole repository, and the check that no two migrations share a version |
|          | `static`                 | lint and type-check of every package and tool except the two apps                        |
|          | `test 1/3` to `test 3/3` | Vitest of those packages, three shards split by file                                     |
| `mobile` | `static`                 | lint, type-check and the Expo doctor gate                                                |
|          | `1/6` to `6/6`           | Jest of the app, six shards, split by file size (see below)                              |
| `web`    | `static`                 | lint, type-check and `next build`                                                        |
|          | `1/2`, `2/2`             | Vitest of the web app, two shards split by file                                          |
| `db`     | `database`               | pgTAP, the `@keylow/db` database and Edge Function suites, and the generated types check |
|          | `clients`                | the `@keylow/api-client` and `@keylow/assistant-evals` integration suites                |

`lockfile` (the duplicate check, on full runs only), `functions` (Deno type-check and lint of the Edge Functions) and `web-storybook` (the Storybook build) are single jobs.

- **Mobile Jest legs.** Jest's own `--shard` hashes each file path into a slice, which ignores cost, so the slices differ a lot in time. `apps/mobile/test/support/shardSequencer.js` (the `testSequencer` in `apps/mobile/jest.config.js`) replaces that split. It deals the test files out by size on disk, largest first, each into the lightest leg so far. A tie in size goes by path and a tie in weight by the lower leg number, so every leg works out the same split with no data file to keep up to date. File size tracks a mobile test file's run time closely enough, but not perfectly: look at the per-leg times when a leg drifts away from the others. Each Jest leg keeps its own Jest cache, keyed by the leg's index.
- **Why `format` has its own leg.** Prettier needs nothing from the install beyond itself, so it runs beside the lint and type-check instead of in front of the tests, and it stays off the critical path.
- **Why ESLint has no cache.** The shared ESLint config is `strictTypeChecked` (`packages/config/eslint/base.js`), so the result for a file depends on the types of everything it imports, and ESLint's cache keys on the file alone. A change to an imported type could leave a stale pass, which loses protection. Do not add `--cache`.
- **Why `turbo.json` has no lint chain.** `lint` does not depend on the lint of the packages it uses, and `test` does not wait for a type-check, because packages are consumed as source and the `static` legs run the type-checks. Tasks that CI runs with `--only` skip the dependencies' tasks for the same reason.
- **Migration versions.** The `core (format)` leg fails when two migrations in `packages/db/supabase/migrations` share a version. `supabase db push` pairs a recorded version with the wrong file in production, but a fresh stack applies both files without complaint, so the `db` legs do not see it. The check runs on the merge commit, so it catches a pull request whose version is already on `main`. Two pull requests that pick the same version and merge before either re-runs are caught by the run on `main`.
- **Caches.** Every run restores the pnpm store and the Jest cache, and only a push to `main` saves them, and only when the exact key was not restored. The `core (static)` leg saves the pnpm store and each mobile Jest leg saves its own Jest cache. A pull request never saves: a cache saved by a pull request is visible to that pull request only, and each lockfile change used to save its own 1.2 to 1.5 GB store, which pushed the repository past the 10 GB limit and evicted `main`'s own caches.
- **The `db` stacks.** Each `db` leg boots its own local Supabase stack in the background while the install runs, and the Open Food Facts mock listens on one fixed port, which is why two suites that use it cannot share a stack and the work is split across two runners.

- A pull request runs only the jobs its change can affect, and inside them only the affected packages. A change outside `apps/`, `packages/` and `tools/` (root config, the lockfile, a workflow) runs everything. A job that is not needed shows as skipped, and `checks` counts a skipped job as passed. A failed or cancelled job fails `checks`.
- A push to `main` is scoped exactly like a pull request. The checkout of a push is the squash commit, so `HEAD^1` is the previous commit on `main` and the run covers what that merge changed: the same diff, the same rule for files outside the packages, the same `turbo ls --affected`. A merge that touches only the mobile app runs `core` and `mobile`, and skips `db`, `functions`, `web`, `web-storybook` and the lockfile check. Every merge still gets its own run, and no run on `main` is cancelled.
- The scoped run on `main` is the guard. A scoped run cannot see a link the dependency graph does not know. For example, a migration renames a column, and another pull request queries that column by name from an app or an Edge Function. No import ties the query to the migration, so each merge runs only its own side. There is no nightly run, because even a skipped scheduled run costs a minute a day. When everything must be checked, for example after a migration that renames something used by name, start a full run by hand.
- Start a full run (every job, every package) with `gh workflow run CI --ref main`, or with "Run workflow" on the CI page of the Actions tab. It runs every job against that ref and costs nothing unless someone starts it. A manual run only restores the caches and never saves them, and it never cancels the push run of the same commit.
- The workflow has no `paths` filter and must never get one. A required check that is never reported blocks the pull request for good.
- A new job is added to the `needs` list of `checks`, nothing else changes in the settings.
- `scope` runs turbo through npx, so it needs no install and takes a few seconds.
- `mobile-fingerprint.yml` is separate and is not a required check. It comments on pull requests and needs write access to them.

## Checking before a push

CI runs the full gate on the pull request, so before a push run `pnpm check:affected`, which checks only what the change can affect (see [local-dev.md](runbooks/local-dev.md)). Run the full `pnpm check` when a root file, a shared package's public API or a config changes, or when asked.

`pnpm check:affected` (`scripts/ci-scope.mjs`) compares the working tree with `origin/main`. A change to a file outside `apps/`, `packages/` and `tools/` (Markdown aside) runs everything, and a clean branch runs nothing. CI has its own scope step in `ci.yml`.

Local test runs use half the cores. The Vitest configs and `apps/mobile/jest.config.js` set `maxWorkers` only when `CI` is unset, so CI keeps each tool's default. Testing Library's `waitFor` and `findBy*` wait up to 5 s, not the 1 s default, which flaked on a busy machine.

## Repository settings

These are set on GitHub for `zeenotheinventor/KeyLow` and are not stored in the repo. Nothing secret is involved.

- **Merging:** squash merge only. Merge commits and rebase merges are off. The squash commit takes its title and message from the pull request (`PR_TITLE`, `PR_BODY`).
- **Auto-merge:** allowed, so a pull request can be armed and GitHub merges it when the required check passes.
- **Head branches:** deleted automatically after a merge. Do not delete one yourself (`gh pr merge --delete-branch` or the API): a child pull request that targets a branch deleted that way is closed, not retargeted to `main`.
- **Branch protection on `main`:** the only required status is `checks`, with `strict` off, so a branch does not have to be up to date with `main`. No required reviews. `enforce_admins` is off, so the owner can override in an emergency. Force pushes and deletions are blocked.
- Vercel is never a required check (see "Vercel deploys `main` only").

Read the settings back:

```sh
gh api repos/zeenotheinventor/KeyLow --jq '{allow_squash_merge,allow_merge_commit,allow_rebase_merge,allow_auto_merge,delete_branch_on_merge,squash_merge_commit_title,squash_merge_commit_message}'
gh api repos/zeenotheinventor/KeyLow/branches/main/protection
```

To change them, use `gh api -X PATCH repos/zeenotheinventor/KeyLow` for the merge options and `gh api -X PUT repos/zeenotheinventor/KeyLow/branches/main/protection` for the branch protection (it replaces the whole rule, so send every field), or use Settings on GitHub. Update this section in the same change.

## Merging

A pull request is merged by GitHub once `checks` is green, after the reviewer has approved. Nobody rebases it first, merges it by hand or deletes its branch, unless GitHub shows a conflict (see "New copy modules").

1. The engineer runs `pnpm check:affected`, pushes, and opens the pull request with the QA section written at open time.
2. CI runs the full gate in parallel. `checks` is the only required status.
3. The reviewer approves. A blocking finding goes back to the engineer, and a pull request is never armed before approval.
4. The orchestrator arms auto-merge:

   ```sh
   gh pr merge <n> --squash --auto
   ```

   Never add `--delete-branch` and never rebase onto `main` first. The repository setting deletes the branch after the merge (see "Repository settings"), and deleting it that way makes GitHub retarget stacked children to `main`. Deleting a parent branch through the API closed child pull request #110.

5. GitHub merges when `checks` is green. A new push cancels the superseded run and keeps the arm. If a push after approval changes behaviour, run `gh pr merge <n> --disable-auto` first, and arm it again once the reviewer approves.
6. After the merge, move the ticket to Done and check the push-to-`main` run (a scoped run, see "CI runs the full gate as parallel jobs").

### Red main

Branches need not be up to date, so two pull requests that pass alone can still break `main` together. Every merge to `main` gets a run scoped to what it changed, and that run is the guard. If it goes red, stop arming other pull requests and open a fix pull request within the hour. Arm it as soon as it is approved. The orchestrator of the session that merged the breaking pull request owns it. Revert only if the fix is not obvious within that hour.

### Stacked pull requests

Arm the parent first. When it merges, GitHub deletes its branch and retargets the child to `main`. Merges are squashed, so the child still holds the parent's original commit and GitHub shows a conflict. Rebase the child onto `main` without that commit and force-push:

```sh
git fetch origin
git rebase --onto origin/main <old parent tip> <child branch>
git push --force-with-lease
```

The auto-merge arm stays on, and GitHub merges the child when `checks` is green. Dependent tickets still go in sequence.

### New copy modules

Two pull requests that each add a copy module both edit `packages/core/src/copy/index.ts`, and GitHub shows the second as conflicting until `main` is merged into it locally (see "Merge conflicts on shared files"). Merge `main` in, check each line is there once, push, and CI runs again.
