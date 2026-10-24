import { MONTH_NAMES_SHORT } from "./diaryDay";
import { NOT_MEDICAL_ADVICE } from "./legal";
import { describeWeightProblem, WEIGH_IN_SHEET } from "./weight";
import { formatCalories, formatGrams } from "../format/numbers";
import {
  DEFAULT_RATE_PCT_PER_WEEK,
  HEIGHT_MAX_CM,
  HEIGHT_MIN_CM,
  MAX_AGE_YEARS,
  PROTEIN_G_PER_KG,
  ratePerWeekKg,
} from "../setup";
import { displayWeight, kgToLb, WEIGH_IN_MAX_KG, WEIGH_IN_MIN_KG } from "../weight";

import type { ActivityLevel, Sex } from "../engine";
import type {
  BirthDateReason,
  DietStyle,
  HeightInputReason,
  HeightUnit,
  ProteinPreset,
  RateGoal,
  SetupGoal,
  SetupStep,
} from "../setup";
import type { WeightDisplayUnit, WeightInputReason } from "../weight";

/*
 * The words of the setup wizard, from the approved canvas "Ki-Lo setup wizard" (version 4, boards `setup: *`,
 * the repo copy is docs/canvas/setup-wizard). The two guardrail lines the setup canvas does not draw are the
 * program canvas's: `profile_max` and `macro_fit`. Mobile now and web later read this one file.
 */

/** The wizard's header, footer and escape. "Start" is the estimate's button on the first run. */
export const SETUP_SHELL = {
  backName: "Back",
  closeName: "Close",
  continueLabel: "Continue",
  startLabel: "Start",
  saveTargetsLabel: "Save targets",
  setOwnTargetsLabel: "I'll set my own targets",
  /** The progress bar's name on the estimate, which stands one stop after the last question. */
  setupCompleteName: "Setup complete",
} as const;

/** The header's title on each step: the group the step belongs to. The rate belongs to Goal. */
export const SETUP_GROUP_TITLES: Readonly<Record<SetupStep, string>> = {
  sex: "About you",
  birthDate: "About you",
  body: "About you",
  activity: "Activity",
  goal: "Goal",
  rate: "Goal",
  protein: "Macros",
  diet: "Macros",
  estimate: "Your estimate",
};

/** The header's subtitle and the progress bar's name: "Step 3 of 8", or "of 7" once Maintain skips the rate. */
export const describeSetupStepLabel = (stepNumber: number, stepCount: number): string =>
  `Step ${stepNumber} of ${stepCount}`;

type Question = Readonly<{ question: string; helper: string }>;

type SetupQuestions = Readonly<
  Record<"sex" | "birthDate" | "body" | "activity" | "goal" | "protein" | "diet", Question> & {
    /** The rate is only asked for a goal that moves the weight, and its question names the direction. */
    rate: Readonly<Record<RateGoal, Question>>;
  }
>;

/** Each step's question, in the h1, with the one helper line under it. */
export const SETUP_QUESTIONS: SetupQuestions = {
  sex: {
    question: "What is your sex?",
    helper:
      "Ki-Lo uses it with your age, height and weight to estimate the energy you use each day.",
  },
  birthDate: {
    question: "When were you born?",
    helper: "Your age is part of the estimate.",
  },
  body: {
    question: "How tall are you, and what do you weigh?",
    helper: "Your weight this morning, before you eat, is best.",
  },
  activity: {
    question: "How active are you?",
    helper: "Think of a normal week: your job, getting about and exercise.",
  },
  goal: {
    question: "What is your goal?",
    helper: "Your calorie target follows from this.",
  },
  rate: {
    lose: {
      question: "How fast do you want to lose weight?",
      helper: "As a share of your body weight each week. Slower is easier to keep up.",
    },
    gain: {
      question: "How fast do you want to gain weight?",
      helper: "As a share of your body weight each week. Slower gains add less fat.",
    },
  },
  protein: {
    question: "How much protein?",
    helper:
      "Ki-Lo sets protein first, from your weight, then shares the rest between fat and carbohydrate.",
  },
  diet: {
    question: "How do you like to eat?",
    helper: "This splits the calories left after protein between fat and carbohydrate.",
  },
};

