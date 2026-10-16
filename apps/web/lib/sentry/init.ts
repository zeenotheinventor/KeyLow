import { init } from "@sentry/nextjs";

import { scrubBreadcrumb, scrubEvent } from "./scrub";

// Release health: with a release set, these send a `session` envelope (release, environment and
// user agent) beside each error. Error reports do not need it, so less leaves the app.
const SESSION_INTEGRATIONS = ["ProcessSession", "BrowserSession"];

/**
 * Starts Sentry for whichever runtime calls it (browser, Node, edge), on the production deploy
 * only. With no DSN, or on any other environment (local dev, tests, CI, a preview), it does
 * nothing, so no event can leave from there.
 *
 * The Vercel variables are read by their NEXT_PUBLIC_ names, which next.config.ts fills from
 * VERCEL_ENV and VERCEL_GIT_COMMIT_SHA at build time, as the browser sees no other variable.
 */
export function initSentry() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  const environment = process.env.NEXT_PUBLIC_VERCEL_ENV;
  if (!dsn || environment !== "production") {
    return;
  }

  init({
    dsn,
    environment,
    release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    integrations: (defaults) =>
      defaults.filter((integration) => !SESSION_INTEGRATIONS.includes(integration.name)),
    beforeSend: scrubEvent,
    beforeBreadcrumb: scrubBreadcrumb,
  });
}
