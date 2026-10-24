import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";
import { z } from "zod";

import { collectStrings } from "./collectStrings";
import { samples } from "./samples/program";
import {
  MORE_SCREEN,
  NOT_MEDICAL_ADVICE,
  PROGRAM_CHART,
  PROGRAM_CHECKIN_SUMMARY,
  PROGRAM_EDIT,
  PROGRAM_ERROR,
  PROGRAM_EXPLAINER,
  PROGRAM_GUARDRAIL_LINES,
  PROGRAM_NO_PROGRAM,
  PROGRAM_REASON_LINES,
  PROGRAM_SCREEN,
  PROGRAM_SETTLING,
  PROGRAM_SETUP_CARRIED_FORWARD,
  PROGRAM_SETUP_MEASURED,
  PROGRAM_TARGETS_SCREEN,
  PROGRAM_TOAST,
  RETRY_LABEL,
  SETUP_FLOOR_ABOVE_EXPENDITURE_ADVICE,
  SETUP_GOAL_NOT_OFFERED_UNDER_18,
  SETUP_GOAL_NOTES,
  SETUP_GUARDRAIL_LINES,
  SETUP_TARGETS_ROW,
  describeCarriedForwardLine,
  describeCheckinDataLine,
  describeCheckinSummaryName,
  describeCountedName,
  describeCountOfTarget,
  describeEditFootnote,
  describeExpenditureChartSummary,
  describeExpenditureHeroName,
  describeExpenditureSource,
  describeExplainerSections,
  describeFirstCheckInBanner,
  describeKcalChange,
  describeLikelyRange,
  describeMeasuredAccuracyLine,
  describeNextCheckInCaption,
  describeNextCheckInSubtitle,
  describeNotMeasuredReasons,
  describeOwnTargetsStay,
  describeProteinSubtitle,
  describeRateSubtitle,
  describeRateLine,
  describeSettlingTip,
  describeSettlingTipFor,
  describeSettlingTipOnOrAfter,
  describeTargetsCardName,
  describeTargetsCardSince,
  describeTargetsScreenSince,
  guardrailLineOrder,
} from "../../src/copy";
import * as programCopy from "../../src/copy/program";
import { CLAMPS, DEFAULT_ENGINE_PARAMS } from "../../src/engine";
import { expenditureBand } from "../../src/program";
import { PROFILE_MAX_KCAL } from "../../src/setup";
import { PROFILE_MIN_KCAL } from "../../src/setup/profileRange";

import type { ProgramGuardrailEntry } from "../../src/copy";

/*
 * The words of the program screens (KEY-634, canvas "Ki-Lo program" version 2, the repo copy is
 * docs/canvas/program). Every expected string is a literal here, and each board's words are also looked up in
 * the canvas files, so a literal that drifts from the approved design fails. User-facing copy says
 * "Programme" and identifiers say `program`.
 */

const canvasDirectory = path.join(
  import.meta.dirname,
  "..",
  "..",
  "..",
  "..",
  "docs",
  "canvas",
  "program",
);

const readCanvasFile = (file: string): string =>
  readFileSync(path.join(canvasDirectory, file), "utf8");

const canvasNotesSchema = z.object({
  notes: z.record(z.string(), z.object({ text: z.string().optional() })),
});

// The notes of a canvas are the strings inside canvas.json, and the boards write an apostrophe as \' in a script string.
const programCanvasText = [
  ...readdirSync(canvasDirectory)
    .filter((file) => file.endsWith(".dc.html"))
    .map(readCanvasFile),
  ...Object.values(canvasNotesSchema.parse(JSON.parse(readCanvasFile("canvas.json"))).notes).map(
    (note) => note.text ?? "",
  ),
]
  .join("\n")
  .replaceAll("\\'", "'");

/** Asserts that every word is on the program canvas, so the literals below are the design's and not the author's. */
const expectOnCanvas = (words: readonly string[]): void => {
  expect(words.filter((word) => !programCanvasText.includes(word))).toEqual([]);
};

describe("the canvas files the words are read from", () => {
  it("should be found and hold the programme's words", () => {
    expect(programCanvasText).toContain("How your programme works");
    expect(programCanvasText).toContain("Kept to a 30% deficit");
  });
});

describe("more · program-row", () => {
  const words = {
    title: "Programme",
    subtitleWithout: "Let Ki-Lo set your targets",
    subtitleWith: "Next check-in Fri 30 Oct",
    targetsSubtitle: "From your programme",
  };

  it("should give the Programme row of Nutrition and the Targets subtitle of the board", () => {
    expect(MORE_SCREEN.nutrition.program).toEqual({
      title: words.title,
      subtitleWithoutProgram: words.subtitleWithout,
    });
    expect(MORE_SCREEN.nutrition.targets.subtitleFromProgram).toBe(words.targetsSubtitle);
    expect(describeNextCheckInSubtitle("2026-10-30")).toBe(words.subtitleWith);
    expectOnCanvas(Object.values(words));
  });

  it("should keep every key and word the More screen had", () => {
    expect(MORE_SCREEN.nutrition.title).toBe("Nutrition");
    expect(MORE_SCREEN.nutrition.targets.title).toBe("Targets");
    expect(MORE_SCREEN.nutrition.targets.subtitle).toBe("Set by you");
    expect(MORE_SCREEN.food.yourFoods.subtitle).toBe("Foods you created or copied");
    expect(MORE_SCREEN.account.signOut).toBe("Sign out");
  });
});

