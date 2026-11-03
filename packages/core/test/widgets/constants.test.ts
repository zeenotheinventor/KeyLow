import { describe, expect, it } from "vitest";

import {
  EXERCISE_NAMES_LIMIT,
  RECENT_FOODS_LIMIT,
  TIMELINE_STEP_MINUTES,
  UNDO_WINDOW_MINUTES,
  WARMEST_MUSCLES_SHOWN,
  WIDGET_KINDS,
  WIDGET_SNAPSHOT_VERSION,
} from "../../src/widgets";

describe("the widget constants", () => {
  it("should pin the snapshot version at 1", () => {
    expect(WIDGET_SNAPSHOT_VERSION).toBe(1);
  });

  it("should pin the Undo window at 10 minutes", () => {
    expect(UNDO_WINDOW_MINUTES).toBe(10);
  });

  it("should pin the timeline step at 60 minutes", () => {
    expect(TIMELINE_STEP_MINUTES).toBe(60);
  });

  it("should pin the recent foods at 3", () => {
    expect(RECENT_FOODS_LIMIT).toBe(3);
  });

  it("should pin the exercise names named at 3", () => {
    expect(EXERCISE_NAMES_LIMIT).toBe(3);
  });

  it("should pin the warmest muscles shown at 3", () => {
    expect(WARMEST_MUSCLES_SHOWN).toBe(3);
  });

  it("should list the eleven widget kinds of boards A and B", () => {
    expect(WIDGET_KINDS).toEqual([
      "today_ring",
      "today_macros",
      "this_week",
      "body_heat",
      "today_glance",
      "body_map",
      "log_grid",
      "today_logging",
      "log_again",
      "weigh_in",
      "training",
    ]);
  });
});
