import { init } from "@sentry/nextjs";

import { scrubBreadcrumb, scrubEvent } from "./scrub";

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
    beforeSend: scrubEvent,
    beforeBreadcrumb: scrubBreadcrumb,
  });
}
