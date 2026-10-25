import { describe, expect, it, vi } from "vitest";

import { collectStrings } from "./collectStrings";
import {
  BODY_COMPOSITION,
  BODY_COMPOSITION_CHART,
  HEALTH_ACCESS,
  HEALTH_ACCESS_BODY_POINTS,
  HEALTH_ACCESS_EXPLAIN_POINTS,
  TREND_EXPLAINER,
  TREND_EXPLAINER_BODY_SECTION,
  WEIGHT_SCREEN,
  describeBodyChange,
  describeBodyChartName,
  describeBodyCounts,
  describeBodyRangeEmpty,
  describeBodySettlingLine,
  describeBodyValue,
  describeChartName,
  describeCompositionChartName,
  describeCompositionSource,
} from "../../src";

// The boards are "Ki-Lo M5 screens", canvas version 10. Every expected value below is copied from a
// board file, never computed from the module under test. Boards are named as the canvas names them.
// The minus in the change words is the true minus sign, U+2212.

describe("weight: chart and weigh-ins · body-composition", () => {
  it("should pin the section's words as WeightScreen.dc.html and BodyCompositionPrompt.dc.html draw them", () => {
    expect(BODY_COMPOSITION).toEqual({
      heading: "Body composition",
      kinds: {
        body_fat_pct: { label: "Body fat", unit: "%", changeUnit: "points" },
        lean_mass_kg: { label: "Lean mass", unit: "kg", changeUnit: "kg" },
      },
      caption: "Lean mass includes bone and water as well as muscle.",
      loadingLabel: "Loading body fat and lean mass",
      notAllowed: {
        title: "See body fat and lean mass here",
        text: "If your smart scale records them, Ki-Lo can read them from Health Connect and show a trend for each.",
        action: "Add body fat and lean mass",
      },
      noReadings: {
        title: "No body fat or lean mass readings yet",
        text: "Weigh in on a smart scale that saves body fat and lean mass to Health Connect. New readings show here the next time you open Ki-Lo.",
      },
      partial: {
        body_fat_pct: { text: "Ki-Lo can't read body fat yet.", action: "Add body fat" },
        lean_mass_kg: { text: "Ki-Lo can't read lean mass yet.", action: "Add lean mass" },
      },
      error: {
        title: "Couldn't load body fat and lean mass",
        body: "Check your connection and try again.",
        retry: "Try again",
      },
    });
  });

  it("should leave the settling badge to the weight screen's own", () => {
    expect(WEIGHT_SCREEN.settlingBadge).toBe("Settling");
    expect(Object.keys(BODY_COMPOSITION)).not.toContain("settlingBadge");
  });
});

