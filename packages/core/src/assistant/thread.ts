import { z } from "zod";

import { assistantCardLinkSchema, assistantCardSchema } from "./card";
import { assistantExerciseMusclesSchema } from "./exerciseMusclesCard";
import { assistantNoticeSchema } from "./notice";
import { undoStateOfActions } from "./undoState";
import { ASSISTANT_CARD_KINDS_WITHOUT_UNDO, mergeAssistantCards } from "./writeToolWords";

import type { AssistantCard, AssistantCardLink } from "./card";
import type { AssistantExerciseMuscles } from "./exerciseMusclesCard";
import type { AssistantNotice } from "./notice";
import type { AssistantActionState } from "./undoState";

/*
 * The conversation thread (M8 plan, section 5, "useAssistantConversation"), read back from what the
 * `assistant` function stored. The function keeps each message as the Messages API content blocks it
 * sent and received, so the next turn replays history unchanged. This file turns those blocks into the
 * items a screen draws, the same items the live turn streams, so a reopened sheet looks like the one that
 * was closed.
 */

export type AssistantTurnStatus =
  "open" | "complete" | "clarify" | "confirm" | "stopped" | "failed" | "refused";

/** One row of `assistant_messages`, with the status of the turn it belongs to, in `seq` order. */
export type AssistantStoredMessage = {
  id: string;
  turnId: string;
  role: "user" | "assistant";
  /** The Messages API content: a string, or a list of blocks. */
  content: unknown;
  /**
   * What the app draws for the tool results of a user-role message, keyed by `tool_use_id`, or null:
   * `assistant_messages.display` (ADR 0003, Amendment 14 addendum).
   */
  display: unknown;
  turnStatus: AssistantTurnStatus;
};

export type AssistantAnswerMeta = { citation: string | null; estimate: string | null };

/**
 * `answered` is true on a question or a confirmation once a later turn exists, because the person has
 * replied by then and its buttons are gone.
 */
export type AssistantThreadItem =
  | { kind: "user"; id: string; text: string }
  | {
      kind: "reply";
      id: string;
      text: string;
      answerMeta: AssistantAnswerMeta | null;
      stopped: boolean;
    }
  | { kind: "card"; id: string; card: AssistantCard }
  | {
      kind: "clarify";
      id: string;
      question: string;
      quickReplies: string[];
      fieldHint: string | null;
      answered: boolean;
    }
  | {
      kind: "confirm";
      id: string;
      confirmationId: string;
      question: string;
      confirmLabel: string;
      cancelLabel: string;
      tone: "danger" | "primary";
      answered: boolean;
    }
  | { kind: "notice"; id: string; notice: AssistantNotice }
  /** A link on its own, under the words of an answer that changed nothing (`assistant-card · routine-updated`, Removing a day). */
  | { kind: "link"; id: string; link: AssistantCardLink }
  /** The muscles an exercise works, drawn as a figure under the reply (`assistant-card · exercise-muscles`). One item for each exercise, in call order, never merged. */
  | { kind: "exercise_muscles"; id: string; exercise: AssistantExerciseMuscles }
  /** The Ask again quick reply at the end of a turn (`assistant · workout-in-progress`). `answered` once a later turn exists, and then the chip is gone. */
  | { kind: "ask_again"; id: string; answered: boolean };

/** The words under the field when the assistant asks a question (`assistant · clarify`). */
const CLARIFY_FIELD_HINT = "Or say it your way";

const ASK_USER_TOOL = "ask_user";

const textBlockSchema = z.object({ type: z.literal("text"), text: z.string() });

const toolUseBlockSchema = z.object({
  type: z.literal("tool_use"),
  id: z.string(),
  name: z.string(),
  input: z.unknown(),
});

const toolResultBlockSchema = z.object({
  type: z.literal("tool_result"),
  tool_use_id: z.string(),
});

const askUserInputSchema = z.object({
  question: z.string().min(1),
  quick_replies: z.array(z.string().min(1)).max(3),
});

/*
 * What the app draws for one tool result. The executor puts only the tool's model-facing text in the
 * `tool_result` block, and the card, the confirmation, the citation and the estimate reach the app
 * through its structured outcome, which the model never sees. The turn loop keeps that outcome in the
 * message's `display`, keyed by `tool_use_id`, and each entry is read on its own so a bad one drops only
 * itself.
 */
