import { DAY_STEPPER, MONTH_NAMES_SHORT, WEEKDAY_NAMES_SHORT } from "./diaryDay";
import { isCalendarDay, parseCalendarDay } from "../dates/calendarDay";
import { describeDay } from "../dates/describeDay";
import { formatClockTime } from "../dates/formatClockTime";
import { toLocalDate } from "../dates/toLocalDate";
import { DEFAULT_ENGINE_PARAMS } from "../engine/params";
import { formatWeight } from "../format/numbers";
import { WEIGH_IN_MAX_KG, WEIGH_IN_MIN_KG, TREND_SETTLED_OBS } from "../weight/bounds";

import type { WeightInputReason } from "../weight/parseWeightInput";
import type { WeightRange } from "../weight/types";

/**
 * The words of the Weight screen, the weigh-in sheet, the Health access screen and the trend explainer (M5), written out here so every platform prints the
 * same text. They come from the canvas "Ki-Lo M5 screens", versions 9 and 10, and the board of each is named below.
 * Health Connect is the only service Ki-Lo reads from, so no string names any other.
 */

/** The only health service Ki-Lo reads weigh-ins from. */
export const HEALTH_CONNECT_NAME = "Health Connect";

const TRUE_MINUS_SIGN = "−";

/** The Weight screen's own words, as `weight: chart and weigh-ins` draws them. */
export const WEIGHT_SCREEN = {
  title: "Weight",
  backLabel: "Back to More",
  addLabel: "Add weigh-in",
  explainerLabel: "How the trend works",
  /** The name of the region of skeletons in the `loading` state. */
  loadingLabel: "Loading your weigh-ins",
  listHeading: "Weigh-ins",
  /** The badge on a weigh-in the trend ignored. */
  leftOutBadge: "Left out of trend",
  trendCardName: "Trend weight",
  settlingBadge: "Settling",
  unit: "kg",
  rangeGroupLabel: "Chart range",
  legend: { trend: "Trend", weighIn: "Weigh-in", leftOut: "Left out" },
  /** The last tick of the chart's x-axis. */
  chartToday: "Today",
} as const;

/** The `error` state: its title, body and retry button. */
export const WEIGHT_ERROR = {
  title: "Couldn't load your weigh-ins",
  body: "Check your connection and try again. Nothing you logged has been lost.",
  retry: "Try again",
} as const;

/** The `empty` state: its title, body and two actions. */
export const WEIGHT_EMPTY = {
  title: "No weigh-ins yet",
  body: `Add one now, or bring in readings from your smart scale through ${HEALTH_CONNECT_NAME}. Your trend starts after the first weigh-in.`,
  addWeighIn: "Add weigh-in",
  connectHealth: `Connect ${HEALTH_CONNECT_NAME}`,
} as const;

/**
 * The status beside the Weigh-ins heading. `importing` is the banner of `importing`, `checking` replaces the
 * last import line while it runs, and `connect` is the link of `not-connected`. `describeLastImport` writes
 * the line the rest of the time.
 */
export const WEIGHT_IMPORT_STATUS = {
  importing: `Importing from ${HEALTH_CONNECT_NAME}`,
  checking: "Checking for new readings",
  connect: `Connect ${HEALTH_CONNECT_NAME}`,
} as const;

/** The chart range control's labels, in days. */
export const WEIGHT_RANGE_LABELS: Readonly<Record<WeightRange, string>> = {
  7: "1 week",
  30: "30 days",
  90: "90 days",
  365: "1 year",
};

const CHART_SPAN_WORDS: Readonly<Record<WeightRange, string>> = {
  7: "week",
  30: "30 days",
  90: "90 days",
  365: "year",
};

// A describer never throws and never prints "NaN". A number that is not finite is written as nothing,
// or as zero for a count, and a date or time it cannot read is left out. The fallbacks hold no weight
// beyond the one the caller passed in, and never a note or an id.
const countOrZero = (count: number): number => (Number.isFinite(count) ? count : 0);

