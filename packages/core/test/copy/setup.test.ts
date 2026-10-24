import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";
import { z } from "zod";

import { collectStrings } from "./collectStrings";
import { samples } from "./samples/setup";
import {
  ACCURACY_LINE_BEFORE_CHECKIN,
  ACCURACY_LINE_WITH_CHECKIN,
  NOT_MEDICAL_ADVICE,
  SAVE_FAILED_BANNER,
  SETUP_ACTIVITY_OPTIONS,
  SETUP_DIET_OPTIONS,
  SETUP_ESTIMATE,
  SETUP_FIELDS,
  SETUP_FLOOR_ABOVE_EXPENDITURE_ADVICE,
  SETUP_GOAL_NOT_OFFERED_UNDER_18,
  SETUP_GOAL_NOTES,
  SETUP_GOAL_OPTIONS,
  SETUP_GROUP_TITLES,
  SETUP_GUARDRAIL_LINES,
  SETUP_PER_DAY,
  SETUP_PER_WEEK,
  SETUP_PROTEIN_OPTIONS,
  SETUP_QUESTIONS,
  SETUP_RATE_OPTIONS,
  SETUP_SEX_OPTIONS,
  SETUP_SHELL,
  SETUP_SUGGESTED_BADGE,
  SETUP_TARGETS_ROW,
  describeAgeLine,
  describeBirthDateProblem,
  describeHeightProblem,
  describeSetupOptionName,
  describeProteinGrams,
  describeRateAmount,
  describeRateAmountInWords,
  describeRateLine,
  describeRateOptionName,
  describeRateTitle,
  describeSetupStepLabel,
  describeSetupWeightProblem,
  describeWeighInSource,
  WEIGH_IN_SHEET,
} from "../../src/copy";
import * as setupCopy from "../../src/copy/setup";
import { ACTIVITY_LEVELS, DEFAULT_ENGINE_PARAMS } from "../../src/engine";
import {
  checkBirthDate,
  DEFAULT_DIET_STYLE,
  DEFAULT_PROTEIN_PRESET,
  DEFAULT_RATE_PCT_PER_WEEK,
  DIET_STYLES,
  GOALS,
  HEIGHT_MAX_CM,
  HEIGHT_MIN_CM,
  MAX_AGE_YEARS,
  PROTEIN_G_PER_KG,
  PROTEIN_PRESETS,
  RATE_PRESETS_PCT_PER_WEEK,
  SETUP_STEPS,
} from "../../src/setup";
import { WEIGH_IN_MAX_KG, WEIGH_IN_MIN_KG } from "../../src/weight";

import type { BirthDateReason, HeightInputReason } from "../../src/setup";
import type { WeightInputReason } from "../../src/weight";

/*
 * The words of the setup wizard (KEY-626, canvas "Ki-Lo setup wizard" version 4, boards `setup: *`). Every
 * expected string is a literal here, and each board's words are also looked up in the canvas files under
 * docs/canvas, so a literal that drifts from the approved design fails. The guardrail lines for
 * `profile_max` and `macro_fit` are the program canvas's words, because the setup canvas draws neither.
 */

const canvasDirectory = path.join(import.meta.dirname, "..", "..", "..", "..", "docs", "canvas");

const readCanvasFile = (canvas: string, file: string): string =>
  readFileSync(path.join(canvasDirectory, canvas, file), "utf8");

const canvasNotesSchema = z.object({
  notes: z.record(z.string(), z.object({ text: z.string().optional() })),
});

// The notes of a canvas are the strings inside canvas.json, and the boards write an apostrophe as \' in a script string.
const readCanvasNotes = (canvas: string): string =>
  Object.values(canvasNotesSchema.parse(JSON.parse(readCanvasFile(canvas, "canvas.json"))).notes)
    .map((note) => note.text ?? "")
    .join("\n");

const setupCanvasText = [
  readCanvasFile("setup-wizard", "SetupScreen.dc.html"),
  readCanvasFile("setup-wizard", "TargetsScreen.dc.html"),
  readCanvasNotes("setup-wizard"),
]
  .join("\n")
  .replaceAll("\\'", "'");

const programCanvasText = [
  readCanvasFile("program", "ProgramKit.dc.html"),
  readCanvasNotes("program"),
]
  .join("\n")
  .replaceAll("\\'", "'");

const wordsMissingFrom = (canvasText: string, words: readonly string[]): string[] =>
  words.filter((word) => !canvasText.includes(word));

/** Asserts that every word is on the setup canvas, so the literals below are the design's and not the author's. */
const expectOnSetupCanvas = (words: readonly string[]): void => {
  expect(wordsMissingFrom(setupCanvasText, words)).toEqual([]);
};

describe("the canvas files the words are read from", () => {
  it("should be found and hold the wizard's words", () => {
    expect(setupCanvasText).toContain("What is your sex?");
    expect(programCanvasText).toContain("Protein was lowered to");
  });
});

describe("setup: about you · sex", () => {
  const words = {
    group: "About you",
    question: "What is your sex?",
    helper:
      "Ki-Lo uses it with your age, height and weight to estimate the energy you use each day.",
    female: { title: "Female" },
    male: { title: "Male" },
    other: {
      title: "Prefer not to say",
      description: "Ki-Lo uses the average of the female and male estimates.",
    },
    escape: "I'll set my own targets",
  };

  it("should have the question, the helper line and the three options", () => {
    expect(SETUP_GROUP_TITLES.sex).toBe(words.group);
    expect(SETUP_QUESTIONS.sex).toEqual({ question: words.question, helper: words.helper });
    expect(SETUP_SEX_OPTIONS).toEqual({
      female: words.female,
      male: words.male,
      other: words.other,
    });
    expect(SETUP_SHELL.setOwnTargetsLabel).toBe(words.escape);
    expectOnSetupCanvas(collectStrings(words));
  });

  it("should read an option's title, then its description without the full stop", () => {
    expect(
      describeSetupOptionName(
        "Prefer not to say",
        "Ki-Lo uses the average of the female and male estimates.",
      ),
    ).toBe("Prefer not to say, Ki-Lo uses the average of the female and male estimates");
    expect(describeSetupOptionName("Female")).toBe("Female");
  });
});