describe("program: default", () => {
  it("should give the header, the hero and its badge", () => {
    expect(PROGRAM_SCREEN.title).toBe("Programme");
    expect(PROGRAM_SCREEN.backName).toBe("Back to More");
    expect(PROGRAM_SCREEN.hero).toEqual({
      eyebrow: "Estimated expenditure",
      estimateBadge: "Estimate",
      settlingBadge: "Settling",
      unit: "kcal a day",
      settlingLine: "A starting estimate from your answers. Your first check-in measures it.",
    });
    expectOnCanvas([
      "Back to More",
      "Estimated expenditure",
      "kcal a day",
      "A starting estimate from your answers. Your first check-in measures it.",
    ]);
  });

  it("should write the likely range from the golden fixture's belief as the notes' arithmetic does", () => {
    // mu 2,579.54 and variance 13,449.0: 2,579.54 +/- 1.2816 x 115.97 is 2,430.9 to 2,728.2.
    const band = expenditureBand({ muKcal: 2579.54, varKcal2: 13449 });

    expect(describeLikelyRange(band)).toBe("Likely 2,430 to 2,730 kcal");
    expect(describeExpenditureHeroName(band)).toBe(
      "Estimated expenditure, 2,580 kilocalories a day, likely 2,430 to 2,730 kcal",
    );
    expectOnCanvas(["Likely 2,430 to 2,730 kcal"]);
  });

  // mu 2,500 and variance 9,575: 1.2816 x 97.85 = 125.4, so 2,374.6 to 2,625.4, to the nearest 10 and not to the nearest 5.
  it("should write the ends of the range to the nearest 10", () => {
    expect(describeLikelyRange(expenditureBand({ muKcal: 2500, varKcal2: 9575 }))).toBe(
      "Likely 2,370 to 2,630 kcal",
    );
  });

  it("should write the settling person's likely range, and a range past a thousand with its separator", () => {
    expect(describeLikelyRange({ lowKcal: 1950, highKcal: 2880 })).toBe(
      "Likely 1,950 to 2,880 kcal",
    );
    expect(describeLikelyRange({ lowKcal: 940, highKcal: 1250 })).toBe("Likely 940 to 1,250 kcal");
    expectOnCanvas(["Likely 1,950 to 2,880 kcal"]);
  });

  it("should name the hero by the whole kilocalories, whatever the unrounded mean", () => {
    expect(describeExpenditureHeroName({ muKcal: 2413.125, lowKcal: 1950, highKcal: 2880 })).toBe(
      "Estimated expenditure, 2,413 kilocalories a day, likely 1,950 to 2,880 kcal",
    );
  });

  it("should say where the estimate comes from and when it was updated", () => {
    expect(describeExpenditureSource("2026-10-23")).toBe(
      "From your weigh-ins and food log, updated Friday 23 October",
    );
    expectOnCanvas(["From your weigh-ins and food log, updated Friday 23 October"]);
  });

  it("should give the targets card its words, and its two names for the next check-in", () => {
    expect(PROGRAM_SCREEN.targets).toEqual({
      eyebrow: "This week's targets",
      unit: "kcal a day",
      nextCheckIn: "Next check-in",
      firstCheckIn: "First check-in",
    });
    expect(describeTargetsCardSince("2026-10-23")).toBe("Since Fri 23 Oct");
    expect(describeTargetsCardName(2140)).toBe("This week's targets, 2,140 kilocalories a day");
    expectOnCanvas(["This week's targets", "Since Fri 23 Oct", "Next check-in", "First check-in"]);
  });

  it("should write the next check-in's caption with the weekday of the check-in", () => {
    expect(describeNextCheckInCaption(7, "2026-10-30")).toBe("In 7 days, then every Friday");
    expect(describeNextCheckInCaption(9, "2026-11-06")).toBe("In 9 days, then every Friday");
    expectOnCanvas(["In 7 days, then every Friday", "In 9 days, then every Friday"]);
  });

  it("should write the day before and the day of a check-in", () => {
    expect(describeNextCheckInCaption(1, "2026-10-30")).toBe("In 1 day, then every Friday");
    expect(describeNextCheckInCaption(0, "2026-10-30")).toBe("Today, then every Friday");
  });

  it("should read an overdue check-in as today, never as a negative number of days", () => {
    expect(describeNextCheckInCaption(-2, "2026-10-30")).toBe("Today, then every Friday");
    expect(describeFirstCheckInBanner("2026-11-06", -2)).toBe(
      "First check-in Friday 6 November, today",
    );
  });

  it("should give the rate line of the targets card from the setup formatter", () => {
    expect(
      describeRateLine({ goal: "lose", ratePctPerWeek: 0.5, weightKg: 79.023, unit: "kg" }),
    ).toBe("To lose about 0.4 kg a week (0.5% of your weight).");
    expect(
      describeRateLine({ goal: "lose", ratePctPerWeek: 0.5, weightKg: 79.023, unit: "lb" }),
    ).toBe("To lose about 0.9 lb a week (0.5% of your weight).");
    expectOnCanvas(["To lose about 0.4 kg a week (0.5% of your weight)."]);
  });

  it("should give the rows of Your programme with their subtitles", () => {
    expect(PROGRAM_SCREEN.details).toEqual({
      title: "Your programme",
      goal: "Goal",
      rate: "Rate",
      protein: "Protein",
      dietStyle: "Diet style",
    });
    expect(describeRateSubtitle(0.5, 79.023, "kg")).toBe("About 0.4 kg a week");
    expect(describeRateSubtitle(0.5, 79.023, "lb")).toBe("About 0.9 lb a week");
    expect(describeProteinSubtitle("moderate", 79.023)).toBe("1.6 g per kg, about 126 g a day");
    expect(describeProteinSubtitle("high", 79.023)).toBe("2.0 g per kg, about 158 g a day");
    expect(describeProteinSubtitle("very_high", 79.023)).toBe("2.2 g per kg, about 174 g a day");
    expectOnCanvas([
      "Your programme",
      "Diet style",
      "About 0.4 kg a week",
      "1.6 g per kg, about 126 g a day",
    ]);
  });

  it("should name the two buttons and carry the legal sentence by reference", () => {
    expect(PROGRAM_SCREEN.editLabel).toBe("Edit programme");
    expect(PROGRAM_SCREEN.howItWorksLabel).toBe("How it works");
    expect(PROGRAM_SCREEN.notMedicalAdvice).toBe(NOT_MEDICAL_ADVICE);
    expectOnCanvas(["Edit programme", "How it works", NOT_MEDICAL_ADVICE]);
  });
});