/** An option card's title, and the line under it when there is one. */
export type SetupOptionWords = Readonly<{ title: string; description?: string }>;

/** "Prefer not to say" is stored as `other`. */
export const SETUP_SEX_OPTIONS: Readonly<Record<Sex, SetupOptionWords>> = {
  female: { title: "Female" },
  male: { title: "Male" },
  other: {
    title: "Prefer not to say",
    description: "Ki-Lo uses the average of the female and male estimates.",
  },
};

/** The activity factors are not shown. */
export const SETUP_ACTIVITY_OPTIONS: Readonly<Record<ActivityLevel, SetupOptionWords>> = {
  sedentary: { title: "Sedentary", description: "Mostly sitting, with little or no exercise." },
  light: { title: "Lightly active", description: "Some walking, or exercise 1 to 3 days a week." },
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

export const SETUP_GOAL_OPTIONS: Readonly<Record<SetupGoal, SetupOptionWords>> = {
  lose: { title: "Lose weight", description: "Eat a little less than you use." },
  maintain: { title: "Maintain weight", description: "Eat about what you use." },
  gain: { title: "Gain weight", description: "Eat a little more than you use." },
};

/** The reason on the disabled Lose card, with an Info icon, for someone aged 13 to 17. */
export const SETUP_GOAL_NOT_OFFERED_UNDER_18 = "Not offered under 18.";

/** The note under the goal options: always shown, and different for someone under 18. */
export const SETUP_GOAL_NOTES = {
  default: {
    title: "Pregnant or breastfeeding?",
    body: "Talk to a doctor, midwife or dietitian before you set a goal. Ki-Lo's estimates do not allow for pregnancy or breastfeeding.",
  },
  under18: {
    title: "Talk to a health professional",
    body: "If you are under 18 and want to lose weight, or you are pregnant or breastfeeding, talk to a doctor, midwife or dietitian first.",
  },
} as const;

/** The badge on the rate that is chosen on arrival. */
export const SETUP_SUGGESTED_BADGE = "Suggested";

/** Under each rate's weekly amount, and after a rate's percentage. */
export const SETUP_PER_WEEK = "a week";

/** Under each protein preset's grams. */
export const SETUP_PER_DAY = "a day";

/** One rate card: the percentage of body weight a week, the line under it and whether it is the default. */
export type SetupRateOption = Readonly<{
  ratePctPerWeek: number;
  description: string;
  suggested: boolean;
}>;

const rateOptions = (
  goal: RateGoal,
  words: ReadonlyArray<readonly [ratePctPerWeek: number, description: string]>,
): readonly SetupRateOption[] =>
  words.map(([ratePctPerWeek, description]) => ({
    ratePctPerWeek,
    description,
    suggested: ratePctPerWeek === DEFAULT_RATE_PCT_PER_WEEK[goal],
  }));

/** The rate cards, in the order drawn. Maintain skips the step. */
export const SETUP_RATE_OPTIONS: Readonly<Record<RateGoal, readonly SetupRateOption[]>> = {
  lose: rateOptions("lose", [
    [0.25, "Gentle, and easy to keep up."],
    [0.5, "A steady pace."],
    [0.75, "Faster, and harder to keep up."],
    [1.0, "The fastest Ki-Lo sets."],
  ]),
  gain: rateOptions("gain", [
    [0.1, "Slow, and adds the least fat."],
    [0.25, "A steady pace."],
    [0.5, "The fastest Ki-Lo sets."],
  ]),
};

/** The g per kg in these lines are the setup layer's `PROTEIN_G_PER_KG`, and a test keeps them equal. */
export const SETUP_PROTEIN_OPTIONS: Readonly<Record<ProteinPreset, SetupOptionWords>> = {
  moderate: {
    title: "Moderate",
    description: "1.6 g per kg of body weight. Enough for most people.",
  },
  high: { title: "High", description: "2.0 g per kg. Suits regular strength training." },
  very_high: {
    title: "Very high",
    description: "2.2 g per kg. Helps keep muscle while you lose weight.",
  },
};

/** The fat fractions behind these are not shown, and there is no keto option. */
export const SETUP_DIET_OPTIONS: Readonly<Record<DietStyle, SetupOptionWords>> = {
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

type DateOfBirthField = Readonly<{ label: string; placeholder: string; name: string }>;
type UnitField = Readonly<{ name: string; suffix: string }>;

/** The labels, placeholders, unit suffixes and accessible names of the wizard's fields. */
export const SETUP_FIELDS = {
  birthDate: {
    group: "Date of birth",
    day: { label: "Day", placeholder: "DD", name: "Day of birth" } satisfies DateOfBirthField,
    month: { label: "Month", placeholder: "MM", name: "Month of birth" } satisfies DateOfBirthField,
    year: { label: "Year", placeholder: "YYYY", name: "Year of birth" } satisfies DateOfBirthField,
  },
  units: { name: "Units", metric: "kg, cm", imperial: "lb, ft, in" },
  height: {
    label: "Height",
    centimetres: { name: "Height in centimetres", suffix: "cm" } satisfies UnitField,
    feet: { name: "Height, feet", suffix: "ft" } satisfies UnitField,
    inches: { name: "Height, inches", suffix: "in" } satisfies UnitField,
  },
  weight: {
    label: "Weight",
    kilograms: { name: "Weight in kilograms", suffix: "kg" } satisfies UnitField,
    pounds: { name: "Weight in pounds", suffix: "lb" } satisfies UnitField,
  },
} as const;

/** The first word of these stays capitalised when a sentence is read inside a longer one. */
const PROPER_NOUNS = ["Ki-Lo"];

/** A sentence read as a phrase inside a screen reader name: its full stop dropped and its first letter lowered. */
const asPhrase = (sentence: string): string => {
  const withoutFullStop = sentence.replace(/\.$/, "");
  const keepsCapital = PROPER_NOUNS.some((noun) => withoutFullStop.startsWith(noun));
  return keepsCapital
    ? withoutFullStop
    : withoutFullStop.charAt(0).toLowerCase() + withoutFullStop.slice(1);
};

/**
 * What a screen reader says for an option card: the title, then the line under it or the reason it is
 * disabled, such as "Prefer not to say, Ki-Lo uses the average of the female and male estimates" and
 * "Lose weight, not offered under 18".
 */
export const describeSetupOptionName = (title: string, detail?: string): string =>
  detail === undefined ? title : `${title}, ${asPhrase(detail)}`;

/** A rate to at least one decimal, as the cards write it: 1.0, 0.5, 0.25. */
const formatRatePercent = (ratePctPerWeek: number): string =>
  Number.isInteger(ratePctPerWeek * 10) ? ratePctPerWeek.toFixed(1) : String(ratePctPerWeek);

/** A rate card's title: "0.5% a week". */
export const describeRateTitle = (ratePctPerWeek: number): string =>
  `${formatRatePercent(ratePctPerWeek)}% ${SETUP_PER_WEEK}`;

const weeklyAmountNumber = (kilograms: number, unit: WeightDisplayUnit): string =>
  displayWeight(kilograms, unit).toFixed(1);

/** What a rate is worth a week at this weight, to one decimal in the person's unit: "0.4 kg", and 0.08 kg is "0.1 kg". */
export const describeRateAmount = (
  ratePctPerWeek: number,
  weightKg: number,
  unit: WeightDisplayUnit,
): string => `${weeklyAmountNumber(ratePerWeekKg(ratePctPerWeek, weightKg), unit)} ${unit}`;

/** What a screen reader says for a rate's weekly amount: "about 0.4 kilograms a week", in the person's unit. */
export const describeRateAmountInWords = (
  ratePctPerWeek: number,
  weightKg: number,
  unit: WeightDisplayUnit,
): string => {
  const unitInWords = unit === "kg" ? "kilograms" : "pounds";
  const amount = weeklyAmountNumber(ratePerWeekKg(ratePctPerWeek, weightKg), unit);
  return `about ${amount} ${unitInWords} ${SETUP_PER_WEEK}`;
};

/**
 * What a screen reader says for a rate card, as in "0.5% a week, suggested, a steady pace, about 0.4 kilograms
 * a week": the title, "suggested" when it is the default, the line under it and the weekly amount in words.
 */
export const describeRateOptionName = (
  option: SetupRateOption,
  weightKg: number,
  unit: WeightDisplayUnit,
): string =>
  [
    describeRateTitle(option.ratePctPerWeek),
    ...(option.suggested ? ["suggested"] : []),
    asPhrase(option.description),
    describeRateAmountInWords(option.ratePctPerWeek, weightKg, unit),
  ].join(", ");

/** A protein preset's grams a day for this weight, whole grams in either unit: "128 g". */
export const describeProteinGrams = (preset: ProteinPreset, weightKg: number): string =>
  `${Math.round(PROTEIN_G_PER_KG[preset] * weightKg)} g`;

/** Under the date fields once they hold a valid date: "You are 35." */
export const describeAgeLine = (ageInYears: number): string => `You are ${ageInYears}.`;

const describeDayAndMonth = (calendarDate: string): string => {
  const [, month, day] = calendarDate.split("-").map(Number);
  return `${day} ${MONTH_NAMES_SHORT[(month ?? 1) - 1]}`;
};

/** Under a prefilled weight: "From your weigh-in today", or "From your weigh-in on 21 Oct". Both are `YYYY-MM-DD`. */
export const describeWeighInSource = (weighInDate: string, today: string): string =>
  weighInDate === today
    ? "From your weigh-in today"
    : `From your weigh-in on ${describeDayAndMonth(weighInDate)}`;

/**
 * Under the date fields, keyed by the reason code of `checkBirthDate`, with today as `YYYY-MM-DD`. The line for
 * `too-old` names the first year every date of which is accepted today: `MAX_AGE_YEARS` before this year. The
 * canvas drew no such line, and "after 1900" would be false for someone born in 1910, who is refused as over 100.
 */
export const describeBirthDateProblem = (reason: BirthDateReason, today: string): string => {
  switch (reason) {
    case "too-young":
      return "You need to be 13 or over to use Ki-Lo.";
    case "future":
      return "Enter a date before today.";
    case "not-a-date":
      return "Enter a real date.";
    case "too-old":
      return `Enter a year from ${Number(today.slice(0, 4)) - MAX_AGE_YEARS} onwards.`;
  }
};

const CENTIMETRES_PER_INCH = 2.54;
const INCHES_PER_FOOT = 12;

const describeFeetAndInches = (totalInches: number): string =>
  `${Math.floor(totalInches / INCHES_PER_FOOT)} ft ${totalInches % INCHES_PER_FOOT} in`;

const HEIGHT_RANGE_IN_CENTIMETRES = `Enter a height between ${HEIGHT_MIN_CM} and ${HEIGHT_MAX_CM} cm.`;

// Rounded inwards, so that the shortest and tallest heights named are heights the setup accepts.
const HEIGHT_RANGE_IN_FEET_AND_INCHES = `Enter a height between ${describeFeetAndInches(Math.ceil(HEIGHT_MIN_CM / CENTIMETRES_PER_INCH))} and ${describeFeetAndInches(Math.floor(HEIGHT_MAX_CM / CENTIMETRES_PER_INCH))}.`;

/**
 * Under the height field, keyed by the reason code of `parseHeightInput`, or null when nothing is wrong:
 * an empty field only turns Continue off. Every reason about the number itself shares the range sentence,
 * as the weigh-in sheet does for a weight, and too many decimals reuses that sheet's own line. The canvas
 * words only the range.
 */
export const describeHeightProblem = (
  reason: HeightInputReason,
  unit: HeightUnit,
): string | null => {
  switch (reason) {
    case "empty":
      return null;
    case "too-many-decimals":
      return WEIGH_IN_SHEET.help;
    case "not-a-number":
    case "too-low":
    case "too-high":
    case "inches-out-of-range":
      return unit === "cm" ? HEIGHT_RANGE_IN_CENTIMETRES : HEIGHT_RANGE_IN_FEET_AND_INCHES;
  }
};

const POUNDS_PER_KILOGRAM = kgToLb(1);

/**
 * Under the weight field, keyed by the reason code of `parseWeightInput`, or null for an empty field. Kilograms
 * give the weigh-in sheet's own sentence. Pounds give the same bounds rounded inwards, 45 and 881.
 */
export const describeSetupWeightProblem = (
  reason: WeightInputReason,
  unit: WeightDisplayUnit,
): string | null => {
  const metricProblem = describeWeightProblem(reason);
  if (unit === "kg" || metricProblem === null || reason === "too-many-decimals") {
    return metricProblem;
  }
  const lowest = Math.ceil(POUNDS_PER_KILOGRAM * WEIGH_IN_MIN_KG);
  const highest = Math.floor(POUNDS_PER_KILOGRAM * WEIGH_IN_MAX_KG);
  return `Enter a weight between ${lowest} and ${highest} lb.`;
};

type RateFigures = Readonly<{
  /** The weight the rate is a share of, in kilograms. */
  weightKg: number;
  /** The rate the final calories imply, in percent of body weight a week, as a positive number. */
  effectiveRatePctPerWeek: number;
  /** The rate that was asked for, in percent of body weight a week. */
  wantedRatePctPerWeek: number;
  unit: WeightDisplayUnit;
}>;

type CalorieFigures = RateFigures & Readonly<{ caloriesKcal: number }>;

type FloorFigures = CalorieFigures &
  Readonly<{
    /** The estimated expenditure, in kilocalories a day: the floor can be above it. */
    expenditureKcal: number;
  }>;

type MacroFitFigures = Readonly<{ proteinGrams: number; caloriesKcal: number; fatGrams: number }>;

/** The numbers each guardrail line takes. */
export type SetupGuardrailFigures = {
  max_deficit: RateFigures;
  max_surplus: RateFigures;
  floor: FloorFigures;
  profile_max: CalorieFigures;
  macro_fit: MacroFitFigures;
};

export type SetupGuardrailCode = keyof SetupGuardrailFigures;

/** "about 0.3 kg a week (0.47% of your weight), not 1.0%": the weight to one decimal, the effective rate to two. */
const describeRateAgainstWanted = (
  verb: "lose" | "gain",
  { weightKg, effectiveRatePctPerWeek, wantedRatePctPerWeek, unit }: RateFigures,
): string => {
  const weeklyKg = (weightKg * effectiveRatePctPerWeek) / 100;
  return `You would ${verb} about ${weeklyAmountNumber(weeklyKg, unit)} ${unit} ${SETUP_PER_WEEK} (${effectiveRatePctPerWeek.toFixed(2)}% of your weight), not ${formatRatePercent(wantedRatePctPerWeek)}%.`;
};

/**
 * What the floor leaves of the rate. Usually it is a slower loss. When the floor is above expenditure the
 * effective rate is zero or negative, so the person would gain, and these are the program canvas's words for it
 * (ADR 0002, Amendment 1, `deriveTargets` point 3). Zero takes the same line.
 */
const describeFloorOutcome = (figures: FloorFigures): string => {
  if (figures.effectiveRatePctPerWeek > 0) {
    return describeRateAgainstWanted("lose", figures);
  }
  const gainedKg = (figures.weightKg * -figures.effectiveRatePctPerWeek) / 100;
  return `That is more than your estimated expenditure of ${formatCalories(figures.expenditureKcal)} kcal, so you would gain about ${weeklyAmountNumber(gainedKg, figures.unit)} ${figures.unit} ${SETUP_PER_WEEK} (${Math.abs(figures.effectiveRatePctPerWeek).toFixed(2)}% of your weight), not lose it.`;
};

/** The plain line after the floor line when the floor is above expenditure, as the program canvas has it. */
export const SETUP_FLOOR_ABOVE_EXPENDITURE_ADVICE =
  "Talk to a doctor or dietitian before you try to lose more weight.";

/**
 * The line that replaces the rate line when a guardrail changed the result, one per code, so a record over
 * exactly these five and not over the engine's whole `Clamp`. Show only the line of the clamp that set the
 * final number (`bindingCalorieClamp`), then `macro_fit` under it. The 30% and 20% are `maxDeficitFrac` and
 * `maxSurplusFrac`, and a test keeps them equal. The floor line has a second form for a floor above expenditure,
 * which then takes `SETUP_FLOOR_ABOVE_EXPENDITURE_ADVICE` as the line after it.
 */
export const SETUP_GUARDRAIL_LINES: {
  readonly [Code in SetupGuardrailCode]: (figures: SetupGuardrailFigures[Code]) => string;
} = {
  max_deficit: (figures) =>
    `Kept to a 30% deficit, the most Ki-Lo sets. ${describeRateAgainstWanted("lose", figures)}`,
  max_surplus: (figures) =>
    `Kept to a 20% surplus, the most Ki-Lo sets. ${describeRateAgainstWanted("gain", figures)}`,
  floor: (figures) =>
    `Raised to ${formatCalories(figures.caloriesKcal)} kcal, the lowest target Ki-Lo sets for you. ${describeFloorOutcome(figures)}`,
  profile_max: (figures) =>
    `Capped at ${formatCalories(figures.caloriesKcal)} kcal, the most Ki-Lo sets. ${describeRateAgainstWanted("gain", figures)}`,
  macro_fit: ({ proteinGrams, caloriesKcal, fatGrams }) =>
    `Protein was lowered to ${formatGrams(proteinGrams)} g so that it fits in ${formatCalories(caloriesKcal)} kcal with the least fat Ki-Lo sets (${formatGrams(fatGrams)} g). Carbohydrate is 0 g.`,
};

/** The estimate's accuracy line until the weekly check-in ships. */
export const ACCURACY_LINE_BEFORE_CHECKIN =
  "This is a starting estimate from your answers, and it can be out by a few hundred kcal a day. You can change these any time in Targets.";

/** The estimate's accuracy line once the weekly check-in ships (Setup wizard 18 switches it on). */
export const ACCURACY_LINE_WITH_CHECKIN =
  "This is a starting estimate from your answers. Each week, Ki-Lo checks it against your weigh-ins and food log and adjusts your targets.";

/** The estimate step: its heading, the calorie card, the macro tiles and the expenditure row. */
export const SETUP_ESTIMATE = {
  heading: "Your starting targets",
  card: {
    title: "Calorie target",
    name: "Calorie target, estimate",
    badge: "Estimate",
    caloriesUnit: "kcal a day",
  },
  tileLabels: { protein: "Protein", carbohydrate: "Carbohydrate", fat: "Fat" },
  expenditure: {
    title: "Estimated expenditure",
    caption: "The energy you use in a day",
    unit: "kcal",
  },
  /** Under the accuracy line. It is the legal copy's own sentence, not a second copy of it. */
  notMedicalAdvice: NOT_MEDICAL_ADVICE,
} as const;

type RateLineInput = Readonly<{
  goal: SetupGoal;
  /** The rate that was chosen, in percent of body weight a week. It is ignored for `maintain`. */
  ratePctPerWeek: number;
  weightKg: number;
  unit: WeightDisplayUnit;
}>;

/** The line under the calorie numeral when no guardrail changed the result. */
export const describeRateLine = ({
  goal,
  ratePctPerWeek,
  weightKg,
  unit,
}: RateLineInput): string => {
  if (goal === "maintain") {
    return "To keep your weight about where it is.";
  }
  const amount = describeRateAmount(ratePctPerWeek, weightKg, unit);
  return `To ${goal} about ${amount} a week (${formatRatePercent(ratePctPerWeek)}% of your weight).`;
};

/** The Targets screen's row that opens the wizard in recalculate mode. */
export const SETUP_TARGETS_ROW = {
  title: "Estimate my targets",
  subtitle: "From a few questions about you and your goal",
  name: "Estimate my targets, from a few questions about you and your goal",
} as const;