describe("setup: about you · birth-date", () => {
  const words = {
    question: "When were you born?",
    helper: "Your age is part of the estimate.",
    labels: ["Day", "Month", "Year"],
    placeholders: ["DD", "MM", "YYYY"],
    names: ["Day of birth", "Month of birth", "Year of birth"],
    group: "Date of birth",
    ageLine: "You are 35.",
    tooYoung: "You need to be 13 or over to use Ki-Lo.",
    future: "Enter a date before today.",
    notADate: "Enter a real date.",
  };

  it("should have the question, helper, three fields and their accessible names", () => {
    expect(SETUP_QUESTIONS.birthDate).toEqual({ question: words.question, helper: words.helper });
    expect(SETUP_FIELDS.birthDate.group).toBe(words.group);
    expect([
      SETUP_FIELDS.birthDate.day,
      SETUP_FIELDS.birthDate.month,
      SETUP_FIELDS.birthDate.year,
    ]).toEqual([
      { label: "Day", placeholder: "DD", name: "Day of birth" },
      { label: "Month", placeholder: "MM", name: "Month of birth" },
      { label: "Year", placeholder: "YYYY", name: "Year of birth" },
    ]);
    expectOnSetupCanvas(collectStrings(words));
  });

  it("should say how old the person is", () => {
    expect(describeAgeLine(35)).toBe(words.ageLine);
  });

  it("should have a sentence for every birth date reason", () => {
    const sentences: ReadonlyArray<readonly [BirthDateReason, string]> = [
      ["too-young", words.tooYoung],
      ["future", words.future],
      ["not-a-date", words.notADate],
      ["too-old", "Enter a year from 1926 onwards."],
    ];

    for (const [reason, sentence] of sentences) {
      expect(describeBirthDateProblem(reason, "2026-10-23")).toBe(sentence);
    }
  });

  // The canvas's "Enter a year after 1900." is not drawn, and it is false for someone born in 1910, who is
  // refused as over 100. The sentence names the first year every date of which is accepted today.
  it("should name the earliest year from the oldest age accepted, which is 100", () => {
    expect(MAX_AGE_YEARS).toBe(100);
    expect(describeBirthDateProblem("too-old", "2026-10-23")).toBe(
      "Enter a year from 1926 onwards.",
    );
    expect(describeBirthDateProblem("too-old", "2026-01-01")).toBe(
      "Enter a year from 1926 onwards.",
    );
    expect(describeBirthDateProblem("too-old", "2031-12-31")).toBe(
      "Enter a year from 1931 onwards.",
    );
  });

  it("should accept every date from that year and refuse one a day older, by the setup rule", () => {
    expect(checkBirthDate("1926-01-01", "2026-10-23")).toEqual({ ok: true });
    expect(checkBirthDate("1925-10-23", "2026-10-23")).toEqual({ ok: false, reason: "too-old" });
  });
});

const HEIGHT_REASONS: readonly HeightInputReason[] = [
  "empty",
  "not-a-number",
  "too-low",
  "too-high",
  "too-many-decimals",
  "inches-out-of-range",
];
const WEIGHT_REASONS: readonly WeightInputReason[] = [
  "empty",
  "not-a-number",
  "too-low",
  "too-high",
  "too-many-decimals",
];

