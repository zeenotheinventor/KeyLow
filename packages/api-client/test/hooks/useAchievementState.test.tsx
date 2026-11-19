import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useAchievementState } from "../../src/hooks/useAchievementState";
import { REST_URL } from "../support/postgrest";
import { createWrapper } from "../support/wrapper";

const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

// Synthetic: a person with 12 entries who already holds Jotter and First Bite.
const PAYLOAD = {
  profile_created_at: "2026-01-10T09:00:00+00:00",
  onboarding_completed_at: null,
  targets_updated_at: null,
  time_zone: "UTC",
  manual_targets: { kcal: null, protein_g: null, carbs_g: null, fat_g: null },
  targets: [],
  days: [],
  entry_totals: {
    entries: 12,
    distinct_foods: 3,
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
  event_counts: {
    distinct_barcodes_scanned: 0,
    exercise_demos_watched: 0,
    week_view_opens: 0,
    data_exports: 0,
    logs_from_favourites: 0,
    shopping_items_ticked_off: 0,
    assistant_drafts_saved: 0,
  },
  checkin_dates: [],
  programmes: [],
  achievements: [
    {
      achievement_id: "first-bite",
      unlocked_at: "2026-11-01T10:00:00+00:00",
      seen_at: null,
      backfilled: false,
    },
    {
      achievement_id: "jotter",
      unlocked_at: "2026-11-02T10:00:00+00:00",
      seen_at: "2026-11-02T10:05:00+00:00",
      backfilled: false,
    },
  ],
  streak_freeze_events: [],
};

const DEVICE = { reminderEnabled: false };
const NOW = new Date("2026-11-19T12:00:00Z");

describe("useAchievementState", () => {
  it("should read the stats, run the engine over them and return the held rows beside the run", async () => {
    server.use(http.post(`${REST_URL}/rpc/achievement_stats`, () => HttpResponse.json(PAYLOAD)));
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useAchievementState({ device: DEVICE, now: NOW }), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data?.held.map((row) => row.id)).toEqual(["first-bite", "jotter"]);
    expect(result.current.data?.run.newUnlocks).toEqual([]);
    expect(result.current.data?.run.points).toBe(20);
    expect(result.current.data?.run.notification).toBeNull();
  });

  it("should describe the calendar range the caller asks for, from today", async () => {
    server.use(http.post(`${REST_URL}/rpc/achievement_stats`, () => HttpResponse.json(PAYLOAD)));
    const { wrapper } = createWrapper();

    const { result } = renderHook(
      () =>
        useAchievementState({
          device: DEVICE,
          now: NOW,
          calendarRangeOf: (today) => ({ from: today, to: today }),
        }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data?.run.calendar.map((day) => day.localDate)).toEqual(["2026-11-19"]);
  });

  it("should return today and the weeks the weekly streaks read, with this week always in the training weeks", async () => {
    server.use(
      http.post(`${REST_URL}/rpc/achievement_stats`, () =>
        HttpResponse.json({
          ...PAYLOAD,
          weigh_ins: { count: 1, dates: ["2026-11-17"], before_nine_count: 0 },
        }),
      ),
    );
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useAchievementState({ device: DEVICE, now: NOW }), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data?.today).toBe("2026-11-19");
    expect(result.current.data?.weeks.weighIn).toEqual([
      { weekStart: "2026-11-16", achieved: 1, required: 1 },
    ]);
    expect(result.current.data?.weeks.training).toEqual([
      { weekStart: "2026-11-16", achieved: 0, required: 3 },
    ]);
  });

  it("should not read anything while disabled", () => {
    const { wrapper } = createWrapper();

    const { result } = renderHook(
      () => useAchievementState({ device: DEVICE, now: NOW, enabled: false }),
      { wrapper },
    );

    expect(result.current.fetchStatus).toBe("idle");
  });
});
