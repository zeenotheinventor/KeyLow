import { assertEquals, assertFalse, assertObjectMatch, assertStringIncludes } from "@std/assert";
import * as Sentry from "@sentry/deno";
import type { ErrorEvent } from "@sentry/deno";

import { createReporter, scrubEvent, toSafeError } from "./report.ts";
import { handle } from "./http.ts";

const dsn = "https://publickey@o1.ingest.de.sentry.io/1";

// Collects the tasks the reporter hands to the runtime, so a test can wait for them like the runtime would.
function backgroundTasks() {
  const tasks: Promise<unknown>[] = [];
  return {
    runInBackground: (task: Promise<unknown>) => tasks.push(task),
    count: () => tasks.length,
    settled: () => Promise.all(tasks),
  };
}

// Stands in for the network: the envelopes the real SDK would have sent, as text.
function capturingTransport() {
  const sent: string[] = [];
  return {
    sent,
    transport: () => ({
      send: (envelope: unknown) => {
        sent.push(JSON.stringify(envelope));
        return Promise.resolve({});
      },
      flush: () => Promise.resolve(true),
    }),
  };
}

class QuotingError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "QuotingError";
  }
}

function failWhileLogging(): never {
  throw new QuotingError("Logged 82.4 kg for Chicken breast", {
    cause: new Error("Chicken breast, 82.4 kg"),
  });
}

Deno.test(
  "what reaches Sentry carries the function, the code and the stack, and no message",
  async () => {
    const background = backgroundTasks();
    const network = capturingTransport();
    // Things the SDK would normally attach to an event if something had put them in its scope.
    Sentry.setUser({ id: "user-1", email: "someone@example.com" });
    Sentry.setExtra("body", "Chicken breast 82.4 kg");
    Sentry.addBreadcrumb({ category: "console", message: "Chicken breast 82.4 kg" });
    const reportError = createReporter({
      readDsn: () => dsn,
      loadSdk: () => import("@sentry/deno"),
      runInBackground: background.runInBackground,
      transport: network.transport,
    });

    try {
      failWhileLogging();
    } catch (caught) {
      reportError("off-product", "upstream_error", caught);
    }
    await background.settled();

    assertEquals(network.sent.length, 1);
    const [event] = network.sent;
    assertFalse(event.includes("82.4"));
    assertFalse(event.includes("Chicken breast"));
    assertFalse(event.includes("someone@example.com"));
    assertStringIncludes(event, '"function":"off-product"');
    assertStringIncludes(event, '"code":"upstream_error"');
    assertStringIncludes(event, '"type":"QuotingError"');
    assertStringIncludes(event, "failWhileLogging");
    assertStringIncludes(event, "report.test.ts");
  },
);

Deno.test(
  "a thrown value that is not an Error is reported by its call site, never its content",
  async () => {
    const background = backgroundTasks();
    const network = capturingTransport();
    const reportError = createReporter({
      readDsn: () => dsn,
      loadSdk: () => import("@sentry/deno"),
      runInBackground: background.runInBackground,
      transport: network.transport,
    });

    reportError("off-search", "internal_error", { message: "Chicken breast 82.4 kg" });
    await background.settled();

    assertEquals(network.sent.length, 1);
    assertFalse(network.sent[0].includes("Chicken breast"));
    assertStringIncludes(network.sent[0], '"code":"internal_error"');
    assertStringIncludes(network.sent[0], "report.test.ts");
  },
);

Deno.test("nothing is loaded, started or scheduled while SENTRY_DSN is unset", () => {
  const background = backgroundTasks();
  const reportError = createReporter({
    readDsn: () => undefined,
    loadSdk: () => {
      throw new Error("the SDK must not be loaded without a DSN");
    },
    runInBackground: background.runInBackground,
  });

  reportError("off-product", "internal_error", new Error("boom"));

  assertEquals(background.count(), 0);
});

Deno.test(
  "the SDK starts once per isolate and each report is flushed for a short time",
  async () => {
    const background = backgroundTasks();
    const calls: string[] = [];
    let initOptions: unknown;
    const fakeSdk = {
      init: (options: unknown) => {
        initOptions = options;
        calls.push("init");
        return undefined;
      },
      captureException: () => {
        calls.push("capture");
        return "event-id";
      },
      flush: (timeout?: number) => {
        calls.push(`flush ${timeout}`);
        return Promise.resolve(true);
      },
    };
    const reportError = createReporter({
      readDsn: () => dsn,
      loadSdk: () => Promise.resolve(fakeSdk),
      runInBackground: background.runInBackground,
    });

    reportError("off-product", "internal_error", new Error("one"));
    reportError("off-product", "internal_error", new Error("two"));
    await background.settled();

    assertEquals(calls, ["init", "capture", "flush 2000", "capture", "flush 2000"]);
    // The fake records whatever the reporter passed; it is an options object.
    assertObjectMatch(initOptions as Record<string, unknown>, {
      dsn,
      sendDefaultPii: false,
      tracesSampleRate: 0,
      defaultIntegrations: false,
      maxBreadcrumbs: 0,
    });
  },
);