describe("setup: about you · body", () => {
  const words = {
    question: "How tall are you, and what do you weigh?",
    helper: "Your weight this morning, before you eat, is best.",
    units: { name: "Units", metric: "kg, cm", imperial: "lb, ft, in" },
    height: {
      label: "Height",
      centimetres: "Height in centimetres",
      feet: "Height, feet",
      inches: "Height, inches",
    },
    weight: { label: "Weight", kilograms: "Weight in kilograms", pounds: "Weight in pounds" },
    heightMetricProblem: "Enter a height between 100 and 250 cm.",
    heightImperialProblem: "Enter a height between 3 ft 4 in and 8 ft 2 in.",
    weightMetricProblem: "Enter a weight between 20 and 400 kg.",
    weightImperialProblem: "Enter a weight between 45 and 881 lb.",
    weighInToday: "From your weigh-in today",
    weighInOn: "From your weigh-in on 21 Oct",
  };

  it("should have the question, helper, unit switch and field names", () => {
    expect(SETUP_QUESTIONS.body).toEqual({ question: words.question, helper: words.helper });
    expect(SETUP_FIELDS.units).toEqual(words.units);
    expect(SETUP_FIELDS.height.label).toBe("Height");
    expect(SETUP_FIELDS.height.centimetres.name).toBe(words.height.centimetres);
    expect(SETUP_FIELDS.height.feet.name).toBe(words.height.feet);
    expect(SETUP_FIELDS.height.inches.name).toBe(words.height.inches);
    expect(SETUP_FIELDS.weight.label).toBe("Weight");
    expect(SETUP_FIELDS.weight.kilograms.name).toBe(words.weight.kilograms);
    expect(SETUP_FIELDS.weight.pounds.name).toBe(words.weight.pounds);
    expect([
      SETUP_FIELDS.height.centimetres.suffix,
      SETUP_FIELDS.height.feet.suffix,
      SETUP_FIELDS.height.inches.suffix,
      SETUP_FIELDS.weight.kilograms.suffix,
      SETUP_FIELDS.weight.pounds.suffix,
    ]).toEqual(["cm", "ft", "in", "kg", "lb"]);
    expectOnSetupCanvas([
      words.question,
      words.helper,
      words.units.name,
      words.units.metric,
      words.units.imperial,
      words.height.centimetres,
      words.height.feet,
      words.height.inches,
      words.weight.kilograms,
      words.weight.pounds,
    ]);
  });

  it("should give the height bounds sentence in centimetres and in feet and inches", () => {
    expect(describeHeightProblem("too-low", "cm")).toBe(words.heightMetricProblem);
    expect(describeHeightProblem("too-high", "cm")).toBe(words.heightMetricProblem);
    expect(describeHeightProblem("too-low", "ft_in")).toBe(words.heightImperialProblem);
    expect(describeHeightProblem("too-high", "ft_in")).toBe(words.heightImperialProblem);
    expectOnSetupCanvas([words.heightMetricProblem, words.heightImperialProblem]);
  });

  it("should give the weight bounds sentence in kilograms and in pounds", () => {
    expect(describeSetupWeightProblem("too-low", "kg")).toBe(words.weightMetricProblem);
    expect(describeSetupWeightProblem("too-high", "kg")).toBe(words.weightMetricProblem);
    expect(describeSetupWeightProblem("too-low", "lb")).toBe(words.weightImperialProblem);
    expect(describeSetupWeightProblem("too-high", "lb")).toBe(words.weightImperialProblem);
    expectOnSetupCanvas([words.weightMetricProblem, words.weightImperialProblem]);
  });

  it("should say where a prefilled weight came from", () => {
    expect(describeWeighInSource("2026-10-21", "2026-10-23")).toBe(words.weighInOn);
    expect(describeWeighInSource("2026-10-23", "2026-10-23")).toBe(words.weighInToday);
    expect(describeWeighInSource("2026-03-05", "2026-10-23")).toBe("From your weigh-in on 5 Mar");
    expectOnSetupCanvas([words.weighInOn]);
  });

  describe("the problem under each field", () => {
    it("should say nothing for an empty field, which only turns Continue off", () => {
      expect(describeHeightProblem("empty", "cm")).toBeNull();
      expect(describeHeightProblem("empty", "ft_in")).toBeNull();
      expect(describeSetupWeightProblem("empty", "kg")).toBeNull();
      expect(describeSetupWeightProblem("empty", "lb")).toBeNull();
    });

    it("should have a sentence for every other height reason in both units", () => {
      for (const reason of HEIGHT_REASONS.filter((candidate) => candidate !== "empty")) {
        for (const unit of ["cm", "ft_in"] as const) {
          expect(describeHeightProblem(reason, unit)).toEqual(expect.any(String));
        }
      }
    });

    it("should have a sentence for every other weight reason in both units", () => {
      for (const reason of WEIGHT_REASONS.filter((candidate) => candidate !== "empty")) {
        for (const unit of ["kg", "lb"] as const) {
          expect(describeSetupWeightProblem(reason, unit)).toEqual(expect.any(String));
        }
      }
    });

    it("should ask for a whole number of inches under 12 in the feet and inches sentence", () => {
      expect(describeHeightProblem("inches-out-of-range", "ft_in")).toBe(
        words.heightImperialProblem,
      );
    });

    it("should reuse the weigh-in sheet's one decimal place line for too many decimals", () => {
      expect(describeHeightProblem("too-many-decimals", "cm")).toBe(WEIGH_IN_SHEET.help);
      expect(WEIGH_IN_SHEET.help).toBe("Up to one decimal place.");
      expect(describeSetupWeightProblem("too-many-decimals", "kg")).toBe(
        "Up to one decimal place.",
      );
      expect(describeSetupWeightProblem("too-many-decimals", "lb")).toBe(
        "Up to one decimal place.",
      );
    });
  });

  it("should state the bounds the setup module and the weigh-in sheet enforce", () => {
    expect(HEIGHT_MIN_CM).toBe(100);
    expect(HEIGHT_MAX_CM).toBe(250);
    expect(WEIGH_IN_MIN_KG).toBe(20);
    expect(WEIGH_IN_MAX_KG).toBe(400);
  });
});

describe("setup: activity", () => {
  const words = {
    group: "Activity",
    question: "How active are you?",
    helper: "Think of a normal week: your job, getting about and exercise.",
    sedentary: { title: "Sedentary", description: "Mostly sitting, with little or no exercise." },
    light: {
      title: "Lightly active",
      description: "Some walking, or exercise 1 to 3 days a week.",
    },
    moderate: {
      title: "Moderately active",
      description: "On your feet a lot, or exercise 3 to 5 days a week.",
    },
    very: {
      title: "Very active",
      description: "A physical job, or hard exercise 6 or 7 days a week.",
    },
    extra: {
      title: "Extra active",
      description: "A physical job and daily training, or training twice a day.",
    },
  };

  it("should have the question, helper line and five options", () => {
    expect(SETUP_GROUP_TITLES.activity).toBe(words.group);
    expect(SETUP_QUESTIONS.activity).toEqual({ question: words.question, helper: words.helper });
    expect(SETUP_ACTIVITY_OPTIONS).toEqual({
      sedentary: words.sedentary,
      light: words.light,
      moderate: words.moderate,
      very: words.very,
      extra: words.extra,
    });
    expectOnSetupCanvas(collectStrings(words));
  });
});

describe("setup: goal · default", () => {
  const words = {
    group: "Goal",
    question: "What is your goal?",
    helper: "Your calorie target follows from this.",
    lose: { title: "Lose weight", description: "Eat a little less than you use." },
    maintain: { title: "Maintain weight", description: "Eat about what you use." },
    gain: { title: "Gain weight", description: "Eat a little more than you use." },
    note: {
      title: "Pregnant or breastfeeding?",
      body: "Talk to a doctor, midwife or dietitian before you set a goal. Ki-Lo's estimates do not allow for pregnancy or breastfeeding.",
    },
  };

  it("should have the question, helper line, three goals and the note", () => {
    expect(SETUP_GROUP_TITLES.goal).toBe(words.group);
    expect(SETUP_QUESTIONS.goal).toEqual({ question: words.question, helper: words.helper });
    expect(SETUP_GOAL_OPTIONS).toEqual({
      lose: words.lose,
      maintain: words.maintain,
      gain: words.gain,
    });
    expect(SETUP_GOAL_NOTES.default).toEqual(words.note);
    expectOnSetupCanvas(collectStrings(words));
  });
});