/**
 * The chart's name for a screen reader: "Weight over the last week, trend 83.1 kg". With a trend that is
 * not a number it drops the trend: "Weight over the last week".
 */
export const describeChartName = (range: WeightRange, trendKg: number): string => {
  const name = `Weight over the last ${CHART_SPAN_WORDS[range]}`;

  return Number.isFinite(trendKg) ? `${name}, trend ${formatWeight(trendKg)}` : name;
};

/**
 * Whether the rate shows as 0.0 once it is rounded to one decimal, whichever way it points. A rate that
 * is not a number counts as steady, because no direction can be claimed.
 */
const isSteady = (weeklyRateKg: number): boolean =>
  !Number.isFinite(weeklyRateKg) || Math.round(Math.abs(weeklyRateKg) * 10) === 0;

/**
 * The trend card's badge: "−0.3 kg a week" for a loss, "+0.4 kg a week" for a gain, "0.0 kg a week" for
 * neither. The board's own arithmetic would print "+0.0" for a tiny gain, and this prints no sign there.
 */
export const describeRateBadge = (weeklyRateKg: number): string => {
  if (isSteady(weeklyRateKg)) {
    return `${formatWeight(0)} a week`;
  }
  const sign = weeklyRateKg < 0 ? TRUE_MINUS_SIGN : "+";

  return `${sign}${formatWeight(Math.abs(weeklyRateKg))} a week`;
};

/** The line under the trend while it settles: "Settles after 7 weigh-ins. 3 of 7 so far." */
export const describeSettlingLine = (observationCount: number): string =>
  `Settles after ${TREND_SETTLED_OBS} weigh-ins. ${countOrZero(observationCount)} of ${TREND_SETTLED_OBS} so far.`;

/** A day as a short date, "Sat 10 Oct". */
const describeShortDate = (localDate: string): string => {
  const { year, month, day } = parseCalendarDay(localDate);
  const weekday = WEEKDAY_NAMES_SHORT[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];

  return `${weekday} ${day} ${MONTH_NAMES_SHORT[month - 1]}`;
};

/** The x-axis tick of a day: "10 Oct", or nothing for text that is not a day that exists. */
export const describeChartDate = (localDate: string): string => {
  if (!isCalendarDay(localDate)) {
    return "";
  }
  const { month, day } = parseCalendarDay(localDate);

  return `${day} ${MONTH_NAMES_SHORT[month - 1]}`;
};

// Two calendar days are compared by `describeDay`, which reads Dates. Noon UTC read in UTC is that day
// whatever zone the weigh-in was taken in, so the stored local date is what decides Today.
const atNoonUtc = (localDate: string) => new Date(`${localDate}T12:00:00Z`);

/** The day against today, or null when either is not a day that exists. */
const describeLocalDay = (localDate: string, today: string) =>
  isCalendarDay(localDate) && isCalendarDay(today)
    ? describeDay(atNoonUtc(localDate), atNoonUtc(today), "UTC")
    : null;

type TrendLineInput = Readonly<{
  lastKg: number;
  /** The calendar day of the last weigh-in, `YYYY-MM-DD`. */
  lastLocalDate: string;
  /** Today in the profile's zone, `YYYY-MM-DD`. */
  today: string;
  /** Null when the trend has no week behind it yet. */
  weeklyRateKg: number | null;
}>;

/** "today", "yesterday" or "on Sat 10 Oct", or null when the day cannot be read. */
const describeLastWeighInDay = (lastLocalDate: string, today: string): string | null => {
  if (!isCalendarDay(lastLocalDate)) {
    return null;
  }
  const daysFromToday = describeLocalDay(lastLocalDate, today)?.daysFromToday;
  if (daysFromToday === 0) {
    return DAY_STEPPER.today.toLowerCase();
  }
  if (daysFromToday === -1) {
    return DAY_STEPPER.yesterday.toLowerCase();
  }

  return `on ${describeShortDate(lastLocalDate)}`;
};

const describeAverageRate = (weeklyRateKg: number): string => {
  if (isSteady(weeklyRateKg)) {
    return "Steady over the last 7 days.";
  }

  return `Average ${weeklyRateKg < 0 ? "loss" : "gain"} over the last 7 days.`;
};

