import { readFileSync } from "node:fs";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { collectStrings } from "./collectStrings";
import {
  HEALTH_ACCESS,
  HEALTH_ACCESS_BODY_POINTS,
  HEALTH_ACCESS_EXPLAIN_POINTS,
  HEALTH_CONNECT_NAME,
  WEIGHT_EMPTY,
  WEIGHT_ERROR,
  WEIGHT_IMPORT_STATUS,
  WEIGHT_RANGE_LABELS,
  WEIGHT_SCREEN,
  TREND_EXPLAINER,
  TREND_EXPLAINER_BODY_SECTION,
  WEIGH_IN_SHEET,
  describeChartDate,
  describeChartName,
  describeImportedCount,
  describeLastImport,
  describeRateBadge,
  describeSettlingBanner,
  describeSettlingLine,
  describeSheetDate,
  describeSheetTime,
  describeTrendLine,
  describeWeighInRow,
  describeWeightProblem,
  parseWeightInput,
} from "../../src";

// The boards are "Ki-Lo M5 screens", canvas versions 9 and 10. Every expected value below is copied from a
// board file, never computed from the module under test. Boards are named as the canvas names them.
const TODAY = "2026-10-17";
const LONDON = "Europe/London";

describe("the name of the health service", () => {
  it("should be Health Connect, the only one Ki-Lo reads from", () => {
    expect(HEALTH_CONNECT_NAME).toBe("Health Connect");
  });
});