describe("setup: goal · under-18", () => {
  const words = {
    reason: "Not offered under 18.",
    note: {
      title: "Talk to a health professional",
      body: "If you are under 18 and want to lose weight, or you are pregnant or breastfeeding, talk to a doctor, midwife or dietitian first.",
    },
    loseName: "Lose weight, not offered under 18",
    maintainStepLabel: "Step 5 of 7",
  };

  it("should have the reason Lose is not offered and the under 18 note", () => {
    expect(SETUP_GOAL_NOT_OFFERED_UNDER_18).toBe(words.reason);
    expect(SETUP_GOAL_NOTES.under18).toEqual(words.note);
    expectOnSetupCanvas([words.reason, words.note.title, words.note.body, words.loseName]);
  });

  it("should name the disabled Lose card with its reason", () => {
    expect(describeSetupOptionName("Lose weight", SETUP_GOAL_NOT_OFFERED_UNDER_18)).toBe(
      words.loseName,
    );
  });

  it("should count seven steps once Maintain is chosen", () => {
    expect(describeSetupStepLabel(5, 7)).toBe(words.maintainStepLabel);
    expectOnSetupCanvas([words.maintainStepLabel]);
  });
});

describe("setup: rate · lose", () => {
  const words = {
    question: "How fast do you want to lose weight?",
    helper: "As a share of your body weight each week. Slower is easier to keep up.",
    options: [
      { title: "0.25% a week", description: "Gentle, and easy to keep up.", amount: "0.2 kg" },
      { title: "0.5% a week", description: "A steady pace.", amount: "0.4 kg" },
      { title: "0.75% a week", description: "Faster, and harder to keep up.", amount: "0.6 kg" },
      { title: "1.0% a week", description: "The fastest Ki-Lo sets.", amount: "0.8 kg" },
    ],
    badge: "Suggested",
    perWeek: "a week",
    suggestedName: "0.5% a week, suggested, a steady pace, about 0.4 kilograms a week",
  };

  it("should have the question, helper line and four rates", () => {
    expect(SETUP_GROUP_TITLES.rate).toBe("Goal");
    expect(SETUP_QUESTIONS.rate.lose).toEqual({ question: words.question, helper: words.helper });
    expect(
      SETUP_RATE_OPTIONS.lose.map((option) => ({
        title: describeRateTitle(option.ratePctPerWeek),
        description: option.description,
        amount: describeRateAmount(option.ratePctPerWeek, 80.0, "kg"),
      })),
    ).toEqual(words.options);
    expect(SETUP_SUGGESTED_BADGE).toBe(words.badge);
    expect(SETUP_PER_WEEK).toBe(words.perWeek);
    expectOnSetupCanvas([
      words.question,
      words.helper,
      words.badge,
      words.perWeek,
      words.suggestedName,
      ...words.options.flatMap((option) => [option.title, option.description, option.amount]),
    ]);
  });

  it("should mark only 0.5% as suggested", () => {
    expect(SETUP_RATE_OPTIONS.lose.map((option) => option.suggested)).toEqual([
      false,
      true,
      false,
      false,
    ]);
  });

  it("should name the suggested card with its description and weekly amount", () => {
    const [, steady] = SETUP_RATE_OPTIONS.lose;

    expect(steady && describeRateOptionName(steady, 80.0, "kg")).toBe(words.suggestedName);
  });

  it("should name a card that is not suggested without the word suggested", () => {
    const [gentle] = SETUP_RATE_OPTIONS.lose;

    expect(gentle && describeRateOptionName(gentle, 80.0, "kg")).toBe(
      "0.25% a week, gentle, and easy to keep up, about 0.2 kilograms a week",
    );
  });

  it("should write the weekly amounts in pounds for an imperial person", () => {
    expect(
      SETUP_RATE_OPTIONS.lose.map((option) =>
        describeRateAmount(option.ratePctPerWeek, 80.0, "lb"),
      ),
    ).toEqual(["0.4 lb", "0.9 lb", "1.3 lb", "1.8 lb"]);
    const [, steady] = SETUP_RATE_OPTIONS.lose;
    expect(steady && describeRateOptionName(steady, 80.0, "lb")).toBe(
      "0.5% a week, suggested, a steady pace, about 0.9 pounds a week",
    );
  });

  it("should show 0.08 kg as 0.1 kg", () => {
    expect(describeRateAmount(0.1, 80.0, "kg")).toBe("0.1 kg");
  });

  it("should say a weekly amount in words for a screen reader, in the person's unit", () => {
    expect(describeRateAmountInWords(0.5, 80.0, "kg")).toBe("about 0.4 kilograms a week");
    expect(describeRateAmountInWords(0.5, 80.0, "lb")).toBe("about 0.9 pounds a week");
    expect(describeRateAmountInWords(0.1, 80.0, "kg")).toBe("about 0.1 kilograms a week");
  });
});

describe("setup: rate · gain", () => {
  const words = {
    question: "How fast do you want to gain weight?",
    helper: "As a share of your body weight each week. Slower gains add less fat.",
    options: [
      { title: "0.1% a week", description: "Slow, and adds the least fat.", amount: "0.1 kg" },
      { title: "0.25% a week", description: "A steady pace.", amount: "0.2 kg" },
      { title: "0.5% a week", description: "The fastest Ki-Lo sets.", amount: "0.4 kg" },
    ],
  };

  it("should have the question, helper line and three rates", () => {
    expect(SETUP_QUESTIONS.rate.gain).toEqual({ question: words.question, helper: words.helper });
    expect(
      SETUP_RATE_OPTIONS.gain.map((option) => ({
        title: describeRateTitle(option.ratePctPerWeek),
        description: option.description,
        amount: describeRateAmount(option.ratePctPerWeek, 80.0, "kg"),
      })),
    ).toEqual(words.options);
    expectOnSetupCanvas([
      words.question,
      words.helper,
      ...words.options.flatMap((option) => [option.title, option.description, option.amount]),
    ]);
  });

  it("should mark only 0.25% as suggested", () => {
    expect(SETUP_RATE_OPTIONS.gain.map((option) => option.suggested)).toEqual([false, true, false]);
  });

  it("should write the weekly amounts in pounds for an imperial person", () => {
    expect(
      SETUP_RATE_OPTIONS.gain.map((option) =>
        describeRateAmount(option.ratePctPerWeek, 80.0, "lb"),
      ),
    ).toEqual(["0.2 lb", "0.4 lb", "0.9 lb"]);
  });
});

