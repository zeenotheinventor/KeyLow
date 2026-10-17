# Error monitoring

How to read a Sentry error from Ki-Lo, find which release it came from, roll back a bad mobile update, and check that a fix arrived. The decision and the privacy rules behind this are in [ADR 0004](../adr/0004-error-monitoring.md).

Sentry lives at `https://de.sentry.io`, in the organisation `sojisoft-limited`. There are three projects: `keylow-mobile`, `keylow-web` and `keylow-edge`.

## 1. Read an event

Open the project, then **Issues**, then the issue.

- **The title is the error type only.** Ki-Lo strips every error message before it is sent, because a message can quote a food or a weight. Do not look for the message in Sentry. Look at the stack.
- **The stack** shows the file and line. Source maps are uploaded for builds that had `SENTRY_AUTH_TOKEN`, so frames are readable. If you see minified frames, that build had no token (see section 6).
- **The account id** is on the event's user. It is the Supabase user UUID. To see who it is, look the id up under Authentication in the Supabase dashboard. Nothing else that names the person is in Sentry (no email, no name, no IP address).
- **The route** is on the request (web only). Mobile events show no route, only the request breadcrumbs (`xhr`, `fetch`, `http`), with query strings removed.
- **Edge events** carry the tags `function` and `code`, and the exception value is the fixed text `<function> <code>`. They have no breadcrumbs and no contexts (no device or browser details). For more detail, read that function's logs in the Supabase dashboard (the console line has the same stack).

## 2. Which release did it come from

- **Web.** The release is the Vercel git commit SHA. Match it to the deployment on Vercel, or to the commit on `main`.
- **Edge.** Events have no release, and the environment is `production`. Functions deploy from `main` through the `deploy-supabase` workflow, so match the event time against the latest successful run on the Actions tab.
- **Mobile.** Every OTA update is published by the `EAS Update` workflow, run for a push to `main`, and the bundle carries that push's commit in `EXPO_PUBLIC_COMMIT_SHA`. On an event:
  - `release` is that commit. For the bundle built into the installed app, which has no commit, it falls back to the runtime version (the native fingerprint).
  - `dist` is the id of the running update (`Updates.updateId`), so events group per update.
  - The tag `runtimeVersion` is the fingerprint, which tells you which native build the phone has.
  - `environment` comes from the app variant and defaults to `production`.

  Find the commit from the release, then find the workflow run for that commit on the Actions tab. To list the updates themselves, from `apps/mobile`:

  ```sh
  eas update:list --branch production
  ```

  The workflow publishes with `--channel production`, which publishes to the branch linked to that channel. If `production` is not the branch name, `eas channel:view production` shows the real one. Each row of the list is an update group with its message (the commit message), its time and its group id.

## 3. Roll back a bad mobile update

Needs the EAS CLI and an Expo login (`eas login`, or `EXPO_TOKEN` set). Run these from `apps/mobile`.

1. List the recent updates and pick the last good group id:

   ```sh
   eas update:list --branch production
   ```

   `update:list` only takes `--branch`, so confirm the branch name with `eas channel:view production` first.

2. Republish that group. This makes it the newest update on the channel, so phones fetch it:

   ```sh
   eas update:republish --group <update-group-id> --channel production
   ```

   If you do not know the id, `eas update:republish --channel production` shows a list to choose from.

3. Fix the bug on `main` as usual. The next push to main publishes a new update on top.

`eas update:rollback` is the other route. It republishes the update group published before the latest one, and falls back to the bundle embedded in the installed app only if there is no earlier group. Run non-interactively, it needs the latest group id. Republishing a chosen group, as above, is the clearer option when the last good update is not the one just before the bad one.

Web is rolled back with Instant Rollback in the Vercel dashboard. Edge Functions are rolled back by reverting the commit on `main` and letting `deploy-supabase` run.

## 4. Confirm the fix arrived

Open **More**, then **About**, in the app (on web too). The version line reads `Version 1.0.0 (a1b2c3d)`, where the letters are the first seven characters of the commit the running code was built from. On the phone, the line under it reads `Updated <date and time>` for an OTA update and `Built in` for the embedded bundle.

