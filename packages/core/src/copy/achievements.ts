import { joinInWords } from "./bodyMap";

import type { AchievementCategory, AchievementId } from "../achievements/catalogue";

/*
 * The words of achievements (KEY-1082): the 13 category headings, the 130 names with their "earn it by"
 * lines as `docs/design/achievements/catalogue.md` has them, the level names and the unlock notification
 * text. The ids are the stable ones of the catalogue, so a rename here never changes an id.
 */

export const ACHIEVEMENT_CATEGORY_NAMES: Readonly<Record<AchievementCategory, string>> = {
  "getting-started": "Getting started",
  "logging-volume": "Logging volume",
  "daily-streaks": "Daily streaks",
  targets: "Targets",
  variety: "Variety",
  kitchen: "Kitchen",
  "training-volume": "Training volume",
  "training-consistency": "Training consistency",
  "strength-and-range": "Strength and range",
  "weight-and-body": "Weight and body",
  "programme-and-check-ins": "Programme and check-ins",
  "ki-lo-explorer": "Ki-Lo explorer",
  "hidden-and-seasonal": "Hidden and seasonal",
};

export type AchievementWords = Readonly<{
  name: string;
  /** Finishes "Earn it by": for example "logging your first food". */
  earnedBy: string;
}>;

export const ACHIEVEMENT_COPY: Readonly<Record<AchievementId, AchievementWords>> = {
  "first-bite": { name: "First Bite", earnedBy: "logging your first food" },
  "set-the-course": { name: "Set the Course", earnedBy: "finishing setup with your targets" },
  "on-the-scales": { name: "On the Scales", earnedBy: "recording your first weigh-in" },
  "beep-beep": { name: "Beep Beep", earnedBy: "scanning your first barcode" },
  "home-cook": { name: "Home Cook", earnedBy: "saving your first recipe" },
  "soft-spot": { name: "Soft Spot", earnedBy: "favouriting a food or recipe" },
  "first-rep": { name: "First Rep", earnedBy: "finishing your first workout" },
  planner: { name: "Planner", earnedBy: "planning your first day of meals" },
  "hello-ki-lo": { name: "Hello, Ki-Lo", earnedBy: "asking the assistant your first question" },
  "nudge-me": { name: "Nudge Me", earnedBy: "turning on a reminder" },
  "measured-up": {
    name: "Measured Up",
    earnedBy: "your first body composition reading from Health",
  },
  "closing-time": { name: "Closing Time", earnedBy: "completing your first day" },
  jotter: { name: "Jotter", earnedBy: "10 entries logged" },
  notebook: { name: "Notebook", earnedBy: "50 entries" },
  centurion: { name: "Centurion", earnedBy: "100 entries" },
  "quarter-master": { name: "Quarter Master", earnedBy: "250 entries" },
  diarist: { name: "Diarist", earnedBy: "500 entries" },
  "grand-log": { name: "Grand Log", earnedBy: "1,000 entries" },
  archivist: { name: "Archivist", earnedBy: "2,500 entries" },
  encyclopaedia: { name: "Encyclopaedia", earnedBy: "5,000 entries" },
  "a-month-of-meals": { name: "A Month of Meals", earnedBy: "30 different days logged" },
  "hundred-days": { name: "Hundred Days", earnedBy: "100 different days logged" },
  "year-in-the-book": { name: "Year in the Book", earnedBy: "365 different days logged" },
  "hat-trick": { name: "Hat Trick", earnedBy: "3-day daily streak" },
  "full-week": { name: "Full Week", earnedBy: "7-day streak" },
  fortnight: { name: "Fortnight", earnedBy: "14-day streak" },
  "habit-forming": { name: "Habit Forming", earnedBy: "21-day streak" },
  "month-strong": { name: "Month Strong", earnedBy: "30-day streak" },
  "two-months": { name: "Two Months", earnedBy: "60-day streak" },
  "quarter-year": { name: "Quarter Year", earnedBy: "90-day streak" },
  "half-year": { name: "Half Year", earnedBy: "180-day streak" },
  "full-circle": { name: "Full Circle", earnedBy: "365-day streak" },
  unstoppable: { name: "Unstoppable", earnedBy: "500-day streak" },
  "back-on-track": { name: "Back on Track", earnedBy: "completing a day after 3 or more days off" },
  "saved-by-the-snow": { name: "Saved by the Snow", earnedBy: "a freeze keeps your streak alive" },
  "weekend-warrior": {
    name: "Weekend Warrior",
    earnedBy: "completing every Saturday and Sunday for 4 weekends",
  },
  stockpile: { name: "Stockpile", earnedBy: "holding 10 freezes at once" },
  "protein-pioneer": { name: "Protein Pioneer", earnedBy: "hitting your protein target for a day" },
  "protein-week": { name: "Protein Week", earnedBy: "7 days on protein target" },
  "protein-month": { name: "Protein Month", earnedBy: "30 days on protein target" },
  "protein-pro": { name: "Protein Pro", earnedBy: "100 days on protein target" },
  bullseye: { name: "Bullseye", earnedBy: "calories in range for a day" },
  "steady-hand": { name: "Steady Hand", earnedBy: "7 days with calories in range" },
  "dialled-in": { name: "Dialled In", earnedBy: "30 days with calories in range" },
  precision: { name: "Precision", earnedBy: "100 days with calories in range" },
  "balanced-plate": {
    name: "Balanced Plate",
    earnedBy: "calories, protein, carbs and fat all in range on one day",
  },
  "perfect-week": {
    name: "Perfect Week",
    earnedBy: "7 days in a row with calories and protein in range",
  },
  "fibre-fan": { name: "Fibre Fan", earnedBy: "7 days reaching 25 g of fibre" },
  "morning-logger": { name: "Morning Logger", earnedBy: "logging before 10:00 on 30 days" },
  taster: { name: "Taster", earnedBy: "25 different foods logged" },
  "varied-diet": { name: "Varied Diet", earnedBy: "50 different foods" },
  adventurous: { name: "Adventurous", earnedBy: "100 different foods" },
  omnivore: { name: "Omnivore", earnedBy: "250 different foods" },
  explorer: { name: "Explorer", earnedBy: "10 foods you had never logged before, in one week" },
  "creature-of-habit": {
    name: "Creature of Habit",
    earnedBy: "logging the same favourite 30 times",
  },
  scanner: { name: "Scanner", earnedBy: "10 different barcodes scanned" },
  "barcode-collector": { name: "Barcode Collector", earnedBy: "50 different barcodes" },
  "checkout-champion": { name: "Checkout Champion", earnedBy: "100 different barcodes" },
  "recipe-box": { name: "Recipe Box", earnedBy: "5 recipes saved" },
  cookbook: { name: "Cookbook", earnedBy: "10 recipes saved" },
  "head-chef": { name: "Head Chef", earnedBy: "25 recipes saved" },
  regular: { name: "Regular", earnedBy: "logging your own recipes 10 times" },
  "house-special": { name: "House Special", earnedBy: "logging your own recipes 50 times" },
  "batch-cook": { name: "Batch Cook", earnedBy: "one recipe logged on 3 different days" },
  "week-ahead": { name: "Week Ahead", earnedBy: "a full 7-day meal plan" },
  "master-planner": { name: "Master Planner", earnedBy: "4 weeks of meal plans" },
  "list-maker": { name: "List Maker", earnedBy: "your first shopping list" },
  "basket-case": { name: "Basket Case", earnedBy: "50 shopping items ticked off" },
  "routine-builder": { name: "Routine Builder", earnedBy: "creating your first routine" },
  "warmed-up": { name: "Warmed Up", earnedBy: "5 workouts" },
  "ten-down": { name: "Ten Down", earnedBy: "10 workouts" },
  "regular-at-the-rack": { name: "Regular at the Rack", earnedBy: "25 workouts" },
  "fifty-sessions": { name: "Fifty Sessions", earnedBy: "50 workouts" },
  "hundred-club": { name: "Hundred Club", earnedBy: "100 workouts" },
  "iron-habit": { name: "Iron Habit", earnedBy: "250 workouts" },
  lifer: { name: "Lifer", earnedBy: "500 workouts" },
  "set-counter": { name: "Set Counter", earnedBy: "100 sets" },
  "thousand-sets": { name: "Thousand Sets", earnedBy: "1,000 sets" },
  "ten-thousand": { name: "Ten Thousand", earnedBy: "10,000 sets" },
  "ten-tonnes": { name: "Ten Tonnes", earnedBy: "10,000 kg lifted in total (sets x reps x load)" },
  "hundred-tonnes": { name: "Hundred Tonnes", earnedBy: "100,000 kg lifted" },
  megalifter: { name: "Megalifter", earnedBy: "1,000,000 kg lifted" },
  "big-session": { name: "Big Session", earnedBy: "one workout with 25 or more sets" },
  "two-good-weeks": { name: "Two Good Weeks", earnedBy: "2-week training streak" },
  "four-weeks-solid": { name: "Four Weeks Solid", earnedBy: "4-week training streak" },
  "eight-weeks": { name: "Eight Weeks", earnedBy: "8-week training streak" },
  "quarter-of-graft": { name: "Quarter of Graft", earnedBy: "12-week training streak" },
  "half-a-year-of-iron": { name: "Half a Year of Iron", earnedBy: "26-week training streak" },
  "year-of-iron": { name: "Year of Iron", earnedBy: "52-week training streak" },
  "early-bird": { name: "Early Bird", earnedBy: "10 workouts started before 07:00" },
  "night-owl": { name: "Night Owl", earnedBy: "10 workouts started after 21:00" },
  "personal-best": {
    name: "Personal Best",
    earnedBy: "your first personal record (see the note above this table)",
  },
  "on-a-roll": { name: "On a Roll", earnedBy: "10 personal records" },
  "record-breaker": { name: "Record Breaker", earnedBy: "50 personal records" },
  "hall-of-fame": { name: "Hall of Fame", earnedBy: "100 personal records" },
  "full-body": {
    name: "Full Body",
    earnedBy: "all six main muscle groups (not neck) trained as a primary muscle in one week",
  },
  "leg-day-legend": { name: "Leg Day Legend", earnedBy: "25 workouts that train legs" },
  "well-rounded": { name: "Well Rounded", earnedBy: "50 different exercises" },
  "form-check": { name: "Form Check", earnedBy: "watching an exercise demo" },
  "weekly-weigh": { name: "Weekly Weigh", earnedBy: "10 weigh-ins" },
  "data-driven": { name: "Data Driven", earnedBy: "50 weigh-ins" },
  "trend-setter": { name: "Trend Setter", earnedBy: "100 weigh-ins" },
  "every-single-day": { name: "Every Single Day", earnedBy: "365 weigh-ins" },
  "four-weeks-weighed": { name: "Four Weeks Weighed", earnedBy: "4-week weigh-in streak" },
  "quarter-weighed": { name: "Quarter Weighed", earnedBy: "12-week weigh-in streak" },
  "year-weighed": { name: "Year Weighed", earnedBy: "52-week weigh-in streak" },
  "body-reader": { name: "Body Reader", earnedBy: "10 body composition readings" },
  "morning-routine": { name: "Morning Routine", earnedBy: "30 weigh-ins before 09:00" },
  "composition-collector": {
    name: "Composition Collector",
    earnedBy: "50 body composition readings",
  },
  "signed-up": { name: "Signed Up", earnedBy: "4 weeks on a programme" },
  "checking-in": { name: "Checking In", earnedBy: "your first check-in" },
  "monthly-review": { name: "Monthly Review", earnedBy: "4 check-ins" },
  "quarterly-review": { name: "Quarterly Review", earnedBy: "12 check-ins" },
  graduate: { name: "Graduate", earnedBy: "12 check-ins on one programme" },
  "course-correct": { name: "Course Correct", earnedBy: "editing your targets" },
  chatterbox: { name: "Chatterbox", earnedBy: "10 assistant conversations" },
  "hands-free": { name: "Hands Free", earnedBy: "letting the assistant log a meal for you" },
  "sous-chef": { name: "Sous Chef", earnedBy: "the assistant drafting a recipe you save" },
  "your-data": { name: "Your Data", earnedBy: "exporting your data" },
  "ideas-person": { name: "Ideas Person", earnedBy: "sending a feature request" },
  "favourites-fan": { name: "Favourites Fan", earnedBy: "logging from favourites 25 times" },
  "weekly-review": { name: "Weekly Review", earnedBy: "opening the week view 10 times" },
  "new-year-new-log": { name: "New Year, New Log", earnedBy: "logging on 1 January" },
  "festive-feast": { name: "Festive Feast", earnedBy: "logging on 25 December" },
  "spooky-snacks": { name: "Spooky Snacks", earnedBy: "logging on 31 October" },
  "leap-of-faith": { name: "Leap of Faith", earnedBy: "logging on 29 February" },
  "midnight-snack": { name: "Midnight Snack", earnedBy: "logging between 00:00 and 04:00" },
  anniversary: { name: "Anniversary", earnedBy: "one year since you joined" },
  collector: { name: "Collector", earnedBy: "50 achievements earned" },
  completionist: { name: "Completionist", earnedBy: "100 achievements earned" },
};