describe("setup: macros · protein", () => {
  const words = {
    group: "Macros",
    question: "How much protein?",
    helper:
      "Ki-Lo sets protein first, from your weight, then shares the rest between fat and carbohydrate.",
    moderate: {
      title: "Moderate",
      description: "1.6 g per kg of body weight. Enough for most people.",
    },
    high: { title: "High", description: "2.0 g per kg. Suits regular strength training." },
    very_high: {
      title: "Very high",
      description: "2.2 g per kg. Helps keep muscle while you lose weight.",
    },
    perDay: "a day",
    grams: ["128 g", "160 g", "176 g"],
  };

  it("should have the question, helper line and three presets", () => {
    expect(SETUP_GROUP_TITLES.protein).toBe(words.group);
    expect(SETUP_QUESTIONS.protein).toEqual({ question: words.question, helper: words.helper });
    expect(SETUP_PROTEIN_OPTIONS).toEqual({
      moderate: words.moderate,
      high: words.high,
      very_high: words.very_high,
    });
    expect(SETUP_PER_DAY).toBe(words.perDay);
    expectOnSetupCanvas([
      ...collectStrings(words.moderate),
      ...collectStrings(words.high),
      ...collectStrings(words.very_high),
      words.question,
      words.helper,
      words.perDay,
      ...words.grams,
    ]);
  });

  it("should show whole grams a day for 80.0 kg", () => {
    expect(PROTEIN_PRESETS.map((preset) => describeProteinGrams(preset, 80.0))).toEqual(
      words.grams,
    );
  });

  it("should round a half-way gram up, as the engine's macro split does", () => {
    // 2.2 g per kg of 77.5 kg is 170.5 g.
    expect(describeProteinGrams("very_high", 77.5)).toBe("171 g");
  });

  it("should name the grams per kilogram the words promise", () => {
    expect(PROTEIN_G_PER_KG).toEqual({ moderate: 1.6, high: 2.0, very_high: 2.2 });
  });
});

describe("setup: macros · diet", () => {
  const words = {
    question: "How do you like to eat?",
    helper: "This splits the calories left after protein between fat and carbohydrate.",
    balanced: { title: "Balanced", description: "A mix of both, as most people eat." },
    low_fat: {
      title: "Low fat",
      description: "More bread, rice, pasta and fruit. Less oil and butter.",
    },
    low_carb: {
      title: "Low carb",
      description: "More meat, fish, eggs, dairy and oils. Less bread and rice. Not keto.",
    },
  };

  it("should have the question, helper line and three diet styles", () => {
    expect(SETUP_QUESTIONS.diet).toEqual({ question: words.question, helper: words.helper });
    expect(SETUP_DIET_OPTIONS).toEqual({
      balanced: words.balanced,
      low_fat: words.low_fat,
      low_carb: words.low_carb,
    });
    expectOnSetupCanvas(collectStrings(words));
  });
});

describe("setup: estimate · default", () => {
  const words = {
    headerTitle: "Your estimate",
    setupComplete: "Setup complete",
    heading: "Your starting targets",
    cardTitle: "Calorie target",
    cardName: "Calorie target, estimate",
    badge: "Estimate",
    caloriesUnit: "kcal a day",
    tiles: ["Protein", "Carbohydrate", "Fat"],
    expenditureTitle: "Estimated expenditure",
    expenditureCaption: "The energy you use in a day",
    expenditureUnit: "kcal",
    start: "Start",
    saveTargets: "Save targets",
    rateLose: "To lose about 0.4 kg a week (0.5% of your weight).",
    rateGain: "To gain about 0.2 kg a week (0.25% of your weight).",
    rateMaintain: "To keep your weight about where it is.",
    accuracyBefore:
      "This is a starting estimate from your answers, and it can be out by a few hundred kcal a day. You can change these any time in Targets.",
    accuracyWith:
      "This is a starting estimate from your answers. Each week, Ki-Lo checks it against your weigh-ins and food log and adjusts your targets.",
    notMedicalAdvice:
      "Ki-Lo's estimates and targets are not medical advice. Speak to a doctor before you make big changes to your diet or your weight.",
  };

  it("should have the header, heading, card, tiles and expenditure row", () => {
    expect(SETUP_GROUP_TITLES.estimate).toBe(words.headerTitle);
    expect(SETUP_SHELL.setupCompleteName).toBe(words.setupComplete);
    expect(SETUP_ESTIMATE.heading).toBe(words.heading);
    expect(SETUP_ESTIMATE.card).toEqual({
      title: words.cardTitle,
      name: words.cardName,
      badge: words.badge,
      caloriesUnit: words.caloriesUnit,
    });
    expect(SETUP_ESTIMATE.tileLabels).toEqual({
      protein: "Protein",
      carbs: "Carbs",
      fat: "Fat",
    });
    expect(SETUP_ESTIMATE.expenditure).toEqual({
      title: words.expenditureTitle,
      caption: words.expenditureCaption,
      unit: words.expenditureUnit,
    });
    expectOnSetupCanvas([
      words.headerTitle,
      words.setupComplete,
      words.heading,
      words.cardTitle,
      words.cardName,
      words.badge,
      words.caloriesUnit,
      ...words.tiles,
      words.expenditureTitle,
      words.expenditureCaption,
      words.expenditureUnit,
    ]);
  });

  it("should label the footer button Start on the first run and Save targets in a recalculation", () => {
    expect(SETUP_SHELL.startLabel).toBe(words.start);
    expect(SETUP_SHELL.saveTargetsLabel).toBe(words.saveTargets);
    expectOnSetupCanvas([words.start, words.saveTargets]);
  });

  it("should have the rate line for each goal, in kilograms and in pounds", () => {
    expect(
      describeRateLine({ goal: "lose", ratePctPerWeek: 0.5, weightKg: 80.0, unit: "kg" }),
    ).toBe(words.rateLose);
    expect(
      describeRateLine({ goal: "gain", ratePctPerWeek: 0.25, weightKg: 80.0, unit: "kg" }),
    ).toBe(words.rateGain);
    expect(
      describeRateLine({ goal: "maintain", ratePctPerWeek: 0, weightKg: 80.0, unit: "kg" }),
    ).toBe(words.rateMaintain);
    expect(
      describeRateLine({ goal: "lose", ratePctPerWeek: 0.5, weightKg: 80.0, unit: "lb" }),
    ).toBe("To lose about 0.9 lb a week (0.5% of your weight).");
    expectOnSetupCanvas([words.rateLose, words.rateGain, words.rateMaintain]);
  });

  it("should have both accuracy lines", () => {
    expect(ACCURACY_LINE_BEFORE_CHECKIN).toBe(words.accuracyBefore);
    expect(ACCURACY_LINE_WITH_CHECKIN).toBe(words.accuracyWith);
    expectOnSetupCanvas([words.accuracyBefore, words.accuracyWith]);
  });

  it("should carry the not medical advice line of the legal copy, word for word", () => {
    expect(SETUP_ESTIMATE.notMedicalAdvice).toBe(words.notMedicalAdvice);
    expect(NOT_MEDICAL_ADVICE).toBe(words.notMedicalAdvice);
    expectOnSetupCanvas([words.notMedicalAdvice]);
  });

  it("should not copy the not medical advice line into the setup copy", () => {
    const source = readFileSync(
      path.join(import.meta.dirname, "..", "..", "src", "copy", "setup.ts"),
      "utf8",
    );

    expect(source).not.toContain("are not medical advice");
  });
});

