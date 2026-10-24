import { describeShortDate, describeWeekdayName } from "./bodyMap";
import { describeCount } from "./counts";
import { describeDateInWords } from "./diary";
import { MONTH_NAMES_LONG } from "./diaryDay";
import { RETRY_LABEL } from "./errors";
import { NOT_MEDICAL_ADVICE } from "./legal";
import {
  SETUP_FLOOR_ABOVE_EXPENDITURE_ADVICE,
  SETUP_GOAL_NOT_OFFERED_UNDER_18,
  SETUP_GOAL_NOTES,
  SETUP_GUARDRAIL_LINES,
  SETUP_PER_DAY,
  SETUP_PER_WEEK,
  SETUP_TARGETS_ROW,
  describeProteinGrams,
  describeRateAmount,
} from "./setup";
import { capitaliseFirst, lowerFirst } from "./wording";
import { addCalendarDays, parseCalendarDay } from "../dates/calendarDay";
import { DEFAULT_ENGINE_PARAMS } from "../engine";
import { formatCalories } from "../format/numbers";
import { PROTEIN_G_PER_KG, bindingCalorieClamp } from "../setup";

import type { SetupGuardrailFigures } from "./setup";
import type { MeasurementCounts, MeasurementReason } from "../engine";
import type { ExpenditureBand } from "../program";
import type { ProteinPreset, SetupClamp } from "../setup";
import type { WeightDisplayUnit } from "../weight";

/*
 * The words of the Programme screens, from the approved canvas "Ki-Lo program" (version 2, boards `more ·
 * program-row` to `setup: estimate · measured`, the repo copy is docs/canvas/program). People read "Programme"
 * and the code says `program`. Mobile now and web later read this one file. The guardrail lines the setup
 * wizard words (`max_deficit`, `max_surplus`, `floor`, `profile_max`, `macro_fit`) are `setup.ts`'s, reused.
 *
 * Numbers follow the canvas's rules: an expenditure in whole kilocalories with a thousands separator, the
 * likely range's ends as `expenditureBand` rounds them (to 10), a date as "Friday 23 October" in a sentence and
 * "Fri 30 Oct" in a row. The numbers the explainer and the lines state (4 weeks, 8, 14 and 10 days, 250 kcal,
 * 30% and 20%, 1,200 kcal, 90%, 6,000 kcal, 7,700 kcal) are the engine's, and a test keeps them equal.
 */

/** A count towards what it is working towards: "4 of 8". */
export const describeCountOfTarget = (count: number, target: number): string =>
  `${count} of ${target}`;

/** What a screen reader says for a bar that counts: the name, then the count, as in "Complete days, 4 of 10". */
export const describeCountedName = (name: string, count: number, target: number): string =>
  `${name}, ${describeCountOfTarget(count, target)}`;

const describeKcal = (kcal: number): string => `${formatCalories(kcal)} kcal`;

/** The hero's likely range, from the band `expenditureBand` returns: "Likely 2,430 to 2,730 kcal". */
export const describeLikelyRange = ({
  lowKcal,
  highKcal,
}: Pick<ExpenditureBand, "lowKcal" | "highKcal">): string =>
  `Likely ${formatCalories(lowKcal)} to ${describeKcal(highKcal)}`;

/** The Programme screen, as the boards `program: default`, `settling`, `loading` and the hero draw it. */
export const PROGRAM_SCREEN = {
  title: "Programme",
  backName: "Back to More",
  loadingName: "Loading your programme",
  hero: {
    eyebrow: "Estimated expenditure",
    estimateBadge: "Estimate",
    settlingBadge: "Settling",
    unit: "kcal a day",
    settlingLine: "A starting estimate from your answers. Your first check-in measures it.",
  },
  targets: {
    eyebrow: "This week's targets",
    unit: "kcal a day",
    nextCheckIn: "Next check-in",
    firstCheckIn: "First check-in",
  },
  details: {
    title: "Your programme",
    goal: "Goal",
    rate: "Rate",
    protein: "Protein",
    dietStyle: "Diet style",
  },
  editLabel: "Edit programme",
  howItWorksLabel: "How it works",
  /** Under the cards, muted: the legal copy's own sentence, not a second copy of it. */
  notMedicalAdvice: NOT_MEDICAL_ADVICE,
} as const;

