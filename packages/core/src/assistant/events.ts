import { z } from "zod";

import { assistantCardLinkSchema, assistantCardSchema } from "./card";
import { assistantExerciseFormMediaSchema } from "./exerciseFormCard";
import { assistantExerciseMusclesSchema } from "./exerciseMusclesCard";
import { assistantIdSchema } from "./ids";
import { assistantNoticeSchema } from "./notice";
import { assistantRecipeDraftSchema } from "./recipeDraft";
import { assistantRecipeNoticeSchema } from "./recipeNotice";
import { assistantRecipeRefusalSchema } from "./recipeRefusal";

/*
 * The events the `assistant` Edge Function streams to the app, one JSON event per Server-Sent Events
 * `data:` line (M8 plan, section 5, "Contracts"). Both sides parse them with these schemas, so a field
 * the other side does not know is an error, never a silent extra. The one place that is lenient is
 * `parseAssistantEvent`: a status it cannot read is the default step, and an event type or a card kind it
 * does not know is reported as skippable, so a server that is ahead of the app (a new status code, a new
 * event, a new card kind) never fails the person's turn.
 */

/** The first event of every turn: which turn this is and the conversation it belongs to. */
const turnEventSchema = z.strictObject({
  type: z.literal("turn"),
  turnId: assistantIdSchema,
  conversationId: assistantIdSchema,
});

/** The next piece of the reply in progress, appended to the text so far (`assistant · streaming`). */
const textEventSchema = z.strictObject({
  type: z.literal("text"),
  delta: z.string(),
});

/**
 * What the function is doing while no text arrives, with send disabled (`assistant · working`). Reading a
 * recipe page is worded from `host` (`assistant · recipe-import`, left), the default step is "Thinking",
 * and a tool is worded by the app from its `tool` name, which is a plain string on the wire so a new tool
 * needs words in the app and no change here. `food` is the words a search used, and `isConfirmed` is true
 * once the person has pressed a confirm button.
 */
const statusEventSchema = z.discriminatedUnion("code", [
  z.strictObject({
    type: z.literal("status"),
    code: z.literal("reading_recipe"),
    host: z.string().min(1),
  }),
  z.strictObject({ type: z.literal("status"), code: z.literal("thinking") }),
  z.strictObject({
    type: z.literal("status"),
    code: z.literal("tool"),
    tool: z.string().min(1).max(64),
    food: z.string().min(1).max(120).nullable(),
    isConfirmed: z.boolean(),
  }),
]);

/** A write was applied: its action card, with Undo. */
const cardEventSchema = z.strictObject({
  type: z.literal("card"),
  card: assistantCardSchema,
});

/**
 * A link on its own, with no card (`assistant-card · routine-updated`, Removing a day): the way into the
 * routine editor under an answer that changed nothing.
 */
const linkEventSchema = z.strictObject({
  type: z.literal("link"),
  link: assistantCardLinkSchema,
});

/**
 * The muscles an exercise works (`assistant-card · exercise-muscles`): a read, drawn by the app as a 2D
 * figure under the reply. One event for each exercise, in call order.
 */
const exerciseMusclesEventSchema = z.strictObject({
  type: z.literal("exercise_muscles"),
  exercise: assistantExerciseMusclesSchema,
});

/**
 * The form video or photos of an exercise (`assistant-card · exercise-form`): a read, drawn by the app as
 * the form media card under the reply. One event for each exercise, in call order. It carries no URL.
 */
const exerciseFormMediaEventSchema = z.strictObject({
  type: z.literal("exercise_form_media"),
  exercise: assistantExerciseFormMediaSchema,
});

/**
 * A recipe the assistant drafted (`suggest_recipe`, `adjust_recipe`), drawn by the app under the reply. A
 * read: nothing is saved until the person presses Save to recipes. One event for each draft, in call order.
 */
// Not strict, unlike the other events, so a field a later version adds beside `draft` is stripped by an app
// that is behind instead of failing the turn.
const recipeDraftEventSchema = z.object({
  type: z.literal("recipe_draft"),
  draft: assistantRecipeDraftSchema,
});

/**
 * Why a recipe did not come (`assistant-card · recipe-draft-failed`): `suggest_recipe` or `adjust_recipe` ended timed
 * out or refused. Drawn by the app as a notice under the reply. It is an event of its own and not a `notice`,
 * because the notices are the gates of the whole assistant, and an app that is behind skips an event it does not
 * know. Not strict, like `recipe_draft`.
 */
const recipeNoticeEventSchema = z.object({
  type: z.literal("recipe_notice"),
  notice: assistantRecipeNoticeSchema,
});

/**
 * A saved recipe `adjust_recipe` could not change as asked (`assistant-card · recipe-compare`, refused): the
 * card with what a serving reaches against what was asked. Not strict, like `recipe_draft`.
 */
const recipeRefusalEventSchema = z.object({
  type: z.literal("recipe_refusal"),
  refusal: assistantRecipeRefusalSchema,
});