/**
 * The line under the trend once it has settled: "Last weigh-in 81.6 kg today. Average loss over the last 7
 * days." The board draws only today and a loss. Yesterday, an older day ("on Sat 10 Oct"), a gain, a steady
 * rate ("Steady over the last 7 days.") and a null rate (no second sentence) are written to match. A weight
 * that is not a number or a day that cannot be read is left out of the first sentence.
 */
export const describeTrendLine = ({
  lastKg,
  lastLocalDate,
  today,
  weeklyRateKg,
}: TrendLineInput): string => {
  const lastWeighIn = [
    "Last weigh-in",
    Number.isFinite(lastKg) ? formatWeight(lastKg) : null,
    describeLastWeighInDay(lastLocalDate, today),
  ]
    .filter((part) => part !== null)
    .join(" ")
    .concat(".");

  return weeklyRateKg === null
    ? lastWeighIn
    : `${lastWeighIn} ${describeAverageRate(weeklyRateKg)}`;
};

const SOURCE_WORDS = {
  health_connect: { meta: HEALTH_CONNECT_NAME, label: `From ${HEALTH_CONNECT_NAME}` },
  manual: { meta: "Added by you", label: "Added by you" },
} as const;

type WeighInRowInput = Readonly<{
  /** The calendar day of the weigh-in, `YYYY-MM-DD`. */
  localDate: string;
  /** Today in the profile's zone, `YYYY-MM-DD`. */
  today: string;
  measuredAt: Date;
  /** The IANA zone the weigh-in was taken in. */
  timeZone: string;
  /** `manual` or `health_connect`. Any other value is written as manual. */
  source: string;
  weightKg: number;
  /** Whether the trend left the reading out. */
  rejected: boolean;
}>;

type WeighInRow = Readonly<{
  /** "Today", "Yesterday" or "Sat 10 Oct". */
  day: string;
  /** The time and where it came from: "07:42 · Health Connect". */
  meta: string;
  /** The weight to one decimal, without its unit: "81.6". */
  valueText: string;
  unit: string;
  /** What a screen reader hears on the source icon. */
  sourceLabel: string;
  leftOut: boolean;
}>;

/** The 24-hour time, or null for an instant or a zone that cannot be read. */
const readClockTime = (instant: Date, timeZone: string): string | null => {
  try {
    return formatClockTime(instant, timeZone);
  } catch {
    return null;
  }
};

/** The row's day: Today, Yesterday or a short date. With today unreadable it is the short date, and with the day unreadable nothing. */
const describeRowDay = (localDate: string, today: string): string => {
  const described = describeLocalDay(localDate, today);
  if (described !== null) {
    return described.label;
  }

  return isCalendarDay(localDate) ? describeShortDate(localDate) : "";
};

/**
 * What a row of the weigh-in list says, in pieces so the screen lays them out. A time that cannot be
 * read leaves `meta` as the source alone, and a weight that is not a number leaves `valueText` empty.
 */
export const describeWeighInRow = ({
  localDate,
  today,
  measuredAt,
  timeZone,
  source,
  weightKg,
  rejected,
}: WeighInRowInput): WeighInRow => {
  const words = source === "health_connect" ? SOURCE_WORDS.health_connect : SOURCE_WORDS.manual;
  const time = readClockTime(measuredAt, timeZone);

  return {
    day: describeRowDay(localDate, today),
    meta: time === null ? words.meta : `${time} · ${words.meta}`,
    valueText: Number.isFinite(weightKg) ? formatWeight(weightKg).replace(/ kg$/, "") : "",
    unit: WEIGHT_SCREEN.unit,
    sourceLabel: words.label,
    leftOut: rejected,
  };
};

const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;

