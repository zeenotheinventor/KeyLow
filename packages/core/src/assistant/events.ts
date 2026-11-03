import { z } from "zod";

import { assistantCardSchema } from "./card";
import { assistantIdSchema } from "./ids";
import { assistantNoticeSchema } from "./notice";

/*
 * The events the `assistant` Edge Function streams to the app, one JSON event per Server-Sent Events
 * `data:` line (M8 plan, section 5, "Contracts"). Both sides parse them with these schemas, so a field
 * the other side does not know is an error, never a silent extra.
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
 * What the function is doing while no text arrives, with send disabled. The only one is reading a
 * recipe page, and the screen words it as "Reading the recipe at example.com" from `host`
 * (`assistant · recipe-import`, left).
 */
const statusEventSchema = z.strictObject({
  type: z.literal("status"),
  code: z.literal("reading_recipe"),
  host: z.string().min(1),
});

/** A write was applied: its action card, with Undo. */
const cardEventSchema = z.strictObject({
  type: z.literal("card"),
  card: assistantCardSchema,
});

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
  clarifyEventSchema,
  confirmEventSchema,
  answerMetaEventSchema,
  noticeEventSchema,
  doneEventSchema,
]);

export type AssistantStreamEvent = z.infer<typeof assistantStreamEventSchema>;

/**
 * One SSE `data:` payload that did not parse. `invalid_json` is a payload that is not JSON, and
 * `invalid_event` a JSON value that is not an event, with the paths of the fields that broke, such as
 * `outcome`. An extra key is named by its whole path, such as `card.rows.0.grams`, because a key's name
 * is not a value. Never a value: the text is the person's, so nothing the event holds reaches a log or
 * an error report from here.
 */
export type ParsedAssistantEvent =
  | { ok: true; event: AssistantStreamEvent }
  | { ok: false; reason: "invalid_json" | "invalid_event"; fieldPaths: string[] };

const readJson = (line: string): { ok: true; value: unknown } | { ok: false } => {
  try {
    return { ok: true, value: JSON.parse(line) };
  } catch {
    return { ok: false };
  }
};

/** Reads one SSE `data:` payload as an assistant event. It never throws. */
export const parseAssistantEvent = (line: string): ParsedAssistantEvent => {
  const json = readJson(line);
  if (!json.ok) {
    return { ok: false, reason: "invalid_json", fieldPaths: [] };
  }
  const result = assistantStreamEventSchema.safeParse(json.value);
  if (result.success) {
    return { ok: true, event: result.data };
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
 * `HH:MM`, or null.
 */
export const assistantTurnRequestSchema = z.strictObject({
  conversationId: assistantIdSchema.nullable(),
  text: z.string().trim().min(1).max(ASSISTANT_MAX_TEXT_LENGTH),
  localDate: z.iso.date(),
  localTime: z.iso.time({ precision: -1 }).nullable(),
});

export type AssistantTurnRequest = z.infer<typeof assistantTurnRequestSchema>;
