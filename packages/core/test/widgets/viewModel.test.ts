import { describe, expect, it } from "vitest";

import {
  EXERCISE_ID,
  NEW_ROW_ID,
  NOW,
  OATS_ENTRY_ID,
  SAMPLE_SESSION,
  SAMPLE_TARGETS,
  SESSION_ID,
  WRAP_ENTRY_ID,
  sampleSnapshot,
  sampleSnapshotInSession,
} from "./sampleSnapshot";
import { SIGNED_OUT_SOURCE, WIDGET_KINDS, WidgetError, widgetViewModel } from "../../src/widgets";

import type { PendingUndo, WidgetKind, WidgetSnapshot } from "../../src/widgets";

const ready = (snapshot: WidgetSnapshot = sampleSnapshot()) => ({
  status: "ready" as const,
  snapshot,
});

const view = (kind: WidgetKind, snapshot?: WidgetSnapshot, now = NOW) =>
  widgetViewModel(ready(snapshot), kind, now);

const withoutTarget = (): WidgetSnapshot => ({ ...sampleSnapshot(), targets: null });

const undoRecord = (overrides: Partial<PendingUndo> = {}): PendingUndo => ({
  action: "log_again",
  rowId: OATS_ENTRY_ID,
  at: "2026-11-03T11:55:00Z",
  ...overrides,
});

describe("every widget kind", () => {
  it.each(WIDGET_KINDS)("should say it is signed out for %s", (kind) => {
    expect(widgetViewModel(SIGNED_OUT_SOURCE, kind, NOW)).toMatchObject({
      kind,
      state: "signed_out",
      eyebrow: "KI-LO",
      headline: "Sign in to see today",
      body: "Your nutrition and training appear here once you sign in.",
      actions: [{ label: "Open Ki-Lo", emphasis: "primary", action: { type: "open", path: "/" } }],
    });
  });

  it.each(WIDGET_KINDS.filter((kind) => kind !== "log_grid"))(
    "should say there is no data yet for %s",
    (kind) => {
      expect(widgetViewModel({ status: "no_data" }, kind, NOW)).toMatchObject({
        kind,
        state: "no_data",
        eyebrow: "TODAY",
        headline: "Open Ki-Lo to load today",
        body: "The widget fills in after the app has opened once today.",
        actions: [{ label: "Open Ki-Lo", emphasis: "secondary" }],
      });
    },
  );

  it("should keep the log grid working with no data, because it needs none", () => {
    expect(widgetViewModel({ status: "no_data" }, "log_grid", NOW)).toMatchObject({
      state: "ready",
    });
  });

  it.each(WIDGET_KINDS.filter((kind) => kind !== "log_grid" && kind !== "log_again"))(
    "should say there is no data yet for %s two midnights after the snapshot",
    (kind) => {
      const later = new Date("2026-11-05T09:00:00Z");

      expect(widgetViewModel(ready(), kind, later)).toMatchObject({ state: "no_data" });
    },
  );

  it("should throw an error that carries an action and a code, and no value, for a bad time", () => {
    const attempt = () => view("today_ring", sampleSnapshot(), new Date("not a date"));

    expect(attempt).toThrow(WidgetError);
    expect(attempt).toThrow("Widget view_model failed: invalid_now");
  });
});

describe("Today ring", () => {
  it("should draw the board's small ring: 740 kcal left of 2,200", () => {
    expect(view("today_ring")).toMatchObject({
      state: "ready",
      eyebrow: "TODAY",
      status: null,
      tap: { type: "open", path: "/diary" },
      ring: {
        fraction: 1460 / 2200,
        hasTarget: true,
        value: "740",
        caption: "kcal left",
        eatenOfTarget: "1,460 of 2,200",
        eatenOfTargetWithUnit: "1,460 of 2,200 kcal",
        accessibleName: "1,460 of 2,200 kcal eaten",
        fillRole: "accent",
        trackRole: "track",
      },
    });
  });

  it("should count over the target and fill the ring", () => {
    const snapshot = sampleSnapshot();
    snapshot.week[1] = {
      localDate: "2026-11-03",
      isComplete: false,
      totals: { kcal: 2412, proteinG: 150, carbsG: 257, fatG: 81 },
    };

    expect(view("today_ring", snapshot)).toMatchObject({
      ring: { fraction: 1, value: "212", caption: "kcal over" },
    });
  });

  it("should dim the ring and say when it was saved while offline", () => {
    const model = widgetViewModel(ready(), "today_ring", NOW, { isOffline: true });

    expect(model).toMatchObject({
      status: { text: "Offline · updated 10:05", role: "warning" },
      ring: { fillRole: "textSubtle", eatenOfTargetWithUnit: "1,460 of 2,200 kcal" },
    });
  });

  it("should show what was eaten and open Targets when no target is set", () => {
    expect(view("today_ring", withoutTarget())).toMatchObject({
      state: "no_target",
      eyebrow: "TODAY",
      trailing: "1,460 kcal eaten",
      headline: "No target set",
      body: "Set a calorie and macro target to see what is left.",
      actions: [{ label: "Set target", action: { type: "open", path: "/targets" } }],
    });
  });
});