/** What a screen reader says for the hero: "Estimated expenditure, 2,580 kilocalories a day, likely 2,430 to 2,730 kcal". */
export const describeExpenditureHeroName = (band: ExpenditureBand): string =>
  `${PROGRAM_SCREEN.hero.eyebrow}, ${formatCalories(band.muKcal)} kilocalories a day, ${lowerFirst(describeLikelyRange(band))}`;

/** Under the likely range: "From your weigh-ins and food log, updated Friday 23 October". The date is `YYYY-MM-DD`. */
export const describeExpenditureSource = (updatedOn: string): string =>
  `From your weigh-ins and food log, updated ${describeDateInWords(updatedOn)}`;

/** On the targets card, from the date the targets were set: "Since Fri 23 Oct". */
export const describeTargetsCardSince = (setOn: string): string =>
  `Since ${describeShortDate(setOn)}`;

/** What a screen reader says for the targets card: "This week's targets, 2,140 kilocalories a day". */
export const describeTargetsCardName = (caloriesKcal: number): string =>
  `${PROGRAM_SCREEN.targets.eyebrow}, ${formatCalories(caloriesKcal)} kilocalories a day`;

const describeDaysUntil = (daysLeft: number): string =>
  daysLeft <= 0 ? "today" : `in ${describeCount(daysLeft, "day", "days")}`;

/**
 * Under "Next check-in": "In 7 days, then every Friday". The weekday is the one of the check-in's date
 * (`YYYY-MM-DD`), which is the day the person set up on. A day left of 1 is "In 1 day", and of 0 is "Today".
 */
export const describeNextCheckInCaption = (daysLeft: number, checkInDate: string): string => {
  return `${capitaliseFirst(describeDaysUntil(daysLeft))}, then every ${describeWeekdayName(checkInDate)}`;
};

/** The Programme row of More while a programme runs: "Next check-in Fri 30 Oct". */
export const describeNextCheckInSubtitle = (checkInDate: string): string =>
  `${PROGRAM_SCREEN.targets.nextCheckIn} ${describeShortDate(checkInDate)}`;

/** Under "Rate" in Your programme: "About 0.4 kg a week", at the weight the targets use. */
export const describeRateSubtitle = (
  ratePctPerWeek: number,
  weightKg: number,
  unit: WeightDisplayUnit,
): string => `About ${describeRateAmount(ratePctPerWeek, weightKg, unit)} ${SETUP_PER_WEEK}`;

/** Under "Protein" in Your programme: "1.6 g per kg, about 126 g a day". */
export const describeProteinSubtitle = (preset: ProteinPreset, weightKg: number): string =>
  `${PROTEIN_G_PER_KG[preset].toFixed(1)} g per kg, about ${describeProteinGrams(preset, weightKg)} ${SETUP_PER_DAY}`;

/** The settling banner: the first check-in's date and the days left, with the words for the last two days. */
export const describeFirstCheckInBanner = (firstCheckInDate: string, daysLeft: number): string =>
  `${PROGRAM_SCREEN.targets.firstCheckIn} ${describeDateInWords(firstCheckInDate)}, ${describeDaysUntil(daysLeft)}`;

/** One count the first check-in needs: the label over the bar, the name that starts its accessible name, and the target. */
type SettlingNeed = Readonly<{ label: string; name: string; target: number }>;

/** The settling banner's words, under its title. */
export const PROGRAM_SETTLING: Readonly<{ intro: string; needs: readonly SettlingNeed[] }> = {
  intro: "Until then your targets stay as they are. The check-in needs:",
  needs: [
    { label: "Days with a weigh-in", name: "Days with a weigh-in", target: 8 },
    {
      label: "Days your weigh-ins cover, first to last",
      name: "Days your weigh-ins cover",
      target: 14,
    },
    { label: "Complete days", name: "Complete days", target: 10 },
  ],
};

/**
 * The tip under the counts, from the first check-in's date: weigh in the day before, the last day of the window,
 * so the weigh-ins can cover the full 14 days. Show it only while that can still be met and is not met yet.
 */