Deno.test("a reporter that fails never fails the request", async () => {
  const background = backgroundTasks();
  const reportError = createReporter({
    readDsn: () => dsn,
    loadSdk: () => Promise.reject(new Error("the SDK could not be loaded")),
    runInBackground: background.runInBackground,
  });

  reportError("off-product", "internal_error", new Error("boom"));

  // A task that rejected would make this throw.
  await background.settled();
  assertEquals(background.count(), 1);
});

Deno.test(
  "a fetch with a barcode and a search text in its URL leaves no trace in the next report",
  async () => {
    const background = backgroundTasks();
    const network = capturingTransport();
    const realFetch = globalThis.fetch;
    globalThis.fetch = () => Promise.resolve(new Response("{}"));
    try {
      const reportError = createReporter({
        readDsn: () => dsn,
        loadSdk: () => import("@sentry/deno"),
        runInBackground: background.runInBackground,
        transport: network.transport,
      });
      // The first report starts the SDK. Anything it patches is patched from here on.
      reportError("off-search", "internal_error", new Error("warm up"));
      await background.settled();

      await fetch(
        "https://world.openfoodfacts.org/api/v2/product/5000112637922?q=Chicken%20breast",
      );
      await fetch("https://world.openfoodfacts.org/cgi/search.pl?search_terms=Chicken%20breast");
      try {
        failWhileLogging();
      } catch (caught) {
        reportError("off-product", "upstream_error", caught);
      }
      await background.settled();
    } finally {
      globalThis.fetch = realFetch;
    }

    assertEquals(network.sent.length, 2);
    for (const event of network.sent) {
      assertFalse(event.includes("5000112637922"));
      assertFalse(event.includes("Chicken"));
      assertFalse(event.includes("82.4"));
      assertFalse(event.includes("openfoodfacts"));
      assertFalse(event.includes("breadcrumbs"));
    }
  },
);

Deno.test("scrubEvent keeps an allowlist and drops everything else an SDK event can carry", () => {
  // An event shaped like the ones the SDK builds when its integrations are on.
  const event: ErrorEvent = {
    type: undefined,
    event_id: "1",
    timestamp: 1,
    platform: "javascript",
    level: "error",
    environment: "production",
    message: "Chicken breast 82.4 kg",
    logentry: { message: "Chicken breast %s", params: ["82.4 kg"] },
    extra: { body: "Chicken breast" },
    user: { id: "u", ip_address: "203.0.113.7" },
    server_name: "host-5000112637922",
    request: {
      url: "https://x.supabase.co/functions/v1/off-search?q=Chicken",
      method: "POST",
      data: "82.4 kg",
    },
    contexts: {
      culture: { locale: "en" },
      trace: { trace_id: "t", span_id: "s" },
      device: { name: "Chicken breast" },
    },
    breadcrumbs: [
      {
        category: "fetch",
        data: {
          url: "https://world.openfoodfacts.org/api/v2/product/5000112637922",
          "http.query": "?q=Chicken%20breast",
        },
      },
      { category: "console", message: "82.4 kg" },
    ],
    tags: { function: "off-product", code: "upstream_error" },
    exception: {
      values: [
        {
          type: "QuotingError",
          value: "Logged 82.4 kg for Chicken breast",
          stacktrace: {
            frames: [{ function: "failWhileLogging", filename: "file:///src/index.ts" }],
          },
        },
      ],
    },
  };

  const text = JSON.stringify(scrubEvent(event));

  for (const leaked of [
    "Chicken",
    "82.4",
    "5000112637922",
    "203.0.113.7",
    "openfoodfacts",
    "breadcrumbs",
  ]) {
    assertFalse(text.includes(leaked), leaked);
  }
  assertStringIncludes(text, "off-product upstream_error");
  assertStringIncludes(text, "failWhileLogging");
});

Deno.test(
  "a runtime that cannot run the task in the background still lets the request answer",
  async () => {
    const reportError = createReporter({
      readDsn: () => dsn,
      loadSdk: () => import("@sentry/deno"),
      runInBackground: () => {
        throw new Error("no EdgeRuntime here");
      },
    });
    const handler = handle(
      "off-product",
      () => {
        throw new Error("boom");
      },
      reportError,
    );

    const response = await handler(new Request("http://localhost/off-product", { method: "POST" }));

    assertEquals(response.status, 500);
    assertEquals((await response.json()).error.code, "internal_error");
    assertEquals(response.headers.get("Access-Control-Allow-Origin"), "*");
  },
);

Deno.test("toSafeError keeps the type and the frames and nothing else", () => {
  const original = new QuotingError("Logged 82.4 kg for Chicken breast", {
    cause: new Error("Chicken breast, 82.4 kg"),
  });

  const safeError = toSafeError(original);

  assertEquals(safeError.name, "QuotingError");
  assertEquals(safeError.message, "");
  assertEquals(safeError.cause, undefined);
  const [typeLine, ...frames] = (safeError.stack ?? "").split("\n");
  assertEquals(typeLine, "QuotingError");
  assertEquals(frames.length > 0, true);
  assertEquals(
    frames.every((line) => line.trimStart().startsWith("at ")),
    true,
  );
});
