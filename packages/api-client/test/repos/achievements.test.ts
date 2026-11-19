import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  appendFreezeEvents,
  fetchAchievementStats,
  fetchAchievementsBackfilledAt,
  markAchievementsSeen,
  recordAchievements,
} from "../../src/repos/achievements";
import { createTestClient } from "../createTestClient";
import { REST_URL, postgrestError, postgrestRows } from "../support/postgrest";

type Recorded = { url: URL; method: string; body: unknown };

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

const record = async (request: Request): Promise<void> => {
  const text = await request.clone().text();
  recorded.push({
    url: new URL(request.url),
    method: request.method,
    body: text === "" ? null : JSON.parse(text),
  });
};

const answer = (method: "get" | "post" | "patch", path: string, respond: () => Response) => {
  server.use(
    http[method](`${REST_URL}/${path}`, async ({ request }) => {
      await record(request);
      return respond();
    }),
  );
};

const MINIMAL_PAYLOAD = {
  profile_created_at: "2026-01-10T09:00:00+00:00",
  onboarding_completed_at: null,
  targets_updated_at: null,
  time_zone: "UTC",
  manual_targets: { kcal: null, protein_g: null, carbs_g: null, fat_g: null },
  targets: [],
  days: [],
  entry_totals: {
    entries: 1,
    distinct_foods: 1,
    new_foods_per_week: [],
    most_logs_of_favourite_food: 0,
    own_recipe_entries: 0,
    most_days_for_one_recipe: 0,
  },
  weigh_ins: { count: 0, dates: [], before_nine_count: 0 },
  body_measurement_count: 0,
  workouts: {
    sessions: 0,
    before_seven_count: 0,
    from_twenty_one_count: 0,
    working_sets: 0,
    tonnage_kg: 0,
    most_sets_in_session: 0,
    legs_sessions: 0,
    distinct_exercises: 0,
    weeks: [],
    session_best_sets: [],
  },
  training_goals: [],
  active_routine_day_count: 0,
  routines: 0,
  recipes: 0,
  favourites: 0,
  meal_plans: 0,
  longest_meal_plan_days: 0,
  distinct_planned_days: 0,
  shopping_list_items: 0,
  assistant_user_messages: 0,
  assistant_conversations: 0,
  assistant_log_entry_actions: 0,
  assistant_create_recipe_actions: 0,
  feature_requests: 0,
  checkin_dates: [],
  programmes: [],
  achievements: [],
  streak_freeze_events: [],
};

describe("fetchAchievementStats", () => {
  it("should ask for the whole history and map the answer", async () => {
    answer("post", "rpc/achievement_stats", () => HttpResponse.json(MINIMAL_PAYLOAD));

    const snapshot = await fetchAchievementStats(createTestClient());

    expect(recorded[0]?.body).toEqual({ p_from: "2000-01-01" });
    expect(snapshot.stats.entries.total).toBe(1);
    expect(snapshot.held).toEqual([]);
  });

  it("should name the action and the database code only when the call fails", async () => {
    answer("post", "rpc/achievement_stats", () =>
      postgrestError(500, "XX000", "secret stub message"),
    );

    const failure = await fetchAchievementStats(createTestClient()).catch(
      (error: unknown) => error,
    );

    expect(failure).toHaveProperty("message", "Could not read the achievement stats (XX000)");
    expect(failure).toHaveProperty("cause", { code: "XX000" });
    expect(String(failure)).not.toContain("secret");
  });

  it("should refuse an answer that is not the shape with the code invalid", async () => {
    answer("post", "rpc/achievement_stats", () => HttpResponse.json({ time_zone: 42 }));

    const failure = await fetchAchievementStats(createTestClient()).catch(
      (error: unknown) => error,
    );

    expect(failure).toHaveProperty("cause", { code: "invalid" });
  });
});

describe("recordAchievements", () => {
  it("should send the ids and the backfill flag and resolve to the ids that were new", async () => {
    answer("post", "rpc/record_achievements", () => HttpResponse.json(["jotter"]));

    const inserted = await recordAchievements(createTestClient(), ["first-bite", "jotter"], true);

    expect(recorded[0]?.body).toEqual({ p_ids: ["first-bite", "jotter"], p_backfill: true });
    expect(inserted).toEqual(["jotter"]);
  });

  it("should send no request for no ids on an ordinary run", async () => {
    const inserted = await recordAchievements(createTestClient(), [], false);

    expect(inserted).toEqual([]);
    expect(recorded).toHaveLength(0);
  });

  it("should still send a backfill with no ids, because it marks the backfill done", async () => {
    answer("post", "rpc/record_achievements", () => HttpResponse.json([]));

    await recordAchievements(createTestClient(), [], true);

    expect(recorded[0]?.body).toEqual({ p_ids: [], p_backfill: true });
  });

  it("should name the action and the code only when the call fails", async () => {
    answer("post", "rpc/record_achievements", () =>
      postgrestError(400, "22023", "secret stub id list"),
    );

    const failure = await recordAchievements(createTestClient(), ["jotter"], false).catch(
      (error: unknown) => error,
    );

    expect(failure).toHaveProperty("message", "Could not record the achievements (22023)");
    expect(String(failure)).not.toContain("secret");
  });
});

