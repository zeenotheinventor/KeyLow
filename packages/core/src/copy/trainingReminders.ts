/*
 * The words of the training reminders (KEY-509, and the missed day and check-in ones of KEY-813). They show on the lock screen, so they name no
 * muscle, exercise or weekday (the health data rule), and the detail waits inside the app. One exception:
 * the routine day's own name, which the person chose, may appear in "Time to train" only, behind
 * `TRAIN_REMINDER_NAMES_ROUTINE_DAY` (Zee, 2026-11-03, pending confirmation). "Take it easy" and "See your
 * progress" stay generic. The missed day and check-in words are kind and never count the days missed.
 */

export const TRAINING_REMINDER_TYPES = ["train", "progress", "ease", "missed", "checkin"] as const;

/**
 * "Time to train" on a planned day, "See your progress" on Sunday, and "Take it easy" on a loaded day.
 * "A fresh start" the morning after a planned day went by, and "Checking in" after several of them.
 */
export type TrainingReminderType = (typeof TRAINING_REMINDER_TYPES)[number];

export type TrainingReminderCopy = Readonly<{ title: string; body: string }>;

/** A body of a reminder and its id. The id is kept once a body is used, so editing the copy never remaps it. */
export type TrainingReminderVariant = Readonly<{ id: string; body: string }>;

/** One title for each type. The variety is in the bodies. */
export const TRAINING_REMINDER_TITLES: Readonly<Record<TrainingReminderType, string>> = {
  train: "Time to train",
  progress: "See your progress",
  ease: "Take it easy",
  missed: "A fresh start",
  checkin: "Checking in",
};

/**
 * The bodies of each reminder. The planner picks one by the fire date and never repeats the last one used.
 * Never reuse or change the meaning of an id: add a new body with a new id instead.
 */
export const TRAINING_REMINDER_VARIANTS: Readonly<
  Record<TrainingReminderType, readonly TrainingReminderVariant[]>
> = {
  train: [
    { id: "train-1", body: "Your session is ready when you are." },
    { id: "train-2", body: "A good day for a session. Take it at your own pace." },
    { id: "train-3", body: "Today's plan is waiting for you. Any effort counts." },
    { id: "train-4", body: "A little time for yourself, and your plan is all set." },
    { id: "train-5", body: "Whenever you are ready, today's session is there." },
    { id: "train-6", body: "Show up as you are. A steady session is a good one." },
    { id: "train-7", body: "Your plan is ready for today. Start whenever suits you." },
    { id: "train-8", body: "A little progress today is still progress." },
  ],
  progress: [
    { id: "progress-1", body: "You moved forward this week. Come and see how." },
    { id: "progress-2", body: "Something went up this week. Have a look." },
    { id: "progress-3", body: "Your hard work is showing. See what changed this week." },
    { id: "progress-4", body: "Steady effort, and it shows. Take a look at your week." },
    { id: "progress-5", body: "You improved this week. See where." },
    { id: "progress-6", body: "Small steps add up. See what moved this week." },
  ],
  ease: [
    {
      id: "ease-1",
      body: "You are still recovering from recent training. Go gently today if you like.",
    },
    { id: "ease-2", body: "Recovery is part of the plan. Today can be a lighter one." },
    {
      id: "ease-3",
      body: "You have trained hard lately. A lighter session is a good choice today.",
    },
    { id: "ease-4", body: "Your body could use a little ease today. Listen to how you feel." },
    { id: "ease-5", body: "Resting well helps you progress. Be kind to yourself today." },
    { id: "ease-6", body: "There is still some recovering to do. A gentle day is a fine day." },
  ],
  missed: [
    { id: "missed-1", body: "Yesterday slipped by, and that is fine. Today is a fresh start." },
    { id: "missed-2", body: "A day off the plan happens. Pick it back up whenever you are ready." },
    { id: "missed-3", body: "No worries about yesterday. Today is a good day to begin again." },
    {
      id: "missed-4",
      body: "Yesterday did not go to plan, and that is okay. Your next session is waiting.",
    },
    { id: "missed-5", body: "Life got busy yesterday. Ease back in at your own pace today." },
    {
      id: "missed-6",
      body: "One quiet day does not undo your effort. Come back whenever it suits you.",
    },
  ],
  checkin: [
    { id: "checkin-1", body: "Training has been quiet lately. Everything okay?" },
    { id: "checkin-2", body: "It has been a little while. How are you doing?" },
    { id: "checkin-3", body: "Just checking in. Is everything alright?" },
    {
      id: "checkin-4",
      body: "Things have gone quiet. Your plan will be here whenever you are ready.",
    },
    { id: "checkin-5", body: "If life got busy, that is okay. Your plan is ready when you are." },
    {
      id: "checkin-6",
      body: "How are you getting on? Your plan is here when you want it, no pressure.",
    },
  ],
};