describe("setup: estimate · guardrail", () => {
  const words = {
    floor:
      "Raised to 1,200 kcal, the lowest target Ki-Lo sets for you. You would lose about 0.3 kg a week (0.47% of your weight), not 1.0%.",
    maxDeficit:
      "Kept to a 30% deficit, the most Ki-Lo sets. You would lose about 0.9 kg a week (0.71% of your weight), not 1.0%.",
    maxSurplusTemplate:
      "Kept to a 20% surplus, the most Ki-Lo sets. You would gain about {kg} kg a week ({pct}% of your weight), not {rate}%.",
    maxSurplus:
      "Kept to a 20% surplus, the most Ki-Lo sets. You would gain about 0.3 kg a week (0.47% of your weight), not 0.5%.",
    profileMax:
      "Capped at 6,000 kcal, the most Ki-Lo sets. You would gain about 0.4 kg a week (0.26% of your weight), not 0.5%.",
    macroFit:
      "Protein was lowered to 120 g so that it fits in 1,200 kcal with the least fat Ki-Lo sets (80 g). Carbohydrate is 0 g.",
  };

  // Female, 30, 160 cm, 55.0 kg, sedentary, lose 1.0%: the effective rate is 0.474% of 55 kg.
  const floorFigures = {
    caloriesKcal: 1200,
    expenditureKcal: 1486.8,
    weightKg: 55,
    effectiveRatePctPerWeek: 0.474,
    wantedRatePctPerWeek: 1.0,
    unit: "kg",
  } as const;

  it("should have a line for exactly the five codes the setup layer shows", () => {
    expect(Object.keys(SETUP_GUARDRAIL_LINES).sort()).toEqual([
      "floor",
      "macro_fit",
      "max_deficit",
      "max_surplus",
      "profile_max",
    ]);
  });

  it("should give the floor line of the canvas", () => {
    expect(SETUP_GUARDRAIL_LINES.floor(floorFigures)).toBe(words.floor);
    expectOnSetupCanvas([words.floor]);
  });

  // Male, 40, 175 cm, 130.0 kg, lose 1.0%: 1,018.1 kcal a day is 0.712% of 130 kg.
  it("should give the max deficit line of the canvas", () => {
    expect(
      SETUP_GUARDRAIL_LINES.max_deficit({
        weightKg: 130,
        effectiveRatePctPerWeek: 0.712,
        wantedRatePctPerWeek: 1.0,
        unit: "kg",
      }),
    ).toBe(words.maxDeficit);
    expectOnSetupCanvas([words.maxDeficit]);
  });

  it("should give the max surplus line of the notes, which no board draws", () => {
    expect(
      SETUP_GUARDRAIL_LINES.max_surplus({
        weightKg: 70,
        effectiveRatePctPerWeek: 0.47,
        wantedRatePctPerWeek: 0.5,
        unit: "kg",
      }),
    ).toBe(words.maxSurplus);
    expectOnSetupCanvas([words.maxSurplusTemplate]);
  });

  it("should give the profile maximum line of the program canvas", () => {
    expect(
      SETUP_GUARDRAIL_LINES.profile_max({
        caloriesKcal: 6000,
        weightKg: 150,
        effectiveRatePctPerWeek: 0.26,
        wantedRatePctPerWeek: 0.5,
        unit: "kg",
      }),
    ).toBe(words.profileMax);
    expect(wordsMissingFrom(programCanvasText, [words.profileMax])).toEqual([]);
  });

  it("should give the macro fit line of the program canvas", () => {
    expect(
      SETUP_GUARDRAIL_LINES.macro_fit({ proteinGrams: 120, caloriesKcal: 1200, fatGrams: 80 }),
    ).toBe(words.macroFit);
    expect(wordsMissingFrom(programCanvasText, [words.macroFit])).toEqual([]);
  });

  describe("the floor above expenditure", () => {
    const programCanvasLine =
      "Raised to 1,200 kcal, the lowest target Ki-Lo sets for you. That is more than your estimated expenditure of 1,094 kcal, so you would gain about 0.1 kg a week (0.24% of your weight), not lose it.";
    const programCanvasAdvice = "Talk to a doctor or dietitian before you try to lose more weight.";

    // ADR 0002 Amendment 1, point 3: female, 50, 150 cm, 40 kg, sedentary. BMR 926.5, TDEE 1,111.8, floor 1,200,
    // so the effective rate is (1,111.8 - 1,200) / 440 = -0.200% a week of 40 kg.
    const amendmentFigures = {
      caloriesKcal: 1200,
      expenditureKcal: 1111.8,
      weightKg: 40,
      effectiveRatePctPerWeek: -0.2,
      wantedRatePctPerWeek: 0.5,
      unit: "kg",
    } as const;

    it("should give the program canvas's words for the Amendment 1 figures, not a negative loss", () => {
      expect(SETUP_GUARDRAIL_LINES.floor(amendmentFigures)).toBe(
        "Raised to 1,200 kcal, the lowest target Ki-Lo sets for you. That is more than your estimated expenditure of 1,112 kcal, so you would gain about 0.1 kg a week (0.20% of your weight), not lose it.",
      );
    });

    it("should give the program canvas's specimen word for word", () => {
      expect(
        SETUP_GUARDRAIL_LINES.floor({
          caloriesKcal: 1200,
          expenditureKcal: 1094,
          weightKg: 40,
          effectiveRatePctPerWeek: -0.24,
          wantedRatePctPerWeek: 0.5,
          unit: "kg",
        }),
      ).toBe(programCanvasLine);
      expect(wordsMissingFrom(programCanvasText, [programCanvasLine, programCanvasAdvice])).toEqual(
        [],
      );
    });

    it("should have the line that follows it on the program canvas", () => {
      expect(SETUP_FLOOR_ABOVE_EXPENDITURE_ADVICE).toBe(programCanvasAdvice);
    });

    it("should write the gain in pounds for an imperial person", () => {
      expect(SETUP_GUARDRAIL_LINES.floor({ ...amendmentFigures, unit: "lb" })).toBe(
        "Raised to 1,200 kcal, the lowest target Ki-Lo sets for you. That is more than your estimated expenditure of 1,112 kcal, so you would gain about 0.2 lb a week (0.20% of your weight), not lose it.",
      );
    });

    it("should use the same words when the effective rate is exactly zero", () => {
      expect(
        SETUP_GUARDRAIL_LINES.floor({ ...amendmentFigures, effectiveRatePctPerWeek: 0 }),
      ).toContain("That is more than your estimated expenditure");
    });

    it("should keep the loss line for a positive effective rate", () => {
      expect(
        SETUP_GUARDRAIL_LINES.floor({ ...amendmentFigures, effectiveRatePctPerWeek: 0.01 }),
      ).toContain("You would lose about");
    });
  });

  it("should write the kilograms a week in pounds for an imperial person", () => {
    expect(SETUP_GUARDRAIL_LINES.floor({ ...floorFigures, unit: "lb" })).toBe(
      "Raised to 1,200 kcal, the lowest target Ki-Lo sets for you. You would lose about 0.6 lb a week (0.47% of your weight), not 1.0%.",
    );
  });

  it("should show a rate to two decimals, a weight to one and the wanted rate with one decimal at least", () => {
    expect(
      SETUP_GUARDRAIL_LINES.max_deficit({
        weightKg: 100,
        effectiveRatePctPerWeek: 0.5,
        wantedRatePctPerWeek: 0.75,
        unit: "kg",
      }),
    ).toBe(
      "Kept to a 30% deficit, the most Ki-Lo sets. You would lose about 0.5 kg a week (0.50% of your weight), not 0.75%.",
    );
  });

  it("should name the same deficit and surplus caps as the engine", () => {
    expect(DEFAULT_ENGINE_PARAMS.targets.maxDeficitFrac).toBe(0.3);
    expect(DEFAULT_ENGINE_PARAMS.targets.maxSurplusFrac).toBe(0.2);
  });
});