export const describeSettlingTip = (firstCheckInDate: string): string =>
  `Weigh in on ${describeDateInWords(addCalendarDays(firstCheckInDate, -1))}, the day before, so your weigh-ins cover the full 14 days.`;

/** The Programme screen for someone on their own targets (`program: no-program`). */
export const PROGRAM_NO_PROGRAM = {
  title: "Let Ki-Lo set your targets",
  body: "A programme sets your calorie and macro targets from your goal, then checks them each week.",
  points: [
    "Estimates the energy you use, from a few questions about you.",
    "Checks that estimate each week against your weigh-ins and food log.",
    "Adjusts your calorie and macro targets to keep you on pace for your goal.",
  ],
  /** The setup row's own words: the button opens the wizard in recalculate mode. */
  startLabel: SETUP_TARGETS_ROW.title,
  notMedicalAdvice: NOT_MEDICAL_ADVICE,
} as const;

/** Under the button: the person's own calorie target, which stays until they start. */
export const describeOwnTargetsStay = (caloriesKcal: number): string =>
  `Your own targets (${formatCalories(caloriesKcal)} kcal a day) stay until you start.`;

/** The error state (`program: error`). No raw error text is ever shown with it. */
export const PROGRAM_ERROR = {
  title: "Couldn't load your programme",
  body: "Check your connection and try again. Your targets have not changed.",
  retryLabel: RETRY_LABEL,
} as const;

/** The check-in summary card: its eyebrow, the two badges and the two row labels. */
export const PROGRAM_CHECKIN_SUMMARY = {
  eyebrow: "Last check-in",
  measured: "Measured",
  notMeasured: "Not measured",
  expenditureLabel: "Expenditure",
  calorieTargetLabel: "Calorie target",
} as const;

/** What a screen reader says for the card: "Last check-in, Friday 9 October, measured". */
export const describeCheckinSummaryName = (checkInDate: string, isMeasured: boolean): string =>
  `${PROGRAM_CHECKIN_SUMMARY.eyebrow}, ${describeDateInWords(checkInDate)}, ${
    isMeasured ? "measured" : "not measured"
  }`;

type KcalChangeOptions = Readonly<{
  /** True for an expenditure the check-in could not measure, which keeps its value. */
  carriedForward?: boolean;
}>;

/**
 * A change row's value, in whole kilocalories: "2,574 to 2,580 kcal", "2,140 kcal, no change" when the two
 * figures are the same whole number, or "2,500 kcal, carried forward" when nothing was measured.
 */
export const describeKcalChange = (
  fromKcal: number,
  toKcal: number,
  { carriedForward = false }: KcalChangeOptions = {},
): string => {
  if (carriedForward) {
    return `${describeKcal(toKcal)}, carried forward`;
  }
  if (Math.round(fromKcal) === Math.round(toKcal)) {
    return `${describeKcal(toKcal)}, no change`;
  }
  return `${formatCalories(fromKcal)} to ${describeKcal(toKcal)}`;
};

/** The data line of a measured check-in, from the counts of its window. */
export const describeCheckinDataLine = ({
  weighDays,
  completeDays,
}: Pick<MeasurementCounts, "weighDays" | "completeDays">): string =>
  `From your weight trend and the food you logged: ${weighDays} weigh-ins and ${completeDays} complete days in the last 4 weeks.`;

const describeDays = (days: number): string => describeCount(days, "day", "days");

/** One line per reason a window did not measure, keyed by the engine's reason code, from the counts it found. */
export const PROGRAM_REASON_LINES: {
  readonly [Reason in MeasurementReason]: (counts: MeasurementCounts) => string;
} = {
  span: ({ spanDays }) =>
    `Your weigh-ins cover ${describeDays(spanDays)}, first to last. A check-in needs them to cover at least 14.`,
  weigh_days: ({ weighDays }) =>
    `You weighed in on ${describeDays(weighDays)}. A check-in needs at least 8 in the last 4 weeks.`,
  complete_days: ({ completeDays }) =>
    `You completed ${describeDays(completeDays)}. A check-in needs at least 10 complete days in the last 4 weeks.`,
};

const REASON_ORDER: readonly MeasurementReason[] = ["span", "weigh_days", "complete_days"];

