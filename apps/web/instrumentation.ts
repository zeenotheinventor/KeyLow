import { captureRequestError } from "@sentry/nextjs";

import { initSentry } from "@/lib/sentry/init";

export function register() {
  initSentry();
}

export const onRequestError = captureRequestError;
