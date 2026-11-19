import { streakCalendarRangeOf } from "@keylow/core";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "@keylow/api-client";
import type { CalendarDayState, DayState } from "@keylow/core";

/**
 * November 2026 as the board draws it, today being Thursday the 19th: the 1st to the 18th complete bar
 * the 7th, which is missed, and the 14th, which a freeze kept. Built over core's own range, so a day
 * outside the month is never in it.
 */
export function novemberCalendar(
  today = "2026-11-19",
  overrides: Readonly<Record<string, DayState>> = {},
): CalendarDayState[] {
  const { from, to } = streakCalendarRangeOf(today);
  const days: CalendarDayState[] = [];
  for (let localDate = from; localDate <= to; localDate = nextDay(localDate)) {
    days.push({ localDate, state: overrides[localDate] ?? defaultState(localDate, today) });
  }
  return days;
}

const defaultStates: Readonly<Record<string, DayState>> = {
  "2026-11-07": "missed",
  "2026-11-14": "frozen",
};

function defaultState(localDate: string, today: string): DayState {
  if (localDate === today) {
    return "at_risk";
  }
  if (localDate > today) {
    return "future";
  }
  return defaultStates[localDate] ?? "complete";
}

function nextDay(localDate: string): string {
  const next = new Date(`${localDate}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

export type StreakStatsOptions = {
  completeDays?: readonly string[];
  earnedFreezes?: number;
  weighInDates?: readonly string[];
  trainingWeeks?: readonly { weekStart: string; sessions: number }[];
  /** The sessions a training week asks for. */
  daysPerWeek?: number;
};

// Synthetic: what `achievement_stats` answers for a person with the given days complete, the freezes the
// ledger says they earned and the weeks the weekly streaks read. Nothing here is a real person's.
function statsPayload({
  completeDays = [],
  earnedFreezes = 0,
  weighInDates = [],
  trainingWeeks = [],
  daysPerWeek = 4,
}: StreakStatsOptions) {
  return {
    profile_created_at: "2026-01-10T09:00:00+00:00",
    onboarding_completed_at: null,
    targets_updated_at: null,
    time_zone: "UTC",
    manual_targets: { kcal: null, protein_g: null, carbs_g: null, fat_g: null },
    targets: [],
    days: completeDays.map((localDate) => ({
      local_date: localDate,
      entry_count: 1,
      kcal: 0,
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
      fibre_g: 0,
      is_complete: true,
      completed_at: `${localDate}T21:00:00+00:00`,
      earliest_entry_local_time: "12:00",
      logged_between_midnight_and_four: false,
    })),
    entry_totals: {
      entries: completeDays.length,
      distinct_foods: 1,
      new_foods_per_week: [],
      most_logs_of_favourite_food: 0,
      own_recipe_entries: 0,
      most_days_for_one_recipe: 0,
    },
    weigh_ins: { count: weighInDates.length, dates: weighInDates, before_nine_count: 0 },
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
      weeks: trainingWeeks.map(({ weekStart, sessions }) => ({
        week_start: weekStart,
        sessions,
        muscle_groups: [],
      })),
      session_best_sets: [],
    },
    training_goals: [
      {
        days_per_week: daysPerWeek,
        effective_from: "2026-01-01T00:00:00+00:00",
        effective_to: null,
      },
    ],
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
    achievements: [],
    streak_freeze_events:
      earnedFreezes === 0
        ? []
        : [
            {
              kind: "earned",
              reason: "test",
              ref: "test-grant",
              count: earnedFreezes,
              local_date: "2026-10-01",
            },
          ],
  };
}

/**
 * A Supabase client whose only answer is `achievement_stats`, with the stats above, or an error when
 * `options` is "fails". `requests` counts the reads made. With `isHeld` the answer waits until the test
 * calls `release`, so a test can look at the view while the read is still out.
 */
export function streakStatsClient(
  options: StreakStatsOptions | "fails",
  { isHeld = false }: { isHeld?: boolean } = {},
) {
  const requests = { count: 0 };
  let release = () => {};
  const gate = isHeld
    ? new Promise<void>((resolve) => {
        release = resolve;
      })
    : Promise.resolve();
  const client = createClient<Database>("http://localhost:54321", "anon-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: async (input) => {
        requests.count += 1;
        await gate;
        const url =
          typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        const isStats = url.includes("/rpc/achievement_stats");
        const isFailure = !isStats || options === "fails";

        return new Response(
          JSON.stringify(isFailure ? { message: "stub" } : statsPayload(options)),
          {
            status: isFailure ? 500 : 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      },
    },
  });

  return { client, requests, release };
}