/** The reason lines of a check-in that did not measure, in the order span, weigh_days, complete_days, one for each reason. */
export const describeNotMeasuredReasons = (
  reasons: readonly MeasurementReason[],
  counts: MeasurementCounts,
): string[] =>
  REASON_ORDER.filter((reason) => reasons.includes(reason)).map((reason) =>
    PROGRAM_REASON_LINES[reason](counts),
  );

/** The plain line after the reasons: the estimate was carried forward, with the likely range it now has. */
export const describeCarriedForwardLine = ({
  lowKcal,
  highKcal,
}: Pick<ExpenditureBand, "lowKcal" | "highKcal">): string =>
  `So your expenditure estimate was carried forward, and it is less certain: ${lowerFirst(describeLikelyRange({ lowKcal, highKcal }))}. Your targets were worked out again from it.`;

type DowFloorFigures = Readonly<{
  /** The floor as the engine records it, unrounded: the line shows the day target it raised the day to. */
  floorKcal: number;
}>;

/** What the engine sets a day to when it raises it to the floor: the floor rounded up to its step. */
const raisedDayKcal = (floorKcal: number): number => {
  const stepKcal = DEFAULT_ENGINE_PARAMS.targets.roundToKcal;
  return Math.ceil(floorKcal / stepKcal) * stepKcal;
};
type StepClampFigures = Readonly<{
  /** The step before the weekly clamp, in kilocalories a day, signed: `expenditureRawChangeKcal`. */
  rawChangeKcal: number;
}>;

type SetupClampFigures = SetupGuardrailFigures & {
  max_rate: Readonly<{ goal: "lose" | "gain" }>;
  dow_floor: DowFloorFigures;
  dow_range: undefined;
};

/**
 * The numbers each guardrail line takes: the setup wizard's codes with theirs, the rest of `SetupClamp`, and
 * the expenditure step clamp, which is not a clamp code of the targets and so has its own.
 */
export type ProgramGuardrailFigures = { [Code in SetupClamp]: SetupClampFigures[Code] } & {
  expenditure_step: StepClampFigures;
};

export type ProgramGuardrailCode = keyof ProgramGuardrailFigures;

type GuardrailEntryOf<Code extends ProgramGuardrailCode> = Readonly<{
  code: Code;
  figures: ProgramGuardrailFigures[Code];
}>;

/** A guardrail that applied, with its figures. The check-in's recorded clamps and its step clamp go in as these. */
export type ProgramGuardrailEntry = {
  [Code in ProgramGuardrailCode]: GuardrailEntryOf<Code>;
}[ProgramGuardrailCode];

/**
 * The line of each guardrail, one per code, so a record over exactly `SetupClamp` and the step clamp. The five
 * the setup wizard words are reused as they are. Show the lines through `guardrailLineOrder`. The 250 kcal, 1.0%
 * and 0.5% are the engine's `maxWeeklyChangeKcal`, `maxLossPct` and `maxGainPct`, and a test keeps them equal.
 * `dow_range` has no line on the canvas: its words are the tech lead's, and it cannot fire in v1, as day of
 * week offsets are zero and no screen sets them.
 */
export const PROGRAM_GUARDRAIL_LINES: {
  readonly [Code in ProgramGuardrailCode]: (figures: ProgramGuardrailFigures[Code]) => string;
} = {
  expenditure_step: ({ rawChangeKcal }) =>
    `Your expenditure moved 250 kcal, the most it moves in one week. Your weigh-ins and food log pointed to a ${formatCalories(Math.abs(rawChangeKcal))} kcal ${
      rawChangeKcal < 0 ? "drop" : "rise"
    }, so it may move again at your next check-in.`,
  max_rate: ({ goal }) =>
    goal === "lose"
      ? "Set to 1.0% a week, the fastest Ki-Lo sets for losing weight."
      : "Set to 0.5% a week, the fastest Ki-Lo sets for gaining weight.",
  max_deficit: SETUP_GUARDRAIL_LINES.max_deficit,
  max_surplus: SETUP_GUARDRAIL_LINES.max_surplus,
  floor: SETUP_GUARDRAIL_LINES.floor,
  profile_max: SETUP_GUARDRAIL_LINES.profile_max,
  macro_fit: SETUP_GUARDRAIL_LINES.macro_fit,
  dow_floor: ({ floorKcal }) =>
    `Some days were raised to ${describeKcal(raisedDayKcal(floorKcal))}, the lowest daily target Ki-Lo sets for you.`,
  dow_range: () => "Some days were kept between 800 and 6,000 kcal, the range Ki-Lo sets.",
};