describe("weight: chart and weigh-ins", () => {
  it("should pin the screen's own words as WeightScreen.dc.html draws them", () => {
    expect(WEIGHT_SCREEN).toEqual({
      title: "Weight",
      backLabel: "Back to More",
      addLabel: "Add weigh-in",
      explainerLabel: "How the trend works",
      loadingLabel: "Loading your weigh-ins",
      listHeading: "Weigh-ins",
      leftOutBadge: "Left out of trend",
      trendCardName: "Trend weight",
      settlingBadge: "Settling",
      unit: "kg",
      rangeGroupLabel: "Chart range",
      legend: { trend: "Trend", weighIn: "Weigh-in", leftOut: "Left out" },
      chartToday: "Today",
    });
  });

  describe("· error", () => {
    it("should pin the title, body and retry button", () => {
      expect(WEIGHT_ERROR).toEqual({
        title: "Couldn't load your weigh-ins",
        body: "Check your connection and try again. Nothing you logged has been lost.",
        retry: "Try again",
      });
    });
  });

  describe("· empty", () => {
    it("should pin the title, body and both actions", () => {
      expect(WEIGHT_EMPTY).toEqual({
        title: "No weigh-ins yet",
        body: "Add one now, or bring in readings from your smart scale through Health Connect. Your trend starts after the first weigh-in.",
        addWeighIn: "Add weigh-in",
        connectHealth: "Connect Health Connect",
      });
    });
  });

  describe("· loading", () => {
    it("should name the region of skeletons as the board does", () => {
      expect(WEIGHT_SCREEN.loadingLabel).toBe("Loading your weigh-ins");
    });
  });

  describe("· chart, importing, not-connected: the status beside Weigh-ins", () => {
    it("should pin the banner, the checking line and the link", () => {
      expect(WEIGHT_IMPORT_STATUS).toEqual({
        importing: "Importing from Health Connect",
        checking: "Checking for new readings",
        connect: "Connect Health Connect",
      });
    });

    it.each([
      [0, "Health Connect · updated just now"],
      [1, "Health Connect · updated 1 min ago"],
      [2, "Health Connect · updated 2 min ago"],
      [59, "Health Connect · updated 59 min ago"],
      [60, "Health Connect · updated 1 hr ago"],
      [119, "Health Connect · updated 1 hr ago"],
      [120, "Health Connect · updated 2 hr ago"],
      [1439, "Health Connect · updated 23 hr ago"],
      [1440, "Health Connect · updated 1 day ago"],
      [2879, "Health Connect · updated 1 day ago"],
      [3000, "Health Connect · updated 2 days ago"],
    ])("should write %i minutes ago as %j", (minutesAgo, expected) => {
      expect(describeLastImport(minutesAgo)).toBe(expected);
    });

    it("should say just now for a clock that ran backwards or a value that is not a number", () => {
      expect(describeLastImport(-5)).toBe("Health Connect · updated just now");
      expect(describeLastImport(Number.NaN)).toBe("Health Connect · updated just now");
    });
  });

  describe("the chart range control and the chart's name", () => {
    it("should pin the four range labels in the order the screen shows them", () => {
      expect(WEIGHT_RANGE_LABELS).toEqual({
        7: "1 week",
        30: "30 days",
        90: "90 days",
        365: "1 year",
      });
    });

    it.each([
      [7, "Weight over the last week, trend 83.1 kg"],
      [30, "Weight over the last 30 days, trend 83.1 kg"],
      [90, "Weight over the last 90 days, trend 83.1 kg"],
      [365, "Weight over the last year, trend 83.1 kg"],
    ] as const)("should name the %i day chart as %j", (range, expected) => {
      expect(describeChartName(range, 83.1)).toBe(expected);
    });

    it("should print the trend to one decimal", () => {
      expect(describeChartName(90, 83.14)).toBe("Weight over the last 90 days, trend 83.1 kg");
      expect(describeChartName(90, 83)).toBe("Weight over the last 90 days, trend 83.0 kg");
    });

    it.each([
      ["2026-10-10", "10 Oct"],
      ["2026-01-05", "5 Jan"],
      ["2026-12-31", "31 Dec"],
    ])("should write the x-axis tick for %s as %j", (localDate, expected) => {
      expect(describeChartDate(localDate)).toBe(expected);
    });
  });

  describe("· chart: the rate badge", () => {
    it.each([
      [-0.34, "−0.3 kg a week"],
      [0.4, "+0.4 kg a week"],
      [0.04, "0.0 kg a week"],
      [-0.04, "0.0 kg a week"],
      [0.049, "0.0 kg a week"],
      [-0.049, "0.0 kg a week"],
      [0.05, "+0.1 kg a week"],
      [-0.05, "−0.1 kg a week"],
      [0, "0.0 kg a week"],
      [-1.26, "−1.3 kg a week"],
    ])("should write a weekly rate of %f as %j", (weeklyRateKg, expected) => {
      expect(describeRateBadge(weeklyRateKg)).toBe(expected);
    });

    it("should use the real minus sign, U+2212", () => {
      expect(describeRateBadge(-0.34).codePointAt(0)).toBe(0x2212);
    });
  });

  describe("· settling: the line under the trend", () => {
    it.each([
      [0, "Settles after 7 weigh-ins. 0 of 7 so far."],
      [1, "Settles after 7 weigh-ins. 1 of 7 so far."],
      [2, "Settles after 7 weigh-ins. 2 of 7 so far."],
      [3, "Settles after 7 weigh-ins. 3 of 7 so far."],
      [4, "Settles after 7 weigh-ins. 4 of 7 so far."],
      [5, "Settles after 7 weigh-ins. 5 of 7 so far."],
      [6, "Settles after 7 weigh-ins. 6 of 7 so far."],
    ])("should write %i observations as %j", (observationCount, expected) => {
      expect(describeSettlingLine(observationCount)).toBe(expected);
    });
  });

  describe("· chart: the line under the trend", () => {
    const base = { lastKg: 81.6, lastLocalDate: TODAY, today: TODAY, weeklyRateKg: -0.34 };

    it.each([
      [
        "a loss today (the board)",
        base,
        "Last weigh-in 81.6 kg today. Average loss over the last 7 days.",
      ],
      [
        "a gain today",
        { ...base, weeklyRateKg: 0.4 },
        "Last weigh-in 81.6 kg today. Average gain over the last 7 days.",
      ],
      [
        "a loss yesterday",
        { ...base, lastLocalDate: "2026-10-16" },
        "Last weigh-in 81.6 kg yesterday. Average loss over the last 7 days.",
      ],
      [
        "a gain on an older day",
        { ...base, lastLocalDate: "2026-10-10", weeklyRateKg: 0.4 },
        "Last weigh-in 81.6 kg on Sat 10 Oct. Average gain over the last 7 days.",
      ],
      [
        "a flat rate of +0.04",
        { ...base, weeklyRateKg: 0.04 },
        "Last weigh-in 81.6 kg today. Steady over the last 7 days.",
      ],
      [
        "a flat rate of -0.04",
        { ...base, weeklyRateKg: -0.04 },
        "Last weigh-in 81.6 kg today. Steady over the last 7 days.",
      ],
      [
        "a gain at the steady boundary, +0.05",
        { ...base, weeklyRateKg: 0.05 },
        "Last weigh-in 81.6 kg today. Average gain over the last 7 days.",
      ],
      [
        "a loss at the steady boundary, -0.05",
        { ...base, weeklyRateKg: -0.05 },
        "Last weigh-in 81.6 kg today. Average loss over the last 7 days.",
      ],
      ["a null rate", { ...base, weeklyRateKg: null }, "Last weigh-in 81.6 kg today."],
      [
        "a weight with no decimal",
        { ...base, lastKg: 82 },
        "Last weigh-in 82.0 kg today. Average loss over the last 7 days.",
      ],
    ])("should write %s", (_name, input, expected) => {
      expect(describeTrendLine(input)).toBe(expected);
    });
  });

  describe("· chart: a row of the weigh-in list", () => {
    const healthConnectRow = {
      localDate: TODAY,
      today: TODAY,
      measuredAt: new Date("2026-10-17T06:42:00Z"),
      timeZone: LONDON,
      source: "health_connect",
      weightKg: 81.6,
      rejected: false,
    };

    it("should describe a Health Connect weigh-in from today", () => {
      expect(describeWeighInRow(healthConnectRow)).toEqual({
        day: "Today",
        meta: "07:42 · Health Connect",
        valueText: "81.6",
        unit: "kg",
        sourceLabel: "From Health Connect",
        leftOut: false,
      });
    });

    it("should describe a manual weigh-in from yesterday", () => {
      expect(
        describeWeighInRow({
          ...healthConnectRow,
          localDate: "2026-10-16",
          measuredAt: new Date("2026-10-16T07:05:00Z"),
          source: "manual",
          weightKg: 82,
        }),
      ).toEqual({
        day: "Yesterday",
        meta: "08:05 · Added by you",
        valueText: "82.0",
        unit: "kg",
        sourceLabel: "Added by you",
        leftOut: false,
      });
    });

    it("should describe a left-out weigh-in from an older day by its short date", () => {
      expect(
        describeWeighInRow({
          ...healthConnectRow,
          localDate: "2026-10-14",
          measuredAt: new Date("2026-10-14T07:10:00Z"),
          source: "manual",
          weightKg: 88.9,
          rejected: true,
        }),
      ).toEqual({
        day: "Wed 14 Oct",
        meta: "08:10 · Added by you",
        valueText: "88.9",
        unit: "kg",
        sourceLabel: "Added by you",
        leftOut: true,
      });
    });

    it("should print the time in the weigh-in's own zone", () => {
      expect(
        describeWeighInRow({
          ...healthConnectRow,
          measuredAt: new Date("2026-10-17T11:42:00Z"),
          timeZone: "America/New_York",
        }).meta,
      ).toBe("07:42 · Health Connect");
    });

    it("should read the day from the stored local date, not from the instant", () => {
      expect(
        describeWeighInRow({
          ...healthConnectRow,
          localDate: "2026-10-16",
          measuredAt: new Date("2026-10-17T00:30:00Z"),
          timeZone: "America/Los_Angeles",
        }).day,
      ).toBe("Yesterday");
    });

    it.each([
      [81.25, "81.3"],
      [81.35, "81.4"],
      [81.05, "81.1"],
      [82, "82.0"],
    ])("should round %f to %j with the same rounding as the trend line", (weightKg, expected) => {
      expect(describeWeighInRow({ ...healthConnectRow, weightKg }).valueText).toBe(expected);
    });

    it("should fall back to the manual words for a source it has no words for", () => {
      const row = describeWeighInRow({ ...healthConnectRow, source: "some_other_source" });

      expect(row.meta).toBe("07:42 · Added by you");
      expect(row.sourceLabel).toBe("Added by you");
    });
  });
});