const displayEntrySchema = z.object({
  card: assistantCardSchema.optional(),
  confirm: z
    .object({
      confirmationId: z.string().min(1),
      question: z.string().min(1),
      confirmLabel: z.string().min(1),
      cancelLabel: z.string().min(1),
      tone: z.enum(["danger", "primary"]),
    })
    .optional(),
  link: assistantCardLinkSchema.optional(),
  // A non-strict object, so an older app reading a stored row drops this key and draws nothing.
  exerciseMuscles: assistantExerciseMusclesSchema.optional(),
  askAgain: z.boolean().optional(),
  citation: z.string().min(1).nullish(),
  estimate: z.string().min(1).nullish(),
});

type DisplayEntry = z.infer<typeof displayEntrySchema>;

const displaySchema = z.record(z.string(), z.unknown());

function displayEntryOf(display: unknown, toolUseId: string): DisplayEntry | null {
  const entries = displaySchema.safeParse(display);
  if (!entries.success || !Object.hasOwn(entries.data, toolUseId)) {
    return null;
  }
  const parsed = displayEntrySchema.safeParse(entries.data[toolUseId]);
  return parsed.success ? parsed.data : null;
}

type Block =
  | z.infer<typeof textBlockSchema>
  | z.infer<typeof toolUseBlockSchema>
  | z.infer<typeof toolResultBlockSchema>;

function blocksOf(content: unknown): Block[] {
  if (typeof content === "string") {
    return [{ type: "text", text: content }];
  }
  if (!Array.isArray(content)) {
    return [];
  }
  return content.flatMap((raw: unknown) => {
    for (const schema of [textBlockSchema, toolUseBlockSchema, toolResultBlockSchema]) {
      const parsed = schema.safeParse(raw);
      if (parsed.success) {
        return [parsed.data];
      }
    }
    return [];
  });
}

const textOf = (blocks: readonly Block[]): string[] =>
  blocks.flatMap((block) =>
    block.type === "text" && block.text.trim() !== "" ? [block.text] : [],
  );

// A card waiting to be merged with the next result of the same tool, then given its live undo state.
type DraftItem =
  | AssistantThreadItem
  | { kind: "draft_card"; id: string; cards: [AssistantCard, ...AssistantCard[]] };

type TurnContext = {
  actionsById: ReadonlyMap<string, AssistantActionState>;
  answered: boolean;
};

const distinct = (values: readonly (string | null | undefined)[]): string | null => {
  const kept = [...new Set(values.flatMap((value) => (value ? [value] : [])))];
  return kept.length === 0 ? null : kept.join(" · ");
};

function itemsOfTurn(
  turn: readonly AssistantStoredMessage[],
  context: TurnContext,
): AssistantThreadItem[] {
  const items: DraftItem[] = [];
  // The muscles of an exercise, a link and Ask again are drawn at the end of the turn, under its words, as
  // the boards show them: the reply, the muscles, the link, a notice, then Ask again.
  const exerciseMuscles: AssistantThreadItem[] = [];
  const links: AssistantThreadItem[] = [];
  const askAgains: AssistantThreadItem[] = [];
  const citations: (string | null | undefined)[] = [];
  const estimates: (string | null | undefined)[] = [];

  for (const message of turn) {
    const blocks = blocksOf(message.content);

    if (message.role === "user") {
      // The turn loop puts a date block first and the person's words last.
      const words = textOf(blocks).at(-1);
      if (words !== undefined) {
        items.push({ kind: "user", id: message.id, text: words });
      }
    } else {
      const text = textOf(blocks).join("\n\n");
      if (text !== "") {
        items.push({
          kind: "reply",
          id: `${message.id}:text`,
          text,
          answerMeta: null,
          stopped: false,
        });
      }
    }

    for (const [index, block] of blocks.entries()) {
      const id = `${message.id}:${index}`;
      if (block.type === "tool_use") {
        const question =
          block.name === ASK_USER_TOOL ? askUserInputSchema.safeParse(block.input) : null;
        if (question?.success) {
          items.push({
            kind: "clarify",
            id,
            question: question.data.question,
            quickReplies: question.data.quick_replies,
            fieldHint: CLARIFY_FIELD_HINT,
            answered: context.answered,
          });
        }
      } else if (block.type === "tool_result") {
        const outcome = displayEntryOf(message.display, block.tool_use_id);
        if (outcome === null) {
          continue;
        }
        citations.push(outcome.citation);
        estimates.push(outcome.estimate);
        const last = items.at(-1);
        if (outcome.card !== undefined) {
          if (last?.kind === "draft_card" && last.cards[0].kind === outcome.card.kind) {
            last.cards.push(outcome.card);
          } else {
            items.push({ kind: "draft_card", id, cards: [outcome.card] });
          }
        }
        if (outcome.confirm !== undefined) {
          items.push({ kind: "confirm", id, ...outcome.confirm, answered: context.answered });
        }
        if (outcome.exerciseMuscles !== undefined) {
          exerciseMuscles.push({
            kind: "exercise_muscles",
            id: `${id}:exerciseMuscles`,
            exercise: outcome.exerciseMuscles,
          });
        }
        if (outcome.link !== undefined) {
          links.push({ kind: "link", id: `${id}:link`, link: outcome.link });
        }
        if (outcome.askAgain === true) {
          askAgains.push({ kind: "ask_again", id: `${id}:askAgain`, answered: context.answered });
        }
      }
    }
  }

  return finishTurn(
    items,
    turn,
    context,
    { citation: distinct(citations), estimate: distinct(estimates) },
    { exerciseMuscles, links, askAgains },
  );
}