describe("Today with macros", () => {
  it("should draw the board's three macro rows", () => {
    const model = view("today_macros");

    expect(model).toMatchObject({
      state: "ready",
      eyebrow: "TODAY · TUE 3 NOV",
      ring: { value: "740" },
    });
    expect(model.state === "ready" && model.kind === "today_macros" && model.macros).toEqual([
      {
        label: "Protein",
        value: "112 / 160 g",
        fraction: 0.7,
        fillRole: "accent",
        trackRole: "track",
      },
      {
        label: "Carbs",
        value: "150 / 240 g",
        fraction: 0.625,
        fillRole: "accent",
        trackRole: "track",
      },
      {
        label: "Fat",
        value: "48 / 70 g",
        fraction: 48 / 70,
        fillRole: "accent",
        trackRole: "track",
      },
    ]);
  });

  it("should use the no-target state", () => {
    expect(view("today_macros", withoutTarget())).toMatchObject({ state: "no_target" });
  });

  it("should write a macro with no target as grams alone", () => {
    const snapshot = sampleSnapshot();
    snapshot.targets = { caloriesKcal: 2200, proteinG: null, carbsG: null, fatG: null };

    const model = view("today_macros", snapshot);

    expect(
      model.kind === "today_macros" && model.state === "ready" && model.macros[0],
    ).toMatchObject({
      value: "112 g",
      fraction: 0,
    });
  });
});

describe("This week", () => {
  it("should draw the week card from the week summary", () => {
    const model = view("this_week");

    expect(model).toMatchObject({
      state: "ready",
      eyebrow: "THIS WEEK · FROM MON 2 NOV",
      progress: "1 of 2 days complete",
      average: { value: "2,050", caption: "kcal average · target 2,200" },
      note: null,
      tap: { type: "open", path: "/week" },
    });
    expect(model.kind === "this_week" && model.state === "ready" && model.barFraction).toBeCloseTo(
      0.932,
      3,
    );
  });

  it("should draw the seven dots: complete, today outlined, the rest to come", () => {
    const model = view("this_week");

    expect(model.kind === "this_week" && model.state === "ready" && model.dots).toEqual([
      { letter: "M", fill: "filled", role: "accent", isToday: false },
      { letter: "T", fill: "outline", role: "accent", isToday: true },
      { letter: "W", fill: "filled", role: "track", isToday: false },
      { letter: "T", fill: "filled", role: "track", isToday: false },
      { letter: "F", fill: "filled", role: "track", isToday: false },
      { letter: "S", fill: "filled", role: "track", isToday: false },
      { letter: "S", fill: "filled", role: "track", isToday: false },
    ]);
  });

  it("should fill today's dot once the day is marked complete", () => {
    const snapshot = sampleSnapshot();
    snapshot.week[1] = {
      localDate: "2026-11-03",
      isComplete: true,
      totals: { kcal: 1460, proteinG: 112, carbsG: 150, fatG: 48 },
    };

    const model = view("this_week", snapshot);

    expect(model.kind === "this_week" && model.state === "ready" && model.dots[1]).toEqual({
      letter: "T",
      fill: "filled",
      role: "accent",
      isToday: true,
    });
  });

  it("should leave the target out of the caption when none is set", () => {
    expect(view("this_week", withoutTarget())).toMatchObject({
      average: { caption: "kcal average" },
    });
  });

  it("should say the averages start tomorrow on a Monday", () => {
    const sunday = { ...sampleSnapshot(), today: "2026-11-08" };
    const monday = new Date("2026-11-09T00:30:00Z");

    expect(view("this_week", sunday, monday)).toMatchObject({
      eyebrow: "THIS WEEK · FROM MON 9 NOV",
      average: null,
      note: "Your averages start tomorrow.",
      progress: "0 of 1 day complete",
    });
  });
});