describe("setup: estimate · saving", () => {
  it("should keep the label Start, which the board hides behind the spinner", () => {
    expect(SETUP_SHELL.startLabel).toBe("Start");
    expect(SETUP_SHELL.backName).toBe("Back");
    expectOnSetupCanvas(["Start", "Back"]);
  });
});

describe("setup: estimate · save-error", () => {
  const banner = "Not saved. Check your connection and try again.";

  it("should use the diary's save failed banner, which Targets has", () => {
    expect(SAVE_FAILED_BANNER).toBe(banner);
    expectOnSetupCanvas([banner]);
  });
});

describe("setup: entry · targets-row", () => {
  const words = {
    title: "Estimate my targets",
    subtitle: "From a few questions about you and your goal",
    name: "Estimate my targets, from a few questions about you and your goal",
  };

  it("should have the title, subtitle and accessible name of the row", () => {
    expect(SETUP_TARGETS_ROW).toEqual(words);
    expectOnSetupCanvas(collectStrings(words));
  });
});

describe("setup: entry · recalculate", () => {
  it("should name the Close button on the right of every step", () => {
    expect(SETUP_SHELL.closeName).toBe("Close");
    expect(SETUP_SHELL.continueLabel).toBe("Continue");
    expectOnSetupCanvas(["Close", "Continue"]);
  });
});

describe("the steps", () => {
  it("should say which step of how many", () => {
    expect(describeSetupStepLabel(3, 8)).toBe("Step 3 of 8");
    expect(describeSetupStepLabel(1, 8)).toBe("Step 1 of 8");
    expect(describeSetupStepLabel(8, 8)).toBe("Step 8 of 8");
  });

  it("should group the steps under the five titles", () => {
    expect(SETUP_GROUP_TITLES).toEqual({
      sex: "About you",
      birthDate: "About you",
      body: "About you",
      activity: "Activity",
      goal: "Goal",
      rate: "Goal",
      protein: "Macros",
      diet: "Macros",
      estimate: "Your estimate",
    });
  });
});