/** Five levels to a name. Level 0, before the first 50 points, is still a Sprout. */
export const LEVEL_NAMES = ["Sprout", "Sapling", "Oak", "Summit", "Legend"] as const;

/** Every level past the last named set, 26 and up, carries this one name. */
export const BEYOND_LEGEND_LEVEL_NAME = "Mythic";

const LEVELS_PER_NAME = 5;

export const levelNameFor = (level: number): string =>
  LEVEL_NAMES[Math.floor(Math.max(level - 1, 0) / LEVELS_PER_NAME)] ?? BEYOND_LEGEND_LEVEL_NAME;

const upperFirst = (text: string): string => `${text.charAt(0).toUpperCase()}${text.slice(1)}`;

const freezeText = (freezes: number): string =>
  freezes === 1 ? "+1 freeze" : `+${freezes} freezes`;

export type UnlockNotificationInput = Readonly<{
  /** The badges one action earned, at least one. */
  badgeIds: readonly AchievementId[];
  /** The points of all of them together. */
  points: number;
  /** The freezes that came with them. */
  freezes: number;
  /** The level the points carried the person to, or null when they stayed where they were. */
  reachedLevelName: string | null;
}>;

/**
 * The one notification an action's unlocks send: a single badge names itself and says how it was earned,
 * several are listed in one title so a busy log never sends a burst. A freeze or a new level is added to
 * the body when it came with them.
 */