describe("weigh-in-entry: add and edit", () => {
  it("should pin the sheet's own words as WeighInSheet.dc.html draws them", () => {
    expect(WEIGH_IN_SHEET).toEqual({
      titleAdd: "Add weigh-in",
      titleEdit: "Weigh-in",
      cancel: "Cancel",
      weightLabel: "Weight",
      dateLabel: "Date",
      timeLabel: "Time",
      noteLabel: "Note",
      optionalHint: "(optional)",
      unit: "kg",
      weightPlaceholder: "0.0",
      notePlaceholder: "After a run, new scale, anything",
      help: "Up to one decimal place.",
      save: "Save",
      saving: "Saving",
      delete: "Delete weigh-in",
      importedNotice: "Imported from Health Connect. Edit it in Health Connect.",
      importedHelp: "Imported readings can only be deleted here.",
      deleteWarning:
        "Deleting removes it from Ki-Lo only. It stays in Health Connect and won't come back on the next import.",
      saveError:
        "Couldn't save your weigh-in. Check your connection and try again. What you typed is still here.",
    });
  });

  describe("· new and filled: the add sheet", () => {
    it("should show the add title, the Up to one decimal help, today's date and time", () => {
      const instant = new Date("2026-10-17T07:15:00Z");

      expect(WEIGH_IN_SHEET.titleAdd).toBe("Add weigh-in");
      expect(WEIGH_IN_SHEET.help).toBe("Up to one decimal place.");
      expect(describeSheetDate(instant, TODAY, LONDON)).toBe("Today, Sat 17 Oct");
      expect(describeSheetTime(instant, LONDON)).toBe("08:15");
    });
  });

  describe("· invalid: the board types 814", () => {
    it("should give the board's help sentence for the reason core reports", () => {
      const result = parseWeightInput("814");

      expect(result).toEqual({ ok: false, reason: "too-high" });
      expect(describeWeightProblem("too-high")).toBe("Enter a weight between 20 and 400 kg.");
    });
  });

  describe("· saving", () => {
    it("should label the busy button Saving", () => {
      expect(WEIGH_IN_SHEET.saving).toBe("Saving");
    });
  });

  describe("· edit-manual: the Weigh-in title, Save and Delete weigh-in", () => {
    it("should use the edit title and keep Save and Delete weigh-in", () => {
      expect(WEIGH_IN_SHEET.titleEdit).toBe("Weigh-in");
      expect(WEIGH_IN_SHEET.save).toBe("Save");
      expect(WEIGH_IN_SHEET.delete).toBe("Delete weigh-in");
    });
  });

  describe("· edit-imported: the read-only Date and Time", () => {
    it("should show Today and 07:42 for a reading imported today", () => {
      const instant = new Date("2026-10-17T06:42:00Z");

      expect(describeSheetDate(instant, TODAY, LONDON, { imported: true })).toBe("Today");
      expect(describeSheetTime(instant, LONDON)).toBe("07:42");
    });
  });

  describe("describeWeightProblem", () => {
    it.each([
      ["too-low", "Enter a weight between 20 and 400 kg."],
      ["too-high", "Enter a weight between 20 and 400 kg."],
      ["not-a-number", "Enter a weight between 20 and 400 kg."],
      ["too-many-decimals", "Up to one decimal place."],
    ] as const)("should write %s as %j", (reason, expected) => {
      expect(describeWeightProblem(reason)).toBe(expected);
    });

    it("should give no sentence for an empty field, because Save is simply off", () => {
      expect(describeWeightProblem("empty")).toBeNull();
    });

    it.each([
      ["", null],
      ["abc", "Enter a weight between 20 and 400 kg."],
      ["19.9", "Enter a weight between 20 and 400 kg."],
      ["400.1", "Enter a weight between 20 and 400 kg."],
      ["81.45", "Up to one decimal place."],
    ])("should explain what core says about %j", (text, expected) => {
      const result = parseWeightInput(text);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(describeWeightProblem(result.reason)).toBe(expected);
      }
    });
  });

  describe("describeSheetDate", () => {
    const instant = new Date("2026-10-17T07:15:00Z");

    it.each([
      ["today", "Today, Sat 17 Oct", TODAY],
      ["yesterday", "Yesterday, Sat 17 Oct", "2026-10-18"],
      ["an older day", "Sat 17 Oct", "2026-10-24"],
    ])("should write %s in the add sheet as %j", (_name, expected, today) => {
      expect(describeSheetDate(instant, today, LONDON)).toBe(expected);
    });

    it.each([
      ["today", "Today", TODAY],
      ["yesterday", "Yesterday", "2026-10-18"],
      ["an older day", "Sat 17 Oct", "2026-10-24"],
    ])("should write %s in the imported sheet as %j", (_name, expected, today) => {
      expect(describeSheetDate(instant, today, LONDON, { imported: true })).toBe(expected);
    });

    it("should read the day in the given zone, so 23:30 UTC is already the next day in London summer time", () => {
      const lateInstant = new Date("2026-10-24T23:30:00Z");

      expect(describeSheetDate(lateInstant, "2026-10-25", LONDON)).toBe("Today, Sun 25 Oct");
    });
  });

  describe("describeSheetTime across a clock change", () => {
    it.each([
      ["the hour before the clocks go back (BST)", "2026-10-25T00:30:00Z", "01:30"],
      ["the same wall time again once they have gone back (GMT)", "2026-10-25T01:30:00Z", "01:30"],
      ["the evening after", "2026-10-25T23:30:00Z", "23:30"],
      ["just before the clocks go forward (GMT)", "2026-03-29T00:30:00Z", "00:30"],
      ["just after the clocks go forward (BST)", "2026-03-29T01:30:00Z", "02:30"],
    ])("should write %s as %s", (_name, isoInstant, expected) => {
      expect(describeSheetTime(new Date(isoInstant), LONDON)).toBe(expected);
    });
  });
});

