# Local development

This runbook takes a new engineer from `git clone` to both apps running against a local Supabase stack, with a phone connected over the machine's LAN IP. Every command is meant to be pasted as written from the repo root unless the block says otherwise.

The commands were written for macOS. The steps that need a physical phone or an EAS account are marked **Device step** and are the only ones that cannot be checked from a laptop alone.

If Node 22 is not your default, run `source ~/.nvm/nvm.sh && nvm use 22` in each new terminal before anything else.

## 1. Prerequisites

| Tool                                                 | Version             | Why                                                                                                          |
| ---------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------ |
| git                                                  | any current version | Clone the repo. On a fresh Mac, `git clone` prompts you to install the Command Line Tools. That is not Xcode |
| [nvm](https://github.com/nvm-sh/nvm) with Node       | 22 (see note below) | The db scripts run TypeScript through Node's built-in type stripping                                         |
| pnpm, through Corepack                               | 10.34.5 (pinned)    | `package.json` pins it with `packageManager`, Corepack resolves it                                           |
| Docker Desktop, running                              | any current version | `supabase start` runs the whole local backend in containers                                                  |
| [Supabase CLI](https://supabase.com/docs/guides/cli) | 2.106 or later      | Starts the stack, resets the database, generates types, runs the pgTAP tests                                 |

The repo pins Node 22 in `.nvmrc`, and `package.json` requires `>=22`. Use 22.18 or later, because the db scripts run TypeScript through Node's built-in type stripping, which is on by default from that release.

Install Node and turn Corepack on:

```sh
nvm install
nvm use
node -v
corepack enable
```

`nvm install` reads `.nvmrc`, so run it from inside the clone. Corepack only picks the pinned pnpm inside the repo. Outside it, `pnpm -v` reports a different default version, so check the version from the repo root:

```sh
pnpm -v
```

It should print `10.34.5`.

Two things you do not need:

- Xcode and Android Studio. The JavaScript loop (tests, Metro, `expo export`) runs without them, and the native dev client is built in the EAS cloud, not on your machine.
- A global Expo or EAS CLI. Expo's CLI is a dependency of `apps/mobile`, so `npx expo` inside that folder uses the pinned one. Use `npx eas-cli` when you need EAS (section 5). It needs an EAS login only for builds.

## 2. Clone and install

```sh
git clone https://github.com/zeenotheinventor/KeyLow.git
cd KeyLow
pnpm install
```

What to expect:

- The `prepare` script installs the lefthook pre-commit hook (prettier, then eslint on staged files).
- pnpm ends with an "Ignored build scripts: unrs-resolver" warning. That is expected. The build script is deliberately not approved, so do not run `pnpm approve-builds`.
- `.npmrc` sets `node-linker=hoisted`. This is required for Expo (see Troubleshooting).

## 3. Local Supabase

Start the stack. The first run pulls several Docker images and takes a few minutes.

```sh
pnpm dev:db
```

When it finishes, the CLI prints the service URLs:

| Service                 | URL                                                       |
| ----------------------- | --------------------------------------------------------- |
| API (what the apps use) | `http://127.0.0.1:54321`                                  |
| Postgres                | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |
| Studio (database UI)    | `http://127.0.0.1:54323`                                  |
| Mailpit (local inbox)   | `http://127.0.0.1:54324`                                  |

Load the migrations and the seed into a fresh database:

```sh
pnpm --filter @keylow/db db:reset
```

This drops and recreates the local database, applies `packages/db/supabase/migrations/`, then runs `packages/db/supabase/seed.sql`. It also deletes any account you created by signing up, so use it deliberately. The local database is shared by every checkout of KeyLow on this machine (the project id is `keylow`), so a reset in one clone resets it for all. See the troubleshooting entry about `supabase start is already running`.

The seed currently holds one demo user and its profile row:

| Field    | Value               |
| -------- | ------------------- |
| Email    | `demo@keylow.local` |
| Password | `keylow-demo-local` |

These are local test values and are never loaded into production. Richer seed data arrives with the milestones that add the tables.

Both apps need the API's publishable key. `supabase status` reads the project from the `supabase/` folder it is run in, so run it from `packages/db` or pass `--workdir`. From the repo root with no flag it fails with `No such container: supabase_db_<folder name>`. Print the key with:

```sh
supabase status --workdir packages/db -o env | grep PUBLISHABLE_KEY
```

The output wraps the value in double quotes. Copy only what is between them, and paste it without the quotes. Keep that value for sections 4 and 5. The keys are the same every time the local stack starts, so you only copy them once.

Generate the database types and run the database tests:

```sh
pnpm gen-types
git diff --exit-code packages/db/src/types.gen.ts
pnpm check:integration
```

- `pnpm gen-types` rewrites `packages/db/src/types.gen.ts` from the running database. On a clean checkout after `db:reset` it leaves no diff, so `git diff --exit-code` exits 0.
- `pnpm check:integration` runs the pgTAP tests in `packages/db/supabase/tests/` and ends with `Result: PASS`. It needs the stack running.

Leave the stack running, because sections 4 and 5 need it. When you finish for the day, stop it:

```sh
pnpm --filter @keylow/db stop:db
```

Stopping keeps your data in a Docker volume, and the next `pnpm dev:db` picks it up. To start from nothing, run `db:reset`.

## 4. Web app

Create the web env file from the example and fill in the key:

```sh
cp apps/web/.env.example apps/web/.env.local
```

Edit `apps/web/.env.local` so it reads as below, with the `PUBLISHABLE_KEY` value from section 3 (without its double quotes) after the `=`. The variable is still called `ANON_KEY` for historical reasons. The value to use is the publishable key.

```sh
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<PUBLISHABLE_KEY value>
```

`.env.local` is ignored by git. Never commit it.

Start the dev server:

```sh
pnpm --filter @keylow/web dev
```

Open <http://localhost:3000>. You should see:

- `/login` shows a form with Email and Password fields and "Sign in" and "Create account" buttons.
- Visiting `/diary`, `/recipes`, `/weight` or `/settings` while signed out redirects to `/login`.
- Signing in as the demo user, or creating a new account, lands on `/diary` with a navigation bar of Diary, Recipes, Weight and Settings. A "Sign out" button returns you to `/login`.
- Sign-up needs no email confirmation locally (see Troubleshooting).
- "Continue with Google" does not work against the local stack. Google is disabled in the local config and needs real OAuth credentials.

Run the unit tests and the end-to-end tests:

```sh
pnpm --filter @keylow/web test
pnpm --filter @keylow/web exec playwright install chromium
pnpm --filter @keylow/web test:e2e
```

- `playwright install chromium` downloads the browser Playwright drives. It is a one-time step per Playwright version and does nothing once the browser is present.
- `test:e2e` starts its own `next dev`, so the stack must be running, `apps/web/.env.local` must exist and **port 3000 must be free**. Stop your own dev server first. Playwright refuses to run when something already listens on 3000. Expect every test to pass. The tests create throwaway accounts in your local database.

## 5. Mobile app

The mobile app runs on a development client, not Expo Go. Expo Go is not supported.

### Point the app at your Mac

A phone cannot reach `127.0.0.1` on your Mac, so the mobile app takes its Supabase URL from the machine's LAN IP. Find it. Wi-Fi is usually `en0`, but a Mac with built-in Ethernet may have Wi-Fi on `en1`:

```sh
ipconfig getifaddr en0
```

This form picks whichever interface carries your default route, so it works on either:

```sh
ipconfig getifaddr $(route get default | awk '/interface:/ {print $2}')
```

If both print nothing, look up the address in System Settings under Network.

Create the mobile env file:

```sh
cp apps/mobile/.env.example apps/mobile/.env.local
```

Edit the two Supabase lines in `apps/mobile/.env.local`, using your LAN IP and the `PUBLISHABLE_KEY` value from section 3 (without its double quotes):

```sh
EXPO_PUBLIC_SUPABASE_URL=http://<LAN-IP>:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=<PUBLISHABLE_KEY value>
```

The file also holds `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` and `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`. They come pre-filled from `.env.example` with the real Google client ids (they are public values), so leave them as they are. Without them the Google button shows an error and email sign-in keeps working.

`apps/mobile/lib/supabase.ts` reads the two Supabase names and throws `EXPO_PUBLIC_SUPABASE_URL is not set` (or the same for `EXPO_PUBLIC_SUPABASE_ANON_KEY`) if either is empty. Metro loads `.env.local` itself and inlines `EXPO_PUBLIC_` values into the bundle when it builds it, so after any edit restart Metro with `--clear` (below).

`.env.local` is only for runs through Metro, which is what a development client on your phone does. It is ignored by git and never reaches EAS. Builds made by EAS get their values from the `env` block of the `base` profile in `apps/mobile/eas.json` (which `development` and `production` extend), and `.github/workflows/eas-update.yml` sets the same four values for the OTA publish. Those point at production Supabase, so a development client built by EAS still talks to your local stack because Metro serves a fresh bundle from your `.env.local`. If a Google client id changes, update `.env.example`, `eas.json` and the workflow together.

Docker publishes the API on every interface, so the LAN IP reaches the same stack as `127.0.0.1`. Confirm it from your Mac. A healthy API answers `200` with a JSON body naming GoTrue:

```sh
curl -i http://<LAN-IP>:54321/auth/v1/health
```

`supabase status` only prints the `127.0.0.1` URLs and does not show which interfaces are bound, so use this `curl` as the check. Opening the same URL in the phone's browser proves the phone can reach the Mac.

### Start Metro

```sh
pnpm --filter @keylow/mobile start
```

This runs `expo start --dev-client`. Metro serves on port 8081 and listens on the LAN, so `http://<LAN-IP>:8081/status` answers `packager-status:running`. In an interactive terminal it prints a QR code and a URL. To restart with a clean cache after changing `.env.local`:

```sh
pnpm --filter @keylow/mobile start --clear
```

### Get a development client onto the phone

**Device step, not run by the author of this runbook.** The repo is not ready for it yet, so read this part as the plan:

```sh
npx eas-cli build --profile development-device
```

This builds an internal-distribution development client in the EAS cloud (profile `development-device` in `apps/mobile/eas.json`). The `development` profile builds an iOS simulator app instead, which only runs in the iOS Simulator, so you need Xcode on your machine to run it. The EAS build itself does not need Xcode. Before the first build works you need these things:

- An EAS login (`npx eas-cli login`) with access to the `sojisoft` Expo organisation. The account signs in through the browser; the CLI opens it.
- Bundle identifiers and the EAS project are already in `apps/mobile/app.json` (`com.sojisoft.keylow` for both platforms, project `@sojisoft/keylow`).
- For an iOS internal-distribution build, an Apple Developer account and the phone's UDID registered with `npx eas-cli device:create`. Android needs neither.

The first build itself is tracked as a manual ticket. Until it is done, nobody can install a dev client, but everything else in this section still works.

### Connect the phone

**Device step, not run.** With a dev client installed:

1. Put the phone and the Mac on the same Wi-Fi network.
2. Keep the stack running (section 3) and Metro running (above).
3. Open the KeyLow dev client. Its launcher lists the Metro server it finds on the network. Tap it, or choose to enter a URL and type `http://<LAN-IP>:8081`.
4. The app opens on the sign-in screen. Sign in as `demo@keylow.local` or create an account. The app talks to Supabase at the `EXPO_PUBLIC_SUPABASE_URL` you set.

### Checks that need no device

Run these from `apps/mobile`:

```sh
cd apps/mobile
pnpm test
npx expo-doctor
npx expo export --platform ios --no-bytecode
cd ../..
```

- `pnpm test` runs the jest-expo suite and should report every suite passed.
- `npx expo-doctor` should end with `No issues detected!`.
- `npx expo export --platform ios --no-bytecode` bundles the app with Metro and writes `apps/mobile/dist/`, which git ignores. It is the closest thing to a smoke test without a device. It reads `.env.local` for the two `EXPO_PUBLIC_` values.

## 6. Everyday commands

Run from the repo root.

| Command                                  | What it does                                                                                                                                            |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm check`                             | `turbo run format:check lint typecheck test`. Run it before every push. The CI pipeline, once it is added, runs exactly this command as its static job. |
| `pnpm check --force`                     | The same, ignoring the Turborepo cache                                                                                                                  |
| `pnpm check:integration`                 | pgTAP tests in `packages/db/supabase/tests/`. Needs the stack running.                                                                                  |
| `pnpm dedupe --check`                    | Fails if the lockfile has duplicates that `pnpm dedupe` would remove                                                                                    |
| `pnpm exec prettier --write <path>`      | Formats a file the way `format:check` expects. Markdown is checked too.                                                                                 |
| `pnpm gen-types`                         | Regenerates `packages/db/src/types.gen.ts`. Run it after every migration, then commit the result.                                                       |
| `pnpm --filter @keylow/db db:reset`      | Rebuilds the local database from the migrations and the seed                                                                                            |
| `pnpm --filter @keylow/mobile typecheck` | Type-checks the mobile app with its own TypeScript                                                                                                      |
| `cd apps/mobile && npx expo-doctor`      | The Expo project health check. The CI pipeline runs it too once it exists.                                                                              |

After you change the schema, the sequence is: add a migration in `packages/db/supabase/migrations/`, run `db:reset`, run `pnpm gen-types`, add or update a pgTAP test in `packages/db/supabase/tests/`, run `pnpm check:integration`, then commit the migration, the test and the regenerated types together.

## 7. Troubleshooting

**`pnpm install --frozen-lockfile` fails after a merge or rebase.** The lockfile no longer matches the manifests, often because two branches changed dependencies. Run `pnpm install` to regenerate `pnpm-lock.yaml`, commit it, then confirm with `pnpm install --frozen-lockfile`.

**Duplicate React, "Invalid hook call", or hooks that break only on the phone.** Two copies of React are loaded. Three guards prevent that, and none of them should be removed:

- `.npmrc` sets `node-linker=hoisted`, so Metro finds one `node_modules` tree.
- The root `package.json` has `pnpm.overrides` pinning `react` and `react-dom` to the version Expo SDK 57 needs (19.2.3).
- `pnpm dedupe --check` catches duplicates a new dependency adds. Run `pnpm dedupe` to fix them.

Never add `react-native` or a native module to anything under `packages/`.

**expo-doctor complains about `disableHierarchicalLookup`.** `apps/mobile/metro.config.js` deliberately leaves it unset, because expo-doctor on SDK 57 rejects `true`. Do not "fix" it by setting it. The three guards above cover duplicate React instead.

**`supabase status` says `No such container: supabase_db_<folder name>`.** You ran it outside `packages/db`. Run it there or add `--workdir packages/db`.

**The first `supabase start`, `supabase test db` or `supabase gen types` hangs while pulling an image.** The Docker credential helper can hang on a first pull. Run the command with an empty Docker config:

```sh
DOCKER_CONFIG=$(mktemp -d) pnpm dev:db
```

The same prefix works for `pnpm check:integration` (which pulls the pgTAP runner) and `pnpm gen-types` (which pulls postgres-meta). It affects only that one command.

**`pnpm dev:db` says `supabase start is already running` but you did not start it.** Another checkout's stack is up. The project id in `config.toml` is fixed as `keylow`, so every clone shares the same container names and ports, and the running database holds that other checkout's migrations. Stop it with `pnpm --filter @keylow/db stop:db` (from either checkout), then start it again here and run `db:reset` so the database matches this checkout.

**`pnpm --filter @keylow/web test:e2e` fails with `http://localhost:3000 is already used`.** Stop whatever listens on port 3000. Find it with `lsof -nP -iTCP:3000 -sTCP:LISTEN`.

**The phone cannot reach Supabase or Metro.**

- Confirm the phone and the Mac are on the same network. Guest Wi-Fi often isolates clients from each other.
- Check the LAN IP in `.env.local` still matches the address you found in section 5. DHCP can hand the Mac a new address, and then you must update `.env.local` and restart Metro with `--clear`.
- Run the `curl` health check from section 5. If it works on the Mac but not in the phone's browser, look at the macOS firewall and any VPN.
- If the dev client shows a Metro URL with the wrong address (for example on a machine with several network interfaces or a VPN), start Metro with the address pinned: `REACT_NATIVE_PACKAGER_HOSTNAME=<LAN-IP> pnpm --filter @keylow/mobile start`.

**`EXPO_PUBLIC_SUPABASE_URL is not set` (or the same for `EXPO_PUBLIC_SUPABASE_ANON_KEY`) on the phone.** The message names whichever variable is empty. `apps/mobile/.env.local` is missing or that value is empty. Fix the file and restart Metro with `--clear`.

**Sign-up creates the account but never asks for email confirmation.** That is intended locally. `packages/db/supabase/config.toml` sets `enable_confirmations = false` under `[auth.email]`, so sign-up returns a session straight away. Production has confirmation on.

**A sign-in redirect is rejected after you add a new URL.** The allow-list of redirect targets lives in `packages/db/supabase/config.toml` under `[auth]` as `additional_redirect_urls`. It currently covers the web callbacks on `localhost:3000` and `127.0.0.1:3000` and the mobile scheme `keylow://auth/callback`. GoTrue matches these exactly. A config change only takes effect after a full restart:

```sh
pnpm --filter @keylow/db stop:db
pnpm dev:db
```

**EAS builds fail on missing files, or upload files you did not expect.** `.easignore` at the repo root replaces every `.gitignore` for EAS uploads, it does not add to them. It repeats the root and `apps/mobile` ignore rules and then excludes what the app does not need (`apps/web`, `docs`, `packages/db/data`, e2e). When you change a `.gitignore`, make the same change in `.easignore`.

**TypeScript is 6.x in `apps/mobile` and 5.9 elsewhere.** A bare `tsc` at the root picks the wrong one. Always type-check through the package script: `pnpm --filter @keylow/mobile typecheck`, or `pnpm check` for everything.

**Files that appear after running things but never show in `git status`.** Playwright writes `test-results/` and `playwright-report/`, `expo export` writes `apps/mobile/dist/`, and Next generates `apps/web/next-env.d.ts`. All of them are gitignored. If one shows up as untracked, a `.gitignore` rule was lost.
