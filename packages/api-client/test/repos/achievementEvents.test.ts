import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { recordAchievementEvent } from "../../src/repos/achievementEvents";
import { createTestClient } from "../createTestClient";
import { REST_URL, postgrestError } from "../support/postgrest";

type Recorded = { url: URL; prefer: string | null; body: unknown };

let recorded: Recorded[] = [];

const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
beforeEach(() => {
  recorded = [];
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

const answerWith = (respond: () => Response) => {
  server.use(
    http.post(`${REST_URL}/achievement_events`, async ({ request }) => {
      recorded.push({
        url: new URL(request.url),
        prefer: request.headers.get("prefer"),
        body: await request.clone().json(),
      });
      return respond();
    }),
  );
};

describe("recordAchievementEvent", () => {
  it("should insert one row with the kind and the ref, ignoring a row it already holds", async () => {
    answerWith(() => new HttpResponse(null, { status: 201 }));

    await recordAchievementEvent(createTestClient(), "barcode_scanned", "5000000000017");

    expect(recorded).toHaveLength(1);
    expect(recorded[0]?.url.searchParams.get("on_conflict")).toBe("user_id,kind,ref");
    expect(recorded[0]?.prefer).toContain("resolution=ignore-duplicates");
    expect(recorded[0]?.body).toEqual({ kind: "barcode_scanned", ref: "5000000000017" });
  });

  it("should send a null ref for an event that has none", async () => {
    answerWith(() => new HttpResponse(null, { status: 201 }));

    await recordAchievementEvent(createTestClient(), "week_view_opened");

    expect(recorded[0]?.body).toEqual({ kind: "week_view_opened", ref: null });
  });

  it("should resolve and throw nothing when the database refuses the row", async () => {
    answerWith(() => postgrestError(403, "42501", "secret stub row"));

    await expect(
      recordAchievementEvent(createTestClient(), "data_exported"),
    ).resolves.toBeUndefined();
  });

  it("should resolve and throw nothing when the request cannot be made", async () => {
    answerWith(() => HttpResponse.error());

    await expect(
      recordAchievementEvent(createTestClient(), "data_exported"),
    ).resolves.toBeUndefined();
  });
});