describe("health-access: permissions flow", () => {
  it("should pin the close button and the privacy link of the screen", () => {
    expect(HEALTH_ACCESS.closeLabel).toBe("Close");
    expect(HEALTH_ACCESS.privacyPolicyLink).toBe("Read the privacy policy");
  });

  describe("· explain", () => {
    it("should pin the heading, body and buttons", () => {
      expect(HEALTH_ACCESS.explain).toEqual({
        heading: "Bring in weigh-ins from Health Connect",
        body: "If your smart scale saves to Health Connect, Ki-Lo can read those readings so you don't have to type them.",
        primary: "Continue",
        secondary: "Not now",
      });
    });
  });

  describe("· install", () => {
    it("should pin the heading, body, buttons and the three steps", () => {
      expect(HEALTH_ACCESS.install).toEqual({
        heading: "Get Health Connect first",
        body: "On Android 13 and earlier, Health Connect is a separate app from Google Play. Install it, then come back here.",
        primary: "Get Health Connect",
        secondary: "Not now",
        steps: [
          "Tap Get Health Connect and install it.",
          "Return to Ki-Lo.",
          "Tap Continue to choose what Ki-Lo can read.",
        ],
      });
    });
  });

  describe("· connecting", () => {
    it("should pin the heading, body and the busy button", () => {
      expect(HEALTH_ACCESS.connecting).toEqual({
        heading: "Importing from Health Connect",
        body: "Reading your weight history. This only happens while Ki-Lo is open.",
        bodyWithBodyComposition:
          "Reading your weight and body composition history. This only happens while Ki-Lo is open.",
        primary: "Importing",
      });
    });
  });

  describe("· denied", () => {
    it("should pin the heading, body, buttons and the three steps", () => {
      expect(HEALTH_ACCESS.denied).toEqual({
        heading: "Ki-Lo can't read your weight",
        body: "Permission to read weight was not given. You can change that at any time.",
        primary: "Open Health Connect",
        secondary: "Not now",
        steps: ["Open Health Connect.", "Tap App permissions, then Ki-Lo.", "Turn on Weight."],
      });
    });
  });

  describe("· import-error", () => {
    it("should pin the heading, body and both buttons", () => {
      expect(HEALTH_ACCESS.importError).toEqual({
        heading: "Couldn't import your weigh-ins",
        body: "Something went wrong reading from Health Connect. Your weigh-ins in Ki-Lo are safe. Pull down on the Weight screen to try again later.",
        primary: "Try again",
        secondary: "Close",
      });
    });
  });

  describe("· connected", () => {
    it("should pin the body and the button", () => {
      expect(HEALTH_ACCESS.connected).toEqual({
        body: "New readings come in each time you open Ki-Lo, or when you pull down on the Weight screen. Ki-Lo never writes to Health Connect.",
        primary: "See your trend",
      });
    });

    it.each([
      [0, "0 weigh-ins imported"],
      [1, "1 weigh-in imported"],
      [2, "2 weigh-ins imported"],
      [64, "64 weigh-ins imported"],
    ])("should write the heading for %i readings as %j", (importedCount, expected) => {
      expect(describeImportedCount(importedCount)).toBe(expected);
    });
  });
});