describe("program: settling", () => {
  it("should write the banner with the days left, and the day or the day before as numbers say", () => {
    expect(describeFirstCheckInBanner("2026-11-06", 9)).toBe(
      "First check-in Friday 6 November, in 9 days",
    );
    expect(describeFirstCheckInBanner("2026-11-06", 1)).toBe(
      "First check-in Friday 6 November, in 1 day",
    );
    expect(describeFirstCheckInBanner("2026-11-06", 0)).toBe(
      "First check-in Friday 6 November, today",
    );
    expectOnCanvas(["First check-in Friday 6 November, in 9 days"]);
  });

  it("should say the targets stay as they are, and list the three counts with their targets", () => {
    expect(PROGRAM_SETTLING.intro).toBe(
      "Until then your targets stay as they are. The check-in needs:",
    );
    expect(PROGRAM_SETTLING.needs).toEqual([
      { label: "Days with a weigh-in", name: "Days with a weigh-in", target: 8 },
      {
        label: "Days your weigh-ins cover, first to last",
        name: "Days your weigh-ins cover",
        target: 14,
      },
      { label: "Complete days", name: "Complete days", target: 10 },
    ]);
    expectOnCanvas([PROGRAM_SETTLING.intro, ...PROGRAM_SETTLING.needs.map((need) => need.label)]);
  });

  it("should write each count and name each bar by its count", () => {
    expect(describeCountOfTarget(4, 8)).toBe("4 of 8");
    expect(describeCountOfTarget(6, 14)).toBe("6 of 14");
    expect(describeCountedName("Days with a weigh-in", 4, 8)).toBe("Days with a weigh-in, 4 of 8");
    expect(describeCountedName("Days your weigh-ins cover", 6, 14)).toBe(
      "Days your weigh-ins cover, 6 of 14",
    );
    expect(describeCountedName("Complete days", 4, 10)).toBe("Complete days, 4 of 10");
    expectOnCanvas([
      "Days with a weigh-in, 4 of 8",
      "Days your weigh-ins cover, 6 of 14",
      "Complete days, 4 of 10",
    ]);
  });

  it("should write the tip with the day before the first check-in", () => {
    expect(describeSettlingTip("2026-11-06")).toBe(
      "Weigh in on Thursday 5 November, the day before, so your weigh-ins cover the full 14 days.",
    );
    expectOnCanvas([
      "Weigh in on Thursday 5 November, the day before, so your weigh-ins cover the full 14 days.",
    ]);
  });

  it("should write the tip with the date itself, when older weigh-ins put it earlier than the day before", () => {
    expect(describeSettlingTipOnOrAfter("2026-11-02")).toBe(
      "Weigh in on or after Monday 2 November so your weigh-ins cover the full 14 days.",
    );
  });

  it("should write no tip when there is no tip date", () => {
    expect(describeSettlingTipFor("2026-11-06", null)).toBeNull();
  });

  it("should write the day before wording when the tip date is the day before the first check-in", () => {
    expect(describeSettlingTipFor("2026-11-06", "2026-11-05")).toBe(
      "Weigh in on Thursday 5 November, the day before, so your weigh-ins cover the full 14 days.",
    );
  });

  it("should write the on or after wording when the tip date is earlier than the day before", () => {
    expect(describeSettlingTipFor("2026-11-06", "2026-11-02")).toBe(
      "Weigh in on or after Monday 2 November so your weigh-ins cover the full 14 days.",
    );
  });

  it("should write the same days in both tips as the span the engine needs", () => {
    const { minSpanDays } = DEFAULT_ENGINE_PARAMS.expenditure;

    expect(describeSettlingTip("2026-11-06")).toContain(`the full ${minSpanDays} days.`);
    expect(describeSettlingTipOnOrAfter("2026-11-02")).toContain(`the full ${minSpanDays} days.`);
  });

  it("should write the first check-in as a short date in a row", () => {
    expect(describeNextCheckInSubtitle("2026-11-06")).toBe("Next check-in Fri 6 Nov");
    expectOnCanvas(["Fri 6 Nov", "In 9 days, then every Friday"]);
  });

  it("should write the settling person's rows and own words", () => {
    expect(describeProteinSubtitle("moderate", 80)).toBe("1.6 g per kg, about 128 g a day");
    expectOnCanvas(["1.6 g per kg, about 128 g a day"]);
  });
});

describe("program: no-program", () => {
  it("should give the empty state its title, body and three points in order", () => {
    expect(PROGRAM_NO_PROGRAM.title).toBe("Let Ki-Lo set your targets");
    expect(PROGRAM_NO_PROGRAM.body).toBe(
      "A programme sets your calorie and macro targets from your goal, then checks them each week.",
    );
    expect(PROGRAM_NO_PROGRAM.points).toEqual([
      "Estimates the energy you use, from a few questions about you.",
      "Checks that estimate each week against your weigh-ins and food log.",
      "Adjusts your calorie and macro targets to keep you on pace for your goal.",
    ]);
    expectOnCanvas([
      PROGRAM_NO_PROGRAM.title,
      PROGRAM_NO_PROGRAM.body,
      ...PROGRAM_NO_PROGRAM.points,
    ]);
  });

  it("should give the button, the person's own targets and the legal sentence", () => {
    expect(PROGRAM_NO_PROGRAM.startLabel).toBe("Estimate my targets");
    expect(PROGRAM_NO_PROGRAM.startLabel).toBe(SETUP_TARGETS_ROW.title);
    expect(describeOwnTargetsStay(2200)).toBe(
      "Your own targets (2,200 kcal a day) stay until you start.",
    );
    expect(PROGRAM_NO_PROGRAM.notMedicalAdvice).toBe(NOT_MEDICAL_ADVICE);
    expectOnCanvas([
      "Estimate my targets",
      "Your own targets (2,200 kcal a day) stay until you start.",
    ]);
  });
});

describe("program: loading and program: error", () => {
  it("should name the loading screen", () => {
    expect(PROGRAM_SCREEN.loadingName).toBe("Loading your programme");
    expectOnCanvas(["Loading your programme"]);
  });

  it("should give the error state its title and body, and the app's own retry label", () => {
    expect(PROGRAM_ERROR.title).toBe("Couldn't load your programme");
    expect(PROGRAM_ERROR.body).toBe(
      "Check your connection and try again. Your targets have not changed.",
    );
    expect(PROGRAM_ERROR.retryLabel).toBe("Try again");
    expect(PROGRAM_ERROR.retryLabel).toBe(RETRY_LABEL);
    expectOnCanvas([
      "Couldn't load your programme",
      "Check your connection and try again. Your targets have not changed.",
      "Try again",
    ]);
  });
});

describe("checkin-summary: measured", () => {
  it("should give the card's words and the badge", () => {
    expect(PROGRAM_CHECKIN_SUMMARY).toEqual({
      eyebrow: "Last check-in",
      measured: "Measured",
      notMeasured: "Not measured",
      expenditureLabel: "Expenditure",
      calorieTargetLabel: "Calorie target",
    });
    expectOnCanvas(["Last check-in", "Measured", "Not measured", "Calorie target"]);
  });

  it("should name the card by its date and whether it measured", () => {
    expect(describeCheckinSummaryName("2026-10-09", true)).toBe(
      "Last check-in, Friday 9 October, measured",
    );
    expect(describeCheckinSummaryName("2026-10-09", false)).toBe(
      "Last check-in, Friday 9 October, not measured",
    );
    expectOnCanvas(["Last check-in, Friday 9 October, measured"]);
  });

  it("should write a change as from to, or as the value with no change", () => {
    expect(describeKcalChange(2574.22, 2579.54)).toBe("2,574 to 2,580 kcal");
    expect(describeKcalChange(2500, 2559.56)).toBe("2,500 to 2,560 kcal");
    expect(describeKcalChange(2060, 2120)).toBe("2,060 to 2,120 kcal");
    expect(describeKcalChange(2140, 2140)).toBe("2,140 kcal, no change");
    expectOnCanvas([
      "2,574 to 2,580 kcal",
      "2,500 to 2,560 kcal",
      "2,060 to 2,120 kcal",
      "2,140 kcal, no change",
    ]);
  });

  it("should call a change that rounds to the same whole kilocalories no change", () => {
    expect(describeKcalChange(2579.6, 2579.9)).toBe("2,580 kcal, no change");
  });

  it("should write a step down, a step past a thousand and a gain from a low start", () => {
    expect(describeKcalChange(3408.06, 3158.06)).toBe("3,408 to 3,158 kcal");
    expect(describeKcalChange(1111.8, 1093.6)).toBe("1,112 to 1,094 kcal");
    expectOnCanvas(["3,408 to 3,158 kcal", "1,112 to 1,094 kcal"]);
  });

  it("should write a value carried forward, however the two figures compare", () => {
    expect(describeKcalChange(2500, 2500, { carriedForward: true })).toBe(
      "2,500 kcal, carried forward",
    );
    expect(describeKcalChange(2500, 2510, { carriedForward: true })).toBe(
      "2,510 kcal, carried forward",
    );
  });

  it("should write the data line with the counts of the window", () => {
    expect(describeCheckinDataLine({ weighDays: 28, completeDays: 28 })).toBe(
      "From your weight trend and the food you logged: 28 weigh-ins and 28 complete days in the last 4 weeks.",
    );
    expect(describeCheckinDataLine({ weighDays: 14, completeDays: 14 })).toBe(
      "From your weight trend and the food you logged: 14 weigh-ins and 14 complete days in the last 4 weeks.",
    );
    expectOnCanvas([
      "From your weight trend and the food you logged: 28 weigh-ins and 28 complete days in the last 4 weeks.",
      "From your weight trend and the food you logged: 14 weigh-ins and 14 complete days in the last 4 weeks.",
    ]);
  });
});

