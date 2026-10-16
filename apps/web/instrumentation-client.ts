import { captureRouterTransitionStart } from "@sentry/nextjs";

import { initSentry } from "@/lib/sentry/init";

initSentry();

export const onRouterTransitionStart = captureRouterTransitionStart;
