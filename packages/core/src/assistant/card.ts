import { z } from "zod";

import { assistantIdSchema } from "./ids";

/*
 * The action card the assistant shows for each write, with Undo (M8 plan, section 5, "AssistantCard").
 * Every string on it is worded in core by the write's own card builder, so a screen renders the strings
 * it receives and never composes them.
 */

/** Where a card's link opens. */
const assistantCardLinkTargetSchema = z.discriminatedUnion("screen", [
  z.strictObject({ screen: z.literal("recipe_editor"), recipeId: assistantIdSchema }),
  /**
   * An imported line that matched no food is not saved as an ingredient, so its link opens the recipe
   * editor's add-ingredient search with the line's food word in `query`.
   */
  z.strictObject({
    screen: z.literal("recipe_add_ingredient"),
    recipeId: assistantIdSchema,
    query: z.string().min(1),
  }),
  z.strictObject({ screen: z.literal("own_food"), foodId: assistantIdSchema }),
  z.strictObject({ screen: z.literal("diary_day"), localDate: z.iso.date() }),
  z.strictObject({ screen: z.literal("routine_editor"), routineId: assistantIdSchema }),
  z.strictObject({ screen: z.literal("session_detail"), sessionId: assistantIdSchema }),
  /** The Plan screen, on the week that holds `localDate`. The phone has the screen. The web has no page for it, so its card shows no link. */
  z.strictObject({ screen: z.literal("meal_plan"), localDate: z.iso.date() }),
]);

export const assistantCardLinkSchema = z.strictObject({
  label: z.string().min(1),
  target: assistantCardLinkTargetSchema,
});

/**
 * One day of a routine, drawn as a line that opens to its exercises (`assistant-card · routine-created`).
 * `name` is the day and its focus ("Monday · Push"), `summary` what the day holds ("5 exercises · 15 sets
 * · about 50 min"), and each exercise its name and its detail ("3 sets · 8 to 10 reps · RIR 2"). Every
 * string is worded in core by the card's builder.
 */
const assistantCardDaySchema = z.strictObject({
  name: z.string().min(1),
  summary: z.string().min(1),
  exercises: z.array(z.strictObject({ name: z.string().min(1), detail: z.string().min(1) })),
});

/**
 * One line of a card. A logged food leads with its own portion, grams in brackets ("2 large eggs
 * (100 g)"), or plain grams ("200 g"). On a recipe import `name` is the line as the page wrote it and
 * `matchedFood` the line under it as the board prints it: the food it matched, or why it is not counted.
 * `estimate` is true on an imported line whose vague amount the import guessed (plan 2.8) and on a logged
 * food whose amount `estimate_portions` worked out (`log_entry` with `estimated`, ADR 0006 Amendment 2),
 * false everywhere else.
 *
 * The rows are reused by the training cards, and their fields keep their names because stored cards hold
 * them: `amountText` is the row's detail ("Was Look better") and `kcalText` its value on the right ("Get
 * stronger"), whatever the row counts.
 */
const assistantCardRowSchema = z.strictObject({
  name: z.string().min(1),
  amountText: z.string().min(1).nullable(),
  time: z.iso.time({ precision: -1 }).nullable(),
  kcalText: z.string().min(1).nullable(),
  match: z.enum(["matched", "unresolved"]).nullable(),
  matchedFood: z.string().min(1).nullable(),
  estimate: z.boolean(),
});

/**
 * `actionIds` lists the writes the card groups, at least one (two `log_entry` calls in one turn make one
 * card). `undo` is the live state, read from `assistant_actions` when the thread is read back, and
 * `undoneSub` is the line shown under "Undone" once it is undone. It is null on a card that can never be
 * undone (an edit, or manual targets with no programme, ADR 0006), because no Undo ever shows that line.
 */
export const assistantCardSchema = z.strictObject({
  actionIds: z.array(assistantIdSchema).min(1),
  kind: z.enum([
    "logged",
    "updated",
    "deleted",
    "day_copied",
    "day_completed",
    "recipe_created",
    "recipe_updated",
    "recipe_archived",
    "food_created",
    "targets_changed",
    "routine_updated",
    "routine_active",
    "routine_archived",
    "routine_created",
    "goals_updated",
    "exercise_created",
    "exercise_updated",
    "exercise_archived",
    "set_updated",
    "workout_deleted",
    "feature_requested",
    "plan_created",
    "plan_day_replanned",
  ]),
  title: z.string().min(1),
  sub: z.string().min(1).nullable(),
  rows: z.array(assistantCardRowSchema),
  /** The days of a routine the card built or changed. Absent or null on every other card, and on every card stored before they existed. */
  days: z.array(assistantCardDaySchema).nullish(),
  /** The short fact the changes list shows for the card ("4 changes"). Absent or null when there is none. */
  changeDetail: z.string().min(1).nullish(),
  totalText: z.string().min(1).nullable(),
  note: z.string().min(1).nullable(),
  link: assistantCardLinkSchema.nullable(),
  undo: z.enum(["available", "undone", "unavailable"]),
  undoneSub: z.string().min(1).nullable(),
});

export type AssistantCard = z.infer<typeof assistantCardSchema>;
export type AssistantCardRow = AssistantCard["rows"][number];
export type AssistantCardDay = z.infer<typeof assistantCardDaySchema>;
export type AssistantCardLink = z.infer<typeof assistantCardLinkSchema>;
export type AssistantCardKind = AssistantCard["kind"];
