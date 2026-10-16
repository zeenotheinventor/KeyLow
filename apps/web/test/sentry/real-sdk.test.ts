// @vitest-environment node
import * as Sentry from "@sentry/nextjs";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { initSentry } from "@/lib/sentry/init";

const sentEnvelopes: unknown[] = [];

// The real SDK with the real options from initSentry. Only the transport is swapped, for one that
// keeps what would have been sent, so nothing leaves the test.
vi.mock("@sentry/nextjs", async (importOriginal) => {
  const sdk = await importOriginal<typeof import("@sentry/nextjs")>();
  return new Proxy(sdk, {
    get: (target, property): unknown =>
      property === "init"
        ? (options: Parameters<typeof sdk.init>[0]) =>
            sdk.init({
              ...options,
              transport: () => ({
                send: (envelope: unknown) => {
                  sentEnvelopes.push(envelope);
                  return Promise.resolve({});
                },
                flush: () => Promise.resolve(true),
              }),
            })
        : Reflect.get(target, property),
  });
});

const WEIGHT = "82.4 kg";
const FOOD_NAME = "Chicken breast";

describe("what the real SDK sends", () => {
  beforeAll(() => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://publickey@o1.ingest.de.sentry.io/2");
    vi.stubEnv("NEXT_PUBLIC_VERCEL_ENV", "production");
    initSentry();
  });

  afterEach(() => {
    sentEnvelopes.length = 0;
  });

  it("should send an event once initialised, so the probe below proves something", async () => {
    Sentry.captureRequestError(
      new Error("boom"),
      { path: "/foods", method: "GET", headers: {} },
      { routerKind: "App Router", routePath: "/foods", routeType: "render" },
    );
    await Sentry.flush(2000);

    expect(Sentry.getClient()).toBeDefined();
    expect(sentEnvelopes).toHaveLength(1);
  });

  it("should send neither a weight, a food name nor an encoded one, from a request error or a request", async () => {
    Sentry.addBreadcrumb({
      type: "http",
      category: "http",
      data: {
        url: "https://x.supabase.co/rest/v1/foods",
        "http.method": "GET",
        "http.query": `?name=ilike.*${encodeURIComponent(FOOD_NAME)}*`,
        "http.fragment": `#${encodeURIComponent(FOOD_NAME)}`,
        status_code: 200,
      },
    });
    Sentry.addBreadcrumb({
      category: "ui.click",
      message: `button[aria-label="Delete ${FOOD_NAME}"]`,
    });
    Sentry.addBreadcrumb({ category: "console", message: `Saved ${FOOD_NAME} at ${WEIGHT}` });

    Sentry.captureRequestError(
      new Error(`Could not log the food: ${FOOD_NAME} at ${WEIGHT}`),
      {
        path: `/foods/search?q=${encodeURIComponent(FOOD_NAME)}`,
        method: "GET",
        headers: { referer: `https://ki-lo.app/foods?q=${FOOD_NAME}` },
      },
      { routerKind: "App Router", routePath: "/foods/search", routeType: "render" },
    );
    await Sentry.flush(2000);

    expect(sentEnvelopes).toHaveLength(1);
    const payload = JSON.stringify(sentEnvelopes);
    expect(payload).not.toContain(WEIGHT);
    expect(payload).not.toContain(FOOD_NAME);
    expect(payload).not.toContain(encodeURIComponent(FOOD_NAME));
  });
});