describe("checkin-summary: guardrail", () => {
  const words = {
    stepDrop:
      "Your expenditure moved 250 kcal, the most it moves in one week. Your weigh-ins and food log pointed to a 415 kcal drop, so it may move again at your next check-in.",
    stepRise:
      "Your expenditure moved 250 kcal, the most it moves in one week. Your weigh-ins and food log pointed to a 284 kcal rise, so it may move again at your next check-in.",
    maxRateLose: "Set to 1.0% a week, the fastest Ki-Lo sets for losing weight.",
    maxRateGain: "Set to 0.5% a week, the fastest Ki-Lo sets for gaining weight.",
    maxDeficit:
      "Kept to a 30% deficit, the most Ki-Lo sets. You would lose about 0.9 kg a week (0.66% of your weight), not 1.0%.",
    maxSurplus:
      "Kept to a 20% surplus, the most Ki-Lo sets. You would gain about 0.3 kg a week (0.47% of your weight), not 0.5%.",
    floor:
      "Raised to 1,200 kcal, the lowest target Ki-Lo sets for you. You would lose about 0.3 kg a week (0.47% of your weight), not 1.0%.",
    floorAboveExpenditure:
      "Raised to 1,200 kcal, the lowest target Ki-Lo sets for you. That is more than your estimated expenditure of 1,094 kcal, so you would gain about 0.1 kg a week (0.24% of your weight), not lose it.",
    floorAdvice: "Talk to a doctor or dietitian before you try to lose more weight.",
    dowFloor: "Some days were raised to 1,580 kcal, the lowest daily target Ki-Lo sets for you.",
    macroFit:
      "Protein was lowered to 120 g so that it fits in 1,200 kcal with the least fat Ki-Lo sets (80 g). Carbohydrate is 0 g.",
    profileMax:
      "Capped at 6,000 kcal, the most Ki-Lo sets. You would gain about 0.4 kg a week (0.26% of your weight), not 0.5%.",
    dowRange: "Some days were kept between 800 and 6,000 kcal, the range Ki-Lo sets.",
  };

  // The notes' arithmetic: the max-deficit man's pace is 0.853 kg a week, which is 0.6643% of 128.4 kg.
  const maxDeficitFigures = {
    weightKg: 128.4,
    effectiveRatePctPerWeek: 0.6643,
    wantedRatePctPerWeek: 1.0,
    unit: "kg",
  } as const;
  // The setup canvas's floor woman: 0.26 kg a week of 55.5 kg is 0.47%.
  const floorFigures = {
    caloriesKcal: 1200,
    expenditureKcal: 1487,
    weightKg: 55.5,
    effectiveRatePctPerWeek: 0.47,
    wantedRatePctPerWeek: 1.0,
    unit: "kg",
  } as const;
  // ADR 0002 Amendment 1, point 3: the notes' woman gains 0.097 kg a week of 39.9 kg, which is 0.2431%.
  const floorAboveExpenditureFigures = {
    caloriesKcal: 1200,
    expenditureKcal: 1093.6,
    weightKg: 39.9,
    effectiveRatePctPerWeek: -0.2431,
    wantedRatePctPerWeek: 0.5,
    unit: "kg",
  } as const;
  // The notes' example: tdee 1,800 at 70 kg, gain 0.5%: 0.3273 kg a week, which is 0.4675%.
  const maxSurplusFigures = {
    weightKg: 70,
    effectiveRatePctPerWeek: 0.4675,
    wantedRatePctPerWeek: 0.5,
    unit: "kg",
  } as const;
  // The notes' example: tdee 5,600 at 140 kg, gain 0.5%: 0.3636 kg a week, which is 0.2597%.
  const profileMaxFigures = {
    caloriesKcal: 6000,
    weightKg: 140,
    effectiveRatePctPerWeek: 0.2597,
    wantedRatePctPerWeek: 0.5,
    unit: "kg",
  } as const;

  const everyEntry: readonly ProgramGuardrailEntry[] = [
    { code: "expenditure_step", figures: { rawChangeKcal: -414.8 } },
    { code: "max_rate", figures: { goal: "lose" } },
    { code: "max_deficit", figures: maxDeficitFigures },
    { code: "max_surplus", figures: maxSurplusFigures },
    { code: "floor", figures: floorFigures },
    { code: "profile_max", figures: profileMaxFigures },
    { code: "dow_floor", figures: { floorKcal: 1579.5 } },
    { code: "dow_range", figures: undefined },
    {
      code: "macro_fit",
      figures: { proteinGrams: 120, caloriesKcal: 1200, fatGrams: 80 },
    },
  ];

  it("should have a line for every code of the engine's clamps, the profile maximum and the step clamp, and for nothing else", () => {
    expect(Object.keys(PROGRAM_GUARDRAIL_LINES).sort()).toEqual(
      [...CLAMPS, "profile_max", "expenditure_step"].sort(),
    );
  });

  it("should write the expenditure step clamp, a drop and a rise, from the raw step", () => {
    expect(PROGRAM_GUARDRAIL_LINES.expenditure_step({ rawChangeKcal: -414.8 })).toBe(
      words.stepDrop,
    );
    expect(PROGRAM_GUARDRAIL_LINES.expenditure_step({ rawChangeKcal: 283.7 })).toBe(words.stepRise);
    expectOnCanvas([words.stepDrop, words.stepRise]);
  });

  it("should write the raw step in whole kilocalories with a thousands separator", () => {
    expect(PROGRAM_GUARDRAIL_LINES.expenditure_step({ rawChangeKcal: -1234.4 })).toContain(
      "pointed to a 1,234 kcal drop",
    );
  });

  it("should write max_rate for losing and for gaining", () => {
    expect(PROGRAM_GUARDRAIL_LINES.max_rate({ goal: "lose" })).toBe(words.maxRateLose);
    expect(PROGRAM_GUARDRAIL_LINES.max_rate({ goal: "gain" })).toBe(words.maxRateGain);
    expectOnCanvas([words.maxRateLose, words.maxRateGain]);
  });

  it("should reuse the setup lines for the five codes it already words, so there is one copy of each", () => {
    expect(PROGRAM_GUARDRAIL_LINES.max_deficit).toBe(SETUP_GUARDRAIL_LINES.max_deficit);
    expect(PROGRAM_GUARDRAIL_LINES.max_surplus).toBe(SETUP_GUARDRAIL_LINES.max_surplus);
    expect(PROGRAM_GUARDRAIL_LINES.floor).toBe(SETUP_GUARDRAIL_LINES.floor);
    expect(PROGRAM_GUARDRAIL_LINES.profile_max).toBe(SETUP_GUARDRAIL_LINES.profile_max);
    expect(PROGRAM_GUARDRAIL_LINES.macro_fit).toBe(SETUP_GUARDRAIL_LINES.macro_fit);
  });

  it("should give the canvas's specimen lines for the reused codes", () => {
    expect(PROGRAM_GUARDRAIL_LINES.max_deficit(maxDeficitFigures)).toBe(words.maxDeficit);
    expect(PROGRAM_GUARDRAIL_LINES.max_surplus(maxSurplusFigures)).toBe(words.maxSurplus);
    expect(PROGRAM_GUARDRAIL_LINES.floor(floorFigures)).toBe(words.floor);
    expect(PROGRAM_GUARDRAIL_LINES.floor(floorAboveExpenditureFigures)).toBe(
      words.floorAboveExpenditure,
    );
    expect(PROGRAM_GUARDRAIL_LINES.profile_max(profileMaxFigures)).toBe(words.profileMax);
    expect(
      PROGRAM_GUARDRAIL_LINES.macro_fit({ proteinGrams: 120, caloriesKcal: 1200, fatGrams: 80 }),
    ).toBe(words.macroFit);
    expectOnCanvas([
      words.maxDeficit,
      words.maxSurplus,
      words.floor,
      words.floorAboveExpenditure,
      words.profileMax,
      words.macroFit,
    ]);
  });

  // The engine raises a day to the floor rounded UP to its step, so the line shows that day's target.
  it("should write dow_floor as the day target the engine set, the floor rounded up to its step", () => {
    expect(DEFAULT_ENGINE_PARAMS.targets.roundToKcal).toBe(10);
    expect(PROGRAM_GUARDRAIL_LINES.dow_floor({ floorKcal: 1579.5 })).toBe(words.dowFloor);
    expect(PROGRAM_GUARDRAIL_LINES.dow_floor({ floorKcal: 1572.3 })).toBe(
      "Some days were raised to 1,580 kcal, the lowest daily target Ki-Lo sets for you.",
    );
    expect(PROGRAM_GUARDRAIL_LINES.dow_floor({ floorKcal: 1580 })).toContain(
      "raised to 1,580 kcal",
    );
    expect(PROGRAM_GUARDRAIL_LINES.dow_floor({ floorKcal: 1580.1 })).toContain(
      "raised to 1,590 kcal",
    );
    expectOnCanvas([words.dowFloor]);
  });

  // The canvas draws no line for dow_range. These are the ticket's words, written by the tech lead, and
  // they cannot fire in v1 (day-of-week offsets are zero and no screen sets them).
  it("should write dow_range in the ticket's words, which the canvas does not draw", () => {
    expect(PROGRAM_GUARDRAIL_LINES.dow_range(undefined)).toBe(words.dowRange);
    expect(programCanvasText).not.toContain("Some days were kept between");
  });

  it("should state in max_rate and the step clamp the engine's own limits", () => {
    expect(DEFAULT_ENGINE_PARAMS.targets.maxLossPct).toBe(1.0);
    expect(DEFAULT_ENGINE_PARAMS.targets.maxGainPct).toBe(0.5);
    expect(DEFAULT_ENGINE_PARAMS.expenditure.maxWeeklyChangeKcal).toBe(250);
  });

  it("should name in dow_range the bounds the profile range holds", () => {
    expect(PROFILE_MIN_KCAL).toBe(800);
    expect(PROFILE_MAX_KCAL).toBe(6000);
  });

  it("should list the lines in the order step clamp, max_rate, calorie clamp, dow_floor, dow_range, macro_fit", () => {
    // Entered in the reverse order, and with the three calorie clamps that did not set the number.
    const lines = guardrailLineOrder([...everyEntry].reverse());

    expect(lines.map((line) => line.code)).toEqual([
      "expenditure_step",
      "max_rate",
      "profile_max",
      "dow_floor",
      "dow_range",
      "macro_fit",
    ]);
  });

  it("should write each line with the text of its code", () => {
    expect(guardrailLineOrder(everyEntry).map((line) => line.text)).toEqual([
      words.stepDrop,
      words.maxRateLose,
      words.profileMax,
      words.dowFloor,
      words.dowRange,
      words.macroFit,
    ]);
  });

  it("should show only the one calorie clamp that set the number, the floor when it and the deficit cap both apply", () => {
    const lines = guardrailLineOrder([
      { code: "max_deficit", figures: maxDeficitFigures },
      { code: "floor", figures: floorFigures },
    ]);

    expect(lines.map((line) => line.code)).toEqual(["floor"]);
  });

  it("should show the deficit cap when it is the only calorie clamp", () => {
    expect(
      guardrailLineOrder([{ code: "max_deficit", figures: maxDeficitFigures }]).map(
        (line) => line.code,
      ),
    ).toEqual(["max_deficit"]);
  });

  it("should show the surplus cap, and the profile maximum over it", () => {
    expect(
      guardrailLineOrder([{ code: "max_surplus", figures: maxSurplusFigures }]).map(
        (line) => line.code,
      ),
    ).toEqual(["max_surplus"]);
    expect(
      guardrailLineOrder([
        { code: "max_surplus", figures: maxSurplusFigures },
        { code: "profile_max", figures: profileMaxFigures },
      ]).map((line) => line.code),
    ).toEqual(["profile_max"]);
  });

  it("should put the calorie clamp between max_rate and dow_floor, and macro_fit last", () => {
    const lines = guardrailLineOrder([
      { code: "macro_fit", figures: { proteinGrams: 120, caloriesKcal: 1200, fatGrams: 80 } },
      { code: "dow_floor", figures: { floorKcal: 1580 } },
      { code: "floor", figures: floorFigures },
      { code: "max_rate", figures: { goal: "gain" } },
    ]);

    expect(lines.map((line) => line.code)).toEqual(["max_rate", "floor", "dow_floor", "macro_fit"]);
  });

  it("should list a code once when it is recorded twice", () => {
    const lines = guardrailLineOrder([
      { code: "max_rate", figures: { goal: "lose" } },
      { code: "max_rate", figures: { goal: "lose" } },
    ]);

    expect(lines).toHaveLength(1);
  });

  it("should list nothing when nothing was recorded", () => {
    expect(guardrailLineOrder([])).toEqual([]);
  });

  it("should add the plain line after the floor line when the floor is above expenditure", () => {
    const [line] = guardrailLineOrder([{ code: "floor", figures: floorAboveExpenditureFigures }]);

    expect(line?.text).toBe(words.floorAboveExpenditure);
    expect(line?.followUp).toBe(words.floorAdvice);
    expect(line?.followUp).toBe(SETUP_FLOOR_ABOVE_EXPENDITURE_ADVICE);
    expectOnCanvas([words.floorAdvice]);
  });

  it("should add it when the effective rate is exactly zero, as the floor line's wording does", () => {
    const [line] = guardrailLineOrder([
      { code: "floor", figures: { ...floorAboveExpenditureFigures, effectiveRatePctPerWeek: 0 } },
    ]);

    expect(line?.text).toContain("That is more than your estimated expenditure");
    expect(line?.followUp).toBe(words.floorAdvice);
  });

  it("should add no plain line to the floor line of a slower loss, or to any other line", () => {
    const lines = guardrailLineOrder(everyEntry);

    expect(lines.map((line) => line.followUp)).toEqual([null, null, null, null, null, null]);
    expect(
      guardrailLineOrder([{ code: "floor", figures: floorFigures }]).map((line) => line.followUp),
    ).toEqual([null]);
  });
});

