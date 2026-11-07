import * as copy from "../../../src/copy";

// Every function `src/copy/assistantNotices.ts` exports, called with representative arguments. The voice test
// fails when a function has no row, so no sentence escapes the sweep.
export const samples: Record<string, () => string[]> = {
  describeAssistantNotice: () =>
    [
      copy.describeAssistantNotice(
        { code: "day_limit", resetsAt: "2026-10-26T00:00:00Z" },
        "Europe/London",
      ),
      copy.describeAssistantNotice({ code: "plus" }, "Europe/London"),
      copy.describeAssistantNotice({ code: "resting", resumesOn: "2026-11-01" }, "Europe/London"),
      copy.describeAssistantNotice({ code: "switched_off" }, "Europe/London"),
      copy.describeAssistantNotice({ code: "turn_failed" }, "Europe/London"),
    ].flatMap(({ title, body, fieldText, button }) =>
      [title, body, fieldText, button].filter((text) => text !== null),
    ),
  describeResetTime: () => [
    copy.describeResetTime("2026-10-26T00:00:00Z", "Europe/London"),
    copy.describeResetTime("2026-07-02T00:00:00Z", "Europe/London"),
    copy.describeResetTime("2026-07-02T00:00:00Z", "Asia/Kolkata"),
  ],
  describeAssistantStatus: () => [
    copy.describeAssistantStatus({ code: "reading_recipe", host: "example.com" }),
    copy.describeAssistantStatus({ code: "thinking" }),
    ...[
      "search_foods",
      "get_food",
      "get_day",
      "get_entries",
      "get_range_totals",
      "get_weigh_ins",
      "get_recipes",
      "log_entry",
      "update_entry",
      "set_day_complete",
      "create_custom_food",
      "create_recipe",
      "update_recipe",
      "delete_entry",
      "copy_day",
      "archive_recipe",
      "update_targets",
      "search_exercises",
      "get_workouts",
      "get_exercise_progress",
      "get_routines",
      "get_training_goals",
      "get_muscle_state",
      "suggest_next_session",
      "edit_routine",
      "set_active_routine",
      "archive_routine",
      "create_routine",
      "update_training_goals",
      "save_custom_exercise",
      "archive_custom_exercise",
      "update_past_set",
      "delete_workout",
    ].flatMap((tool) => [
      copy.describeAssistantStatus({ code: "tool", tool, food: null, isConfirmed: false }),
      copy.describeAssistantStatus({ code: "tool", tool, food: null, isConfirmed: true }),
    ]),
    copy.describeAssistantStatus({
      code: "tool",
      tool: "search_foods",
      food: "toast",
      isConfirmed: false,
    }),
  ],
  safeWordsToShow: () => [copy.safeWordsToShow("toast") ?? ""],
};