The app checks for an update at launch and holds the splash screen for up to 5 seconds while it downloads, then reloads into it. So normally one cold start is enough. If the version line is still old, the check timed out (a slow network), so close the app fully and start it again. A republished update shows the commit of the update you republished, not the commit of the rollback.

## 5. Sentry settings, alerts and reports

### Required before the web and mobile DSNs are set

Two settings keep the IP address out of Sentry. Sentry works out the IP address (and a rough location from it) when an event arrives, even though the apps send none, and the Privacy Policy says Sentry does not keep it. Both were turned on for the organisation on 17 October 2026, together with server-side data scrubbing and the default scrubbers (passwords, card numbers), which also cover native crashes that skip the apps' own scrubbers. If they are ever switched off, turn them back on before any DSN is set:

1. **Prevent Storing of IP Addresses.** In Sentry, **Settings**, then **Security & Privacy**, for the organisation `sojisoft-limited`, switch on "Prevent Storing of IP Addresses". It can also be set per project, under the project's **Settings**, **Security & Privacy**. Set it on all three projects if you do not set it on the organisation.
2. **An Advanced Data Scrubbing rule** that removes the rough location Sentry derived from the IP address. Under the same **Security & Privacy** page, open **Advanced Data Scrubbing**, add a rule, and set it to `[Remove] [Anything] from [$user.geo.**]`.

Check both are on by opening a test event after the DSN is set and confirming the user has no IP address and no geo fields.

### Alerts

- **Every new issue emails.** Each of the three projects has one rule, "Email on every new or high priority issue". It fires when a new issue is created, when a new high-priority issue appears, or when an existing issue escalates to high priority, and emails the issue owners (active members if there are no owners). One rule per project means one email per new issue. Check it at the project's **Alerts** page, under **Alert Rules**.
- **Weekly report.** A summary of the week's errors is a per-user setting, on for Zee for all three projects. Check it at **User settings**, then **Notifications**, then **Weekly Reports**, for the organisation `sojisoft-limited`.

If the alerts stop coming:

- Check **Stats** for the project. Quota drops (free plan) show there. A noisy bug can use the month's event quota, after which Sentry discards events until it resets. Fix or resolve the noisy issue first.
- Check the DSN is still set where the surface reads it (ADR 0004 lists the places). With no DSN a surface sends nothing and shows no error.

## 6. Secrets, by name only

| Name                     | Where it lives                                      |
| ------------------------ | --------------------------------------------------- |
| `NEXT_PUBLIC_SENTRY_DSN` | Vercel production environment, set by Zee           |
| `EXPO_PUBLIC_SENTRY_DSN` | EAS environment variable, `production` environment  |
| `SENTRY_DSN`             | Supabase function secret                            |
| `SENTRY_AUTH_TOKEN`      | GitHub `production` environment, EAS secret, Vercel |

The mobile DSN is an EAS environment variable in the `production` environment, and Zee sets it in the EAS dashboard (project, Environment variables) or with:

```sh
eas env:create --environment production --name EXPO_PUBLIC_SENTRY_DSN --visibility plaintext
```

It is in no committed file, so it does not change the native fingerprint. `eas update` runs with `--environment production`, so OTA bundles get it, and the `production-apk` build profile sets `environment: production`, so that APK gets it. A build from the plain `production` profile does not, and would have reporting off. Do not assume it is already set.

### Source maps

- **Web.** Uploaded when `SENTRY_AUTH_TOKEN` is present on the Vercel build, then deleted from the build output.
- **EAS builds (mobile).** The Sentry Gradle plugin uploads during the build, and the build **fails** if `SENTRY_AUTH_TOKEN` is not an EAS secret. To build without uploading, set `SENTRY_DISABLE_AUTO_UPLOAD=true` for that build.
- **OTA updates.** The `EAS Update` step uploads only when `SENTRY_AUTH_TOKEN` is set, and publishes the update either way.

Never paste a DSN or the token into an issue, a PR or a doc. The repository is public.