/**
 * The bodies of the missed day reminder when it is merged with "Time to train": one notification at the
 * train time in place of two. They have ids of their own, so the merged set never remaps an id of the plain
 * one, and say both things at once. Never reuse or change the meaning of an id: add a new body with a new id
 * instead.
 */
export const MISSED_MERGED_REMINDER_VARIANTS: readonly TrainingReminderVariant[] = [
  {
    id: "missed-merged-1",
    body: "Yesterday slipped by, and that is fine. Today's session is ready when you are.",
  },
  {
    id: "missed-merged-2",
    body: "A day off the plan happens. Today is a fresh start, at your own pace.",
  },
  {
    id: "missed-merged-3",
    body: "No worries about yesterday. Today's session is a good way to begin again.",
  },
  {
    id: "missed-merged-4",
    body: "Yesterday did not go to plan, and that is okay. Today's session is waiting.",
  },
  {
    id: "missed-merged-5",
    body: "Life got busy yesterday. Ease back in with today's session when you are ready.",
  },
  {
    id: "missed-merged-6",
    body: "One quiet day does not undo your effort. Today's plan is ready whenever you are.",
  },
];

/**
 * The one switch for naming the routine day in "Time to train". Off, the planner returns exactly the
 * generic copy, with the generic ids. A working decision awaiting Zee's confirmation (2026-11-03), so
 * flipping it must be the only change needed.
 */
export const TRAIN_REMINDER_NAMES_ROUTINE_DAY = true;

/** Where the routine day's name goes in a named body. Each named body has exactly one. */
export const TRAINING_REMINDER_DAY_SLOT = "{day}";

/**
 * The bodies of "Time to train" that name the routine day, each a template with one day slot. They have
 * ids of their own, so turning the naming off and on again never remaps an id of the generic set. Never
 * reuse or change the meaning of an id: add a new body with a new id instead.
 */
export const NAMED_TRAIN_REMINDER_VARIANTS: readonly TrainingReminderVariant[] = [
  { id: "train-named-1", body: "{day} is ready when you are. Come and enjoy it." },
  { id: "train-named-2", body: "A good day for {day}. Take it at your own pace." },
  { id: "train-named-3", body: "{day} is waiting for you. Any effort counts." },
  { id: "train-named-4", body: "A little time for yourself, and {day} is all set." },
  { id: "train-named-5", body: "Whenever you are ready, {day} is there for you." },
  { id: "train-named-6", body: "Show up as you are. A steady {day} is a good one." },
  { id: "train-named-7", body: "{day} is ready for today. Start whenever suits you." },
  { id: "train-named-8", body: "A little progress today is still progress. Go for {day}." },
];

const isNamed = (dayName: string | undefined): dayName is string =>
  dayName !== undefined && dayName.trim() !== "";

/**
 * The words of one variant of a reminder, by its id. A named variant needs the routine day's name, and a
 * generic one ignores it. Throws a `RangeError` naming the rule when the id is not one of the variants of
 * its type, or is a named one and the name is blank or missing.
 */
export const describeTrainingReminder = (
  type: TrainingReminderType,
  variantId: string,
  dayName?: string,
): TrainingReminderCopy => {
  const title = TRAINING_REMINDER_TITLES[type];
  const generic = TRAINING_REMINDER_VARIANTS[type].find(({ id }) => id === variantId);
  if (generic !== undefined) {
    return { title, body: generic.body };
  }
  if (type === "missed") {
    const merged = MISSED_MERGED_REMINDER_VARIANTS.find(({ id }) => id === variantId);
    if (merged !== undefined) {
      return { title, body: merged.body };
    }
  }
  const named =
    type === "train" ? NAMED_TRAIN_REMINDER_VARIANTS.find(({ id }) => id === variantId) : undefined;
  if (named === undefined) {
    throw new RangeError("A training reminder variant id must be one of the variants of its type");
  }
  if (!isNamed(dayName)) {
    throw new RangeError("A named training reminder variant needs the name of the routine day");
  }
  // Split and join, not replace: a name with "$&" in it must stay as typed.
  return { title, body: named.body.split(TRAINING_REMINDER_DAY_SLOT).join(dayName.trim()) };
};