describe("appendFreezeEvents", () => {
  const rows = [
    {
      kind: "earned" as const,
      reason: "level_reached",
      reference: "level-1",
      date: "2026-11-19",
      count: 1,
    },
  ];

  it("should insert the rows as the ledger names them, ignoring rows it already holds", async () => {
    answer("post", "streak_freeze_events", () => new HttpResponse(null, { status: 201 }));

    await appendFreezeEvents(createTestClient(), rows);

    expect(recorded[0]?.url.searchParams.get("on_conflict")).toBe("user_id,kind,reason,ref");
    expect(recorded[0]?.body).toEqual([
      {
        kind: "earned",
        reason: "level_reached",
        ref: "level-1",
        count: 1,
        local_date: "2026-11-19",
      },
    ]);
  });

  it("should send no request for no rows", async () => {
    await appendFreezeEvents(createTestClient(), []);

    expect(recorded).toHaveLength(0);
  });

  it("should name the action and the code only when the insert fails", async () => {
    answer("post", "streak_freeze_events", () => postgrestError(403, "42501", "secret stub row"));

    const failure = await appendFreezeEvents(createTestClient(), rows).catch(
      (error: unknown) => error,
    );

    expect(failure).toHaveProperty("message", "Could not save the streak freezes (42501)");
    expect(String(failure)).not.toContain("secret");
  });
});

describe("markAchievementsSeen", () => {
  it("should stamp the time on the unseen rows of the ids given", async () => {
    answer("patch", "user_achievements", () => new HttpResponse(null, { status: 204 }));

    await markAchievementsSeen(
      createTestClient(),
      ["first-bite", "jotter"],
      new Date("2026-11-19T12:00:00Z"),
    );

    expect(recorded[0]?.body).toEqual({ seen_at: "2026-11-19T12:00:00.000Z" });
    expect(recorded[0]?.url.searchParams.get("achievement_id")).toBe("in.(first-bite,jotter)");
    expect(recorded[0]?.url.searchParams.get("seen_at")).toBe("is.null");
  });

  it("should send no request for no ids", async () => {
    await markAchievementsSeen(createTestClient(), []);

    expect(recorded).toHaveLength(0);
  });

  it("should name the action and the code only when the update fails", async () => {
    answer("patch", "user_achievements", () => postgrestError(403, "42501", "secret stub"));

    const failure = await markAchievementsSeen(createTestClient(), ["jotter"]).catch(
      (error: unknown) => error,
    );

    expect(failure).toHaveProperty("message", "Could not mark the achievements seen (42501)");
    expect(String(failure)).not.toContain("secret");
  });
});

describe("fetchAchievementsBackfilledAt", () => {
  it("should read the date the backfill was recorded from the profile", async () => {
    server.use(
      http.get(`${REST_URL}/profiles`, ({ request }) => {
        recorded.push({ url: new URL(request.url), method: request.method, body: null });
        return postgrestRows(request, [
          { achievements_backfilled_at: "2026-11-01T09:00:00+00:00" },
        ]);
      }),
    );

    await expect(fetchAchievementsBackfilledAt(createTestClient())).resolves.toBe(
      "2026-11-01T09:00:00+00:00",
    );
    expect(recorded[0]?.url.searchParams.get("select")).toBe("achievements_backfilled_at");
  });

  it("should answer null while the backfill has not been recorded", async () => {
    server.use(
      http.get(`${REST_URL}/profiles`, ({ request }) =>
        postgrestRows(request, [{ achievements_backfilled_at: null }]),
      ),
    );

    await expect(fetchAchievementsBackfilledAt(createTestClient())).resolves.toBeNull();
  });

  it("should answer null when there is no profile row", async () => {
    server.use(http.get(`${REST_URL}/profiles`, ({ request }) => postgrestRows(request, [])));

    await expect(fetchAchievementsBackfilledAt(createTestClient())).resolves.toBeNull();
  });

  it("should name the action and the code only when the read fails", async () => {
    server.use(
      http.get(`${REST_URL}/profiles`, () => postgrestError(500, "XX000", "secret stub message")),
    );

    const failure = await fetchAchievementsBackfilledAt(createTestClient()).catch(
      (error: unknown) => error,
    );

    expect(failure).toHaveProperty(
      "message",
      "Could not read the achievements backfill state (XX000)",
    );
    expect(String(failure)).not.toContain("secret");
  });
});
