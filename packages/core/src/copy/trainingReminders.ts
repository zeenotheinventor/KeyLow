/*
 * The words of the three training reminders (KEY-509). They show on the lock screen, so they are generic:
 * no muscle, exercise or day is named (the health data rule), and the detail waits inside the app.
 */

export const TRAINING_REMINDER_TYPES = ["train", "progress", "ease"] as const;

/** "Time to train" on a planned day, "See your progress" on Sunday, and "Take it easy" on a loaded day. */
export type TrainingReminderType = (typeof TRAINING_REMINDER_TYPES)[number];

export type TrainingReminderCopy = Readonly<{ title: string; body: string }>;

/** A body of a reminder and its id. The id is kept once a body is used, so editing the copy never remaps it. */
export type TrainingReminderVariant = Readonly<{ id: string; body: string }>;

/** One title for each type. The variety is in the bodies. */
export const TRAINING_REMINDER_TITLES: Readonly<Record<TrainingReminderType, string>> = {
  train: "Time to train",
  progress: "See your progress",
  ease: "Take it easy",
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
};

/**
 * The words of one variant of a reminder, by its id. Throws a `RangeError` naming the rule when the id is
 * not one of the variants of its type.
 */
export const describeTrainingReminder = (
  type: TrainingReminderType,
  variantId: string,
): TrainingReminderCopy => {
  const variant = TRAINING_REMINDER_VARIANTS[type].find(({ id }) => id === variantId);
  if (variant === undefined) {
    throw new RangeError("A training reminder variant id must be one of the variants of its type");
  }
  return { title: TRAINING_REMINDER_TITLES[type], body: variant.body };
};