describe("exhaustiveness", () => {
  it("should have a title for every setup step", () => {
    expect(Object.keys(SETUP_GROUP_TITLES).sort()).toEqual([...SETUP_STEPS].sort());
  });

  it("should have an option for every activity level, goal, protein preset and diet style", () => {
    expect(Object.keys(SETUP_ACTIVITY_OPTIONS).sort()).toEqual([...ACTIVITY_LEVELS].sort());
    expect(Object.keys(SETUP_GOAL_OPTIONS).sort()).toEqual([...GOALS].sort());
    expect(Object.keys(SETUP_PROTEIN_OPTIONS).sort()).toEqual([...PROTEIN_PRESETS].sort());
    expect(Object.keys(SETUP_DIET_OPTIONS).sort()).toEqual([...DIET_STYLES].sort());
  });

  it("should have a description for every rate preset of a goal that asks for a rate", () => {
    expect(SETUP_RATE_OPTIONS.lose.map((option) => option.ratePctPerWeek)).toEqual(
      RATE_PRESETS_PCT_PER_WEEK.lose,
    );
    expect(SETUP_RATE_OPTIONS.gain.map((option) => option.ratePctPerWeek)).toEqual(
      RATE_PRESETS_PCT_PER_WEEK.gain,
    );
  });

  it("should mark the setup layer's default rate as the suggested one", () => {
    expect(SETUP_RATE_OPTIONS.lose.find((option) => option.suggested)?.ratePctPerWeek).toBe(
      DEFAULT_RATE_PCT_PER_WEEK.lose,
    );
    expect(SETUP_RATE_OPTIONS.gain.find((option) => option.suggested)?.ratePctPerWeek).toBe(
      DEFAULT_RATE_PCT_PER_WEEK.gain,
    );
  });

  it("should tell the person which protein preset and diet style are chosen on arrival", () => {
    expect(DEFAULT_PROTEIN_PRESET).toBe("moderate");
    expect(DEFAULT_DIET_STYLE).toBe("balanced");
  });
});

describe("the rate formatters", () => {
  it("should show 0.5% of 80.0 kg as 0.4 kg and 0.9 lb a week", () => {
    expect(describeRateAmount(0.5, 80.0, "kg")).toBe("0.4 kg");
    expect(describeRateAmount(0.5, 80.0, "lb")).toBe("0.9 lb");
  });

  it("should write a rate with at least one decimal", () => {
    expect(describeRateTitle(1.0)).toBe("1.0% a week");
    expect(describeRateTitle(0.5)).toBe("0.5% a week");
    expect(describeRateTitle(0.25)).toBe("0.25% a week");
    expect(describeRateTitle(0.75)).toBe("0.75% a week");
    expect(describeRateTitle(0.1)).toBe("0.1% a week");
  });
});

describe("every string of the setup copy", () => {
  const sampleOutputs = (): string[] => [
    ...Object.values(samples).flatMap((call) => call()),
    SETUP_GUARDRAIL_LINES.floor({
      caloriesKcal: 1200,
      expenditureKcal: 1486.8,
      weightKg: 55,
      effectiveRatePctPerWeek: 0.474,
      wantedRatePctPerWeek: 1,
      unit: "kg",
    }),
    SETUP_GUARDRAIL_LINES.max_deficit({
      weightKg: 130,
      effectiveRatePctPerWeek: 0.712,
      wantedRatePctPerWeek: 1,
      unit: "kg",
    }),
    SETUP_GUARDRAIL_LINES.max_surplus({
      weightKg: 70,
      effectiveRatePctPerWeek: 0.47,
      wantedRatePctPerWeek: 0.5,
      unit: "kg",
    }),
    SETUP_GUARDRAIL_LINES.profile_max({
      caloriesKcal: 6000,
      weightKg: 150,
      effectiveRatePctPerWeek: 0.26,
      wantedRatePctPerWeek: 0.5,
      unit: "kg",
    }),
    SETUP_GUARDRAIL_LINES.macro_fit({ proteinGrams: 120, caloriesKcal: 1200, fatGrams: 80 }),
  ];

  const exportedStrings = (): string[] =>
    Object.values(setupCopy).flatMap((exported) =>
      typeof exported === "function" ? [] : collectStrings(exported),
    );

  it("should hold at least the words of the shell and the estimate", () => {
    expect(exportedStrings()).toContain("Your starting targets");
    expect(sampleOutputs()).toContain("Step 3 of 8");
  });

  it("should hold no em dash, in any constant or in any sentence a function builds", () => {
    const withEmDash = [...exportedStrings(), ...sampleOutputs()].filter((text) =>
      text.includes("—"),
    );

    expect(withEmDash).toEqual([]);
  });

  // The voice test sweeps the copy module's functions, and the guardrail lines are in a record, so they are swept here.
  it("should join no clauses with a semicolon", () => {
    expect([...exportedStrings(), ...sampleOutputs()].filter((text) => text.includes(";"))).toEqual(
      [],
    );
  });

  it("should never speak as I, my or we, apart from the person's own buttons, and use no emoji", () => {
    const personsOwnWords: readonly string[] = [
      SETUP_SHELL.setOwnTargetsLabel,
      SETUP_TARGETS_ROW.title,
      SETUP_TARGETS_ROW.name,
    ];
    const kiLoSentences = [...exportedStrings(), ...sampleOutputs()].filter(
      (text) => !personsOwnWords.includes(text),
    );

    expect(kiLoSentences.filter((text) => /\b(my|we)\b/i.test(text) || /\bI\b/.test(text))).toEqual(
      [],
    );
    expect(kiLoSentences.filter((text) => /\p{Extended_Pictographic}/u.test(text))).toEqual([]);
  });

  it("should hold no double hyphen standing in for a dash", () => {
    const withDoubleHyphen = [...exportedStrings(), ...sampleOutputs()].filter((text) =>
      text.includes("--"),
    );

    expect(withDoubleHyphen).toEqual([]);
  });
});