describe("checkin-summary: not-measured", () => {
  const words = {
    complete:
      "You completed 9 days. A check-in needs at least 10 complete days in the last 4 weeks.",
    span: "Your weigh-ins cover 9 days, first to last. A check-in needs them to cover at least 14.",
    weighDays: "You weighed in on 5 days. A check-in needs at least 8 in the last 4 weeks.",
    carriedForward:
      "So your expenditure estimate was carried forward, and it is less certain: likely 2,010 to 2,990 kcal. Your targets were worked out again from it.",
  };

  it("should have a reason line for each reason code and for nothing else", () => {
    expect(Object.keys(PROGRAM_REASON_LINES).sort()).toEqual([
      "complete_days",
      "span",
      "weigh_days",
    ]);
  });

  it("should give the gate case: nine complete days", () => {
    expect(
      describeNotMeasuredReasons(["complete_days"], {
        spanDays: 14,
        weighDays: 14,
        completeDays: 9,
      }),
    ).toEqual([words.complete]);
    expectOnCanvas([words.complete]);
  });

  it("should give the weigh-in case: two reasons in the order span, weigh_days", () => {
    expect(
      describeNotMeasuredReasons(["span", "weigh_days"], {
        spanDays: 9,
        weighDays: 5,
        completeDays: 14,
      }),
    ).toEqual([words.span, words.weighDays]);
    expectOnCanvas([words.span, words.weighDays]);
  });

  it("should write the reasons in the order span, weigh_days, complete_days whatever order they come in", () => {
    expect(
      describeNotMeasuredReasons(["complete_days", "weigh_days", "span"], {
        spanDays: 9,
        weighDays: 5,
        completeDays: 9,
      }),
    ).toEqual([words.span, words.weighDays, words.complete]);
  });

  it("should write one line when a reason is listed twice, and none when there is none", () => {
    expect(
      describeNotMeasuredReasons(["span", "span"], { spanDays: 9, weighDays: 5, completeDays: 9 }),
    ).toEqual([words.span]);
    expect(describeNotMeasuredReasons([], { spanDays: 0, weighDays: 0, completeDays: 0 })).toEqual(
      [],
    );
  });

  it("should write a count of one as one day, and a count of none as 0 days", () => {
    expect(
      describeNotMeasuredReasons(["span", "weigh_days", "complete_days"], {
        spanDays: 1,
        weighDays: 1,
        completeDays: 1,
      }),
    ).toEqual([
      "Your weigh-ins cover 1 day, first to last. A check-in needs them to cover at least 14.",
      "You weighed in on 1 day. A check-in needs at least 8 in the last 4 weeks.",
      "You completed 1 day. A check-in needs at least 10 complete days in the last 4 weeks.",
    ]);
    expect(
      describeNotMeasuredReasons(["complete_days"], { spanDays: 0, weighDays: 0, completeDays: 0 }),
    ).toEqual([
      "You completed 0 days. A check-in needs at least 10 complete days in the last 4 weeks.",
    ]);
  });

  it("should give the line that carries the expenditure forward with its likely range", () => {
    expect(describeCarriedForwardLine({ lowKcal: 2010, highKcal: 2990 })).toBe(
      words.carriedForward,
    );
    expectOnCanvas([words.carriedForward]);
  });

  it("should write the expenditure row as carried forward and the target row as no change", () => {
    expect(describeKcalChange(2500, 2500, { carriedForward: true })).toBe(
      "2,500 kcal, carried forward",
    );
    expect(describeKcalChange(2060, 2060)).toBe("2,060 kcal, no change");
    expectOnCanvas(["2,500 kcal, carried forward", "2,060 kcal, no change"]);
  });

  it("should reach the likely range of the notes' arithmetic from the carried belief", () => {
    // No measurement: mu stays 2,500 and the variance is 140,625 + 75^2 = 146,250, so 2,009.9 to 2,990.1.
    expect(describeCarriedForwardLine(expenditureBand({ muKcal: 2500, varKcal2: 146250 }))).toBe(
      words.carriedForward,
    );
  });
});