describe("health-access: permissions flow · body composition (v10)", () => {
  it("should pin the optional note under the points of explain", () => {
    expect(HEALTH_ACCESS.explainOptionalNote).toBe(
      "Body fat and lean mass are optional. You can leave them off in the Health Connect sheet.",
    );
  });

  it("should pin the four rewritten points of explain", () => {
    expect(HEALTH_ACCESS_EXPLAIN_POINTS).toEqual([
      {
        title: "What Ki-Lo reads",
        text: "Your weight, and body fat and lean mass if your scale records them, with the time of each. Nothing else.",
      },
      { title: "Why", text: "To draw your trends and, later, to set your calorie targets." },
      {
        title: "What it never does",
        text: "Write to Health Connect, share your readings, or use them for advertising.",
      },
      { title: "When", text: "Only while Ki-Lo is open, or when you pull down to refresh." },
    ]);
  });

  it("should pin explain · body-composition: heading, body, buttons and two points", () => {
    expect(HEALTH_ACCESS.explainBodyComposition).toEqual({
      heading: "Add body fat and lean mass",
      body: "If your smart scale records them, Ki-Lo can read them from Health Connect and show a trend for each, beside your weight.",
      primary: "Continue",
      secondary: "Not now",
    });
    expect(HEALTH_ACCESS_BODY_POINTS).toEqual([
      {
        title: "What Ki-Lo reads",
        text: "Body fat and lean mass, with the time of each, to show their trends. Nothing else.",
      },
      {
        title: "What it never does",
        text: "Write to Health Connect, share your readings, or use them for advertising.",
      },
    ]);
  });

  it("should pin denied · body-composition: heading, body, buttons and three steps", () => {
    expect(HEALTH_ACCESS.deniedBodyComposition).toEqual({
      heading: "Ki-Lo can't read body fat or lean mass",
      body: "Permission was not given. Your weight still comes in as before, and you can turn these on at any time.",
      primary: "Open Health Connect",
      secondary: "Not now",
      steps: [
        "Open Health Connect.",
        "Tap App permissions, then Ki-Lo.",
        "Turn on Body fat and Lean body mass.",
      ],
    });
  });

  it("should keep the weight only connecting body beside the one with body composition", () => {
    expect(HEALTH_ACCESS.connecting.body).toBe(
      "Reading your weight history. This only happens while Ki-Lo is open.",
    );
    expect(HEALTH_ACCESS.connecting.bodyWithBodyComposition).toBe(
      "Reading your weight and body composition history. This only happens while Ki-Lo is open.",
    );
  });

  it("should pin connected · partial for neither kind, lean mass and body fat missing", () => {
    expect(HEALTH_ACCESS.connectedPartial).toEqual({
      neither: {
        text: "Body fat and lean mass weren't allowed, so Ki-Lo only reads your weight.",
        action: "Add body fat and lean mass",
      },
      leanMassMissing: {
        text: "Lean mass wasn't allowed, so Ki-Lo doesn't read it.",
        action: "Add lean mass",
      },
      bodyFatMissing: {
        text: "Body fat wasn't allowed, so Ki-Lo doesn't read it.",
        action: "Add body fat",
      },
    });
  });

  it("should keep the connected words as they were", () => {
    expect(HEALTH_ACCESS.connected).toEqual({
      body: "New readings come in each time you open Ki-Lo, or when you pull down on the Weight screen. Ki-Lo never writes to Health Connect.",
      primary: "See your trend",
    });
  });
});

describe("trend-explainer · body fat and lean mass section (v10)", () => {
  it("should pin the new section", () => {
    expect(TREND_EXPLAINER_BODY_SECTION).toEqual({
      title: "Body fat and lean mass",
      text: "Smoothed like your weight. Scales estimate them and readings change with the water you hold, so the trend matters more than any one reading. Lean mass includes bone and water as well as muscle.",
    });
  });
});

describe("trend-explainer", () => {
  describe("· default", () => {
    it("should pin the title, Done, progress name, footer and the five sections", () => {
      expect(TREND_EXPLAINER).toEqual({
        title: "How your trend works",
        done: "Done",
        progressName: "Weigh-ins towards a settled trend",
        footer: "The trend is an estimate. It isn't medical advice.",
        sections: [
          {
            title: "Why a trend",
            text: "Your weight moves by a kilo or more from day to day with water, salt and food. The trend smooths that out so you can see where you are really heading.",
          },
          {
            title: "Settling",
            text: "The trend needs 7 weigh-ins before it is steady. Until then it is drawn dashed and can move a lot.",
          },
          {
            title: "Readings left out",
            text: "A reading far from the rest, like 95 kg after a week around 80 kg, is left out of the trend. If your next reading is close to it, it counts after all.",
          },
          {
            title: "Missing days",
            text: "Days without a weigh-in are filled in from the days around them. After a gap of more than 30 days the trend starts again.",
          },
          {
            title: "Weekly rate",
            text: "How much the trend has moved over the last 7 days, shown as a gain or loss a week.",
          },
        ],
      });
    });
  });

  describe("· settling", () => {
    it.each([
      [0, "Your trend is settling: 0 of 7 weigh-ins"],
      [3, "Your trend is settling: 3 of 7 weigh-ins"],
      [6, "Your trend is settling: 6 of 7 weigh-ins"],
    ])("should write the banner for %i observations as %j", (observationCount, expected) => {
      expect(describeSettlingBanner(observationCount)).toBe(expected);
    });
  });
});