/**
 * The Ask again quick reply under the reply (`assistant · workout-in-progress`, A change refused): a press
 * sends the person's last message again. A later turn takes it away.
 */
const askAgainEventSchema = z.strictObject({ type: z.literal("ask_again") });

/**
 * One question instead of a guess (`assistant · clarify`). The quick replies are the food's own
 * portions or grams, at most 3, and a tap sends the reply's words as the next message.
 */
const clarifyEventSchema = z.strictObject({
  type: z.literal("clarify"),
  question: z.string().min(1),
  quickReplies: z.array(z.string().min(1)).max(3),
  fieldHint: z.string().min(1).nullable(),
});

/**
 * A destructive or bulk write waits for a yes (`assistant · confirm`). A button press sends its label
 * as the next message, so the labels are the words the board draws on the buttons.
 */
const confirmEventSchema = z.strictObject({
  type: z.literal("confirm"),
  confirmationId: assistantIdSchema,
  question: z.string().min(1),
  confirmLabel: z.string().min(1),
  cancelLabel: z.string().min(1),
  tone: z.enum(["danger", "primary"]),
});

/**
 * Under an answer from the person's data (`assistant · answer`, `assistant · answer-estimate`): the one
 * line citing what it is based on, and the Estimate label when the answer is a model estimate.
 */
const answerMetaEventSchema = z.strictObject({
  type: z.literal("answer_meta"),
  citation: z.string().min(1).nullable(),
  estimate: z.string().min(1).nullable(),
});

/** Why the turn cannot go on, or why it failed. */
const noticeEventSchema = z.strictObject({
  type: z.literal("notice"),
  notice: assistantNoticeSchema,
});

/** The last event of every turn. A turn stopped by closing the sheet never reaches it. */
const doneEventSchema = z.strictObject({
  type: z.literal("done"),
  outcome: z.enum(["complete", "clarify", "confirm", "failed"]),
});

export const assistantStreamEventSchema = z.discriminatedUnion("type", [
  turnEventSchema,
  textEventSchema,
  statusEventSchema,
  cardEventSchema,
  linkEventSchema,
  exerciseMusclesEventSchema,
  exerciseFormMediaEventSchema,
  recipeDraftEventSchema,
  recipeNoticeEventSchema,
  recipeRefusalEventSchema,
  askAgainEventSchema,
  clarifyEventSchema,
  confirmEventSchema,
  answerMetaEventSchema,
  noticeEventSchema,
  doneEventSchema,
]);

export type AssistantStreamEvent = z.infer<typeof assistantStreamEventSchema>;

// Omit does not distribute over a union, so each member loses its `type` on its own.
type WithoutType<Event> = Event extends unknown ? Omit<Event, "type"> : never;

/** What a status event says, without its `type`: the turn's current step. */
export type AssistantStatus = WithoutType<Extract<AssistantStreamEvent, { type: "status" }>>;

/**
 * One SSE `data:` payload that did not parse. `invalid_json` is a payload that is not JSON, and
 * `unknown_kind` an event type, or the kind of a card, that this app has no schema for because the server is
 * ahead of it: the reader skips it and the turn goes on. It carries the kind's name and nothing else, and
 * only when the name is a plain word of the kind of name the contract uses (`kindNamePattern`). Any other
 * value is `invalid_event`, so what a payload holds never reaches a log by way of its kind. `invalid_event`
 * is a JSON value that is not an event, with the paths of the fields that broke, such as
 * `outcome`. An extra key is named by its whole path, such as `card.rows.0.grams`, because a key's name
 * is not a value. Never a value: the text is the person's, so nothing the event holds reaches a log or
 * an error report from here.
 */
export type SkippedLink = { subject: "link"; kind: string };

export type ParsedAssistantEvent =
  | { ok: true; event: AssistantStreamEvent; skipped?: SkippedLink }
  | { ok: false; reason: "invalid_json" | "invalid_event"; fieldPaths: string[] }
  | { ok: false; reason: "unknown_kind"; subject: "event" | "card"; kind: string };

const readJson = (line: string): { ok: true; value: unknown } | { ok: false } => {
  try {
    return { ok: true, value: JSON.parse(line) };
  } catch {
    return { ok: false };
  }
};

// The status events are a union of their own, keyed by `code`, so one member stands for all of them.
const eventTypeOf = (option: (typeof assistantStreamEventSchema.options)[number]): string =>
  "shape" in option ? option.shape.type.value : option.options[0].shape.type.value;

const knownEventTypes: ReadonlySet<string> = new Set(
  assistantStreamEventSchema.options.map(eventTypeOf),
);
const knownCardKinds: ReadonlySet<string> = new Set(assistantCardSchema.shape.kind.options);