const describeElapsed = (minutesAgo: number): string => {
  if (!Number.isFinite(minutesAgo) || minutesAgo < 1) {
    return "just now";
  }
  const minutes = Math.floor(minutesAgo);
  if (minutes < MINUTES_PER_HOUR) {
    return `${minutes} min ago`;
  }
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  if (hours < HOURS_PER_DAY) {
    return `${hours} hr ago`;
  }
  const days = Math.floor(hours / HOURS_PER_DAY);

  return days === 1 ? "1 day ago" : `${days} days ago`;
};

/**
 * The status beside Weigh-ins once the last import is done: "Health Connect · updated 2 min ago". The
 * board draws only minutes. Under a minute it says "just now", then "N hr ago" from an hour and "N days
 * ago" from a day.
 */
export const describeLastImport = (minutesAgo: number): string =>
  `${HEALTH_CONNECT_NAME} · updated ${describeElapsed(minutesAgo)}`;

/** The weigh-in sheet's own words, as `weigh-in-entry: add and edit` draws them. */
export const WEIGH_IN_SHEET = {
  titleAdd: "Add weigh-in",
  /** The title when an existing weigh-in is opened, imported or typed. */
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
  /** Under the weight field until something is wrong. */
  help: "Up to one decimal place.",
  save: "Save",
  /** The Save button's label while it saves. */
  saving: "Saving",
  delete: "Delete weigh-in",
  importedNotice: `Imported from ${HEALTH_CONNECT_NAME}. Edit it in ${HEALTH_CONNECT_NAME}.`,
  /** Under the weight field of an imported reading, in place of `help`. */
  importedHelp: "Imported readings can only be deleted here.",
  deleteWarning: `Deleting removes it from Ki-Lo only. It stays in ${HEALTH_CONNECT_NAME} and won't come back on the next import.`,
  saveError:
    "Couldn't save your weigh-in. Check your connection and try again. What you typed is still here.",
} as const;

/**
 * What is wrong with the weight field, written under it, or null when nothing is: an empty field only
 * turns Save off. Too low, too high and not a number share one sentence, which states the bounds.
 */
export const describeWeightProblem = (reason: WeightInputReason): string | null => {
  switch (reason) {
    case "empty":
      return null;
    case "too-many-decimals":
      return WEIGH_IN_SHEET.help;
    case "too-low":
    case "too-high":
    case "not-a-number":
      return `Enter a weight between ${WEIGH_IN_MIN_KG} and ${WEIGH_IN_MAX_KG} kg.`;
  }
};

type SheetDateOptions = Readonly<{
  /** An imported reading's date is read-only, so it is written like a row's day, without the date. */
  imported?: boolean;
}>;

const readLocalDate = (instant: Date, timeZone: string): string | null => {
  try {
    return toLocalDate(instant, timeZone);
  } catch {
    return null;
  }
};

/**
 * The Date row of the sheet, with the day in the given zone and today as `YYYY-MM-DD`: "Today, Sat 17 Oct"
 * to add or edit, "Yesterday, Fri 16 Oct", or "Sat 10 Oct" for any older day. An imported reading is "Today"
 * or "Yesterday" on its own. An instant or a zone that cannot be read gives nothing, and a today that cannot
 * be read gives the short date alone.
 */
export const describeSheetDate = (
  instant: Date,
  today: string,
  timeZone: string,
  { imported = false }: SheetDateOptions = {},
): string => {
  const localDate = readLocalDate(instant, timeZone);
  if (localDate === null) {
    return "";
  }
  const described = describeLocalDay(localDate, today);
  if (described === null) {
    return describeShortDate(localDate);
  }
  const { daysFromToday, label } = described;
  const isRelative = daysFromToday === 0 || daysFromToday === -1;

  return isRelative && !imported ? `${label}, ${describeShortDate(localDate)}` : label;
};

/** The Time row of the sheet: "08:15", on the 24-hour clock of the given zone, or nothing when it cannot be read. */
export const describeSheetTime = (instant: Date, timeZone: string): string =>
  readClockTime(instant, timeZone) ?? "";

/**
 * The Health access screen, one entry per state of `health-access: permissions flow`. The heading of
 * `connected` is `describeImportedCount`, because it carries the number. The explain state's four points
 * are `HEALTH_ACCESS_POINTS`. The body composition states of version 10 are `explainOptionalNote`,
 * `explainBodyComposition`, `deniedBodyComposition`, `connecting.bodyWithBodyComposition` and `connectedPartial`.
 */