/** One line of the check-in summary's guardrails, and the plain line that goes under it when it has one. */
export type ProgramGuardrailLine = Readonly<{
  code: ProgramGuardrailCode;
  text: string;
  followUp: string | null;
}>;

const describeGuardrail = <Code extends ProgramGuardrailCode>({
  code,
  figures,
}: GuardrailEntryOf<Code>): string => PROGRAM_GUARDRAIL_LINES[code](figures);

/**
 * The plain line under the floor line. It follows when the floor is above expenditure, which the floor line
 * words as a gain: an effective rate that is zero or below, as `setup.ts` words it.
 */
const followUpOf = (entry: ProgramGuardrailEntry): string | null =>
  entry.code === "floor" && entry.figures.effectiveRatePctPerWeek <= 0
    ? SETUP_FLOOR_ABOVE_EXPENDITURE_ADVICE
    : null;

/**
 * The lines of the guardrails that applied, in the order step clamp, `max_rate`, the one calorie clamp that set
 * the number (`bindingCalorieClamp`, so two lines never contradict), `dow_floor`, `dow_range`, `macro_fit`.
 * A code recorded twice gives one line, and the entries can come in any order.
 */
export function guardrailLineOrder(
  entries: readonly ProgramGuardrailEntry[],
): readonly ProgramGuardrailLine[] {
  const calorieClamp = bindingCalorieClamp(entries.map((entry) => entry.code));
  const slots: readonly (ProgramGuardrailCode | undefined)[] = [
    "expenditure_step",
    "max_rate",
    calorieClamp,
    "dow_floor",
    "dow_range",
    "macro_fit",
  ];
  return slots.flatMap((slot) => {
    const entry = entries.find((candidate) => candidate.code === slot);
    return entry === undefined
      ? []
      : [{ code: entry.code, text: describeGuardrail(entry), followUp: followUpOf(entry) }];
  });
}

/** The sheet's title and button, and the legal sentence under the sections. */
export const PROGRAM_EXPLAINER = {
  title: "How your programme works",
  doneLabel: "Done",
  notMedicalAdvice: NOT_MEDICAL_ADVICE,
} as const;

type ExplainerSection = Readonly<{ title: string; text: string }>;

/**
 * The seven sections of "How your programme works", in order. The weekly check-in section names the weekday of
 * the check-in's date (`YYYY-MM-DD`), which is the day the person set up on.
 */
