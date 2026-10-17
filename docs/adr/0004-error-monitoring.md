# 0004: Error monitoring with Sentry

## Status

Accepted, 2026-10-16.

## Context

Until now the only way to learn that something crashed in production was a person telling us. Ki-Lo holds health data (weight, food diary, body stats), so a tool that watches for errors must not become a second place that data ends up. An error message can quote the very row that failed, for example a repository error that names the food and the weight being saved, so the choice of tool and the rules for what it may receive matter as much as getting alerts.

Three options were weighed:

- **Sentry** (free Developer plan, EU data residency). Covers React Native including native crashes, Next.js and Deno (Edge Functions). Chosen.
- **PostHog error tracking.** Weaker native-crash coverage in React Native, and adding an analytics product to a health app needs more consent work than error reports do.
- **EAS Observe.** Performance only, not errors. A candidate for M7.

Out of scope: tracing, session replay and product analytics.

## Decision

### Three Sentry projects

The Sentry organisation is `sojisoft-limited`, in the EU region (`de.sentry.io`). There is one project per surface:

| Project         | Surface                            |
| --------------- | ---------------------------------- |
| `keylow-mobile` | The Expo app                       |
| `keylow-web`    | The Next.js app on Vercel          |
| `keylow-edge`   | The Supabase Edge Functions (Deno) |

Tracing is off everywhere (`tracesSampleRate: 0`). There is no session replay.

### Each surface does nothing unless it is switched on

- **Web** starts Sentry only when `NEXT_PUBLIC_SENTRY_DSN` is set and `NEXT_PUBLIC_VERCEL_ENV` is `production`. Local development, tests, CI and previews send nothing.
- **Mobile** starts Sentry only when `EXPO_PUBLIC_SENTRY_DSN` is set, and skips `__DEV__` builds. The release is the commit (`EXPO_PUBLIC_COMMIT_SHA`), falling back to the runtime version for the bundle built into the app. The dist is the running update id. Release-health sessions are off (`enableAutoSessionTracking: false`) and so are client reports. On web the session integrations are removed.
- **Edge** reports only when the `SENTRY_DSN` function secret is set. Without it (local stack, CI) a failure is written to the console and the Sentry SDK is never loaded.

Where each DSN lives: `NEXT_PUBLIC_SENTRY_DSN` is a Vercel production environment variable, set by Zee. `EXPO_PUBLIC_SENTRY_DSN` is an EAS environment variable in the `production` environment, set by Zee in the EAS dashboard (project, Environment variables) or with `eas env:create --environment production --name EXPO_PUBLIC_SENTRY_DSN --visibility plaintext`. It is not in `eas.json`, the OTA workflow or any other committed file, so it cannot change the native fingerprint. `eas update` runs with `--environment production`, so OTA bundles get it, and the `production-apk` build profile sets `environment: production`, so that APK gets it. The plain `production` build profile does not, so a build made from it has reporting off. `SENTRY_DSN` is a Supabase function secret. This describes where each lives, not that each is set yet. A DSN is not written in this repository's docs.

### Source maps

Source maps upload only when `SENTRY_AUTH_TOKEN` is present. The token is a secret on the GitHub `production` environment, an EAS secret and a Vercel variable. Without it the web build and the OTA update still succeed, and stack traces are simply not symbolicated. EAS native builds are stricter: the Sentry Gradle plugin uploads during the build and the build fails without the token as an EAS secret, unless `SENTRY_DISABLE_AUTO_UPLOAD=true` is set. Web source maps are deleted after upload, so they are never served to browsers.

### Web uses `@sentry/nextjs` v10, not v11

Version 11 replaces `sendDefaultPii` with `dataCollection`, which defaults to collecting everything. Staying on v10 keeps `sendDefaultPii: false` as the explicit, reviewed switch. Moving to v11 needs its own decision and a re-check of every rule below.

### What may leave the app

The rule is allow-listing: an event is rebuilt from the fields below before it is sent, and anything not named is dropped. The code is `apps/web/lib/sentry/scrub.ts` for web and the reporter in the Edge Functions' `_shared` folder for edge.