describe("Body heat", () => {
  it("should list the warmest muscles with their heat step and tone", () => {
    const model = view("body_heat");

    expect(model).toMatchObject({
      state: "ready",
      eyebrow: "HEAT NOW",
      todayLine: "Today: Pull day",
      emptyLine: null,
      tap: { type: "open", path: "/body-map" },
    });
    expect(model.kind === "body_heat" && model.state === "ready" && model.rows).toEqual([
      { muscle: "chest_upper", name: "Upper chest", stepName: "Hot", dotRole: "heat-3" },
      { muscle: "delt_front", name: "Front delts", stepName: "Warm", dotRole: "heat-2" },
      { muscle: "triceps", name: "Triceps", stepName: "Warm", dotRole: "heat-2" },
    ]);
  });

  it("should say nothing is logged when nothing is warm", () => {
    const snapshot = sampleSnapshot();
    snapshot.bodyMap.heatSets = [];

    expect(view("body_heat", snapshot)).toMatchObject({
      rows: [],
      emptyLine: "Nothing logged in the last 14 days",
    });
  });

  it("should cool as time passes, by the heat model", () => {
    const later = new Date("2026-11-03T23:00:00Z");

    const model = view("body_heat", sampleSnapshot(), later);

    expect(model.kind === "body_heat" && model.state === "ready" && model.rows[0]).toMatchObject({
      muscle: "chest_upper",
      stepName: "Warm",
    });
  });

  it("should say rest day on a rest day", () => {
    const snapshot = sampleSnapshot();
    snapshot.training.plan = null;

    expect(view("body_heat", snapshot)).toMatchObject({ todayLine: "Today: Rest day" });
  });

  it("should drop the day's plan after midnight, because the app has not loaded it", () => {
    const afterMidnight = new Date("2026-11-04T00:30:00Z");

    expect(view("body_heat", sampleSnapshot(), afterMidnight)).toMatchObject({ todayLine: null });
  });
});

describe("Today at a glance", () => {
  it("should draw the ring, the macros, the week and today's training", () => {
    const model = view("today_glance");

    expect(model).toMatchObject({
      state: "ready",
      eyebrow: "KI-LO · TUE 3 NOV",
      ring: { value: "740" },
      week: { eyebrow: "THIS WEEK", line: "2,050 kcal average" },
      training: {
        eyebrow: "TRAINING TODAY",
        line: "Pull day · 5 exercises",
        heatChip: { text: "Upper chest hot", dotRole: "heat-3" },
      },
      tap: { type: "open", path: "/dashboard" },
    });
    expect(model.kind === "today_glance" && model.state === "ready" && model.macros).toHaveLength(
      3,
    );
  });

  it("should say rest day, or in progress while a session runs", () => {
    const rest = sampleSnapshot();
    rest.training.plan = null;

    expect(view("today_glance", rest)).toMatchObject({ training: { line: "Rest day" } });
    expect(view("today_glance", sampleSnapshotInSession())).toMatchObject({
      training: { line: "Pull day · In progress" },
    });
  });

  it("should show what was eaten when no target is set", () => {
    expect(view("today_glance", withoutTarget())).toMatchObject({
      ring: { hasTarget: false, value: "1,460", caption: "kcal eaten", eatenOfTarget: null },
    });
  });

  it("should leave training out after midnight", () => {
    expect(view("today_glance", sampleSnapshot(), new Date("2026-11-04T00:30:00Z"))).toMatchObject({
      training: null,
    });
  });
});