describe("program-explainer: how it works", () => {
  const sections = [
    {
      title: "Your expenditure",
      text: "The energy you use in a day. Ki-Lo works it out from the food you log and how your weight trend moves: if your trend holds steady while you eat 2,000 kcal a day, you use about 2,000.",
    },
    {
      title: "The weekly check-in",
      text: "Every Friday, the day you started, Ki-Lo looks back over the last 4 weeks. It updates your expenditure, then sets the next week's targets from it. If you have been away, it catches up one week at a time.",
    },
    {
      title: "The first two weeks",
      text: "Your first check-in is two weeks after you start. Until then your expenditure is a starting estimate from your answers, and your targets stay as they are.",
    },
    {
      title: "What a check-in needs",
      text: "In the last 4 weeks: weigh-ins on at least 8 days, covering at least 14 days from the first to the last, and at least 10 complete days. Without them the estimate is carried forward and becomes less certain, and your targets are worked out again from it.",
    },
    {
      title: "The likely range",
      text: "Your expenditure comes with a range. The true figure is inside it 8 times in 10. The range narrows as you weigh in and complete your days.",
    },
    {
      title: "Guardrails",
      text: "Your expenditure moves by at most 250 kcal a week. Your target is never more than 30% below it or 20% above it, and never above 6,000 kcal. When you are losing weight it is never below 1,200 kcal or 90% of the energy you use at rest, whichever is higher. When a guardrail changes your target, the check-in says so.",
    },
    {
      title: "Water, glycogen and muscle",
      text: "Ki-Lo counts 7,700 kcal for each kilogram your trend moves, which assumes the change is mostly fat. In the first weeks of a new deficit you also lose water and glycogen, so your weight falls faster and your expenditure can look higher than it is. If you gain mostly muscle, a kilogram holds less energy, so your expenditure can look lower than it is.",
    },
  ];

  it("should give the title, the Done button and the legal sentence by reference", () => {
    expect(PROGRAM_EXPLAINER.title).toBe("How your programme works");
    expect(PROGRAM_EXPLAINER.doneLabel).toBe("Done");
    expect(PROGRAM_EXPLAINER.notMedicalAdvice).toBe(NOT_MEDICAL_ADVICE);
    expectOnCanvas(["How your programme works", "Done", NOT_MEDICAL_ADVICE]);
  });

  it("should give the seven sections in order, with the weekday of a Friday check-in", () => {
    expect(describeExplainerSections("2026-10-30")).toEqual(sections);
    expectOnCanvas(sections.flatMap((section) => [section.title, section.text]));
  });

  it("should write the person's own check-in weekday into the weekly check-in section", () => {
    const [, weekly] = describeExplainerSections("2026-10-28");

    expect(weekly?.text).toContain("Every Wednesday, the day you started, Ki-Lo");
  });

  // The explainer writes the engine's numbers as words, so a retune of the engine must fail here.
  it("should state the numbers the engine holds today", () => {
    const { expenditure, targets } = DEFAULT_ENGINE_PARAMS;
    const text = sections.map((section) => section.text).join("\n");

    expect(expenditure.windowDays).toBe(4 * 7);
    expect(expenditure.minWeighDays).toBe(8);
    expect(expenditure.minSpanDays).toBe(14);
    expect(expenditure.minCompleteDays).toBe(10);
    expect(expenditure.maxWeeklyChangeKcal).toBe(250);
    expect(expenditure.energyDensityKcalPerKg).toBe(7700);
    expect(targets.maxDeficitFrac).toBe(0.3);
    expect(targets.maxSurplusFrac).toBe(0.2);
    expect(targets.floorAbsKcal).toBe(1200);
    expect(targets.floorBmrFactor).toBe(0.9);
    expect(PROFILE_MAX_KCAL).toBe(6000);
    expect(text).toContain("at least 8 days, covering at least 14 days");
    expect(text).toContain("at least 10 complete days");
  });

  it("should keep the settling counts and the gate lines at the engine's numbers", () => {
    const { expenditure } = DEFAULT_ENGINE_PARAMS;

    expect(PROGRAM_SETTLING.needs.map((need) => need.target)).toEqual([
      expenditure.minWeighDays,
      expenditure.minSpanDays,
      expenditure.minCompleteDays,
    ]);
  });
});