- **No message text.** Every exception message is removed, along with `event.message` and `logentry`. A report keeps the error type, the stack, the account id and, on web, the route, which is enough to find the line that threw. `extra` is deleted, because the SDK puts a thrown non-Error there, such as a PostgREST error with the row it refused.
- **Request.** Only the method and the URL, with the query string and fragment removed.
- **User.** The account id only (the Supabase user UUID). No email or name. The SDKs send no IP address (`sendDefaultPii: false`), and Sentry infers one on arrival, so the Sentry organisation is set not to store it (see Sentry settings below).
- **Device and app details.** Contexts are an allow-list. Web keeps `trace` (web only: without its span data), `runtime`, `os`, `browser`, `device`, `app` and `culture`. Mobile keeps `trace` (whole), `os`, `device`, `app`, `culture`, `runtime`, `ota_updates` and `react_native_context`, and removes the device name from `device`, because owners often name a phone after themselves. `culture` carries the locale and time zone. The `device` context includes the model and also memory, storage and battery-type fields. The Privacy Policy line is worded to cover this (model, operating system, browser, language and time zone).
- **Breadcrumbs (web and mobile).** The same three rules apply on both. Breadcrumb categories are filtered, the message of every breadcrumb is dropped, and the data is an allow-list (the url, `from`, `to`, method and status code, with URL query strings stripped).
  - Web drops console, `ui.input` and `ui.click` breadcrumbs, because a click is named after the element's label (for example "Delete Chicken breast"). It also drops any breadcrumb whose data has a `body`, `request_body`, `input` or `value` key.
  - Mobile keeps only the categories `navigation`, `xhr`, `fetch` and `http`, and has console breadcrumbs off. It registers no routing integration, so in practice a mobile event carries only request breadcrumbs, and no route or navigation trail.
- **Edge.** Never sends the request body, headers, barcode or search text. The event is rebuilt from an allow-list: the function name and error code as tags, the exception type and stack, and a fixed exception value made from the function name and the code (`<function> <code>`). It has no breadcrumbs and no contexts, no release, and the environment is `production`.

The Privacy Policy lists Sentry as a company that handles information, in the same words as this list (what it receives, what it never receives, that it does not keep the IP address, where it is stored and for how long). Adding it bumped `TERMS_VERSION` to `2026-10-16`, which asks existing accounts to accept again.

### Sentry settings that must be on first

These two settings are required, and must be on before the web and mobile DSNs are set:

1. **Prevent Storing of IP Addresses.** In Sentry, organisation `sojisoft-limited`, **Settings**, **Security & Privacy**, switch on "Prevent Storing of IP Addresses". It can instead be set in each of the three projects (project **Settings**, **Security & Privacy**).
2. **An Advanced Data Scrubbing rule**, on the same **Security & Privacy** page: `[Remove] [Anything] from [$user.geo.**]`. It removes the rough location Sentry derives from the IP address.

Both were turned on for the organisation on 17 October 2026, together with server-side data scrubbing and the default scrubbers, which also cover native crashes that skip the apps' own scrubbers. The Privacy Policy line about the IP address depends on them, so they stay on.

### Retention

Events are kept for 30 days on the Developer plan (checked on KEY-278 on 2026-10-16). The Privacy Policy says so, and says an error report can outlast a deleted account by up to 30 days.

### Alerts

Each project has one rule, "Email on every new or high priority issue": Sentry's default high-priority rule with a "new issue is created" condition added, so every new issue sends one email to the issue owners (active members if there are none), as do issues that become high priority. The weekly report (a per-user setting under User settings, Notifications) is on. There is no paging and no custom alert tuning.

## Consequences

- Production crashes reach us without anyone reporting them, and none of the diary, weigh-in or body-stat content reaches a third party. The price is thinner reports: with no message text, finding the cause starts from the stack (and, on web, the route), not from a quoted error.
- Any new data attached to an event (a tag, context, breadcrumb type) is a privacy change. It needs the scrubbing rules above updated first, and the Privacy Policy re-read.
- The free plan has event quotas. A noisy bug can use a month's quota in a day, after which Sentry drops events until the quota resets. `docs/runbooks/error-monitoring.md` covers what to do.
- Pinning web to `@sentry/nextjs` v10 means it is upgraded by hand, and must not move to v11 without the check described above.