describe("describeBodyValue", () => {
  it.each([
    ["body_fat_pct", 22.44, "22.4", "%"],
    ["lean_mass_kg", 63.14, "63.1", "kg"],
    ["body_fat_pct", 22.6, "22.6", "%"],
    ["body_fat_pct", 22, "22.0", "%"],
    ["lean_mass_kg", 0, "0.0", "kg"],
  ] as const)("should write %s %f as %j with the unit %j", (kind, value, valueText, unit) => {
    expect(describeBodyValue(kind, value)).toEqual({ valueText, unit });
  });

  it("should not throw for a value on a rounding edge, zero or a negative", () => {
    expect(() => describeBodyValue("body_fat_pct", 22.45)).not.toThrow();
    expect(() => describeBodyValue("body_fat_pct", -3)).not.toThrow();
    expect(describeBodyValue("body_fat_pct", -0.04).valueText).toBe("0.0");
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "should write %f as empty text and keep the unit, never NaN",
    (value) => {
      expect(describeBodyValue("body_fat_pct", value)).toEqual({ valueText: "", unit: "%" });
      expect(describeBodyValue("lean_mass_kg", value)).toEqual({ valueText: "", unit: "kg" });
    },
  );
});

describe("describeBodyChange", () => {
  it.each([
    ["body_fat_pct", -0.6, 90, "−0.6 points over 90 days"],
    ["lean_mass_kg", -0.2, 90, "−0.2 kg over 90 days"],
    ["body_fat_pct", 0.4, 30, "+0.4 points over 30 days"],
    ["lean_mass_kg", 0.4, 30, "+0.4 kg over 30 days"],
    ["body_fat_pct", 0.04, 7, "0.0 points over 1 week"],
    ["body_fat_pct", -0.04, 7, "0.0 points over 1 week"],
    ["lean_mass_kg", -0.049, 7, "0.0 kg over 1 week"],
    ["body_fat_pct", 0.05, 7, "+0.1 points over 1 week"],
    ["body_fat_pct", -0.05, 7, "−0.1 points over 1 week"],
    ["body_fat_pct", 0, 365, "0.0 points over 1 year"],
    ["body_fat_pct", -1.26, 365, "−1.3 points over 1 year"],
  ] as const)("should write %s %f over %i as %j", (kind, change, range, expected) => {
    expect(describeBodyChange(kind, change, range)).toBe(expected);
  });

  it("should use the real minus sign, U+2212", () => {
    expect(describeBodyChange("body_fat_pct", -0.6, 90).codePointAt(0)).toBe(0x2212);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "should read %f as steady and never print NaN",
    (change) => {
      expect(describeBodyChange("body_fat_pct", change, 90)).toBe("0.0 points over 90 days");
      expect(describeBodyChange("lean_mass_kg", change, 7)).toBe("0.0 kg over 1 week");
    },
  );
});

describe("describeBodyChartName", () => {
  it.each([
    [7, "Body fat over the last week, trend 22.4 %"],
    [30, "Body fat over the last 30 days, trend 22.4 %"],
    [90, "Body fat over the last 90 days, trend 22.4 %"],
    [365, "Body fat over the last year, trend 22.4 %"],
  ] as const)("should name the %i day body fat chart as %j", (range, expected) => {
    expect(describeBodyChartName("body_fat_pct", range, 22.4)).toBe(expected);
  });

  it.each([
    [7, "Lean mass over the last week, trend 63.1 kg"],
    [30, "Lean mass over the last 30 days, trend 63.1 kg"],
    [90, "Lean mass over the last 90 days, trend 63.1 kg"],
    [365, "Lean mass over the last year, trend 63.1 kg"],
  ] as const)("should name the %i day lean mass chart as %j", (range, expected) => {
    expect(describeBodyChartName("lean_mass_kg", range, 63.1)).toBe(expected);
  });

  it("should print the trend to one decimal", () => {
    expect(describeBodyChartName("body_fat_pct", 90, 22.44)).toBe(
      "Body fat over the last 90 days, trend 22.4 %",
    );
    expect(describeBodyChartName("lean_mass_kg", 90, 63)).toBe(
      "Lean mass over the last 90 days, trend 63.0 kg",
    );
  });

  it("should drop a trend that is not a number", () => {
    expect(describeBodyChartName("body_fat_pct", 90, Number.NaN)).toBe(
      "Body fat over the last 90 days",
    );
    expect(describeBodyChartName("lean_mass_kg", 7, Number.POSITIVE_INFINITY)).toBe(
      "Lean mass over the last week",
    );
  });

  it.each([7, 30, 90, 365] as const)(
    "should use the same span words as the weight chart for %i days",
    (range) => {
      expect(describeBodyChartName("body_fat_pct", range, Number.NaN)).toBe(
        describeChartName(range, Number.NaN).replace("Weight", "Body fat"),
      );
    },
  );
});

describe("describeBodySettlingLine", () => {
  it.each([
    [0, "Settles after 7 readings. 0 of 7 so far."],
    [3, "Settles after 7 readings. 3 of 7 so far."],
    [6, "Settles after 7 readings. 6 of 7 so far."],
  ])("should write %i readings as %j", (readingCount, expected) => {
    expect(describeBodySettlingLine(readingCount)).toBe(expected);
  });

  it("should count a value that is not a number as none", () => {
    expect(describeBodySettlingLine(Number.NaN)).toBe("Settles after 7 readings. 0 of 7 so far.");
    expect(describeBodySettlingLine(Number.POSITIVE_INFINITY)).toBe(
      "Settles after 7 readings. 0 of 7 so far.",
    );
  });

  it("should change the 7 when TREND_SETTLED_OBS is 8", async () => {
    vi.resetModules();
    vi.doMock("../../src/weight/bounds", async (importOriginal) => ({
      ...(await importOriginal<typeof import("../../src/weight/bounds")>()),
      TREND_SETTLED_OBS: 8,
    }));
    try {
      const mocked = await import("../../src/copy/bodyComposition");

      expect(mocked.describeBodySettlingLine(3)).toBe("Settles after 8 readings. 3 of 8 so far.");
    } finally {
      vi.doUnmock("../../src/weight/bounds");
      vi.resetModules();
    }
  });
});

describe("describeBodyRangeEmpty", () => {
  it.each([
    [7, "Not enough readings in the last week to show a change."],
    [30, "Not enough readings in the last 30 days to show a change."],
    [90, "Not enough readings in the last 90 days to show a change."],
    [365, "Not enough readings in the last year to show a change."],
  ] as const)("should write the %i day range as %j", (range, expected) => {
    expect(describeBodyRangeEmpty(range)).toBe(expected);
  });
});

describe("describeBodyCounts", () => {
  it.each([
    [12, 12, "Also 12 body fat and 12 lean mass readings."],
    [12, 0, "Also 12 body fat readings."],
    [0, 12, "Also 12 lean mass readings."],
    [1, 1, "Also 1 body fat and 1 lean mass reading."],
    [12, 1, "Also 12 body fat and 1 lean mass reading."],
    [1, 12, "Also 1 body fat and 12 lean mass readings."],
    [1, 0, "Also 1 body fat reading."],
    [0, 1, "Also 1 lean mass reading."],
  ])("should write %i body fat and %i lean mass as %j", (bodyFat, leanMass, expected) => {
    expect(describeBodyCounts({ bodyFat, leanMass })).toBe(expected);
  });

  it("should return null when there are no body readings at all", () => {
    expect(describeBodyCounts({ bodyFat: 0, leanMass: 0 })).toBeNull();
  });

  it("should count a value that is not a number as 0", () => {
    expect(describeBodyCounts({ bodyFat: Number.NaN, leanMass: Number.NaN })).toBeNull();
    expect(describeBodyCounts({ bodyFat: Number.NaN, leanMass: 12 })).toBe(
      "Also 12 lean mass readings.",
    );
    expect(describeBodyCounts({ bodyFat: 12, leanMass: Number.POSITIVE_INFINITY })).toBe(
      "Also 12 body fat readings.",
    );
  });
});

describe("every string of the body composition words", () => {
  const caption = BODY_COMPOSITION.caption;
  const explainerSectionText = TREND_EXPLAINER_BODY_SECTION.text;

  // One call of each describer, with the board's own numbers where the board draws them.
  const describerOutputs = [
    describeBodyValue("body_fat_pct", 22.4),
    describeBodyValue("lean_mass_kg", 63.1),
    describeBodyChange("body_fat_pct", -0.6, 90),
    describeBodyChange("lean_mass_kg", -0.2, 90),
    describeBodyChange("body_fat_pct", 0.4, 30),
    describeBodyChange("body_fat_pct", 0.04, 7),
    describeBodyChartName("body_fat_pct", 90, 22.4),
    describeBodyChartName("lean_mass_kg", 90, 63.1),
    describeBodyChartName("lean_mass_kg", 365, 63.1),
    describeBodySettlingLine(3),
    describeBodyRangeEmpty(7),
    describeBodyRangeEmpty(365),
    describeBodyCounts({ bodyFat: 12, leanMass: 12 }),
    describeBodyCounts({ bodyFat: 12, leanMass: 0 }),
    describeBodyCounts({ bodyFat: 0, leanMass: 1 }),
  ];

  const newWeightExports = [
    HEALTH_ACCESS.explainOptionalNote,
    HEALTH_ACCESS.explainBodyComposition,
    HEALTH_ACCESS.deniedBodyComposition,
    HEALTH_ACCESS.connecting.bodyWithBodyComposition,
    HEALTH_ACCESS.connectedPartial,
    HEALTH_ACCESS_EXPLAIN_POINTS,
    HEALTH_ACCESS_BODY_POINTS,
    TREND_EXPLAINER_BODY_SECTION,
  ];

  const everyString = collectStrings([BODY_COMPOSITION, describerOutputs, newWeightExports]);

  it("should give a non-empty sentence everywhere", () => {
    expect(everyString.length).toBeGreaterThan(50);
    for (const sentence of everyString) {
      expect(sentence.trim()).not.toBe("");
    }
  });

  it("should use no em dash", () => {
    for (const sentence of everyString) {
      expect(sentence).not.toContain("—");
    }
  });

  it("should use no double hyphen and no semicolon", () => {
    for (const sentence of everyString) {
      expect(sentence).not.toContain("--");
      expect(sentence).not.toContain(";");
    }
  });

  it("should name no health service but Health Connect", () => {
    for (const sentence of everyString) {
      expect(sentence).not.toMatch(/apple|healthkit/i);
    }
  });

  it("should say muscle only in the caption and the explainer section, as 'as well as muscle'", () => {
    for (const sentence of everyString) {
      if (!/muscle/i.test(sentence)) {
        continue;
      }
      expect([caption, explainerSectionText]).toContain(sentence);
      expect(sentence.match(/muscle/gi)).toHaveLength(1);
      expect(sentence).toContain("as well as muscle");
    }
  });

  it("should have no double space and no leading or trailing space", () => {
    for (const sentence of everyString) {
      expect(sentence).not.toContain("  ");
      expect(sentence).toBe(sentence.trim());
    }
  });

  it("should say nothing about typing a reading or deleting one", () => {
    for (const sentence of everyString) {
      expect(sentence).not.toMatch(/\b(type|typing|typed|delete|deleting|manual)\b/i);
    }
  });

  it("should spell the British way", () => {
    for (const sentence of everyString) {
      expect(sentence).not.toMatch(/\b(color|center|gray)/i);
    }
  });

  describe("against the approved version 10 boards", () => {
    // Every body composition string the boards draw, listed once from the version 10 files.
    const boardStrings = [
      // WeightScreen.dc.html: body-composition states
      "Body composition",
      "Body fat",
      "Lean mass",
      "%",
      "kg",
      "Lean mass includes bone and water as well as muscle.",
      "Loading body fat and lean mass",
      "See body fat and lean mass here",
      "If your smart scale records them, Ki-Lo can read them from Health Connect and show a trend for each.",
      "Add body fat and lean mass",
      "No body fat or lean mass readings yet",
      "Weigh in on a smart scale that saves body fat and lean mass to Health Connect. New readings show here the next time you open Ki-Lo.",
      "Ki-Lo can't read lean mass yet.",
      "Add lean mass",
      "Ki-Lo can't read body fat yet.",
      "Add body fat",
      "Couldn't load body fat and lean mass",
      "Check your connection and try again.",
      "Try again",
      "−0.6 points over 90 days",
      "−0.2 kg over 90 days",
      "Body fat over the last 90 days, trend 22.4 %",
      "Lean mass over the last 90 days, trend 63.1 kg",
      "Settles after 7 readings. 3 of 7 so far.",
      "Not enough readings in the last week to show a change.",
      "22.4",
      "63.1",
      // HealthAccessScreen.dc.html: body composition states
      "Also 12 body fat and 12 lean mass readings.",
      "Body fat and lean mass are optional. You can leave them off in the Health Connect sheet.",
      "Your weight, and body fat and lean mass if your scale records them, with the time of each. Nothing else.",
      "To draw your trends and, later, to set your calorie targets.",
      "Add body fat and lean mass",
      "If your smart scale records them, Ki-Lo can read them from Health Connect and show a trend for each, beside your weight.",
      "Body fat and lean mass, with the time of each, to show their trends. Nothing else.",
      "Ki-Lo can't read body fat or lean mass",
      "Permission was not given. Your weight still comes in as before, and you can turn these on at any time.",
      "Turn on Body fat and Lean body mass.",
      "Reading your weight and body composition history. This only happens while Ki-Lo is open.",
      "Body fat and lean mass weren't allowed, so Ki-Lo only reads your weight.",
      "Lean mass wasn't allowed, so Ki-Lo doesn't read it.",
      // TrendExplainerSheet.dc.html: the new section
      "Smoothed like your weight. Scales estimate them and readings change with the water you hold, so the trend matters more than any one reading. Lean mass includes bone and water as well as muscle.",
    ];

    it.each(boardStrings)("should have %j in an export", (boardString) => {
      expect(everyString).toContain(boardString);
    });
  });
});

describe("the body composition section of the trend explainer", () => {
  it("should be a separate export that is not yet one of the sheet's sections", () => {
    expect(TREND_EXPLAINER.sections).toHaveLength(5);
    expect(TREND_EXPLAINER.sections.map((section) => section.title)).not.toContain(
      TREND_EXPLAINER_BODY_SECTION.title,
    );
  });
});

// The composition chart's words come from KEY-656, not from a board. The ticket pins every example.
describe("weight: chart and weigh-ins · composition chart words", () => {
  const latestKg = { fat: 18.24, lean: 64.86 };
  const latestPct = { fat: 22.44, lean: 77.56 };

  it("should pin the switch labels", () => {
    expect(BODY_COMPOSITION_CHART).toEqual({
      viewGroupLabel: "Chart view",
      views: { weight: "Weight", composition: "Composition" },
      unitGroupLabel: "Show as",
      units: { kg: "kg", pct: "%" },
    });
  });

  it("should name the figure in kilograms with the latest values", () => {
    expect(describeCompositionChartName(90, "kg", latestKg)).toBe(
      "Body fat and lean mass over the last 90 days, body fat 18.2 kg, lean mass 64.9 kg",
    );
  });

  it("should name the figure in per cent with the latest values", () => {
    expect(describeCompositionChartName(90, "pct", latestPct)).toBe(
      "Body fat and lean mass over the last 90 days, body fat 22.4 %, lean mass 77.6 %",
    );
  });

  it("should name only the span with no latest values", () => {
    expect(describeCompositionChartName(90, "kg", null)).toBe(
      "Body fat and lean mass over the last 90 days",
    );
  });

  it.each([
    [7, "the last week"],
    [30, "the last 30 days"],
    [90, "the last 90 days"],
    [365, "the last year"],
  ] as const)("should use the span words of the body chart for %s days", (range, words) => {
    expect(describeCompositionChartName(range, "kg", null)).toBe(
      `Body fat and lean mass over ${words}`,
    );
  });

  it.each([
    ["fat", { fat: Number.NaN, lean: 64.9 }],
    ["lean", { fat: 18.2, lean: Number.POSITIVE_INFINITY }],
  ])("should drop the latest values when the %s value is not a number", (_label, latest) => {
    const name = describeCompositionChartName(30, "pct", latest);

    expect(name).toBe("Body fat and lean mass over the last 30 days");
    expect(name).not.toMatch(/NaN|Infinity/);
  });

  it("should say which reading the split was worked out from", () => {
    expect(describeCompositionSource("body_fat_pct")).toBe(
      "Worked out from your body fat and trend weight.",
    );
    expect(describeCompositionSource("lean_mass_kg")).toBe(
      "Worked out from your lean mass and trend weight.",
    );
  });

  it("should use no em dash, double hyphen, semicolon, muscle or Apple word", () => {
    const sentences = collectStrings([
      BODY_COMPOSITION_CHART,
      ([7, 30, 90, 365] as const).flatMap((range) => [
        describeCompositionChartName(range, "kg", latestKg),
        describeCompositionChartName(range, "pct", latestPct),
        describeCompositionChartName(range, "kg", null),
      ]),
      describeCompositionSource("body_fat_pct"),
      describeCompositionSource("lean_mass_kg"),
    ]);

    expect(sentences.length).toBeGreaterThan(15);
    for (const sentence of sentences) {
      expect(sentence).not.toMatch(/—|--|;|muscle|apple|healthkit/i);
    }
  });
});
