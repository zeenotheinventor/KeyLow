import { describe, expect, it } from "vitest";

import type { Event } from "@sentry/nextjs";

import { scrubBreadcrumb, scrubEvent } from "@/lib/sentry/scrub";

const scrub = (event: Event): Event => scrubEvent({ ...event, type: undefined });

const WEIGHT = "82.4 kg";
const FOOD_NAME = "Chicken breast";

/** The shape the SDK builds for an Error that carries the failure beneath it as its cause. */
const repositoryErrorEvent = () => ({
  exception: {
    values: [
      {
        type: "Error",
        value: `Could not log the food: duplicate key for "${FOOD_NAME}" at ${WEIGHT}`,
        stacktrace: { frames: [{ filename: "app:///_next/static/chunks/diary.js", lineno: 12 }] },
      },
      {
        type: "Error",
        value: `insert on "${FOOD_NAME}" failed, weighed ${WEIGHT}`,
      },
    ],
  },
});

describe("scrubEvent", () => {
  it("should leave neither a weight nor a food name in the payload of a repository error", () => {
    const scrubbed = JSON.stringify(scrub(repositoryErrorEvent()));

    expect(scrubbed).not.toContain(WEIGHT);
    expect(scrubbed).not.toContain(FOOD_NAME);
  });

  it("should keep the error type and the stack so the failure can still be found", () => {
    const scrubbed = scrub(repositoryErrorEvent());

    expect(scrubbed.exception?.values?.[0]).toMatchObject({
      type: "Error",
      stacktrace: { frames: [{ filename: "app:///_next/static/chunks/diary.js", lineno: 12 }] },
    });
  });

  it("should drop the text of a message captured on its own", () => {
    const scrubbed = scrub({ message: `Saved ${FOOD_NAME} at ${WEIGHT}` });

    expect(JSON.stringify(scrubbed)).not.toContain(FOOD_NAME);
  });

  it("should drop the extra data a PostgREST error object is serialised into", () => {
    const scrubbed = scrub({
      exception: { values: [{ type: "Error", value: "Object captured as exception" }] },
      extra: {
        __serialized__: { code: "23505", details: `Key (name)=(${FOOD_NAME}) exists`, hint: null },
      },
    });

    expect(JSON.stringify(scrubbed)).not.toContain(FOOD_NAME);
  });

  it("should remove the request body, cookies, headers and query string", () => {
    const scrubbed = scrub({
      request: {
        method: "POST",
        url: `https://ki-lo.app/foods?q=${FOOD_NAME}`,
        query_string: `q=${FOOD_NAME}`,
        data: { weight: WEIGHT },
        cookies: { session: "secret" },
        headers: { cookie: "session=secret" },
      },
    });

    expect(scrubbed.request).toEqual({ method: "POST", url: "https://ki-lo.app/foods" });
  });

  it("should drop the contexts the SDK did not fill in about the machine, such as the Next.js request path", () => {
    const scrubbed = scrub({
      contexts: {
        nextjs: { request_path: "/foods/search?q=Chicken%20breast", route_type: "render" },
        runtime: { name: "node" },
        os: { name: "macOS" },
        trace: { trace_id: "a", span_id: "b", data: { "http.url": "/foods?q=Chicken%20breast" } },
      },
    });

    expect(scrubbed.contexts).toEqual({
      runtime: { name: "node" },
      os: { name: "macOS" },
      trace: { trace_id: "a", span_id: "b" },
    });
  });

  it("should keep only the user id", () => {
    const scrubbed = scrub({
      user: { id: "5f1c", email: "a@b.com", username: "zee", ip_address: "1.2.3.4" },
    });

    expect(scrubbed.user).toEqual({ id: "5f1c" });
  });

  it("should strip the query string from the urls of the breadcrumbs it carries", () => {
    const scrubbed = scrub({
      breadcrumbs: [{ category: "navigation", data: { to: `/foods?q=${FOOD_NAME}` } }],
    });

    expect(scrubbed.breadcrumbs?.[0]?.data?.to).toBe("/foods");
  });
});

describe("scrubBreadcrumb", () => {
  it("should drop a console breadcrumb", () => {
    expect(scrubBreadcrumb({ category: "console", message: `Saved ${FOOD_NAME}` })).toBeNull();
  });

  it("should drop a breadcrumb for a value typed into an input", () => {
    expect(scrubBreadcrumb({ category: "ui.input", message: "input#weight" })).toBeNull();
  });

  it.each(["body", "request_body", "input", "value"])(
    "should drop a breadcrumb whose data carries %s",
    (key) => {
      expect(
        scrubBreadcrumb({ category: "fetch", data: { url: "/rest/v1/foods", [key]: WEIGHT } }),
      ).toBeNull();
    },
  );

  it("should strip the query string from the url of a request breadcrumb", () => {
    const scrubbed = scrubBreadcrumb({
      category: "fetch",
      data: { url: `https://x.supabase.co/rest/v1/foods?name=ilike.*${FOOD_NAME}*`, method: "GET" },
    });

    expect(scrubbed?.data).toEqual({ url: "https://x.supabase.co/rest/v1/foods", method: "GET" });
  });

  it("should drop a click breadcrumb, whose message is named after the element's label", () => {
    expect(
      scrubBreadcrumb({
        category: "ui.click",
        message: `button[aria-label="Delete ${FOOD_NAME}"]`,
      }),
    ).toBeNull();
  });

  it("should keep only the method, status and urls of a server request breadcrumb", () => {
    const scrubbed = scrubBreadcrumb({
      category: "http",
      type: "http",
      data: {
        url: "https://x.supabase.co/rest/v1/foods",
        "http.method": "GET",
        "http.query": "?name=ilike.*Chicken%20breast*",
        "http.fragment": "#Chicken%20breast",
        status_code: 200,
      },
    });

    expect(scrubbed?.data).toEqual({
      url: "https://x.supabase.co/rest/v1/foods",
      "http.method": "GET",
      status_code: 200,
    });
  });
});