describe("expenditure-chart: default, few-points, empty", () => {
  it("should give the card's label, unit and legend", () => {
    expect(PROGRAM_CHART.label).toBe("Expenditure by week");
    expect(PROGRAM_CHART.unit).toBe("kcal a day");
    expect(PROGRAM_CHART.legend).toEqual({ estimate: "Estimate", band: "Likely range" });
    expectOnCanvas(["Expenditure by week", "kcal a day", "Estimate", "Likely range"]);
  });

  it("should give the empty state's title and body", () => {
    expect(PROGRAM_CHART.empty).toEqual({
      title: "No estimates yet",
      body: "Your expenditure shows here week by week, starting from your setup answers.",
    });
    expectOnCanvas(["No estimates yet", PROGRAM_CHART.empty.body]);
  });

  it("should sum up five weeks from the first week's figure to now, with the likely range", () => {
    expect(
      describeExpenditureChartSummary({
        weekCount: 5,
        firstWeekStart: "2026-09-21",
        firstMuKcal: 2500,
        latest: expenditureBand({ muKcal: 2579.54, varKcal2: 13449 }),
        isSettling: false,
      }),
    ).toBe(
      "Estimated expenditure over 5 weeks: 2,500 kcal a day in the week of 21 September, 2,580 now, likely 2,430 to 2,730.",
    );
    expectOnCanvas([
      "Estimated expenditure over 5 weeks: 2,500 kcal a day in the week of 21 September, 2,580 now, likely 2,430 to 2,730.",
    ]);
  });

  it("should sum up two weeks while settling as a starting estimate", () => {
    expect(
      describeExpenditureChartSummary({
        weekCount: 2,
        firstWeekStart: "2026-10-19",
        firstMuKcal: 2413.125,
        latest: { muKcal: 2413.125, lowKcal: 1950, highKcal: 2880 },
        isSettling: true,
      }),
    ).toBe(
      "Estimated expenditure over 2 weeks: 2,413 kcal a day, a starting estimate from your answers, likely 1,950 to 2,880.",
    );
    expectOnCanvas([
      "Estimated expenditure over 2 weeks: 2,413 kcal a day, a starting estimate from your answers, likely 1,950 to 2,880.",
    ]);
  });

  it("should sum up one week as this week", () => {
    expect(
      describeExpenditureChartSummary({
        weekCount: 1,
        firstWeekStart: "2026-10-19",
        firstMuKcal: 2413.125,
        latest: { muKcal: 2413.125, lowKcal: 1950, highKcal: 2880 },
        isSettling: true,
      }),
    ).toBe(
      "Estimated expenditure this week: 2,413 kcal a day, a starting estimate from your answers, likely 1,950 to 2,880.",
    );
    expectOnCanvas([
      "Estimated expenditure this week: 2,413 kcal a day, a starting estimate from your answers, likely 1,950 to 2,880.",
    ]);
  });

  it("should read a single week that is not settling as this week, never as over 1 weeks", () => {
    expect(
      describeExpenditureChartSummary({
        weekCount: 1,
        firstWeekStart: "2026-10-19",
        firstMuKcal: 2579.54,
        latest: { muKcal: 2579.54, lowKcal: 2430, highKcal: 2730 },
        isSettling: false,
      }),
    ).toBe("Estimated expenditure this week: 2,580 kcal a day, likely 2,430 to 2,730.");
  });

  it("should write the first week of a longer settling as a starting estimate over its weeks", () => {
    expect(
      describeExpenditureChartSummary({
        weekCount: 3,
        firstWeekStart: "2026-10-19",
        firstMuKcal: 2413.125,
        latest: { muKcal: 2413.125, lowKcal: 1950, highKcal: 2880 },
        isSettling: true,
      }),
    ).toBe(
      "Estimated expenditure over 3 weeks: 2,413 kcal a day, a starting estimate from your answers, likely 1,950 to 2,880.",
    );
  });
});

