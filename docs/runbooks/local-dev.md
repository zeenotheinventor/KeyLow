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
| [Supabase CLI](https://supabase.com/docs/guides/cli) | 2.106 or later      | Starts the stack, applies migrations, generates types, runs the pgTAP tests                                  |

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

The first `supabase start` creates the database, applies `packages/db/supabase/migrations/` and runs `packages/db/supabase/seed.sql`, then the food seeds in `packages/db/supabase/seeds/` (see Food seeds below). After that, apply the migrations a pull or a new branch brought in without touching your data:

```sh
pnpm --filter @keylow/db migration:up
```

This runs `supabase migration up --local` from `packages/db` and applies only the migrations the database does not have yet. It keeps every row and every account you created by signing up. The local database is shared by every checkout of KeyLow on this machine (the project id is `keylow`), so never reset it as a tidiness step. `pnpm --filter @keylow/db db:reset` drops and recreates the database, reapplies the migrations and reloads the seed, and it deletes your accounts in every checkout. It is for a genuinely broken local database only, and you announce it before you run it. See the troubleshooting entry about `supabase start is already running`.

`seed.sql` holds one demo user and its profile row:

| Field    | Value               |
| -------- | ------------------- |
| Email    | `demo@keylow.local` |
| Password | `keylow-demo-local` |

These are local test values and are never loaded into production.

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

- `pnpm gen-types` rewrites `packages/db/src/types.gen.ts` from the running database. On a clean checkout with every migration applied it leaves no diff, so `git diff --exit-code` exits 0.
- `pnpm check:integration` first bundles core and checks the Edge Functions under Deno (see Edge Functions below), then runs the pgTAP tests in `packages/db/supabase/tests/` and ends with `Result: PASS`, then runs the Edge Function suites. The pgTAP part needs the stack running, and the function suites also need the functions served (see Running the Edge Function test suites below).

Leave the stack running, because sections 4 and 5 need it. When you finish for the day, stop it:

```sh
pnpm --filter @keylow/db stop:db
```

Stopping keeps your data in a Docker volume, and the next `pnpm dev:db` picks it up.

### Food seeds

A fresh stack loads `seed.sql` first and then every file in `packages/db/supabase/seeds/` in name order. That covers `supabase start` on a new database, `pnpm --filter @keylow/db db:reset` and every CI run, so the seeded pgTAP test passes in CI without any step of its own.

| File                  | What it holds                                                                                                                                                                                                |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `10_cofid_subset.sql` | 209 CoFID foods (chicken, chick peas, yogurt, milk, oil, bread, rice, cheese and the other staples, per 100 ml drinks and three suspect foods) with their source data. Generated, never edited.              |
| `20_off_sample.sql`   | Five Open Food Facts products for the barcode path and the suspect review gate with no network. Hand written. Their barcodes start with 2, the range GS1 keeps for internal use, so no real product has one. |

The seeds never reach production. `supabase db push` does not run seeds unless it is given `--include-seed`, and `deploy-supabase.yml` does not give it.

To load the seeds into a stack that is already running, which is how a database that was started before the seeds existed gets them, run these from the repository root:

```sh
docker exec -i supabase_db_keylow psql -U postgres -v ON_ERROR_STOP=1 < packages/db/supabase/seeds/10_cofid_subset.sql
docker exec -i supabase_db_keylow psql -U postgres -v ON_ERROR_STOP=1 < packages/db/supabase/seeds/20_off_sample.sql
```

Each file is one transaction and every statement is an upsert, so running them again is safe and changes nothing. On a database that already holds the full CoFID import, the subset foods keep their values. Only the source data rows of those 209 foods are pointed at the seed's import run, instead of the run that wrote them. `packages/db/supabase/tests/search_foods_seeded.test.sql` needs both files loaded and says so when it fails because they are not.

To regenerate the subset seed after editing `packages/db/data/cofid/subset.txt` (one food code per line, `#` starts a comment) or the CoFID mapping, run this from the repository root:

```sh
pnpm --filter @keylow/db import:cofid import --csv data/cofid/cofid-2021.normalised.csv --label seed-subset --subset data/cofid/subset.txt --emit-sql supabase/seeds/10_cofid_subset.sql
```

It reads the committed CSV and writes the file without connecting to any database. Commit the result, and keep the code list in `search_foods_seeded.test.sql` the same as `subset.txt`. A unit test fails when either the seed or that list is out of step.

### Edge Functions

Edge Functions live in `packages/db/supabase/functions/` and run under Deno. The Node tools (ESLint, `tsc`) ignore that folder, and Deno checks it instead. Shared helpers are in `_shared/`, and each function is a folder with an `index.ts`. A folder whose name starts with an underscore is never deployed as a function.

Functions import `@keylow/core` through a generated bundle in `_shared/core/`. The bundle is not committed. Git, Prettier and EAS all ignore it, so a fresh clone does not have it. Write it, and write it again after any change in `packages/core`:

```sh
pnpm --filter @keylow/db bundle-core-for-deno
```

This writes `packages/db/supabase/functions/_shared/core/index.js` (zod included), `index.d.ts` (the rolled-up types Deno checks against) and `database.types.ts` (a copy of the generated database types, so the function clients are typed). It needs no network and no running stack.

Type-check and lint the functions:

```sh
pnpm --filter @keylow/db check:functions
```

This runs `deno check` on every function entry and every `_shared` module, then `deno lint`, with the Deno that the `deno` npm package pins (`pnpm exec deno --version` prints it). The first run downloads supabase-js and zod into Deno's cache, so it needs the network. `check:functions` bundles core first, so it never runs against a stale or missing bundle. `pnpm check:integration` runs it too. `pnpm check` never runs Deno, so it stays offline.

Serve the functions against the running stack, with the test environment:

```sh
(cd packages/db && supabase functions serve --env-file supabase/functions/.env.test --no-verify-jwt)
```

A function is then at `http://127.0.0.1:54321/functions/v1/<name>`. The stack has one edge-runtime container for every checkout on this machine, so serve from one checkout at a time and stop it with Ctrl-C when you are done. `supabase/functions/.env.test` is committed and holds no secrets. It points the Open Food Facts calls at a mock server on the host (`http://host.docker.internal:24399`, because functions run in a container), sets a test User-Agent and sets small per-user rate limits, so a test reaches a limit in a few calls. The CLI accepts the comments in that file.

### Running the Edge Function test suites

The HTTP suites in `packages/db/test/integration/functions/` call the real functions through the local API gateway, with the JWT of a user the test creates. They need three things running: the stack, the functions served, and the Open Food Facts mock. The suite starts the mock itself, so you start the first two.

1. Terminal one, from the repo root, with the stack up (`pnpm dev:db`). Write the core bundle, then serve:

   ```sh
   pnpm --filter @keylow/db bundle-core-for-deno
   (cd packages/db && supabase functions serve --env-file supabase/functions/.env.test --no-verify-jwt)
   ```

   Wait for `Serving functions on http://127.0.0.1:54321/functions/v1/<function-name>`. The first start pulls the edge-runtime image. A change to a function's own files is picked up while it is served. After a change in `packages/core`, write the bundle again, and restart the serve if the function still behaves as before.

2. Terminal two, from the repo root:

   ```sh
   pnpm --filter @keylow/db test:integration:functions
   ```

   `pnpm check:integration` runs the same suite after the pgTAP tests, so it needs the functions served too.

If the stack or the served function is missing, the suite stops within a few seconds and says which one, with the command to start it. It never waits for a function to appear.

What the suite starts and what it leaves behind:

- The Open Food Facts mock is a small Node server on port 24399, bound to every interface because the function container reaches it through the host. The port is below the range the operating system gives to outgoing connections, so one of them can never be holding it. It exists for the length of one run. A run that finds the port taken stops and says so, which usually means another run is still going. The mock answers `GET /api/v2/product/<code>` and `GET /cgi/search.pl` like Open Food Facts, and a test controls it through `POST /__mock/register` (what a barcode answers, from a fixture in `packages/core/test/fixtures/off`), `POST /__mock/register-search` (what a search for some words answers, as a list of fixture products, a raw JSON body or a raw text body), `GET /__mock/calls?code=` and `GET /__mock/calls?searchTerms=` (the requests it received, with their full URL and headers) and `POST /__mock/reset`.
- Every test creates its own users (`k46-<random>@test.local` for off-product, `k52-<random>@test.local` for off-search) and uses barcodes generated for that run, so runs and parallel files never share rows. The suite deletes its users and the food rows it created when it finishes. A run that is killed halfway can leave them behind. They are harmless and easy to find by that email prefix. The `rate_limits` rows for each user's bucket (`off-product:user:<uuid>`, `off-search:user:<uuid>`) also stay, because the service role has no write access to that table by design, and they expire on their own as windows pass.

Stop the served functions with Ctrl-C in terminal one. The CLI may leave the `supabase_edge_runtime_keylow` container running after it exits. That is harmless, because the next serve replaces it, and `docker rm -f supabase_edge_runtime_keylow` clears it if you want the stack back to how `pnpm dev:db` left it.

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
- Visiting `/dashboard`, `/diary`, `/foods`, `/recipes` or `/more` while signed out redirects to `/login`.
- Signing in as the demo user, or creating a new account, lands on `/dashboard` with a navigation bar of Dashboard, Diary, Recipes and More. Weight and Settings are reached through More, and Sign out on More returns you to `/login`.
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

### Storybook

Storybook (`@storybook/nextjs`, the webpack framework) shows the web components in every state. It uses the app's PostCSS and Tailwind setup, so a story is styled exactly like the app. It needs no Supabase stack and no `.env.local`.

```sh
pnpm storybook
pnpm --filter @keylow/web build-storybook
```

- `pnpm storybook` runs the web app's `storybook` script from the repo root and serves on <http://localhost:6006>. Add `--port <port>` to use another port. `build-storybook` writes the static site to `apps/web/storybook-static/`, which git, Prettier and ESLint ignore. CI no longer builds the web Storybook, so run `pnpm --filter @keylow/web build-storybook` locally when you change stories or the Storybook config.
- The **Theme** toolbar item flips `data-theme` on `html` between Dark (the default) and Light, the same attribute the app's layout sets from the cookie. The **Viewport** item has Desktop 1280 and Mobile 375.
- Stories live next to the components, as `components/**/*.stories.tsx`. Vitest only runs `test/**`, so stories are never run as unit tests.
- The **Accessibility** panel runs axe on the open story. Fix a violation before you merge a story.
- Storybook's `next/font` mock loads Geist from Google's font servers when the page opens, so a story shows the fallback font offline.
- The root `package.json` pins `postcss-loader` to 8.1.1, the lowest version `@storybook/nextjs` accepts. Version 8.2 depends on `jiti` 2 while Tailwind 3 needs `jiti` 1, and with both in the lockfile `pnpm dedupe --check` flips between two answers from one run to the next. Drop the pin once Tailwind moves to version 4.

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

`.env.local` is only for runs through Metro, which is what a development client on your phone does. It is ignored by git and never reaches EAS. Builds made by EAS get their values from the `env` block of the `base` profile in `apps/mobile/eas.json` (which `development` and `production` extend, and `production-apk` extends `production`), and `.github/workflows/eas-update.yml` sets the same four values for the OTA publish. Those point at production Supabase, so a development client built by EAS still talks to your local stack because Metro serves a fresh bundle from your `.env.local`. If a Google client id changes, update `.env.example`, `eas.json` and the workflow together. Any edit to `eas.json` changes the native fingerprint (the file is hashed whole), so expect the CI fingerprint comment. OTA publishes belong to CI only: a local `eas update` would bundle your `.env.local` values, including the LAN Supabase URL, into the production channel.

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

To update and start in one go, run this from the repo root:

```sh
pnpm mobile:dev
```

It pulls the current branch, runs `pnpm install`, and starts Metro with a clean cache. It stops before starting Metro if the pull cannot fast-forward (your branch has diverged) or would overwrite a file you have edited and not committed. pnpm runs under whichever Node your shell found, so run `source ~/.nvm/nvm.sh && nvm alias default 22` once if new terminals do not start on Node 22.

### Two Ki-Lo apps on one phone

The phone can hold two Ki-Lo apps side by side. They are different Android apps, because each has its own package id.

| App         | Package id                | Name      | Built with profile   | Loads its JavaScript from                                |
| ----------- | ------------------------- | --------- | -------------------- | -------------------------------------------------------- |
| Development | `com.sojisoft.keylow.dev` | Ki-Lo Dev | `development-device` | Metro on your Mac                                        |
| Main        | `com.sojisoft.keylow`     | Ki-Lo     | `production-apk`     | EAS Update, the `production` channel (what main shipped) |

- **Ki-Lo Dev** is the development client in the next sections. Use it for work in progress: it needs Metro running and shows what is on your Mac.
- **Ki-Lo** is the main app. It is a release build (no Metro, no launcher) that runs the JavaScript bundled in the APK and, on each launch, downloads the newest update that `.github/workflows/eas-update.yml` published to the `production` channel. A downloaded update runs from the next launch, so close the app fully and open it again to see a fresh merge. Every qualifying merge to `main` publishes one automatically, because the `production` GitHub environment has only a branch policy and no approval step. Use it to see what main looks like on a real phone. It talks to production Supabase.

The profile `development` sets `APP_VARIANT=development` in its `env`, and `apps/mobile/app.config.ts` reads that to give the build its own Android package and name. Everything else comes from `app.json`. iOS keeps `com.sojisoft.keylow` (a second iOS bundle id would need a second iOS Google client, and there are no iOS builds yet), so only the display name changes there.

Build the main app with:

```sh
npx eas-cli build --profile production-apk --platform android
```

It extends `production`, with internal distribution so EAS produces an installable APK and a link or QR code instead of a store bundle, and `buildType: apk`. Do not use `production` for this: it builds the store AAB, which cannot be sideloaded.

When each app needs a rebuild:

- Both apps run on a native build plus JavaScript. A change that only touches JavaScript (screens, hooks, copy, styles) needs no rebuild: Ki-Lo Dev gets it from Metro, and Ki-Lo gets it from the next EAS Update after the merge.
- A native change (a new native dependency, a config plugin, an Expo SDK bump, any edit to `eas.json`, or an edit to `app.json` or `app.config.ts` that changes the resolved native config) changes the native fingerprint, which is the runtime version. CI then comments on the pull request. An update published after such a merge is never delivered to an old build, so rebuild **Ki-Lo** with `production-apk`. Rebuild **Ki-Lo Dev** with `development-device` only if the code you are running in Metro needs the new native code.
- The two apps get their runtime version from different configs (the development variant changes the package and name, which are part of the fingerprint), so their fingerprints differ on purpose. The main app's matches what CI computes, which is why it receives updates. Check with `npx fingerprint fingerprint:generate --platform android` from `apps/mobile`, run without `APP_VARIANT`: that hash must be the one the `production-apk` build uses (`npx eas-cli fingerprint:generate --build-profile production-apk --platform android`).
- Metro needs no extra setting for Ki-Lo Dev. The dev client accepts what Metro serves whatever package, name or runtime version it carries. To make Metro serve the development variant anyway (the dev menu then shows "Ki-Lo Dev"), start it with `APP_VARIANT=development pnpm mobile:dev`.

Never set `APP_VARIANT` in an EAS environment (expo.dev, Environment variables). The `production-apk` build and the CI `eas update` both read the EAS `production` environment, so a value there would turn the main app into the development variant.

Both apps register the link scheme `keylow://`, so when you tap a `keylow://auth/callback` link (the email confirmation) Android asks which app should open it. Pick the one you signed up in.

#### Google sign-in for each package id

Email sign-in needs nothing. Google sign-in on Android needs an OAuth client of type Android in the Google Cloud project `KeyLow`, one for each package id and signing key. The app and Supabase need no change: the app asks Google for a token for the existing web client, and Android clients are only matched by package id and SHA-1. EAS keeps one keystore per package id, so the first Android build of `com.sojisoft.keylow.dev` generates a new keystore (EAS asks, or generates without asking under `--non-interactive`; accept it), and its SHA-1 is new. The SHA-1 is a public certificate fingerprint, not a secret, but never download or share the keystore itself.

1. Build once: `npx eas-cli build --profile development-device --platform android`. The build creates the keystore.
2. Read the SHA-1. Either run `npx eas-cli credentials --platform android` from `apps/mobile`, pick the `development-device` profile, then "Keystore: Manage everything needed to build your project", and copy the `SHA1 Fingerprint` line (only look, do not choose a remove or upload option), or open expo.dev, the `sojisoft/keylow` project, Credentials, Android, `com.sojisoft.keylow.dev`, and copy the SHA-1 from the keystore.
3. In Google Cloud console, project `KeyLow`: APIs & Services, Credentials, Create credentials, OAuth client ID. Application type "Android", name "KeyLow Android dev", package name `com.sojisoft.keylow.dev`, the SHA-1 from step 2. Create it. Google can take some minutes (occasionally a few hours) to start honouring a new client.
4. The main app `com.sojisoft.keylow` needs the same, with the SHA-1 of the keystore that signs the `production-apk` build. EAS keys keystores by package id, not by profile, so it reuses the keystore of the build you already have for `com.sojisoft.keylow` if there is one. Check whether an Android client with that SHA-1 already exists and create one if not (name "KeyLow Android"). Repeat step 2 for `com.sojisoft.keylow` to get it.

### Get a development client onto the phone

**Device step, not run by the author of this runbook.** The repo is not ready for it yet, so read this part as the plan:

```sh
npx eas-cli build --profile development-device
```

This builds an internal-distribution development client in the EAS cloud (profile `development-device` in `apps/mobile/eas.json`). The `development` profile builds an iOS simulator app instead, which only runs in the iOS Simulator, so you need Xcode on your machine to run it. The EAS build itself does not need Xcode. Before the first build works you need these things:

- An EAS login (`npx eas-cli login`) with access to the `sojisoft` Expo organisation. The account signs in through the browser; the CLI opens it.
- Bundle identifiers and the EAS project are already in `apps/mobile/app.json` (`com.sojisoft.keylow` for both platforms, project `@sojisoft/keylow`). The development build overrides the Android package to `com.sojisoft.keylow.dev` (see "Two Ki-Lo apps on one phone").
- The first Android build for a package id has no signing keystore yet. EAS asks whether to generate one, and `--non-interactive` generates one without asking. Let it generate: the keystore lives in your EAS account, and the Google sign-in client for that package needs its SHA-1 (see "Google sign-in for each package id" above).
- For an iOS internal-distribution build, an Apple Developer account and the phone's UDID registered with `npx eas-cli device:create`. Android needs neither.

The first build itself is tracked as a manual ticket. Until it is done, nobody can install a dev client, but everything else in this section still works.

### Rebuild the development client after the design foundation

The design foundation (KEY-88) adds native modules and native configuration, so a development client built before it cannot run the code that uses them. Build a new one when it merges, and again whenever the CI fingerprint comment says the native fingerprint changed.

What the new build contains that the old one does not:

- `react-native-svg` and `lucide-react-native` (icons), `expo-haptics`, `expo-system-ui`, `expo-font` and `expo-splash-screen`.
- `react-native-gesture-handler`, which Storybook for React Native needs (KEY-89).
- Geist embedded in three weights (`Geist-Regular`, `Geist-Medium`, `Geist-SemiBold`). An old client does not fail on a missing font, it falls back to the system font without a warning, so text that is not Geist means the client is old.
- `userInterfaceStyle: "automatic"`, so the keyboard and dialogs follow the scheme the app sets, and "Match device" follows the phone.
- A dark window and splash background, so a cold start no longer flashes white.

JavaScript-only work still runs on the old client through Metro until the first import of one of these modules. Build with `npx eas-cli build --profile development-device --platform android` from `apps/mobile`.

### Connect the phone

**Device step, not run.** With a dev client installed:

1. Put the phone and the Mac on the same Wi-Fi network.
2. Keep the stack running (section 3) and Metro running (above).
3. Open the Ki-Lo Dev app. Its launcher lists the Metro server it finds on the network. Tap it, or choose to enter a URL and type `http://<LAN-IP>:8081`.
4. The app opens on the sign-in screen. Sign in as `demo@keylow.local` or create an account. The app talks to Supabase at the `EXPO_PUBLIC_SUPABASE_URL` you set.

### Open Storybook on the phone

Storybook for React Native runs inside the dev client, on the real runtime, so a component is judged on the device it ships to. It is off by default, and a build made without the flag carries none of it. Stories sit next to their components as `*.stories.tsx` under `apps/mobile/components`.

1. Start Metro with the flag on, from the repo root:

   ```sh
   EXPO_PUBLIC_STORYBOOK=true pnpm --filter @keylow/mobile start --clear
   ```

   `--clear` matters when you switch the flag, because Metro inlines it into the bundle. Metro turns Storybook telemetry off for you (`STORYBOOK_DISABLE_TELEMETRY=1`, set in `metro.config.js` when the flag is on). It also rewrites the story index, `apps/mobile/.rnstorybook/storybook.requires.ts`, on every start. Commit it when it changes. CI regenerates it and fails on a difference, and `pnpm --filter @keylow/mobile exec sb-rn-get-stories --config-path .rnstorybook` does the same by hand. It is not a package script on purpose: a script name is part of the native fingerprint.

2. Open the dev client and connect to Metro as in "Connect the phone".
3. Open the deep link `keylow://storybook`. On Android, `adb shell am start -a android.intent.action.VIEW -d "keylow://storybook" com.sojisoft.keylow.dev` does it, and on a phone you can type `keylow://storybook` into the browser. No sign-in is needed, because `AuthGate` lets the `storybook` route through while the flag is on.
4. The bottom bar shows the story and opens the story list. The icon at its right opens the addons panel, whose **Theme** tab switches the story between **Dark** and **Light**. The on-device Storybook has no toolbar, so the switch is a panel. It runs through the app's own `ThemeProvider` with the scheme fixed, so a story takes the real theme path while your saved Appearance setting and the Storybook screens are left alone.

Without `EXPO_PUBLIC_STORYBOOK=true`, `/storybook` redirects to the home route and `npx expo export` produces a bundle with no Storybook code. Check that with `npx expo export --platform android --no-bytecode --output-dir <dir>` and a search of the bundle for `UI/Button` or `kilo/theme`, which only a Storybook build contains.

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
- `npx expo-doctor` should end with `No issues detected!`. A patch-only version mismatch is expected between Expo patch batches. Run `npx expo install --fix` when you build a new native binary.
- `npx expo export --platform ios --no-bytecode` bundles the app with Metro and writes `apps/mobile/dist/`, which git ignores. It is the closest thing to a smoke test without a device. It reads `.env.local` for the two `EXPO_PUBLIC_` values.

## 6. Everyday commands

Run from the repo root.

| Command                                  | What it does                                                                                                                                                                                                                                                                                                                                                                           |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm check`                             | `turbo run format:check lint typecheck test`. Run it before every push. It runs the web tests too, which CI does not (see `pnpm check:ci`).                                                                                                                                                                                                                                            |
| `pnpm check --force`                     | The same, ignoring the Turborepo cache                                                                                                                                                                                                                                                                                                                                                 |
| `pnpm check:ci`                          | What CI runs: `pnpm check` without the `@keylow/web` tests. Web format, lint and type-check still run. Nothing in CI builds the web app or the web Storybook. Vercel builds the app (not Storybook) only when a pull request affects web, and it builds the branch head, not the merge with main. `pnpm check` plus the local builds cover them before you push. Accepts `--affected`. |
| `pnpm check:integration`                 | Deno check and lint of the Edge Functions, the pgTAP tests in `packages/db/supabase/tests/`, then the Edge Function suites. Needs the stack running and the functions served.                                                                                                                                                                                                          |
| `pnpm dedupe --check`                    | Fails if the lockfile has duplicates that `pnpm dedupe` would remove                                                                                                                                                                                                                                                                                                                   |
| `pnpm exec prettier --write <path>`      | Formats a file the way `format:check` expects. Markdown is checked too.                                                                                                                                                                                                                                                                                                                |
| `pnpm storybook`                         | Starts the web Storybook on <http://localhost:6006>                                                                                                                                                                                                                                                                                                                                    |
| `pnpm gen-types`                         | Regenerates `packages/db/src/types.gen.ts`. Run it after every migration, then commit the result.                                                                                                                                                                                                                                                                                      |
| `pnpm --filter @keylow/db migration:up`  | Applies the migrations the local database does not have yet, and keeps its data                                                                                                                                                                                                                                                                                                        |
| `pnpm --filter @keylow/db db:reset`      | Rebuilds the local database from nothing. Only for a broken database, announce it first                                                                                                                                                                                                                                                                                                |
| `pnpm --filter @keylow/mobile typecheck` | Type-checks the mobile app with its own TypeScript                                                                                                                                                                                                                                                                                                                                     |
| `cd apps/mobile && npx expo-doctor`      | The Expo project health check. CI runs it through `tools/expo-doctor-gate`: a package that is only a patch behind is a warning there, anything else fails.                                                                                                                                                                                                                             |

After you change the schema, the sequence is: add a migration in `packages/db/supabase/migrations/`, run `pnpm --filter @keylow/db migration:up`, run `pnpm gen-types`, add or update a pgTAP test in `packages/db/supabase/tests/`, run `pnpm check:integration`, then commit the migration, the test and the regenerated types together.

## 7. Troubleshooting

**`pnpm install --frozen-lockfile` fails after a merge or rebase.** The lockfile no longer matches the manifests, often because two branches changed dependencies. Run `pnpm install` to regenerate `pnpm-lock.yaml`, commit it, then confirm with `pnpm install --frozen-lockfile`.

**Duplicate React, "Invalid hook call", or hooks that break only on the phone.** Two copies of React are loaded. Three guards prevent that, and none of them should be removed:

- `.npmrc` sets `node-linker=hoisted`, so Metro finds one `node_modules` tree.
- The root `package.json` has `pnpm.overrides` pinning `react` and `react-dom` to the version Expo SDK 57 needs (19.2.3).
- `pnpm dedupe --check` catches duplicates a new dependency adds. Run `pnpm dedupe` to fix them.

The same overrides also pin `@types/react` and `@types/react-dom` to the 19.2 line (the exact `@types/react` version Expo SDK 57 pins). This is a types guard, not a runtime one. Without it the web app loads two copies of `@types/react`, and a web file that spreads DOM props onto an element fails `next build` (error TS2322) even though `tsc --noEmit` passes. When an Expo upgrade moves its `@types/react` pin, bump the override to match; `expo-doctor` flags the mismatch.

Never add `react-native` or a native module to anything under `packages/`.

**expo-doctor complains about `disableHierarchicalLookup`.** `apps/mobile/metro.config.js` deliberately leaves it unset, because expo-doctor on SDK 57 rejects `true`. Do not "fix" it by setting it. The three guards above cover duplicate React instead.

**`supabase status` says `No such container: supabase_db_<folder name>`.** You ran it outside `packages/db`. Run it there or add `--workdir packages/db`.

**The first `supabase start`, `supabase test db` or `supabase gen types` hangs while pulling an image.** The Docker credential helper can hang on a first pull. Run the command with an empty Docker config:

```sh
DOCKER_CONFIG=$(mktemp -d) pnpm dev:db
```

The same prefix works for `pnpm check:integration` (which pulls the pgTAP runner) and `pnpm gen-types` (which pulls postgres-meta). It affects only that one command.

**`pnpm dev:db` says `supabase start is already running` but you did not start it.** Another checkout's stack is up. The project id in `config.toml` is fixed as `keylow`, so every clone shares the same container names and ports, and the running database holds that other checkout's migrations. Stop it with `pnpm --filter @keylow/db stop:db` (from either checkout), then start it again here and run `pnpm --filter @keylow/db migration:up`. If it reports remote migrations that are missing from the local migrations directory, the database belongs to a branch with migrations this checkout does not have. Switch to that branch. For a genuinely divergent database, and only after announcing it in the team notes, run `db:reset`. Never run `supabase migration repair` against the shared database.

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