describe("Body map", () => {
  it("should draw the heat figure, its rows and the Rested to Peak legend", () => {
    const model = view("body_map");

    expect(model).toMatchObject({
      state: "ready",
      eyebrow: "BODY MAP · HEAT",
      summaryLine: null,
      figure: { figure: "male", scale: "heat" },
      legend: {
        startLabel: "Rested",
        endLabel: "Peak",
        swatches: ["heat-0", "heat-1", "heat-2", "heat-3", "heat-4", "heat-5"],
      },
    });
    expect(
      model.kind === "body_map" && model.state === "ready" && model.figure.tones,
    ).toMatchObject({
      chest_upper: "heat-3",
      delt_front: "heat-2",
      lats: "heat-0",
    });
    expect(model.kind === "body_map" && model.state === "ready" && model.rows).toHaveLength(3);
  });

  it("should draw weekly volume when More is set to it", () => {
    const snapshot = sampleSnapshot();
    snapshot.bodyMap.scale = "volume";

    const model = view("body_map", snapshot);

    expect(model).toMatchObject({
      eyebrow: "BODY MAP · VOLUME",
      rows: [],
      summaryLine: "4 of 22 muscles at Growing or above",
      legend: { startLabel: "None", endLabel: "High" },
      figure: { scale: "volume" },
    });
    expect(
      model.kind === "body_map" && model.state === "ready" && model.figure.tones.chest_upper,
    ).toBe("volume-productive");
  });

  it("should start the volume again in a new week", () => {
    const snapshot = sampleSnapshot();
    snapshot.bodyMap.scale = "volume";
    snapshot.week = sampleSnapshot().week;
    const sunday = { ...snapshot, today: "2026-11-08" };
    const monday = new Date("2026-11-09T00:30:00Z");

    expect(view("body_map", sunday, monday)).toMatchObject({
      summaryLine: "No sets yet this week",
    });
  });
});

describe("Log grid", () => {
  it("should offer the four shortcuts of board B", () => {
    const model = view("log_grid");

    expect(model.kind === "log_grid" && model.state === "ready" && model.buttons).toEqual([
      {
        label: "Search",
        accessibleName: "Search for a food",
        icon: "search",
        emphasis: "secondary",
        action: { type: "open", path: "/foods" },
      },
      {
        label: "Scan",
        accessibleName: "Scan a barcode",
        icon: "scan",
        emphasis: "secondary",
        action: { type: "open", path: "/foods/scan" },
      },
      {
        label: "Quick add",
        accessibleName: "Quick add calories",
        icon: "add",
        emphasis: "secondary",
        action: { type: "open", path: "/foods/quick-add" },
      },
      {
        label: "Weight",
        accessibleName: "Log weight",
        icon: "weight",
        emphasis: "secondary",
        action: { type: "open", path: "/more/weight/entry" },
      },
    ]);
  });
});

describe("Today plus logging", () => {
  it("should draw the compact ring and the four logging buttons", () => {
    const model = view("today_logging");

    expect(model).toMatchObject({ state: "ready", ring: { value: "740", caption: "kcal left" } });
    expect(
      model.kind === "today_logging" &&
        model.state === "ready" &&
        model.buttons.map((b) => [b.label, b.emphasis]),
    ).toEqual([
      ["Log food", "primary"],
      ["Scan", "secondary"],
      ["Quick add", "secondary"],
      ["Recipe", "secondary"],
    ]);
  });
});