export const describeExplainerSections = (checkInDate: string): readonly ExplainerSection[] => [
  {
    title: "Your expenditure",
    text: "The energy you use in a day. Ki-Lo works it out from the food you log and how your weight trend moves: if your trend holds steady while you eat 2,000 kcal a day, you use about 2,000.",
  },
  {
    title: "The weekly check-in",
    text: `Every ${describeWeekdayName(checkInDate)}, the day you started, Ki-Lo looks back over the last 4 weeks. It updates your expenditure, then sets the next week's targets from it. If you have been away, it catches up one week at a time.`,
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

/** The expenditure chart card: its label, unit, legend and empty state. */
export const PROGRAM_CHART = {
  label: "Expenditure by week",
  unit: "kcal a day",
  legend: { estimate: "Estimate", band: "Likely range" },
  empty: {
    title: "No estimates yet",
    body: "Your expenditure shows here week by week, starting from your setup answers.",
  },
} as const;

type ChartSummaryInput = Readonly<{
  /** How many weeks the chart draws. */
  weekCount: number;
  /** The Monday of the first week drawn, `YYYY-MM-DD`. */
  firstWeekStart: string;
  /** The expenditure of the first week drawn, in kilocalories a day. */
  firstMuKcal: number;
  /** The newest week's estimate and likely range, as `expenditureBand` returns it. */
  latest: ExpenditureBand;
  /** True while the start snapshot is the newest, so the estimate is the one from the person's answers. */
  isSettling: boolean;
}>;

/**
 * The sentence under the chart, which is also its accessible name. Settling it says the estimate is a starting
 * one, over a week or more than one, and otherwise it reads from the first week drawn to now. A chart of one
 * week that is not settling reads as this week.
 */
export const describeExpenditureChartSummary = ({
  weekCount,
  firstWeekStart,
  firstMuKcal,
  latest,
  isSettling,
}: ChartSummaryInput): string => {
  const likely = `likely ${formatCalories(latest.lowKcal)} to ${formatCalories(latest.highKcal)}`;
  const now = describeKcal(latest.muKcal);
  if (isSettling) {
    const span = weekCount <= 1 ? "this week" : `over ${weekCount} weeks`;
    return `Estimated expenditure ${span}: ${now} a day, a starting estimate from your answers, ${likely}.`;
  }
  if (weekCount <= 1) {
    return `Estimated expenditure this week: ${now} a day, ${likely}.`;
  }
  const { day, month } = parseCalendarDay(firstWeekStart);
  return `Estimated expenditure over ${weekCount} weeks: ${describeKcal(firstMuKcal)} a day in the week of ${day} ${MONTH_NAMES_LONG[month - 1]}, ${formatCalories(latest.muKcal)} now, ${likely}.`;
};

/** Edit programme: the title, the four groups, the button, and the setup canvas's banners and reason, reused. */
export const PROGRAM_EDIT = {
  title: "Edit programme",
  groups: {
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
  },
  saveLabel: "Save changes",
  /** Under the goal cards, always shown, and different for someone under 18. */
  goalNotes: SETUP_GOAL_NOTES,
  /** On the disabled Lose card for someone aged 13 to 17. */
  notOfferedUnder18: SETUP_GOAL_NOT_OFFERED_UNDER_18,
} as const;

/** The footnote above Save: a save keeps the newest expenditure estimate and only works the targets out again. */
export const describeEditFootnote = (expenditureKcal: number): string =>
  `Saving changes your targets from today. Your expenditure estimate stays at ${describeKcal(expenditureKcal)} a day.`;

/** Targets while a programme runs (`targets · engine`) and the switch to the person's own (`targets · switch-to-manual`). */
export const PROGRAM_TARGETS_SCREEN = {
  programRow: {
    title: "Programme",
    subtitle: "Your weekly check-in sets these targets",
    name: "Programme, your weekly check-in sets these targets",
  },
  thisWeek: "This week",
  /** The name of the list of this week's four targets, for a screen reader. */
  thisWeekList: "This week's targets",
  engineNote:
    "Your programme sets these each week. If you set your own, the weekly check-in stops.",
  setOwnTargetsLabel: "Set my own targets",
  switchNote: "Saving your own targets ends your programme and its weekly check-in.",
  /** The dialog on Save, primary in tone: Save first, Keep second. Keep changes nothing. */
  dialog: {
    title: "Turn off weekly check-ins?",
    body: `Saving your own targets ends your programme, so Ki-Lo stops adjusting them each week. You can start one again from ${SETUP_TARGETS_ROW.title}.`,
    confirmLabel: "Save my targets",
    cancelLabel: "Keep my programme",
  },
} as const;

/** On the Targets screen, from the date the targets were set: "Since Friday 23 October". */
export const describeTargetsScreenSince = (setOn: string): string =>
  `Since ${describeDateInWords(setOn)}`;

/** The diary's toast after a check-in that changed the calorie target. */
export const PROGRAM_TOAST = {
  message: "Check-in done: new targets",
  actionLabel: "See why",
} as const;

/** The setup estimate in recalculate mode after the engine has measured. */
export const PROGRAM_SETUP_MEASURED = {
  heading: "Your new targets",
  expenditureSubtitle: "Measured from your weigh-ins and food log",
} as const;

/** The estimate's accuracy line after a measurement, from the date of the last check-in. */
export const describeMeasuredAccuracyLine = (measuredOn: string): string =>
  `Ki-Lo measured your expenditure at your last check-in, on ${describeDateInWords(measuredOn)}. Changing your answers keeps it and changes only your targets.`;
