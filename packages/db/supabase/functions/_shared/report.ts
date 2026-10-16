// Reports Edge Function failures to Sentry (KEY-278). It sends the function name, the error code, the
// error's type and its stack frames, and nothing else: never the request, the user, a barcode, a
// search text or the error's message, because a message can quote the very data the function was
// handling. Without SENTRY_DSN (local stack, CI) it only writes a console line and loads nothing.
import type * as SentryDeno from "@sentry/deno";
import type { ErrorEvent } from "@sentry/deno";

import type { EdgeErrorCode } from "./core.ts";
import { runInBackground } from "./runtime.ts";

type SentryOptions = Parameters<typeof SentryDeno.init>[0];

// The three members of the SDK the reporter uses.
export type SentrySdk = {
  init(options: SentryOptions): unknown;
  captureException(
    exception: unknown,
    hint?: Parameters<typeof SentryDeno.captureException>[1],
  ): unknown;
  flush(timeout?: number): Promise<boolean>;
};

export type ReporterDependencies = {
  readDsn: () => string | undefined;
  loadSdk: () => Promise<SentrySdk>;
  // Keeps the runtime alive for the send after the response has gone out.
  runInBackground: (task: Promise<unknown>) => void;
  // Tests replace the network with this.
  transport?: NonNullable<SentryOptions>["transport"];
};

export type ReportError = (functionName: string, code: EdgeErrorCode, caught: unknown) => void;

const flushTimeoutMilliseconds = 2000;

// Only the lines that name a frame survive. The first line of a stack repeats the message.
function stackFrames(error: Error): string {
  const header = error.message === "" ? error.name : `${error.name}: ${error.message}`;
  const stack = error.stack ?? "";
  const withoutHeader = stack.startsWith(header) ? stack.slice(header.length) : stack;
  return withoutHeader
    .split("\n")
    .filter((line) => line.trimStart().startsWith("at "))
    .join("\n");
}

// An error with the original's type and frames and an empty message. A value that is not an Error
// is reported by where it was reported from, because its content is unknown.
export function toSafeError(caught: unknown): Error {
  const type = caught instanceof Error ? caught.name : "EdgeFailure";
  const frames = stackFrames(caught instanceof Error ? caught : new Error());
  const safeError = new Error();
  safeError.name = type;
  safeError.stack = `${type}\n${frames}`;
  return safeError;
}

// The last line of defence, run on every event just before it is sent. Whatever the SDK or the scope
// gathered, only the fields listed here are kept, and the message is replaced by a fixed string made
// from the two tags we set ourselves.
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  const { event_id, timestamp, platform, level, environment, release, exception, tags, sdk } =
    event;
  const fixedMessage = `${String(tags?.function)} ${String(tags?.code)}`;
  return {
    type: undefined,
    event_id,
    timestamp,
    platform,
    level,
    environment,
    release,
    tags,
    sdk,
    exception: {
      values: exception?.values?.map(({ type, stacktrace, mechanism }) => ({
        type,
        value: fixedMessage,
        stacktrace,
        mechanism,
      })),
    },
  };
}

export function createReporter(dependencies: ReporterDependencies): ReportError {
  let started: Promise<SentrySdk> | undefined;

  // Once per isolate, and only after the first failure, so a healthy isolate never loads the SDK.
  function start(dsn: string): Promise<SentrySdk> {
    started ??= dependencies.loadSdk().then((sdk) => {
      sdk.init({
        dsn,
        // No global error handlers and no breadcrumbs from console or fetch.
        defaultIntegrations: false,
        maxBreadcrumbs: 0,
        sendDefaultPii: false,
        tracesSampleRate: 0,
        environment: "production",
        beforeSend: scrubEvent,
        transport: dependencies.transport,
      });
      return sdk;
    });
    return started;
  }

  async function send(dsn: string, functionName: string, code: EdgeErrorCode, safeError: Error) {
    try {
      const sdk = await start(dsn);
      sdk.captureException(safeError, { tags: { function: functionName, code } });
      await sdk.flush(flushTimeoutMilliseconds);
    } catch {
      console.error(`${functionName} could not report ${code} to Sentry`);
    }
  }

  // Reporting is a side channel: nothing in here may throw into the request that is being answered.
  return (functionName, code, caught) => {
    try {
      const safeError = toSafeError(caught);
      console.error(`${functionName} ${code}`, safeError.stack);
      const dsn = dependencies.readDsn();
      if (!dsn) {
        return;
      }
      dependencies.runInBackground(send(dsn, functionName, code, safeError));
    } catch {
      console.error(`${functionName} could not report ${code}`);
    }
  };
}

export const reportError: ReportError = createReporter({
  readDsn: () => Deno.env.get("SENTRY_DSN"),
  loadSdk: () => import("@sentry/deno"),
  runInBackground,
});
