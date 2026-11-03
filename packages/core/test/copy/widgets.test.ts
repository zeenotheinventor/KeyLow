import { describe, expect, it } from "vitest";

import {
  describeAverageCaption,
  describeAverageLine,
  describeBodyMapEyebrow,
  describeEatenOfTarget,
  describeEatenOfTargetWithUnit,
  describeEatenWithoutTarget,
  describeExerciseProgress,
  describeFoodEnergy,
  describeGlanceEyebrow,
  describeHeatChip,
  describeLastTime,
  describeLogAgainName,
  describeLogged,
  describeOfflineStatus,
  describePlanLine,
  describePlanSubtitle,
  describeRingCaption,
  describeRingName,
  describeSessionEyebrow,
  describeSessionLine,
  describeSetProgress,
  describeTodayEyebrow,
  describeWeekEyebrow,
  describeWeighInAge,
  NO_TARGET_BANNER,
  UNDO_LABEL,
  WIDGET_ACTIONS,
  WIDGET_EYEBROWS,
  WIDGET_STATES,
} from "../../src/copy";
import { DASHBOARD_LOAD_FAILED } from "../../src/copy/dashboard";

describe("the widget copy", () => {
  it("should word the states as board D draws them", () => {
    expect(WIDGET_STATES.signedOut).toEqual({
      eyebrow: "KI-LO",
      headline: "Sign in to see today",
      body: "Your nutrition and training appear here once you sign in.",
    });
    expect(WIDGET_STATES.noData.headline).toBe("Open Ki-Lo to load today");
    expect(WIDGET_STATES.noData.body).toBe(
      "The widget fills in after the app has opened once today.",
    );
    expect(WIDGET_STATES.restDay.body).toBe("Nothing planned today. Recovery counts too.");
    expect(WIDGET_STATES.noRecentFoods.headline).toBe("Nothing logged yet");
    expect(WIDGET_STATES.couldntLog.headline).toBe("Couldn't log that. Nothing was saved.");
    expect(WIDGET_STATES.couldntLog.body).toBe("Check your connection, or log it in Ki-Lo.");
    expect(WIDGET_STATES.couldntUndo).toEqual({
      headline: "Couldn't undo that.",
      body: "Check your connection and try again.",
    });
    expect(WIDGET_STATES.couldntUndo.body).toBe(DASHBOARD_LOAD_FAILED.body);
    expect(WIDGET_STATES.sessionMovedOn.headline).toBe("Your session moved on");
  });

  it("should reuse the diary's no-target banner and the Undo label", () => {
    expect(WIDGET_STATES.noTarget.headline).toBe(NO_TARGET_BANNER.title);
    expect(WIDGET_ACTIONS.setTarget).toBe(NO_TARGET_BANNER.action);
    expect(WIDGET_ACTIONS.undo).toBe(UNDO_LABEL);
  });

  it("should word the buttons as boards B and D draw them", () => {
    expect(WIDGET_ACTIONS.search).toEqual({ label: "Search", name: "Search for a food" });
    expect(WIDGET_ACTIONS.quickAdd.name).toBe("Quick add calories");
    expect(WIDGET_ACTIONS.logSet).toBe("Log set");
    expect(WIDGET_ACTIONS.logToday).toBe("Log today");
    expect(WIDGET_EYEBROWS.trainToday).toBe("TRAIN · TODAY");
  });

  it("should write the eyebrows with the date in capitals", () => {
    expect(describeTodayEyebrow("2026-11-03")).toBe("TODAY · TUE 3 NOV");
    expect(describeGlanceEyebrow("2026-11-03")).toBe("KI-LO · TUE 3 NOV");
    expect(describeWeekEyebrow("2026-11-02")).toBe("THIS WEEK · FROM MON 2 NOV");
    expect(describeBodyMapEyebrow("heat")).toBe("BODY MAP · HEAT");
    expect(describeBodyMapEyebrow("volume")).toBe("BODY MAP · VOLUME");
    expect(describeSessionEyebrow(32)).toBe("IN SESSION · 32 MIN");
  });

  it("should write the ring's words", () => {
    expect(describeRingCaption("left")).toBe("kcal left");
    expect(describeRingCaption("over")).toBe("kcal over");
    expect(describeRingCaption("eaten")).toBe("kcal eaten");
    expect(describeEatenOfTarget(1460, 2200)).toBe("1,460 of 2,200");
    expect(describeEatenOfTargetWithUnit(1460, 2200)).toBe("1,460 of 2,200 kcal");
    expect(describeRingName(1460, 2200)).toBe("1,460 of 2,200 kcal eaten");
    expect(describeEatenWithoutTarget(1460)).toBe("1,460 kcal eaten");
    expect(describeOfflineStatus("10:05")).toBe("Offline · updated 10:05");
  });

  it("should write the week card's average", () => {
    expect(describeAverageCaption(2200)).toBe("kcal average · target 2,200");
    expect(describeAverageCaption(null)).toBe("kcal average");
    expect(describeAverageLine(2050)).toBe("2,050 kcal average");
  });

  it("should write the Log again rows", () => {
    expect(describeFoodEnergy(410)).toBe("410 kcal");
    expect(describeLogAgainName("Overnight oats", 410)).toBe("Log Overnight oats again, 410 kcal");
    expect(describeLogged("Overnight oats")).toBe("Logged Overnight oats");
    expect(describeLogged(null)).toBe("Logged");
  });

  it("should write how long ago the last weigh-in was", () => {
    expect(describeWeighInAge(0)).toBe("Logged today");
    expect(describeWeighInAge(1)).toBe("Logged yesterday");
    expect(describeWeighInAge(3)).toBe("Logged 3 days ago");
  });

  it("should write the Training widget's lines", () => {
    expect(describePlanSubtitle(5, ["Rows", "Pull-ups", "Curls"])).toBe(
      "5 exercises · Rows, Pull-ups, Curls and 2 more",
    );
    expect(describePlanSubtitle(2, ["Rows", "Curls"])).toBe("2 exercises · Rows and Curls");
    expect(describePlanSubtitle(1, ["Rows"])).toBe("1 exercise · Rows");
    expect(describePlanLine("Pull day", 5)).toBe("Pull day · 5 exercises");
    expect(describeSessionLine("Pull day")).toBe("Pull day · In progress");
    expect(describeSessionLine(null)).toBe("Session · In progress");
    expect(describeHeatChip("chest_upper", 5)).toBe("Upper chest peak");
    expect(describeExerciseProgress(2, 5)).toBe("Exercise 2 of 5");
    expect(describeSetProgress(3, 4)).toBe("Set 3 of 4");
    expect(describeLastTime("67.5", 8)).toBe("Last time 67.5 × 8");
    expect(describeLastTime(null, 8)).toBe("Last time 8 reps");
  });
});