describe("Log again", () => {
  it("should list the recent foods, each repeating its entry", () => {
    const model = view("log_again");

    expect(model).toMatchObject({ state: "ready", eyebrow: "LOG AGAIN" });
    expect(model.kind === "log_again" && model.state === "ready" && model.rows[0]).toEqual({
      type: "food",
      name: "Overnight oats",
      energy: "410 kcal",
      accessibleName: "Log Overnight oats again, 410 kcal",
      action: { type: "log_again", entryId: OATS_ENTRY_ID },
    });
    expect(model.kind === "log_again" && model.state === "ready" && model.rows).toHaveLength(3);
  });

  it("should say nothing is logged yet, and offer Log food, with no recent foods", () => {
    const snapshot = sampleSnapshot();
    snapshot.recentFoods = [];

    expect(view("log_again", snapshot)).toMatchObject({
      state: "no_recent_foods",
      eyebrow: "LOG AGAIN",
      headline: "Nothing logged yet",
      body: "Foods you log appear here, ready to log again.",
      actions: [
        { label: "Log food", emphasis: "primary", action: { type: "open", path: "/foods" } },
      ],
    });
  });

  it("should show Logged with Undo in place of the row that was logged", () => {
    const model = widgetViewModel(ready(), "log_again", NOW, { pendingUndo: undoRecord() });

    expect(model.kind === "log_again" && model.state === "ready" && model.rows).toMatchObject([
      {
        type: "logged",
        text: "Logged Overnight oats",
        undoLabel: "Undo",
        action: { type: "undo", action: "log_again", rowId: OATS_ENTRY_ID },
      },
      { type: "food", name: "Chicken wrap" },
      { type: "food", name: "Protein shake" },
    ]);
  });

  it("should say only Logged when the new row is not in the snapshot yet", () => {
    const record = undoRecord({ rowId: NEW_ROW_ID });

    const model = widgetViewModel(ready(), "log_again", NOW, { pendingUndo: record });

    expect(model.kind === "log_again" && model.state === "ready" && model.rows[0]).toMatchObject({
      type: "logged",
      text: "Logged",
    });
  });

  it("should stop offering Undo 10 minutes after the record's time", () => {
    const record = undoRecord({ at: "2026-11-03T11:50:00Z" });
    const justInside = new Date("2026-11-03T11:59:59Z");

    const inside = widgetViewModel(ready(), "log_again", justInside, { pendingUndo: record });
    const outside = widgetViewModel(ready(), "log_again", NOW, { pendingUndo: record });

    expect(inside.kind === "log_again" && inside.state === "ready" && inside.rows[0]?.type).toBe(
      "logged",
    );
    expect(outside.kind === "log_again" && outside.state === "ready" && outside.rows[0]?.type).toBe(
      "food",
    );
  });

  it("should ignore an undo record of the other action", () => {
    const model = widgetViewModel(ready(), "log_again", NOW, {
      pendingUndo: undoRecord({ action: "log_set" }),
    });

    expect(model.kind === "log_again" && model.state === "ready" && model.rows[0]?.type).toBe(
      "food",
    );
  });

  it("should say it could not log, and that nothing was saved", () => {
    expect(widgetViewModel(ready(), "log_again", NOW, { failure: "couldnt_log" })).toMatchObject({
      state: "couldnt_log",
      eyebrow: "LOG AGAIN",
      headline: "Couldn't log that. Nothing was saved.",
      headlineRole: "danger",
      body: "Check your connection, or log it in Ki-Lo.",
      actions: [{ label: "Open Ki-Lo", emphasis: "secondary" }],
    });
  });

  it("should say it could not undo, and keep the Open Ki-Lo way out", () => {
    expect(widgetViewModel(ready(), "log_again", NOW, { failure: "couldnt_undo" })).toMatchObject({
      state: "couldnt_undo",
      eyebrow: "LOG AGAIN",
      headline: "Couldn't undo that.",
      headlineRole: "danger",
      body: "Check your connection and try again.",
      actions: [{ label: "Open Ki-Lo", emphasis: "secondary" }],
    });
  });

  it("should say it could not undo a set, with the session's eyebrow", () => {
    expect(
      widgetViewModel(ready(sampleSnapshotInSession()), "training", NOW, {
        failure: "couldnt_undo",
      }),
    ).toMatchObject({ state: "couldnt_undo", eyebrow: "IN SESSION" });
  });

  it("should keep the second recent food's entry for its own tap", () => {
    const model = view("log_again");

    expect(model.kind === "log_again" && model.state === "ready" && model.rows[1]).toMatchObject({
      action: { type: "log_again", entryId: WRAP_ENTRY_ID },
    });
  });
});

describe("Weigh in", () => {
  it("should draw the last weigh-in and ask for today's", () => {
    expect(view("weigh_in")).toMatchObject({
      state: "ready",
      eyebrow: "WEIGHT",
      value: "78.4",
      unit: "kg",
      caption: "Logged yesterday",
      button: {
        label: "Log today",
        emphasis: "primary",
        action: { type: "open", path: "/more/weight/entry" },
      },
    });
  });

  it("should show pounds for a person who weighs in pounds", () => {
    const snapshot = { ...sampleSnapshot(), weightUnit: "lb" as const };

    expect(view("weigh_in", snapshot)).toMatchObject({ value: "172.8", unit: "lb" });
  });

  it("should round a boundary weight as the weight screens do", () => {
    const snapshot = sampleSnapshot();
    snapshot.lastWeighIn = { weightKg: 0.35, localDate: "2026-11-02" };

    expect(view("weigh_in", snapshot)).toMatchObject({ value: "0.4", unit: "kg" });
  });

  it("should count the days since the last weigh-in", () => {
    const snapshot = sampleSnapshot();
    snapshot.lastWeighIn = { weightKg: 78.4, localDate: "2026-10-31" };

    expect(view("weigh_in", snapshot)).toMatchObject({ caption: "Logged 3 days ago" });
  });

  it("should say there are no weigh-ins yet", () => {
    const snapshot = sampleSnapshot();
    snapshot.lastWeighIn = null;

    expect(view("weigh_in", snapshot)).toMatchObject({
      value: "No weigh-ins yet",
      unit: null,
      caption: null,
    });
  });
});

