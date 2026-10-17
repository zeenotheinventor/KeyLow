import type { Breadcrumb, ErrorEvent } from "@sentry/react-native";

/*
 * What may leave the app in an error report. A repository error quotes the failure beneath it
 * ("Could not log the food: ... Chicken breast ... 82.4 kg"), and a PostgREST error carries the row
 * it refused, so no message text is sent at all: the report keeps the error type, the stack, the
 * route and the account id, which is enough to find the line that threw. The web app's
 * apps/web/lib/sentry/scrub.ts applies the same rules.
 */

/*
 * Everything here is an allowlist: what is not named is not sent. A tap breadcrumb is worded from the
 * accessible label of what was pressed ("Delete Chicken breast"), a request breadcrumb can carry the
 * search text of its query, and a context is whatever code put there, so none of those are listed.
 */

// The only breadcrumbs sent: moving between screens, and the requests the app makes.
const BREADCRUMB_CATEGORIES_SENT = new Set(["navigation", "xhr", "fetch", "http"]);

const BREADCRUMB_DATA_KEYS_SENT = ["url", "method", "http.method", "status_code", "from", "to"];

const BREADCRUMB_URL_KEYS = ["url", "from", "to"];

// The contexts the SDKs build from the phone and the running update, never from anything the user did.
const CONTEXT_KEYS_SENT = [
  "trace",
  "os",
  "device",
  "app",
  "culture",
  "runtime",
  "ota_updates",
  "react_native_context",
];

const withoutQueryString = (url: string) => url.split(/[?#]/)[0] ?? url;

export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  const { category, data } = breadcrumb;

  if (category === undefined || !BREADCRUMB_CATEGORIES_SENT.has(category)) {
    return null;
  }

  // A message is worded from what was pressed or typed, so none is sent.
  const withoutMessage = { ...breadcrumb };
  delete withoutMessage.message;

  if (data === undefined) {
    return withoutMessage;
  }

  const scrubbedData: Record<string, unknown> = {};
  for (const key of BREADCRUMB_DATA_KEYS_SENT) {
    const value: unknown = data[key];
    if (value === undefined) {
      continue;
    }
    scrubbedData[key] =
      BREADCRUMB_URL_KEYS.includes(key) && typeof value === "string"
        ? withoutQueryString(value)
        : value;
  }

  return { ...withoutMessage, data: scrubbedData };
}

type Contexts = NonNullable<ErrorEvent["contexts"]>;

function scrubContexts(contexts: Contexts): Contexts {
  const sent = Object.fromEntries(
    Object.entries(contexts).filter(([key]) => CONTEXT_KEYS_SENT.includes(key)),
  );

  if (sent.device !== undefined) {
    // The name the owner gave the phone, often their own.
    const device = { ...sent.device };
    delete device.name;
    sent.device = device;
  }

  return sent;
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

  if (event.contexts !== undefined) {
    scrubbed.contexts = scrubContexts(event.contexts);
  }

  if (event.breadcrumbs !== undefined) {
    scrubbed.breadcrumbs = event.breadcrumbs.flatMap(
      (breadcrumb) => scrubBreadcrumb(breadcrumb) ?? [],
    );
  }

  return scrubbed;
}