describe("a changed constant", () => {
  afterEach(() => {
    vi.doUnmock("../../src/weight/bounds");
    vi.doUnmock("../../src/engine/params");
    vi.resetModules();
  });

  it("should change the settling words when TREND_SETTLED_OBS is 8", async () => {
    vi.resetModules();
    vi.doMock("../../src/weight/bounds", async (importOriginal) => ({
      ...(await importOriginal<typeof import("../../src/weight/bounds")>()),
      TREND_SETTLED_OBS: 8,
    }));
    const mocked = await import("../../src/copy/weight");

    expect(mocked.describeSettlingLine(3)).toBe("Settles after 8 weigh-ins. 3 of 8 so far.");
    expect(mocked.describeSettlingBanner(3)).toBe("Your trend is settling: 3 of 8 weigh-ins");
    expect(mocked.TREND_EXPLAINER.sections[1].text).toBe(
      "The trend needs 8 weigh-ins before it is steady. Until then it is drawn dashed and can move a lot.",
    );
    expect(mocked.TREND_EXPLAINER.sections[4].text).toContain("over the last 7 days");
  });

  it("should change the Missing days words when the longest gap is 14 days", async () => {
    vi.resetModules();
    vi.doMock("../../src/engine/params", async (importOriginal) => {
      const original = await importOriginal<typeof import("../../src/engine/params")>();

      return {
        ...original,
        DEFAULT_ENGINE_PARAMS: {
          ...original.DEFAULT_ENGINE_PARAMS,
          trend: { ...original.DEFAULT_ENGINE_PARAMS.trend, maxGapDays: 14 },
        },
      };
    });
    const mocked = await import("../../src/copy/weight");

    expect(mocked.TREND_EXPLAINER.sections[3].text).toBe(
      "Days without a weigh-in are filled in from the days around them. After a gap of more than 14 days the trend starts again.",
    );
  });
});