function finishTurn(
  drafts: DraftItem[],
  turn: readonly AssistantStoredMessage[],
  context: TurnContext,
  meta: AssistantAnswerMeta,
  trailing: {
    exerciseMuscles: AssistantThreadItem[];
    links: AssistantThreadItem[];
    askAgains: AssistantThreadItem[];
  },
): AssistantThreadItem[] {
  const status = turn[0]?.turnStatus;
  const items = drafts.map((item): AssistantThreadItem => {
    if (item.kind !== "draft_card") {
      return item;
    }
    const merged = mergeAssistantCards(item.cards);
    // A card that can never be undone stays so, whatever its actions say.
    const neverUndoable =
      merged.undo === "unavailable" || ASSISTANT_CARD_KINDS_WITHOUT_UNDO.has(merged.kind);
    const undo = neverUndoable
      ? "unavailable"
      : undoStateOfActions(merged.actionIds, context.actionsById);
    return { kind: "card", id: item.id, card: { ...merged, undo } };
  });

  const lastReplyIndex = items.map((item) => item.kind).lastIndexOf("reply");
  const lastReply = items[lastReplyIndex];
  if (lastReply?.kind === "reply") {
    items[lastReplyIndex] = {
      ...lastReply,
      answerMeta: meta.citation === null && meta.estimate === null ? null : meta,
      stopped: status === "stopped",
    };
  }
  items.push(...trailing.exerciseMuscles, ...trailing.links);
  if (status === "failed" || status === "refused") {
    items.push({ kind: "notice", id: `${turn[0]?.turnId}:notice`, notice: failedTurnNotice });
  }
  // Ask again is a convenience for a turn that ended complete with nothing written: the live turn sends it
  // only then, so a reopened turn draws it only then too. Sending the message again after a write landed
  // would repeat that write, and a question or a failed turn has its own way on.
  const wroteSomething = drafts.some((item) => item.kind === "draft_card");
  if (status === "complete" && !wroteSomething) {
    items.push(...trailing.askAgains);
  }
  return items;
}

const failedTurnNotice: AssistantNotice = assistantNoticeSchema.parse({ code: "turn_failed" });

/**
 * The items of a stored conversation, oldest first. `rawMessages` must be in `seq` order. `actions` are
 * the caller's `assistant_actions`, which give each card its live undo state.
 */
export function threadFromMessages(
  rawMessages: readonly AssistantStoredMessage[],
  actions: readonly AssistantActionState[],
): AssistantThreadItem[] {
  const actionsById = new Map(actions.map((action) => [action.id, action]));
  const turns: AssistantStoredMessage[][] = [];
  for (const message of rawMessages) {
    const turn = turns.at(-1);
    if (turn?.[0]?.turnId === message.turnId) {
      turn.push(message);
    } else {
      turns.push([message]);
    }
  }
  return turns.flatMap((turn, index) =>
    itemsOfTurn(turn, { actionsById, answered: index < turns.length - 1 }),
  );
}