export const unlockNotification = (
  input: UnlockNotificationInput,
): Readonly<{ title: string; body: string }> => {
  const { badgeIds, points, freezes, reachedLevelName } = input;
  const [firstId] = badgeIds;
  if (firstId === undefined) {
    throw new RangeError("An unlock notification needs at least one badge.");
  }
  const single = badgeIds.length === 1;
  const names = badgeIds.map((id) => ACHIEVEMENT_COPY[id].name);
  const title = single
    ? `Badge earned: ${ACHIEVEMENT_COPY[firstId].name}`
    : `${badgeIds.length} badges earned: ${joinInWords(names)}`;
  const parts = [
    ...(single ? [upperFirst(ACHIEVEMENT_COPY[firstId].earnedBy)] : []),
    `+${points} points`,
    ...(freezes > 0 ? [freezeText(freezes)] : []),
    ...(reachedLevelName === null ? [] : [`You reached ${reachedLevelName}`]),
  ];
  return { title, body: parts.join(". ") };
};

/**
 * The notification of a level-up that came with no badge: the level reached, and the freezes it gave.
 * Points only come from badges, so this is a guard for a run that raises the level some other way.
 */
export const levelUpNotification = (
  input: Readonly<{ level: number; levelName: string; freezes: number }>,
): Readonly<{ title: string; body: string }> => ({
  title: `Level ${input.level} reached`,
  body: [
    `You reached ${input.levelName}`,
    ...(input.freezes > 0 ? [freezeText(input.freezes)] : []),
  ].join(". "),
});
