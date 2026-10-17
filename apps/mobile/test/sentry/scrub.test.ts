import { scrubBreadcrumb, scrubEvent } from "../../lib/sentry/scrub";

import type { Event } from "@sentry/react-native";

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
        stacktrace: { frames: [{ filename: "app:///index.android.bundle", lineno: 12 }] },
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
      stacktrace: { frames: [{ filename: "app:///index.android.bundle", lineno: 12 }] },
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
        url: `https://api.example.com/foods?q=${FOOD_NAME}`,
        query_string: `q=${FOOD_NAME}`,
        data: { weight: WEIGHT },
        cookies: { session: "secret" },
        headers: { cookie: "session=secret" },
      },
    });

    expect(scrubbed.request).toEqual({ method: "POST", url: "https://api.example.com/foods" });
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

  it("should drop the breadcrumbs that are not allowed, such as a tap labelled with a food name", () => {
    const scrubbed = scrub({
      breadcrumbs: [
        { category: "touch", message: `Touch event within element: Delete ${FOOD_NAME}` },
        { category: "navigation", data: { to: "/diary" } },
      ],
    });

    expect(scrubbed.breadcrumbs).toEqual([{ category: "navigation", data: { to: "/diary" } }]);
  });

  describe("contexts", () => {
    it("should keep the contexts the SDK builds itself", () => {
      const contexts = {
        trace: { trace_id: "a1", span_id: "b2" },
        os: { name: "Android" },
        device: { model: "Pixel 8" },
        app: { app_version: "1.0.0" },
        culture: { locale: "en-GB" },
        runtime: { name: "Hermes" },
        ota_updates: { update_id: "7a2e" },
        react_native_context: { js_engine: "hermes" },
      };

      expect(scrub({ contexts }).contexts).toEqual(contexts);
    });

    it("should drop any other context, which only code of ours could have set", () => {
      const scrubbed = scrub({
        contexts: {
          os: { name: "Android" },
          entry: { food: FOOD_NAME, weight: WEIGHT },
          Error: { details: FOOD_NAME },
        },
      });

      expect(scrubbed.contexts).toEqual({ os: { name: "Android" } });
    });

    it("should drop the name the owner gave the phone", () => {
      const scrubbed = scrub({ contexts: { device: { model: "Pixel 8", name: "Zee's Pixel" } } });

      expect(scrubbed.contexts?.device).toEqual({ model: "Pixel 8" });
    });
  });
});

describe("scrubBreadcrumb", () => {
  it.each(["console", "ui.input", "ui.click", "ui.tap", "touch", "sentry.event"])(
    "should drop a %s breadcrumb",
    (category) => {
      expect(scrubBreadcrumb({ category, message: `Delete ${FOOD_NAME}` })).toBeNull();
    },
  );

  it("should drop a breadcrumb with no category", () => {
    expect(scrubBreadcrumb({ message: `Delete ${FOOD_NAME}` })).toBeNull();
  });

  it("should strip the query string and the fragment from the url of a request breadcrumb", () => {
    const scrubbed = scrubBreadcrumb({
      category: "xhr",
      type: "http",
      data: {
        url: `https://x.supabase.co/rest/v1/foods?name=ilike.*${FOOD_NAME}*#top`,
        method: "GET",
        status_code: 200,
      },
    });

    expect(scrubbed?.data).toEqual({
      url: "https://x.supabase.co/rest/v1/foods",
      method: "GET",
      status_code: 200,
    });
  });

  it("should keep only the data keys on the list, so the search text of http.query is dropped", () => {
    const scrubbed = scrubBreadcrumb({
      category: "fetch",
      data: {
        url: "https://x.supabase.co/rest/v1/foods",
        "http.method": "GET",
        "http.query": `name=ilike.*${FOOD_NAME}*`,
        "http.fragment": WEIGHT,
        request_body: WEIGHT,
        body: WEIGHT,
        input: WEIGHT,
        value: WEIGHT,
      },
    });

    expect(scrubbed?.data).toEqual({
      url: "https://x.supabase.co/rest/v1/foods",
      "http.method": "GET",
    });
  });

  it("should strip the params from the route a navigation breadcrumb moves between", () => {
    const scrubbed = scrubBreadcrumb({
      category: "navigation",
      data: { from: `/foods/search?q=${FOOD_NAME}`, to: "/diary#now" },
    });

    expect(scrubbed?.data).toEqual({ from: "/foods/search", to: "/diary" });
  });

  it("should drop the message of a breadcrumb it keeps", () => {
    const scrubbed = scrubBreadcrumb({ category: "navigation", message: FOOD_NAME, data: {} });

    expect(scrubbed).not.toHaveProperty("message");
  });
});