describe("every export", () => {
  // One call of each describer, with the board's own numbers where the board draws them.
  const describerOutputs = {
    describeChartName: describeChartName(90, 83.1),
    describeRateBadge: describeRateBadge(-0.34),
    describeSettlingLine: describeSettlingLine(3),
    describeChartDate: describeChartDate("2026-10-10"),
    describeTrendLine: describeTrendLine({
      lastKg: 81.6,
      lastLocalDate: TODAY,
      today: TODAY,
      weeklyRateKg: -0.34,
    }),
    describeWeighInRow: [
      describeWeighInRow({
        localDate: TODAY,
        today: TODAY,
        measuredAt: new Date("2026-10-17T06:42:00Z"),
        timeZone: LONDON,
        source: "health_connect",
        weightKg: 81.6,
        rejected: false,
      }),
      describeWeighInRow({
        localDate: "2026-10-16",
        today: TODAY,
        measuredAt: new Date("2026-10-16T07:05:00Z"),
        timeZone: LONDON,
        source: "manual",
        weightKg: 82,
        rejected: false,
      }),
    ],
    describeLastImport: describeLastImport(2),
    describeWeightProblem: describeWeightProblem("too-high"),
    describeSheetDate: describeSheetDate(new Date("2026-10-17T07:15:00Z"), TODAY, LONDON),
    describeSheetTime: describeSheetTime(new Date("2026-10-17T07:15:00Z"), LONDON),
    describeImportedCount: describeImportedCount(64),
    describeSettlingBanner: describeSettlingBanner(3),
  };

  const constants = {
    HEALTH_CONNECT_NAME,
    WEIGHT_SCREEN,
    WEIGHT_ERROR,
    WEIGHT_EMPTY,
    WEIGHT_IMPORT_STATUS,
    WEIGHT_RANGE_LABELS,
    WEIGH_IN_SHEET,
    HEALTH_ACCESS,
    HEALTH_ACCESS_EXPLAIN_POINTS,
    HEALTH_ACCESS_BODY_POINTS,
    TREND_EXPLAINER,
    TREND_EXPLAINER_BODY_SECTION,
  };

  const everyString = collectStrings([constants, describerOutputs]);

  it("should have a sample for every function and a constant for every other export", async () => {
    const exported = await import("../../src/copy/weight");
    const functionNames = Object.entries(exported)
      .filter(([, value]) => typeof value === "function")
      .map(([name]) => name);
    const constantNames = Object.entries(exported)
      .filter(([, value]) => typeof value !== "function")
      .map(([name]) => name);

    expect(functionNames.sort()).toEqual(Object.keys(describerOutputs).sort());
    expect(constantNames.sort()).toEqual(Object.keys(constants).sort());
  });

  it("should give a non-empty sentence everywhere", () => {
    expect(everyString.length).toBeGreaterThan(100);
    for (const sentence of everyString) {
      expect(sentence.trim()).not.toBe("");
    }
  });

  it("should use no em dash and no double hyphen", () => {
    for (const sentence of everyString) {
      expect(sentence).not.toContain("—");
      expect(sentence).not.toContain("--");
    }
  });

  it("should name no health service but Health Connect", () => {
    for (const sentence of everyString) {
      expect(sentence).not.toMatch(/apple|healthkit/i);
    }
  });

  it("should spell the British way", () => {
    for (const sentence of everyString) {
      expect(sentence).not.toMatch(/\b(color|center|gray)/i);
    }
  });

  describe("against the four boards", () => {
    // Every string the boards draw, listed once from the version 9 files. A state's name is beside it.
    const boardStrings = [
      // WeightScreen.dc.html: chart, settling, importing, not-connected, empty, loading, error
      "Weight",
      "Back to More",
      "How the trend works",
      "Add weigh-in",
      "Importing from Health Connect",
      "Loading your weigh-ins",
      "Couldn't load your weigh-ins",
      "Check your connection and try again. Nothing you logged has been lost.",
      "Try again",
      "No weigh-ins yet",
      "Add one now, or bring in readings from your smart scale through Health Connect. Your trend starts after the first weigh-in.",
      "Connect Health Connect",
      "Trend weight",
      "Settling",
      "−0.3 kg a week",
      "kg",
      "1 week",
      "30 days",
      "90 days",
      "1 year",
      "Chart range",
      "Weight over the last 90 days, trend 83.1 kg",
      "10 Oct",
      "Today",
      "Trend",
      "Weigh-in",
      "Left out",
      "Weigh-ins",
      "Left out of trend",
      "Health Connect · updated 2 min ago",
      "Checking for new readings",
      "Settles after 7 weigh-ins. 3 of 7 so far.",
      "Last weigh-in 81.6 kg today. Average loss over the last 7 days.",
      "From Health Connect",
      "Added by you",
      "Yesterday",
      "07:42 · Health Connect",
      "81.6",
      // WeighInSheet.dc.html: new, filled, invalid, saving, save-error, edit-manual, edit-imported
      "Weigh-in",
      "Cancel",
      "Imported from Health Connect. Edit it in Health Connect.",
      "Weight",
      "0.0",
      "Date",
      "Time",
      "Note",
      "(optional)",
      "After a run, new scale, anything",
      "Couldn't save your weigh-in. Check your connection and try again. What you typed is still here.",
      "Deleting removes it from Ki-Lo only. It stays in Health Connect and won't come back on the next import.",
      "Delete weigh-in",
      "Save",
      "Saving",
      "Enter a weight between 20 and 400 kg.",
      "Imported readings can only be deleted here.",
      "Up to one decimal place.",
      "Today, Sat 17 Oct",
      "08:15",
      // HealthAccessScreen.dc.html: explain, install, connecting, denied, import-error, connected
      "Close",
      "Bring in weigh-ins from Health Connect",
      "If your smart scale saves to Health Connect, Ki-Lo can read those readings so you don't have to type them.",
      "What Ki-Lo reads",
      "Your weight, and body fat and lean mass if your scale records them, with the time of each. Nothing else.",
      "Why",
      "To draw your trends and, later, to set your calorie targets.",
      "What it never does",
      "Write to Health Connect, share your readings, or use them for advertising.",
      "When",
      "Only while Ki-Lo is open, or when you pull down to refresh.",
      "Read the privacy policy",
      "Continue",
      "Not now",
      "Get Health Connect first",
      "On Android 13 and earlier, Health Connect is a separate app from Google Play. Install it, then come back here.",
      "Get Health Connect",
      "Tap Get Health Connect and install it.",
      "Return to Ki-Lo.",
      "Tap Continue to choose what Ki-Lo can read.",
      "Importing from Health Connect",
      "Reading your weight history. This only happens while Ki-Lo is open.",
      "Importing",
      "Ki-Lo can't read your weight",
      "Permission to read weight was not given. You can change that at any time.",
      "Open Health Connect",
      "Open Health Connect.",
      "Tap App permissions, then Ki-Lo.",
      "Turn on Weight.",
      "Couldn't import your weigh-ins",
      "Something went wrong reading from Health Connect. Your weigh-ins in Ki-Lo are safe. Pull down on the Weight screen to try again later.",
      "64 weigh-ins imported",
      "New readings come in each time you open Ki-Lo, or when you pull down on the Weight screen. Ki-Lo never writes to Health Connect.",
      "See your trend",
      // TrendExplainerSheet.dc.html: default, settling
      "How your trend works",
      "Done",
      "Your trend is settling: 3 of 7 weigh-ins",
      "Weigh-ins towards a settled trend",
      "Why a trend",
      "Your weight moves by a kilo or more from day to day with water, salt and food. The trend smooths that out so you can see where you are really heading.",
      "The trend needs 7 weigh-ins before it is steady. Until then it is drawn dashed and can move a lot.",
      "Readings left out",
      "A reading far from the rest, like 95 kg after a week around 80 kg, is left out of the trend. If your next reading is close to it, it counts after all.",
      "Missing days",
      "Days without a weigh-in are filled in from the days around them. After a gap of more than 30 days the trend starts again.",
      "Weekly rate",
      "How much the trend has moved over the last 7 days, shown as a gain or loss a week.",
      "The trend is an estimate. It isn't medical advice.",
    ];

    it.each(boardStrings)("should have %j in an export", (boardString) => {
      expect(everyString).toContain(boardString);
    });
  });
});