describe("Training", () => {
  it("should offer to start today's planned day", () => {
    const model = view("training");

    expect(model).toMatchObject({
      state: "ready",
      phase: "start",
      eyebrow: "TRAIN · TODAY",
      title: "Pull day",
      subtitle: "5 exercises · Rows, Pull-ups, Curls and 2 more",
    });
    expect(
      model.kind === "training" &&
        model.state === "ready" &&
        model.phase === "start" &&
        model.buttons,
    ).toMatchObject([
      {
        label: "Start session",
        emphasis: "primary",
        icon: "play",
        action: { type: "open", path: "/session?start=planned&nonce=nonce-0123456789ab" },
      },
      {
        label: "Empty session",
        emphasis: "secondary",
        action: { type: "open", path: "/session?start=empty&nonce=nonce-0123456789ab" },
      },
    ]);
  });

  it("should switch to Log a set while a session runs", () => {
    const now = new Date("2026-11-03T12:00:00Z");

    expect(view("training", sampleSnapshotInSession(), now)).toMatchObject({
      state: "ready",
      phase: "session",
      eyebrow: "IN SESSION · 32 MIN",
      progress: "Exercise 2 of 5",
      title: "Barbell row",
      setLabel: "Set 3 of 4",
      load: { value: "70", unit: "kg" },
      reps: { value: "8", unit: "reps" },
      lastTime: "Last time 67.5 × 8",
      undo: null,
      button: {
        label: "Log set",
        emphasis: "primary",
        action: { type: "log_set", sessionId: SESSION_ID, exerciseId: EXERCISE_ID, setNumber: 3 },
      },
    });
  });

  it("should show the load in pounds for a person who trains in pounds", () => {
    const snapshot = { ...sampleSnapshotInSession(), weightUnit: "lb" as const };

    expect(view("training", snapshot)).toMatchObject({
      load: { value: "154.3", unit: "lb" },
      lastTime: "Last time 148.8 × 8",
    });
  });

  it("should show Logged with Undo in place of Log set", () => {
    const model = widgetViewModel(ready(sampleSnapshotInSession()), "training", NOW, {
      pendingUndo: undoRecord({ action: "log_set", rowId: NEW_ROW_ID }),
    });

    expect(model).toMatchObject({
      undo: {
        text: "Logged",
        undoLabel: "Undo",
        action: { type: "undo", action: "log_set", rowId: NEW_ROW_ID },
      },
    });
  });

  it("should open the session when it has no set to prefill", () => {
    const snapshot = sampleSnapshotInSession();
    snapshot.training.session = { ...SAMPLE_SESSION, next: null };

    expect(view("training", snapshot)).toMatchObject({
      title: "Pull day",
      setLabel: null,
      button: { label: "Open session", action: { type: "open", path: "/session" } },
    });
  });

  it("should word the rest day and offer an empty session or Train", () => {
    const snapshot = sampleSnapshot();
    snapshot.training.plan = null;

    expect(view("training", snapshot)).toMatchObject({
      state: "rest_day",
      eyebrow: "TRAIN · TODAY",
      headline: "Rest day",
      body: "Nothing planned today. Recovery counts too.",
      actions: [
        {
          label: "Empty session",
          action: { type: "open", path: "/session?start=empty&nonce=nonce-0123456789ab" },
        },
        { label: "Open Train", action: { type: "open", path: "/train" } },
      ],
    });
  });

  it("should refuse to log a set that no longer matches the app", () => {
    expect(
      widgetViewModel(ready(sampleSnapshotInSession()), "training", NOW, {
        failure: "session_moved_on",
      }),
    ).toMatchObject({
      state: "session_moved_on",
      eyebrow: "IN SESSION",
      headline: "Your session moved on",
      body: "The set on the widget no longer matches the app, so nothing was logged.",
      actions: [{ label: "Open session", emphasis: "primary" }],
    });
  });

  it("should say it could not log a set, with the session's eyebrow", () => {
    expect(
      widgetViewModel(ready(sampleSnapshotInSession()), "training", NOW, {
        failure: "couldnt_log",
      }),
    ).toMatchObject({ state: "couldnt_log", eyebrow: "IN SESSION" });
  });

  it("should not know the plan after midnight", () => {
    expect(view("training", sampleSnapshot(), new Date("2026-11-04T00:30:00Z"))).toMatchObject({
      state: "no_data",
    });
  });
});