export const HEALTH_ACCESS = {
  /** The name of the close button in the header. */
  closeLabel: "Close",
  /** The link under the points in `explain`. */
  privacyPolicyLink: "Read the privacy policy",
  /** The caption under the points, on `explain` only. */
  explainOptionalNote:
    "Body fat and lean mass are optional. You can leave them off in the Health Connect sheet.",
  explain: {
    heading: `Bring in weigh-ins from ${HEALTH_CONNECT_NAME}`,
    body: `If your smart scale saves to ${HEALTH_CONNECT_NAME}, Ki-Lo can read those readings so you don't have to type them.`,
    primary: "Continue",
    secondary: "Not now",
  },
  install: {
    heading: `Get ${HEALTH_CONNECT_NAME} first`,
    body: `On Android 13 and earlier, ${HEALTH_CONNECT_NAME} is a separate app from Google Play. Install it, then come back here.`,
    primary: `Get ${HEALTH_CONNECT_NAME}`,
    secondary: "Not now",
    steps: [
      `Tap Get ${HEALTH_CONNECT_NAME} and install it.`,
      "Return to Ki-Lo.",
      "Tap Continue to choose what Ki-Lo can read.",
    ],
  },
  connecting: {
    heading: `Importing from ${HEALTH_CONNECT_NAME}`,
    body: "Reading your weight history. This only happens while Ki-Lo is open.",
    /** The body once the body types are allowed too. `body` stays for when they are not. */
    bodyWithBodyComposition:
      "Reading your weight and body composition history. This only happens while Ki-Lo is open.",
    /** The disabled button while the import runs. */
    primary: "Importing",
  },
  denied: {
    heading: "Ki-Lo can't read your weight",
    body: "Permission to read weight was not given. You can change that at any time.",
    primary: `Open ${HEALTH_CONNECT_NAME}`,
    secondary: "Not now",
    steps: [`Open ${HEALTH_CONNECT_NAME}.`, "Tap App permissions, then Ki-Lo.", "Turn on Weight."],
  },
  /** `explain · body-composition`: asked for on its own once weight is already connected. The points are `HEALTH_ACCESS_BODY_POINTS`. */
  explainBodyComposition: {
    heading: "Add body fat and lean mass",
    body: `If your smart scale records them, Ki-Lo can read them from ${HEALTH_CONNECT_NAME} and show a trend for each, beside your weight.`,
    primary: "Continue",
    secondary: "Not now",
  },
  /** `denied · body-composition`. "Lean body mass" is Health Connect's own name for the permission. */
  deniedBodyComposition: {
    heading: "Ki-Lo can't read body fat or lean mass",
    body: "Permission was not given. Your weight still comes in as before, and you can turn these on at any time.",
    primary: `Open ${HEALTH_CONNECT_NAME}`,
    secondary: "Not now",
    steps: [
      `Open ${HEALTH_CONNECT_NAME}.`,
      "Tap App permissions, then Ki-Lo.",
      "Turn on Body fat and Lean body mass.",
    ],
  },
  /** The quiet block under the heading of `connected · partial`, by what was not allowed. */
  connectedPartial: {
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
  },
  importError: {
    heading: "Couldn't import your weigh-ins",
    body: `Something went wrong reading from ${HEALTH_CONNECT_NAME}. Your weigh-ins in Ki-Lo are safe. Pull down on the Weight screen to try again later.`,
    primary: "Try again",
    secondary: "Close",
  },
  connected: {
    body: `New readings come in each time you open Ki-Lo, or when you pull down on the Weight screen. Ki-Lo never writes to ${HEALTH_CONNECT_NAME}.`,
    primary: "See your trend",
  },
} as const;

/** The heading of the `connected` state: "64 weigh-ins imported", or "1 weigh-in imported". */
export const describeImportedCount = (importedCount: number): string => {
  const count = countOrZero(importedCount);

  return `${count} ${count === 1 ? "weigh-in" : "weigh-ins"} imported`;
};