describe("describers that never throw", () => {
  const instant = new Date("2026-10-17T06:42:00Z");
  const invalidInstant = new Date(Number.NaN);
  const row = {
    localDate: TODAY,
    today: TODAY,
    measuredAt: instant,
    timeZone: LONDON,
    source: "manual",
    weightKg: 81.6,
    rejected: false,
  };
  const trendLine = { lastKg: 81.6, lastLocalDate: TODAY, today: TODAY, weeklyRateKg: -0.34 };

  describe("describeChartDate", () => {
    it.each(["x", "", "2026-13-45", "2026-02-30", "10 Oct"])(
      "should give nothing for %j",
      (text) => {
        expect(describeChartDate(text)).toBe("");
      },
    );
  });

  describe("describeTrendLine", () => {
    it("should leave the day out for a last day that is not a day", () => {
      expect(describeTrendLine({ ...trendLine, lastLocalDate: "x" })).toBe(
        "Last weigh-in 81.6 kg. Average loss over the last 7 days.",
      );
      expect(describeTrendLine({ ...trendLine, lastLocalDate: "2026-13-45" })).toBe(
        "Last weigh-in 81.6 kg. Average loss over the last 7 days.",
      );
    });

    it("should write the short date alone when today is not a day", () => {
      expect(describeTrendLine({ ...trendLine, lastLocalDate: "2026-10-10", today: "x" })).toBe(
        "Last weigh-in 81.6 kg on Sat 10 Oct. Average loss over the last 7 days.",
      );
    });

    it("should leave the weight out when it is not a number", () => {
      expect(describeTrendLine({ ...trendLine, lastKg: Number.NaN })).toBe(
        "Last weigh-in today. Average loss over the last 7 days.",
      );
    });

    it("should call a rate that is not a number steady", () => {
      expect(describeTrendLine({ ...trendLine, weeklyRateKg: Number.NaN })).toBe(
        "Last weigh-in 81.6 kg today. Steady over the last 7 days.",
      );
    });
  });

  describe("describeWeighInRow", () => {
    it("should write the short date when today is not a day", () => {
      expect(describeWeighInRow({ ...row, localDate: "2026-10-10", today: "x" }).day).toBe(
        "Sat 10 Oct",
      );
    });

    it("should write no day when the weigh-in's own day is not a day", () => {
      expect(describeWeighInRow({ ...row, localDate: "x" }).day).toBe("");
    });

    it("should leave the time out of meta for an invalid instant", () => {
      expect(describeWeighInRow({ ...row, measuredAt: invalidInstant }).meta).toBe("Added by you");
      expect(
        describeWeighInRow({ ...row, measuredAt: invalidInstant, source: "health_connect" }).meta,
      ).toBe("Health Connect");
    });

    it("should leave the time out of meta for a time zone that does not exist", () => {
      expect(describeWeighInRow({ ...row, timeZone: "Not/AZone" }).meta).toBe("Added by you");
    });

    it("should leave the value empty for a weight that is not a number", () => {
      expect(describeWeighInRow({ ...row, weightKg: Number.NaN }).valueText).toBe("");
    });
  });

  describe("describeSheetDate and describeSheetTime", () => {
    it("should give nothing for an invalid instant", () => {
      expect(describeSheetDate(invalidInstant, TODAY, LONDON)).toBe("");
      expect(describeSheetTime(invalidInstant, LONDON)).toBe("");
    });

    it("should give nothing for a time zone that does not exist", () => {
      expect(describeSheetDate(instant, TODAY, "Not/AZone")).toBe("");
      expect(describeSheetTime(instant, "Not/AZone")).toBe("");
    });

    it("should write the short date alone when today is not a day", () => {
      expect(describeSheetDate(instant, "x", LONDON)).toBe("Sat 17 Oct");
      expect(describeSheetDate(instant, "x", LONDON, { imported: true })).toBe("Sat 17 Oct");
    });
  });

  describe("numbers that are not finite", () => {
    it("should call a badge rate that is not finite steady", () => {
      expect(describeRateBadge(Number.NaN)).toBe("0.0 kg a week");
      expect(describeRateBadge(Number.POSITIVE_INFINITY)).toBe("0.0 kg a week");
      expect(describeRateBadge(Number.NEGATIVE_INFINITY)).toBe("0.0 kg a week");
    });

    it("should drop the trend from the chart name", () => {
      expect(describeChartName(7, Number.NaN)).toBe("Weight over the last week");
      expect(describeChartName(365, Number.POSITIVE_INFINITY)).toBe("Weight over the last year");
    });

    it("should count a non-finite imported count as none", () => {
      expect(describeImportedCount(Number.NaN)).toBe("0 weigh-ins imported");
      expect(describeImportedCount(Number.POSITIVE_INFINITY)).toBe("0 weigh-ins imported");
    });

    it("should count non-finite observations as none in the settling words", () => {
      expect(describeSettlingLine(Number.NaN)).toBe("Settles after 7 weigh-ins. 0 of 7 so far.");
      expect(describeSettlingBanner(Number.NaN)).toBe("Your trend is settling: 0 of 7 weigh-ins");
    });
  });
});

describe("the module's own rules", () => {
  const source = readFileSync(
    path.join(import.meta.dirname, "..", "..", "src", "copy", "weight.ts"),
    "utf8",
  );

  it("should not read the clock", () => {
    expect(source).not.toMatch(/Date\.now/);
    expect(source).not.toMatch(/new Date\(\s*\)/);
  });

  it("should import nothing from React", () => {
    expect(source).not.toMatch(/from "react/);
  });
});