// The shape of every event type and card kind name in the contract.
const kindNamePattern = /^[a-z][a-z0-9_]{0,63}$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const nameOfUnknownKind = (known: ReadonlySet<string>, name: unknown): string | null =>
  typeof name === "string" && kindNamePattern.test(name) && !known.has(name) ? name : null;

// The type of an event, or the kind of the card in a card event, when the schema refused it for being
// ahead of this app.
function unknownKindOf(value: unknown): { subject: "event" | "card"; kind: string } | null {
  if (!isRecord(value)) {
    return null;
  }
  const eventType = nameOfUnknownKind(knownEventTypes, value["type"]);
  if (eventType !== null) {
    return { subject: "event", kind: eventType };
  }
  const cardKind =
    value["type"] === "card" && isRecord(value["card"])
      ? nameOfUnknownKind(knownCardKinds, value["card"]["kind"])
      : null;
  return cardKind === null ? null : { subject: "card", kind: cardKind };
}

const knownLinkScreens: ReadonlySet<string> = new Set(
  assistantCardLinkSchema.shape.target.options.map((option) => option.shape.screen.value),
);

// A card of a known kind whose link this app cannot read (a screen it does not know) is kept with no link,
// and `skipped` names the screen when it is a plain word of the kind of name the contract uses, and
// `unreadable` when it is not. The card is tried again with its link removed, so a card that is wrong
// anywhere else still fails.
function cardWithoutUnreadableLink(value: unknown): ParsedAssistantEvent | null {
  if (!isRecord(value) || value["type"] !== "card" || !isRecord(value["card"])) {
    return null;
  }
  const { link } = value["card"];
  if (!isRecord(link)) {
    return null;
  }
  const retried = assistantStreamEventSchema.safeParse({
    ...value,
    card: { ...value["card"], link: null },
  });
  if (!retried.success) {
    return null;
  }
  const screen = isRecord(link["target"]) ? link["target"]["screen"] : undefined;
  // A screen the app knows with bad parameters is unreadable, not an unknown screen, so it is not named.
  const kind =
    typeof screen === "string" && kindNamePattern.test(screen) && !knownLinkScreens.has(screen)
      ? screen
      : "unreadable";
  return { ok: true, event: retried.data, skipped: { subject: "link", kind } };
}

// A status the schema refused is a step this app has no words for, so it reads as the default step.
const isStatusObject = (value: unknown): boolean =>
  typeof value === "object" && value !== null && "type" in value && value.type === "status";

/**
 * Reads one SSE `data:` payload as an assistant event. It never throws, a status it cannot read is
 * `thinking`, and an event type or card kind it does not know is `unknown_kind`.
 */
export const parseAssistantEvent = (line: string): ParsedAssistantEvent => {
  const json = readJson(line);
  if (!json.ok) {
    return { ok: false, reason: "invalid_json", fieldPaths: [] };
  }
  const result = assistantStreamEventSchema.safeParse(json.value);
  if (result.success) {
    return { ok: true, event: result.data };
  }
  if (isStatusObject(json.value)) {
    return { ok: true, event: { type: "status", code: "thinking" } };
  }
  const withoutLink = cardWithoutUnreadableLink(json.value);
  if (withoutLink !== null) {
    return withoutLink;
  }
  const unknownKind = unknownKindOf(json.value);
  if (unknownKind !== null) {
    return { ok: false, reason: "unknown_kind", ...unknownKind };
  }
  const fieldPaths = result.error.issues
    .flatMap((issue) =>
      issue.code === "unrecognized_keys"
        ? issue.keys.map((key) => [...issue.path, key].join("."))
        : [issue.path.join(".")],
    )
    .filter((path) => path !== "");
  return { ok: false, reason: "invalid_event", fieldPaths: [...new Set(fieldPaths)] };
};

/**
 * The longest message a person can send the assistant, in characters. A recommendation the owner can
 * change, shared by the `turn` route and the composer so neither accepts what the other refuses.
 */
export const ASSISTANT_MAX_TEXT_LENGTH = 2000;

/**
 * The body of `POST /functions/v1/assistant/turn`. `conversationId` is null for the first message of a
 * new conversation. `localDate` is the day the sheet was opened on, in the person's time zone, so
 * Describe opened from Log food on another day logs to that day. `localTime` is the Describe hint's hour,
 * `HH:MM`, or null. `entry` is where the sheet was opened from when it was not the chat: the Plan screen or a
 * recipe. It makes the turn a kitchen turn (ADR 0006, Amendment 5). It is left out for every other sheet, so an
 * app that does not send it is still valid.
 */
export const assistantTurnRequestSchema = z.strictObject({
  conversationId: assistantIdSchema.nullable(),
  text: z.string().trim().min(1).max(ASSISTANT_MAX_TEXT_LENGTH),
  localDate: z.iso.date(),
  localTime: z.iso.time({ precision: -1 }).nullable(),
  entry: z.enum(["plan", "recipe"]).optional(),
});

export type AssistantTurnRequest = z.infer<typeof assistantTurnRequestSchema>;
