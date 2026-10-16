import type { Breadcrumb, ErrorEvent } from "@sentry/nextjs";

/*
 * What may leave the app in an error report. A repository error quotes the failure beneath it
 * ("Could not log the food: ... Chicken breast ... 82.4 kg"), and a PostgREST error carries the row
 * it refused, so no message text is sent at all: the report keeps the error type, the stack, the
 * route and the account id, which is enough to find the line that threw.
 */

// A click breadcrumb is named after the element's aria-label, name or title, and ours read like
// "Delete Chicken breast".
const BREADCRUMB_CATEGORIES_NEVER_SENT = new Set(["console", "ui.input", "ui.click"]);

// Data keys a breadcrumb uses for something the user typed or a request or response body.
const BREADCRUMB_DATA_KEYS_THAT_CARRY_VALUES = ["body", "request_body", "input", "value"];

const BREADCRUMB_URL_KEYS = ["url", "from", "to"];

// The only data a breadcrumb keeps. Anything else, such as the `http.query` and `http.fragment` the
// server fetch breadcrumb adds, can quote what the user searched for.
const BREADCRUMB_DATA_KEYS_KEPT = [...BREADCRUMB_URL_KEYS, "method", "http.method", "status_code"];

// The contexts the SDK fills in about the machine and the trace. The others are not ours to vouch for:
// `nextjs` carries the request path with its query string.
const CONTEXTS_KEPT = ["trace", "runtime", "os", "browser", "device", "app", "culture"];

const pickKeys = <TValue>(source: Record<string, TValue>, keys: readonly string[]) =>
  Object.fromEntries(Object.entries(source).filter(([key]) => keys.includes(key)));

const withoutQueryString = (url: string) => url.split(/[?#]/)[0] ?? url;

export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  const { category, data } = breadcrumb;

  if (category !== undefined && BREADCRUMB_CATEGORIES_NEVER_SENT.has(category)) {
    return null;
  }

  if (data === undefined) {
    return breadcrumb;
  }

  if (BREADCRUMB_DATA_KEYS_THAT_CARRY_VALUES.some((key) => key in data)) {
    return null;
  }

  const scrubbedData = pickKeys(data, BREADCRUMB_DATA_KEYS_KEPT);
  for (const key of BREADCRUMB_URL_KEYS) {
    const url: unknown = scrubbedData[key];
    if (typeof url === "string") {
      scrubbedData[key] = withoutQueryString(url);
    }
  }

  return { ...breadcrumb, data: scrubbedData };
}

export function scrubEvent(event: ErrorEvent): ErrorEvent {
  const scrubbed = { ...event };

  delete scrubbed.message;
  delete scrubbed.logentry;
  // Where the SDK serialises a thrown non-Error, such as a PostgREST error with the row it refused.
  delete scrubbed.extra;

  if (event.exception?.values !== undefined) {
    scrubbed.exception = {
      ...event.exception,
      values: event.exception.values.map(({ value: _value, ...rest }) => rest),
    };
  }

  if (event.contexts !== undefined) {
    scrubbed.contexts = pickKeys(event.contexts, CONTEXTS_KEPT);
    if (event.contexts.trace !== undefined) {
      // The data of the span the trace came from can hold request urls.
      const trace = { ...event.contexts.trace };
      delete trace.data;
      scrubbed.contexts.trace = trace;
    }
  }

  if (event.request !== undefined) {
    const { method, url } = event.request;
    scrubbed.request = {
      ...(method === undefined ? {} : { method }),
      ...(url === undefined ? {} : { url: withoutQueryString(url) }),
    };
  }

  if (event.user !== undefined) {
    // The account id is all that may identify who hit the error.
    scrubbed.user = event.user.id === undefined ? {} : { id: event.user.id };
  }

  if (event.breadcrumbs !== undefined) {
    scrubbed.breadcrumbs = event.breadcrumbs.flatMap(
      (breadcrumb) => scrubBreadcrumb(breadcrumb) ?? [],
    );
  }

  return scrubbed;
}