/** The four points of the explain state, each a title and its text. */
export const HEALTH_ACCESS_POINTS = [
  {
    title: "What Ki-Lo reads",
    text: "Your body weight readings and the time each was taken. Nothing else.",
  },
  { title: "Why", text: "To draw your weight trend and, later, to set your calorie targets." },
  {
    title: "What it never does",
    text: `Write to ${HEALTH_CONNECT_NAME}, share your readings, or use them for advertising.`,
  },
  { title: "When", text: "Only while Ki-Lo is open, or when you pull down to refresh." },
] as const;

/**
 * The four points of the explain state once body fat and lean mass are asked for too. The permission flow
 * switches the screen to this list and removes `HEALTH_ACCESS_POINTS`.
 */
export const HEALTH_ACCESS_EXPLAIN_POINTS = [
  {
    title: "What Ki-Lo reads",
    text: "Your weight, and body fat and lean mass if your scale records them, with the time of each. Nothing else.",
  },
  { title: "Why", text: "To draw your trends and, later, to set your calorie targets." },
  {
    title: "What it never does",
    text: `Write to ${HEALTH_CONNECT_NAME}, share your readings, or use them for advertising.`,
  },
  { title: "When", text: "Only while Ki-Lo is open, or when you pull down to refresh." },
] as const;

/** The two points of `explain · body-composition`. */
export const HEALTH_ACCESS_BODY_POINTS = [
  {
    title: "What Ki-Lo reads",
    text: "Body fat and lean mass, with the time of each, to show their trends. Nothing else.",
  },
  {
    title: "What it never does",
    text: `Write to ${HEALTH_CONNECT_NAME}, share your readings, or use them for advertising.`,
  },
] as const;

/**
 * The trend explainer sheet, as `trend-explainer` draws it. The 7 of Settling is the weigh-ins a trend
 * needs and the 30 of Missing days is the engine's longest gap, so a changed constant changes the words.
 * The 7 of Weekly rate is the week, which is not a tunable.
 */
export const TREND_EXPLAINER = {
  title: "How your trend works",
  done: "Done",
  /** The name of the progress bar in the settling banner. */
  progressName: "Weigh-ins towards a settled trend",
  footer: "The trend is an estimate. It isn't medical advice.",
  sections: [
    {
      title: "Why a trend",
      text: "Your weight moves by a kilo or more from day to day with water, salt and food. The trend smooths that out so you can see where you are really heading.",
    },
    {
      title: "Settling",
      text: `The trend needs ${TREND_SETTLED_OBS} weigh-ins before it is steady. Until then it is drawn dashed and can move a lot.`,
    },
    {
      title: "Readings left out",
      text: "A reading far from the rest, like 95 kg after a week around 80 kg, is left out of the trend. If your next reading is close to it, it counts after all.",
    },
    {
      title: "Missing days",
      text: `Days without a weigh-in are filled in from the days around them. After a gap of more than ${DEFAULT_ENGINE_PARAMS.trend.maxGapDays} days the trend starts again.`,
    },
    {
      title: "Weekly rate",
      text: "How much the trend has moved over the last 7 days, shown as a gain or loss a week.",
    },
  ],
} as const;

/** The banner over the explainer while the trend settles: "Your trend is settling: 3 of 7 weigh-ins". */
export const describeSettlingBanner = (observationCount: number): string =>
  `Your trend is settling: ${countOrZero(observationCount)} of ${TREND_SETTLED_OBS} weigh-ins`;

/**
 * The sixth section of the explainer, on the board after Weekly rate. It is not in
 * `TREND_EXPLAINER.sections` because the sheet maps that list, so the sheet adds it when it is ready.
 */
export const TREND_EXPLAINER_BODY_SECTION = {
  title: "Body fat and lean mass",
  text: "Smoothed like your weight. Scales estimate them and readings change with the water you hold, so the trend matters more than any one reading. Lean mass includes bone and water as well as muscle.",
} as const;