describe("a session in the snapshot", () => {
  it("should say there is no data yet two midnights on, even with a session running", () => {
    const stale = new Date("2026-11-05T09:00:00Z");

    expect(view("training", sampleSnapshotInSession(), stale)).toMatchObject({ state: "no_data" });
  });

  it("should keep showing the session past one midnight", () => {
    const afterMidnight = new Date("2026-11-04T00:30:00Z");

    expect(view("training", sampleSnapshotInSession(), afterMidnight)).toMatchObject({
      state: "ready",
      phase: "session",
    });
  });
});

describe("the tapped Log again row", () => {
  it("should turn the tapped row into Logged, not the first", () => {
    const record = undoRecord({ rowId: NEW_ROW_ID, sourceEntryId: WRAP_ENTRY_ID });

    const model = widgetViewModel(ready(), "log_again", NOW, { pendingUndo: record });

    expect(model.kind === "log_again" && model.state === "ready" && model.rows).toMatchObject([
      { type: "food", name: "Overnight oats" },
      { type: "logged", text: "Logged Chicken wrap", action: { type: "undo", rowId: NEW_ROW_ID } },
      { type: "food", name: "Protein shake" },
    ]);
  });

  it("should treat an undo record from the future as expired", () => {
    const record = undoRecord({ at: "2026-11-03T12:05:00Z" });

    const model = widgetViewModel(ready(), "log_again", NOW, { pendingUndo: record });

    expect(model.kind === "log_again" && model.state === "ready" && model.rows[0]?.type).toBe(
      "food",
    );
  });
});

describe("the midnight rollover", () => {
  const afterMidnight = new Date("2026-11-04T00:30:00Z");

  it("should start the new day with nothing eaten and that weekday's target", () => {
    const snapshot = sampleSnapshot();
    snapshot.targets = {
      ...SAMPLE_TARGETS,
      weekdayCaloriesKcal: [2000, 2000, 2100, 2200, 2300, 2400, 2500],
    };

    expect(view("today_ring", snapshot, afterMidnight)).toMatchObject({
      ring: { fraction: 0, value: "2,100", eatenOfTarget: "0 of 2,100" },
    });
  });

  it("should use the weekday's target on the Friday after the Thursday too", () => {
    const snapshot = sampleSnapshot();
    snapshot.targets = {
      ...SAMPLE_TARGETS,
      weekdayCaloriesKcal: [2000, 2000, 2100, 2200, 2300, 2400, 2500],
    };
    const thursday = { ...snapshot, today: "2026-11-05" };
    const friday = new Date("2026-11-06T00:30:00Z");

    expect(view("today_ring", thursday, friday)).toMatchObject({ ring: { value: "2,300" } });
  });

  it("should move the week on, with yesterday counted as a day so far", () => {
    expect(view("this_week", sampleSnapshot(), afterMidnight)).toMatchObject({
      progress: "1 of 3 days complete",
      average: { value: "1,755" },
    });
  });

  it("should roll over at the local midnight of the person's zone, not UTC's", () => {
    const auckland = { ...sampleSnapshot(), timeZone: "Pacific/Auckland" };
    const instant = new Date("2026-11-03T11:30:00Z");

    expect(view("today_ring", auckland, instant)).toMatchObject({ ring: { fraction: 0 } });
    expect(view("today_ring", sampleSnapshot(), instant)).toMatchObject({
      ring: { fraction: 1460 / 2200 },
    });
  });
});