describe("program-edit: default, under-18, saving, save-error", () => {
  it("should give the title and the four group headings with their helpers", () => {
    expect(PROGRAM_EDIT.title).toBe("Edit programme");
    expect(PROGRAM_EDIT.groups).toEqual({
      goal: { title: "Goal" },
      rate: {
        title: "Rate",
        helper: "As a share of your body weight each week. Slower is easier to keep up.",
      },
      protein: {
        title: "Protein",
        helper: "Set first, from your weight. Fat and carbohydrate share the rest.",
      },
      dietStyle: {
        title: "Diet style",
        helper: "How the calories left after protein are split between fat and carbohydrate.",
      },
    });
    expectOnCanvas([
      "Edit programme",
      "Goal",
      "Rate",
      PROGRAM_EDIT.groups.rate.helper,
      "Protein",
      PROGRAM_EDIT.groups.protein.helper,
      "Diet style",
      PROGRAM_EDIT.groups.dietStyle.helper,
    ]);
  });

  it("should write the footnote with the expenditure estimate that stays", () => {
    expect(describeEditFootnote(2579.54)).toBe(
      "Saving changes your targets from today. Your expenditure estimate stays at 2,580 kcal a day.",
    );
    expectOnCanvas([
      "Saving changes your targets from today. Your expenditure estimate stays at 2,580 kcal a day.",
    ]);
  });

  it("should give the Save button", () => {
    expect(PROGRAM_EDIT.saveLabel).toBe("Save changes");
    expectOnCanvas(["Save changes"]);
  });

  it("should reuse the setup canvas's banners and the under-18 reason by reference", () => {
    expect(PROGRAM_EDIT.goalNotes).toBe(SETUP_GOAL_NOTES);
    expect(PROGRAM_EDIT.notOfferedUnder18).toBe(SETUP_GOAL_NOT_OFFERED_UNDER_18);
    expectOnCanvas([
      SETUP_GOAL_NOTES.default.title,
      SETUP_GOAL_NOTES.default.body,
      SETUP_GOAL_NOTES.under18.title,
      SETUP_GOAL_NOTES.under18.body,
      SETUP_GOAL_NOT_OFFERED_UNDER_18,
    ]);
  });
});

describe("targets · engine and targets · switch-to-manual", () => {
  const words = {
    programmeTitle: "Programme",
    programmeSubtitle: "Your weekly check-in sets these targets",
    thisWeek: "This week",
    since: "Since Friday 23 October",
    engineNote:
      "Your programme sets these each week. If you set your own, the weekly check-in stops.",
    setOwn: "Set my own targets",
    switchNote: "Saving your own targets ends your programme and its weekly check-in.",
    dialogTitle: "Turn off weekly check-ins?",
    dialogBody:
      "Saving your own targets ends your programme, so Ki-Lo stops adjusting them each week. You can start one again from Estimate my targets.",
    save: "Save my targets",
    keep: "Keep my programme",
  };

  it("should give the Programme row, the section heading and the date it began", () => {
    expect(PROGRAM_TARGETS_SCREEN.programRow).toEqual({
      title: words.programmeTitle,
      subtitle: words.programmeSubtitle,
      name: "Programme, your weekly check-in sets these targets",
    });
    expect(PROGRAM_TARGETS_SCREEN.thisWeek).toBe(words.thisWeek);
    expect(describeTargetsScreenSince("2026-10-23")).toBe(words.since);
    expectOnCanvas([
      words.programmeTitle,
      words.programmeSubtitle,
      words.thisWeek,
      words.since,
      "Programme, your weekly check-in sets these targets",
    ]);
  });

  it("should give the engine note, the button and the switch note", () => {
    expect(PROGRAM_TARGETS_SCREEN.engineNote).toBe(words.engineNote);
    expect(PROGRAM_TARGETS_SCREEN.setOwnTargetsLabel).toBe(words.setOwn);
    expect(PROGRAM_TARGETS_SCREEN.switchNote).toBe(words.switchNote);
    expectOnCanvas([words.engineNote, words.setOwn, words.switchNote]);
  });

  it("should give the confirm dialog, primary in tone, with Save first and Keep second", () => {
    expect(PROGRAM_TARGETS_SCREEN.dialog).toEqual({
      title: words.dialogTitle,
      body: words.dialogBody,
      confirmLabel: words.save,
      cancelLabel: words.keep,
    });
    expectOnCanvas([words.dialogTitle, words.dialogBody, words.save, words.keep]);
  });

  it("should name the setup row the dialog sends people back to", () => {
    expect(words.dialogBody).toContain(SETUP_TARGETS_ROW.title);
  });
});

describe("diary · targets-updated", () => {
  it("should give the toast and its action", () => {
    expect(PROGRAM_TOAST).toEqual({
      message: "Check-in done: new targets",
      actionLabel: "See why",
    });
    expectOnCanvas(["Check-in done: new targets", "See why"]);
  });
});

describe("setup: estimate · measured", () => {
  it("should give the heading and the expenditure row's subtitle", () => {
    expect(PROGRAM_SETUP_MEASURED).toEqual({
      heading: "Your new targets",
      expenditureSubtitle: "Measured from your weigh-ins and food log",
    });
    expectOnCanvas(["Your new targets", "Measured from your weigh-ins and food log"]);
  });

  it("should write the accuracy line with the date of the last check-in", () => {
    expect(describeMeasuredAccuracyLine("2026-10-23")).toBe(
      "Ki-Lo measured your expenditure at your last check-in, on Friday 23 October. Changing your answers keeps it and changes only your targets.",
    );
    expectOnCanvas([
      "Ki-Lo measured your expenditure at your last check-in, on Friday 23 October. Changing your answers keeps it and changes only your targets.",
    ]);
  });
});

// The canvas draws no words for check-ins that never measured. These are the tech lead's, so they are not looked up on it.
describe("setup: estimate · carried forward", () => {
  it("should give the expenditure row's subtitle and the accuracy line in the tech lead's words", () => {
    expect(PROGRAM_SETUP_CARRIED_FORWARD).toEqual({
      expenditureSubtitle: "Carried forward from your last check-in",
      accuracyLine:
        "Ki-Lo has not measured your expenditure yet, so it keeps the estimate from your last check-in. Changing your answers changes only your targets.",
    });
  });
});

describe("the program copy as a whole", () => {
  const exportedStrings = (): string[] =>
    Object.values(programCopy).flatMap((exported) =>
      typeof exported === "function" ? [] : collectStrings(exported),
    );
  const sampleOutputs = (): string[] => Object.values(samples).flatMap((sample) => sample());
  const everySentence = (): string[] => [
    ...exportedStrings(),
    ...sampleOutputs(),
    ...collectStrings(MORE_SCREEN.nutrition),
  ];

  it("should hold a good number of sentences to check", () => {
    expect(exportedStrings()).toContain("How your programme works");
    expect(sampleOutputs()).toContain("Likely 2,430 to 2,730 kcal");
    expect(everySentence().length).toBeGreaterThan(80);
  });

  it("should never write program for a person, in a constant, a sentence a function builds or a More row", () => {
    const spelledWrong = everySentence().filter((text) => /rogram(?!me)/i.test(text));

    expect(spelledWrong).toEqual([]);
  });

  it("should spell programme in the words that say it", () => {
    expect(everySentence().filter((text) => text.includes("rogramme")).length).toBeGreaterThan(10);
  });

  it("should hold no em dash, in any constant or in any sentence a function builds", () => {
    expect(everySentence().filter((text) => text.includes("—"))).toEqual([]);
  });

  it("should hold no double hyphen and join no clauses with a semicolon", () => {
    expect(everySentence().filter((text) => text.includes("--") || text.includes(";"))).toEqual([]);
  });

  it("should carry the legal sentence once, by reference, and never as a second copy in the source", () => {
    const source = readFileSync(
      path.join(import.meta.dirname, "..", "..", "src", "copy", "program.ts"),
      "utf8",
    );

    expect(source).not.toContain("are not medical advice");
  });
});
