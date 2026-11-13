import { replyWords } from "./replyText";
import {
  ASSISTANT_CARD_WORDS,
  ASSISTANT_OFFLINE,
  describeAssistantNotice,
  describeAssistantStatus,
} from "../copy/assistantNotices";
import { RECIPE_WORKING_HINT } from "../copy/assistantRecipeDraftCard";
import {
  ASSISTANT_DESCRIBE,
  ASSISTANT_SHEET,
  ASSISTANT_TRAIN_SHEET,
  describeLogsAt,
} from "../copy/assistantSheet";

import type { AdjustmentDraft } from "./adjustmentDraft";
import type { AssistantCard, AssistantCardLink } from "./card";
import type { AssistantOpenedFrom } from "./describeInLog";
import type { AssistantStatus } from "./events";
import type { AssistantExerciseFormMedia } from "./exerciseFormCard";
import type { AssistantExerciseMuscles } from "./exerciseMusclesCard";
import type { AssistantNotice } from "./notice";
import type { AssistantRecipeDraft } from "./recipeDraft";
import type { SuggestionDraft } from "./recipeDraftOf";
import type { AssistantRecipeNotice } from "./recipeNotice";
import type { AssistantRecipeRefusal } from "./recipeRefusal";
import type { AssistantThreadItem } from "./thread";
import type { DescribableAssistantNotice } from "../copy/assistantNotices";

/*
 * What the assistant sheet draws in its thread (`assistant · empty`, `streaming`, `conversation`,
 * `unavailable`): the stored conversation, and under it the message sent from this sheet with the reply
 * as it arrives. The action cards are drawn here, with the state of their Undo given by
 * `describeAssistantCard`, and so are the questions the assistant asks (`assistant · clarify` and
 * `confirm`): its words, then the quick replies or the two buttons, which are gone once the person has
 * sent their next message. An answer from the person's data carries its citation and, for the trend
 * weight, its Estimate line, exactly as the tool sent them (`assistant · answer`, `answer-estimate`), and
 * the working line shows the turn's current step under your message, "Thinking" until the assistant says
 * more (`assistant · working`, `assistant · recipe-reading`).
 */

/** What the sheet needs of the turn being written: the part of `AssistantLiveTurn` it draws. */
export type AssistantSheetLiveTurn = {
  text: string;
  /** The writes the turn has made so far, each with its Undo. */
  cards: readonly AssistantCard[];
  /** The line under the answer and the Estimate badge, sent at the end of an answer from the person's data. */
  answerMeta: { citation: string | null; estimate: string | null } | null;
  /** The step the assistant is on, until the next event of the turn. */
  status: AssistantStatus | null;
  /** The question that ended the turn, with the words in the field and up to three quick replies. */
  clarify: {
    question: string;
    quickReplies: readonly string[];
    fieldHint: string | null;
  } | null;
  /** The confirmation that ended the turn. Its question is the text of the reply that asked it. */
  confirm: {
    question: string;
    confirmLabel: string;
    cancelLabel: string;
    tone: "danger" | "primary";
  } | null;
  /** The muscles of each exercise the turn showed, in call order, drawn under its words. */
  exerciseMuscles?: readonly AssistantExerciseMuscles[] | undefined;
  /** The form media of each exercise the turn showed, in call order, drawn under its words. */
  exerciseFormMedia?: readonly AssistantExerciseFormMedia[] | undefined;
  /** The recipes the turn drafted, in call order, drawn under its words. */
  recipeDrafts?: readonly AssistantRecipeDraft[] | undefined;
  /** The notices for a recipe that did not come, in call order, drawn under its words. */
  recipeNotices?: readonly AssistantRecipeNotice[] | undefined;
  /** The adjustments that were refused, in call order, drawn under its words. */
  recipeRefusals?: readonly AssistantRecipeRefusal[] | undefined;
  /** A link on its own that the turn sent, drawn under its words. */
  link?: AssistantCardLink | null | undefined;
  /** Whether the turn sent the Ask again quick reply. It is offered once the turn has ended. */
  askAgain?: boolean | undefined;
  stopped: boolean;
  notice: AssistantNotice | null;
  /** How the turn ended, null while it is still going or when it was stopped. */
  outcome: "complete" | "clarify" | "confirm" | "failed" | null;
};

/**
 * The message the person sent from this sheet, and the id of the last stored item when they sent it
 * (null for a conversation with none). While the answer arrives it is always drawn, with the stored items
 * after that one left out, because the function stores your message at the start of the turn and a read
 * during the stream returns it. It stays drawn after the answer has ended, until the stored conversation
 * holds an item that ends the turn after that one (`isSentTurnStored`): a read that landed during the
 * stream holds your message, or your message and a card, and letting go of the reply then would leave
 * it missing until the next read.
 */
export type AssistantSheetSent = { text: string; afterItemId: string | null };

/** The Estimate badge and the muted line beside it, such as "Estimate" and "Trend weight is an estimate". */
export type AssistantSheetEstimate = { badgeLabel: string; label: string };

export type AssistantSheetEntry =
  | { kind: "you"; key: string; text: string }
  | { kind: "card"; key: string; card: AssistantCard }
  | {
      /** The quick replies under a clarifying question, each sent as your message when pressed. */
      kind: "quickReplies";
      key: string;
      options: string[];
    }
  | {
      /** The muscles an exercise works, a flat card with a figure and a row for each role (`assistant-card · exercise-muscles`). */
      kind: "exerciseMuscles";
      key: string;
      exercise: AssistantExerciseMuscles;
    }
  | {
      /** The form video or photos of an exercise, the form media card (`assistant-card · exercise-form`). */
      kind: "exerciseFormMedia";
      key: string;
      exercise: AssistantExerciseFormMedia;
    }
  | {
      /** A recipe the assistant suggested, the card with its figures, ingredients and Save to recipes (`assistant-card · recipe-draft`). */
      kind: "recipeDraft";
      key: string;
      draft: SuggestionDraft;
    }
  | {
      /** A saved recipe the assistant changed, the compare card with its before and after and Save as new recipe (`assistant-card · recipe-compare`). */
      kind: "recipeCompare";
      key: string;
      draft: AdjustmentDraft;
    }
  | {
      /** Why a recipe did not come, the notice of `assistant-card · recipe-draft-failed`. */
      kind: "recipeNotice";
      key: string;
      notice: AssistantRecipeNotice;
      /** Only the notice at the end of the thread offers its button, and not when the turn wrote something, which sending again would repeat. */
      isLatest: boolean;
      canRetry: boolean;
    }
  | {
      /** A saved recipe that could not be changed as asked, the refused card (`assistant-card · recipe-compare`, refused). */
      kind: "recipeRefusal";
      key: string;
      refusal: AssistantRecipeRefusal;
    }
  | {
      /** A link on its own, a line that opens what the answer is about (`assistant-card · routine-updated`, Removing a day). */
      kind: "link";
      key: string;
      link: AssistantCardLink;
    }
  | {
      /** The turn offers Ask again. It is drawn as the quick reply at the end of the thread, as for an answer that was cut short, and has no entry of its own. */
      kind: "askAgain";
      key: string;
    }
  | {
      /** The two buttons under a confirmation: yes first, then the cancel. Each is sent as your message. */
      kind: "confirm";
      key: string;
      confirmLabel: string;
      cancelLabel: string;
      tone: "danger" | "primary";
    }
  | {
      kind: "assistant";
      key: string;
      paragraphs: string[];
      isStreaming: boolean;
      isStopped: boolean;
      /** The line naming the data the answer used, exactly as the tool sent it, else null. */
      citation: string | null;
      /** The Estimate badge for an answer built on an estimate, else null. */
      estimate: AssistantSheetEstimate | null;
    }
  | {
      /** The working line under your message while the assistant works with no words to show. */
      kind: "status";
      key: string;
      text: string;
      /** A second line that appears once the step has gone on this long, for a step that takes a while (`assistant · working-long`). Left off every other step. */
      hint?: { words: string; afterMilliseconds: number };
    }
  | {
      kind: "notice";
      key: string;
      notice: DescribableAssistantNotice;
      /** Only the notice at the end of the thread offers its button. */
      isLatest: boolean;
    };

export type AssistantSheetThread = {
  entries: AssistantSheetEntry[];
  /** Your last message, which Try again and Ask again send again. Null before the first one. */
  lastMessage: string | null;
  /** Whether the thread ends in an answer that was cut short, or a turn that asked for it, which offers the Ask again quick reply. */
  canAskAgain: boolean;
  /** The words in the empty field while a clarifying question waits for its answer ("Or say it your way"), else null. */
  fieldHint: string | null;
  /** Whether the sheet is to be at full height, which a recipe import card needs so its ingredient list shows, and so does a routine just built, so its days can open, and so does the muscles of an exercise, for its figure and its rows, and its form media. */
  needsFullHeight: boolean;
};

type BuildInput = {
  items: readonly AssistantThreadItem[];
  sent: AssistantSheetSent | null;
  live: AssistantSheetLiveTurn | null;
  isStreaming: boolean;
  /**
   * The notice that limits the assistant now (`AssistantSheetAccess` `limited`), drawn at the end of the
   * thread unless the thread already ends in that very notice. Null when nothing limits it.
   */
  accessNotice?: DescribableAssistantNotice | null;
};

// An entry before it knows whether it ends the thread.
type DraftEntry =
  | Exclude<AssistantSheetEntry, { kind: "notice" | "recipeNotice" }>
  | { kind: "notice"; key: string; notice: DescribableAssistantNotice }
  | { kind: "recipeNotice"; key: string; notice: AssistantRecipeNotice; canRetry: boolean };

const isDescribable = (notice: AssistantNotice): notice is DescribableAssistantNotice =>
  notice.code !== "consent_needed";

/** The paragraphs of a reply: one for each blank line, so a single line break stays inside its paragraph. */
const paragraphsOf = (text: string): string[] =>
  text.split(/\n{2,}/).filter((paragraph) => paragraph.trim() !== "");

/** The lines under an answer, as the event sent them. Nothing is worded, counted or rounded here. */
const answerLinesOf = (
  meta: { citation: string | null; estimate: string | null } | null,
): Pick<Extract<AssistantSheetEntry, { kind: "assistant" }>, "citation" | "estimate"> => ({
  citation: meta?.citation ?? null,
  estimate:
    meta === null || meta.estimate === null
      ? null
      : { badgeLabel: ASSISTANT_CARD_WORDS.estimateLabel, label: meta.estimate },
});

/** A recipe made from a link: its lines say which food each matched, which a recipe made from typed ingredients has none of. */
const isRecipeImportCard = (card: AssistantCard): boolean =>
  card.kind === "recipe_created" && card.rows.some((row) => row.match !== null);

// A routine that was just built, whose days need the room to open (`assistant-card · routine-created`): the
// thread's last card only, because an earlier one has been read already.
function endsWithBuiltRoutine(entries: readonly AssistantSheetEntry[]): boolean {
  for (let position = entries.length - 1; position >= 0; position -= 1) {
    const entry = entries[position];
    if (entry?.kind === "card") {
      return entry.card.kind === "routine_created";
    }
  }
  return false;
}

// Whether the paragraphs of a reply end with the paragraphs of a question: the question of a confirmation is
// the text of the reply that asked it, and the live reply joins every step's words, so words can come first.
function endsWithWords(reply: readonly string[], question: readonly string[]): boolean {
  const replyWords = reply.map((paragraph) => paragraph.trim());
  const questionWords = question.map((paragraph) => paragraph.trim());
  return (
    questionWords.length > 0 &&
    questionWords.length <= replyWords.length &&
    questionWords.every(
      (paragraph, position) =>
        paragraph === replyWords[replyWords.length - questionWords.length + position],
    )
  );
}

// How many of the question's leading paragraphs the reply already ends with, the most there are, or 0.
function paragraphsAlreadyDrawn(reply: readonly string[], question: readonly string[]): number {
  for (let count = question.length; count > 0; count -= 1) {
    if (endsWithWords(reply, question.slice(0, count))) {
      return count;
    }
  }
  return 0;
}

/**
 * A question as the assistant's words, less what the entry before it already drew. The question of a
 * confirmation is the text of the reply that asked it, which is drawn already, and it may go on with a line
 * the code added after the model's words (a tool's note, KEY-824). So when the reply before ends with the
 * question's leading paragraphs, only the rest is drawn, as its own entry. The whole question matching
 * draws nothing, and nothing matching draws the whole question.
 */
function questionEntries(
  key: string,
  question: string,
  previous: DraftEntry | undefined,
): DraftEntry[] {
  const paragraphs = paragraphsOf(question);
  const drawn =
    previous?.kind === "assistant" ? paragraphsAlreadyDrawn(previous.paragraphs, paragraphs) : 0;
  const rest = paragraphs.slice(drawn);
  if (rest.length === 0 && drawn > 0) {
    return [];
  }
  return [
    {
      kind: "assistant",
      key: `${key}:question`,
      paragraphs: rest,
      isStreaming: false,
      isStopped: false,
      ...answerLinesOf(null),
    },
  ];
}

// An answered question keeps its words and loses its buttons: the boards draw your answer under it and
// nothing else (`assistant · confirm-yes`, `confirm-no`, `clarify` right).
function clarifyEntries(
  key: string,
  clarify: NonNullable<AssistantSheetLiveTurn["clarify"]>,
  isAnswered: boolean,
  previous: DraftEntry | undefined,
): DraftEntry[] {
  const question = questionEntries(key, clarify.question, previous);
  return isAnswered || clarify.quickReplies.length === 0
    ? question
    : [...question, { kind: "quickReplies", key, options: [...clarify.quickReplies] }];
}

function confirmEntries(
  key: string,
  confirm: NonNullable<AssistantSheetLiveTurn["confirm"]>,
  isAnswered: boolean,
  previous: DraftEntry | undefined,
): DraftEntry[] {
  const question = questionEntries(key, confirm.question, previous);
  return isAnswered
    ? question
    : [
        ...question,
        {
          kind: "confirm",
          key,
          confirmLabel: confirm.confirmLabel,
          cancelLabel: confirm.cancelLabel,
          tone: confirm.tone,
        },
      ];
}

/** `isAllAnswered`: the person has sent a message after these items, so every question in them is answered. */
function storedEntries(items: readonly AssistantThreadItem[], isAllAnswered = false): DraftEntry[] {
  const entries: DraftEntry[] = [];
  for (const item of items) {
    switch (item.kind) {
      case "user":
        entries.push({ kind: "you", key: item.id, text: item.text });
        break;
      case "card":
        entries.push({ kind: "card", key: item.id, card: item.card });
        break;
      case "reply":
        entries.push({
          kind: "assistant",
          key: item.id,
          paragraphs: paragraphsOf(item.text),
          isStreaming: false,
          isStopped: item.stopped,
          ...answerLinesOf(item.answerMeta),
        });
        break;
      case "clarify":
        entries.push(
          ...clarifyEntries(item.id, item, item.answered || isAllAnswered, entries.at(-1)),
        );
        break;
      case "confirm":
        entries.push(
          ...confirmEntries(item.id, item, item.answered || isAllAnswered, entries.at(-1)),
        );
        break;
      case "notice":
        if (isDescribable(item.notice)) {
          entries.push({ kind: "notice", key: item.id, notice: item.notice });
        }
        break;
      case "exercise_muscles":
        entries.push({ kind: "exerciseMuscles", key: item.id, exercise: item.exercise });
        break;
      case "exercise_form_media":
        entries.push({ kind: "exerciseFormMedia", key: item.id, exercise: item.exercise });
        break;
      case "recipe_draft":
        entries.push(recipeEntryOf(item.id, item.draft));
        break;
      case "recipe_refusal":
        entries.push({ kind: "recipeRefusal", key: item.id, refusal: item.refusal });
        break;
      case "recipe_notice":
        entries.push({
          kind: "recipeNotice",
          key: item.id,
          notice: item.notice,
          canRetry: item.canRetry,
        });
        break;
      case "link":
        entries.push({ kind: "link", key: item.id, link: item.link });
        break;
      case "ask_again":
        if (!item.answered && !isAllAnswered) {
          entries.push({ kind: "askAgain", key: item.id });
        }
        break;
    }
  }
  return entries;
}

// The words of the working line while the turn streams: the step the function sent, else Thinking while there
// is nothing else to show. That default is the part the app does by itself (press to first event, and every
// plain answer), and a stop, a question, a notice or the end of the turn stop it flashing for the moment before `done`.
function workingLineWords(live: AssistantSheetLiveTurn, hasWords: boolean): string | null {
  if (live.status !== null) {
    return describeAssistantStatus(live.status);
  }
  const hasSomethingElseToShow =
    hasWords ||
    live.stopped ||
    live.clarify !== null ||
    live.confirm !== null ||
    live.notice !== null ||
    live.outcome !== null;
  return hasSomethingElseToShow ? null : describeAssistantStatus({ code: "thinking" });
}

// A recipe takes a while to write, so its step gets the second line that says how long (`assistant · working-long`).
function workingLineHintOf(
  status: AssistantStatus | null,
): { words: string; afterMilliseconds: number } | null {
  const isRecipeTool =
    status?.code === "tool" && RECIPE_WORKING_HINT.tools.some((tool) => tool === status.tool);
  return isRecipeTool
    ? { words: RECIPE_WORKING_HINT.words, afterMilliseconds: RECIPE_WORKING_HINT.afterMilliseconds }
    : null;
}

function sentEntries(
  sent: AssistantSheetSent,
  live: AssistantSheetLiveTurn | null,
  isStreaming: boolean,
): DraftEntry[] {
  const entries: DraftEntry[] = [{ kind: "you", key: "sent:you", text: sent.text }];
  if (live === null) {
    return entries;
  }
  for (const [position, card] of live.cards.entries()) {
    entries.push({ kind: "card", key: `sent:card:${position}`, card });
  }
  // A marker the next chunk decides (a lone `**` or `-`) is held back, so it is not words yet and draws no caret.
  const hasWords = replyWords(live.text, { isPartial: true }).trim() !== "";
  // A step shows its line and no caret, and a text event clears the step, so words always replace the line.
  const isWriting = isStreaming && live.status === null && hasWords;
  // Words held back count once the turn is over: it has ended, or its outcome has arrived while the stream closes.
  const isOver = !isStreaming || live.outcome !== null;
  if (hasWords || live.stopped || (isOver && live.text.trim() !== "")) {
    entries.push({
      kind: "assistant",
      key: "sent:reply",
      paragraphs: paragraphsOf(live.text),
      isStreaming: isWriting,
      isStopped: live.stopped && !isStreaming,
      ...answerLinesOf(live.answerMeta),
    });
  }
  const workingWords = isStreaming ? workingLineWords(live, hasWords) : null;
  if (workingWords !== null) {
    const hint = workingLineHintOf(live.status);
    entries.push({
      kind: "status",
      key: "sent:status",
      text: workingWords,
      ...(hint === null ? {} : { hint }),
    });
  }
  if (live.clarify !== null) {
    entries.push(...clarifyEntries("sent:clarify", live.clarify, false, entries.at(-1)));
  }
  if (live.confirm !== null) {
    entries.push(...confirmEntries("sent:confirm", live.confirm, false, entries.at(-1)));
  }
  for (const [position, exercise] of (live.exerciseMuscles ?? []).entries()) {
    entries.push({ kind: "exerciseMuscles", key: `sent:exerciseMuscles:${position}`, exercise });
  }
  for (const [position, exercise] of (live.exerciseFormMedia ?? []).entries()) {
    entries.push({
      kind: "exerciseFormMedia",
      key: `sent:exerciseFormMedia:${position}`,
      exercise,
    });
  }
  for (const [position, draft] of (live.recipeDrafts ?? []).entries()) {
    entries.push(recipeEntryOf(`sent:recipeDraft:${position}`, draft));
  }
  for (const [position, refusal] of (live.recipeRefusals ?? []).entries()) {
    entries.push({ kind: "recipeRefusal", key: `sent:recipeRefusal:${position}`, refusal });
  }
  for (const [position, notice] of (live.recipeNotices ?? []).entries()) {
    // A turn that drew a card wrote something, and sending its message again would repeat the write.
    entries.push({
      kind: "recipeNotice",
      key: `sent:recipeNotice:${position}`,
      notice,
      canRetry: live.cards.length === 0,
    });
  }
  if (live.link !== undefined && live.link !== null) {
    entries.push({ kind: "link", key: "sent:link", link: live.link });
  }
  if (live.notice !== null && isDescribable(live.notice)) {
    entries.push({ kind: "notice", key: "sent:notice", notice: live.notice });
  }
  // A press while the turn is still streaming would be refused, so the chip waits for the end.
  if (live.askAgain === true && !isStreaming) {
    entries.push({ kind: "askAgain", key: "sent:askAgain" });
  }
  return entries;
}

// The instant or day a notice lifts at, which tells today's limit from an earlier one of the same code.
const liftsAt = (notice: DescribableAssistantNotice): string | null =>
  notice.code === "day_limit"
    ? notice.resetsAt
    : notice.code === "resting"
      ? notice.resumesOn
      : null;

const isSameNotice = (first: DescribableAssistantNotice, second: DescribableAssistantNotice) =>
  first.code === second.code && liftsAt(first) === liftsAt(second);

// A suggestion is the draft card and an adjustment is the compare card.
function recipeEntryOf(key: string, draft: AssistantRecipeDraft): AssistantSheetEntry {
  return draft.variant === "adjustment"
    ? { kind: "recipeCompare", key, draft }
    : { kind: "recipeDraft", key, draft };
}

// The cards of the muscles and the form media come after the reply, so a reply that was cut short is the entry before them.
function lastEntryBeforeCards(
  entries: readonly AssistantSheetEntry[],
): AssistantSheetEntry | undefined {
  for (let position = entries.length - 1; position >= 0; position -= 1) {
    const entry = entries[position];
    if (
      entry?.kind !== "exerciseMuscles" &&
      entry?.kind !== "exerciseFormMedia" &&
      entry?.kind !== "recipeDraft" &&
      entry?.kind !== "recipeCompare" &&
      entry?.kind !== "recipeRefusal" &&
      entry?.kind !== "recipeNotice"
    ) {
      return entry;
    }
  }
  return undefined;
}

function lastMessageOf(entries: readonly AssistantSheetEntry[]): string | null {
  for (let position = entries.length - 1; position >= 0; position -= 1) {
    const entry = entries[position];
    if (entry?.kind === "you") {
      return entry.text;
    }
  }
  return null;
}

// The stored items up to and including the one the message was sent after. None for a conversation that had none.
function itemsThrough(
  items: readonly AssistantThreadItem[],
  afterItemId: string | null,
): readonly AssistantThreadItem[] {
  if (afterItemId === null) {
    return [];
  }
  const position = items.findIndex((item) => item.id === afterItemId);
  return position < 0 ? items : items.slice(0, position + 1);
}

/**
 * Whether the stored conversation holds the turn the message sent from the sheet started. It does once an
 * item that ends the turn follows the message: a reply, a notice, or a question (a clarify or a confirm,
 * which end the turn, with no words after them). Your own message does not count, and
 * neither does a card on its own, because the function stores a card as the tool returns it, before the
 * words that follow, so a read during the stream can hold your message and the card with the reply still
 * to come. A turn that made no words has no reply to wait for, so there a stored card counts. An item the
 * message was sent after that is no longer there means the conversation was replaced, which holds nothing
 * of the turn.
 */
export function isSentTurnStored(
  items: readonly AssistantThreadItem[],
  afterItemId: string | null,
  live: Pick<AssistantSheetLiveTurn, "text"> | null,
): boolean {
  const position = afterItemId === null ? -1 : items.findIndex((item) => item.id === afterItemId);
  if (afterItemId !== null && position < 0) {
    return true;
  }
  const hasWords = live !== null && live.text.trim() !== "";
  return items
    .slice(position + 1)
    .some(
      (item) =>
        item.kind === "reply" ||
        item.kind === "notice" ||
        item.kind === "clarify" ||
        item.kind === "confirm" ||
        item.kind === "ask_again" ||
        ((item.kind === "card" ||
          item.kind === "link" ||
          item.kind === "exercise_muscles" ||
          item.kind === "exercise_form_media" ||
          item.kind === "recipe_draft" ||
          item.kind === "recipe_refusal" ||
          item.kind === "recipe_notice") &&
          !hasWords),
    );
}

// The words the field shows while a clarifying question waits: the live turn's, or the stored thread's last item.
// Once your next message is sent the question is answered, and the turn being written has none of its own yet.
function fieldHintOf(
  items: readonly AssistantThreadItem[],
  isSentShown: boolean,
  live: AssistantSheetLiveTurn | null,
): string | null {
  if (isSentShown) {
    return live?.clarify?.fieldHint ?? null;
  }
  const last = items.at(-1);
  return last?.kind === "clarify" && !last.answered ? last.fieldHint : null;
}

/** The thread the sheet draws, oldest first. */
export function buildAssistantSheetThread({
  items,
  sent,
  live,
  isStreaming,
  accessNotice = null,
}: BuildInput): AssistantSheetThread {
  const isSentShown =
    sent !== null && (isStreaming || !isSentTurnStored(items, sent.afterItemId, live));
  const drafts = isSentShown
    ? [
        ...storedEntries(itemsThrough(items, sent.afterItemId), true),
        ...sentEntries(sent, live, isStreaming),
      ]
    : storedEntries(items);
  const lastDraft = drafts.at(-1);
  const isAccessNoticeDrawn =
    accessNotice === null ||
    (lastDraft?.kind === "notice" && isSameNotice(lastDraft.notice, accessNotice));
  const allDrafts: DraftEntry[] = isAccessNoticeDrawn
    ? drafts
    : [...drafts, { kind: "notice", key: "access:notice", notice: accessNotice }];
  const entries = allDrafts.map((entry, position): AssistantSheetEntry =>
    entry.kind === "notice" || entry.kind === "recipeNotice"
      ? { ...entry, isLatest: position === allDrafts.length - 1 }
      : entry,
  );
  const last = lastEntryBeforeCards(entries);

  return {
    entries,
    lastMessage: lastMessageOf(entries),
    canAskAgain:
      (last?.kind === "assistant" && last.isStopped && !last.isStreaming) ||
      entries.some((entry) => entry.kind === "askAgain"),
    fieldHint: fieldHintOf(items, isSentShown, live),
    needsFullHeight:
      entries.some((entry) => entry.kind === "card" && isRecipeImportCard(entry.card)) ||
      endsWithBuiltRoutine(entries) ||
      entries.some(
        (entry) =>
          entry.kind === "exerciseMuscles" ||
          entry.kind === "exerciseFormMedia" ||
          entry.kind === "recipeDraft" ||
          entry.kind === "recipeCompare",
      ),
  };
}

/**
 * Send is on for a message with words, while the app is online, no answer is arriving, no step of the
 * turn is showing, and the stored conversation has been read (a read that failed counts) and is not being read
 * again. Before that the conversation's id is not known, and a message would start a new conversation by
 * accident.
 */
export function canSendAssistantMessage({
  text,
  ...state
}: { text: string } & AssistantSendState): boolean {
  return text.trim() !== "" && canAnswerAssistantQuestion(state);
}

type AssistantSendState = {
  isStreaming: boolean;
  isOnline: boolean;
  isThreadKnown: boolean;
  isThreadFetching: boolean;
  /** The turn has a step showing (any status), until the next event of the turn. */
  isWorking: boolean;
  access: AssistantSheetAccess;
};

/**
 * Whether a message could be sent now, whatever it says, which is when a quick reply or a confirm button
 * can be pressed: the rule of `canSendAssistantMessage` without the words. A press that would be refused is
 * dimmed instead, so it never does nothing silently.
 */
export function canAnswerAssistantQuestion({
  isStreaming,
  isOnline,
  isThreadKnown,
  isThreadFetching,
  isWorking,
  access,
}: AssistantSendState): boolean {
  return (
    !isStreaming &&
    !isWorking &&
    isOnline &&
    isThreadKnown &&
    !isThreadFetching &&
    access.kind === "open"
  );
}

/** A notice that stops the assistant taking a turn. A failed turn is not one, because the composer stays on. */
export type LimitingAssistantNotice = Exclude<DescribableAssistantNotice, { code: "turn_failed" }>;

/**
 * What the sheet lets the person do: `checking` until the status is read, `consent` for the consent card
 * with no composer (`assistant · consent-needed`), `limited` with the thread's notice and a disabled
 * composer (`day-limit`, `plus`, `resting`, `unavailable`), or `open`.
 */
export type AssistantSheetAccess =
  | { kind: "checking" }
  | { kind: "consent" }
  | { kind: "open" }
  | { kind: "limited"; notice: LimitingAssistantNotice };

const accessOfNotice = (notice: AssistantNotice | null): AssistantSheetAccess | null => {
  if (notice === null || notice.code === "turn_failed") {
    return null;
  }
  return notice.code === "consent_needed" ? { kind: "consent" } : { kind: "limited", notice };
};

/**
 * Whether a notice left by a turn that has ended is out of date once the status has been read again. The
 * gate notices (consent, the day limit, Ki-Lo Plus, resting, switched off) store no turn, so the stored
 * conversation never moves past them and nothing else lets them go: a day limit would lock the composer
 * the next day, and the consent card would stay after consent was given in Settings. A failed turn is
 * not a gate. It stays, with its Try again.
 */
export function isStaleStreamGateNotice({
  streamNotice,
  isStreaming,
}: {
  streamNotice: AssistantNotice | null;
  isStreaming: boolean;
}): boolean {
  return !isStreaming && accessOfNotice(streamNotice) !== null;
}

/**
 * Whether the sheet may stop waiting for the status. A read that succeeded or failed for good is known, and
 * so is one that has failed once, because the next try is seconds away (the turn route stays the authority).
 * Offline the read cannot run at all, and holding the sheet back for it would leave it blank.
 */
export function isAssistantStatusKnown({
  isSuccess,
  isError,
  failureCount,
  isOnline,
}: {
  isSuccess: boolean;
  isError: boolean;
  failureCount: number;
  isOnline: boolean;
}): boolean {
  return isSuccess || isError || failureCount > 0 || !isOnline;
}

/**
 * Which state the sheet is in. A notice in the stream of the turn on screen wins over the status read
 * (the stream is the authority, so a day limit shows even when the status said open, and it shows before
 * the status has been read). A failed turn in either leaves the assistant open.
 */
export function resolveAssistantSheetAccess({
  statusNotice,
  isStatusKnown,
  streamNotice,
}: {
  statusNotice: AssistantNotice | null;
  isStatusKnown: boolean;
  streamNotice: AssistantNotice | null;
}): AssistantSheetAccess {
  const fromStream = accessOfNotice(streamNotice);
  if (fromStream !== null) {
    return fromStream;
  }
  if (!isStatusKnown) {
    return { kind: "checking" };
  }
  return accessOfNotice(statusNotice) ?? { kind: "open" };
}

/**
 * Whether the sheet draws its loading placeholder (`assistant · opening`) in place of a thread: while the
 * status is read, and when the assistant is open but the stored conversation has not been read yet and
 * there is nothing to draw. The consent card and a limit are never behind it, and neither is a conversation
 * that is known, whose starters are drawn once the read settles.
 */
export function isAssistantSheetOpening({
  access,
  isEmpty,
  isThreadKnown,
}: {
  access: AssistantSheetAccess;
  isEmpty: boolean;
  isThreadKnown: boolean;
}): boolean {
  return access.kind === "checking" || (access.kind === "open" && isEmpty && !isThreadKnown);
}

export type AssistantComposerLook =
  | { isShown: false }
  | {
      isShown: true;
      isFieldDisabled: boolean;
      placeholder: string;
      /** The line over the field, from Describe only, and only while the field takes typing. */
      hint?: { chip: string; text: string };
    };

/**
 * The composer under the thread: gone for the consent card only, off with the notice's own words when the
 * assistant is limited (in the person's time zone), off with the offline words while offline, else on with
 * the sheet's placeholder. It is on while the status is read, as when open, so the sheet that opens on its
 * loading placeholder (`assistant · opening`) shows the field at once, and Send stays off until the
 * conversation is known. Opened from Describe (`describeAt` is the time it logs at) it asks for a meal
 * instead, and says when the meal is logged while the field is on.
 */
export function describeAssistantComposer({
  access,
  isOnline,
  timeZone,
  describeAt,
  from,
  fieldHint = null,
}: {
  access: AssistantSheetAccess;
  isOnline: boolean;
  timeZone: string;
  describeAt?: string | undefined;
  /** The Train header, which asks about training in the field. */
  from?: AssistantOpenedFrom | undefined;
  /** The words of a clarifying question waiting for its answer, which the field shows in place of its own. */
  fieldHint?: string | null | undefined;
}): AssistantComposerLook {
  const placeholder =
    fieldHint ??
    (describeAt !== undefined
      ? ASSISTANT_DESCRIBE.composerPlaceholder
      : from === "train"
        ? ASSISTANT_TRAIN_SHEET.composerPlaceholder
        : ASSISTANT_SHEET.composerPlaceholder);
  switch (access.kind) {
    case "consent":
      return { isShown: false };
    case "limited":
      return {
        isShown: true,
        isFieldDisabled: true,
        placeholder: describeAssistantNotice(access.notice, timeZone).fieldText ?? placeholder,
      };
    case "checking":
    case "open":
      if (!isOnline) {
        return { isShown: true, isFieldDisabled: true, placeholder: ASSISTANT_OFFLINE.fieldText };
      }
      return {
        isShown: true,
        isFieldDisabled: false,
        placeholder,
        ...(describeAt === undefined
          ? {}
          : { hint: { chip: describeLogsAt(describeAt), text: ASSISTANT_DESCRIBE.hintText } }),
      };
  }
}

/**
 * The time zone the sheet words times in: the profile's, the device's until the profile is read, and UTC
 * for a profile with no zone, which is how logging reads one.
 */
export function resolveAssistantTimeZone(
  profileTimeZone: string | null | undefined,
  deviceTimeZone: string,
): string {
  return profileTimeZone === undefined ? deviceTimeZone : (profileTimeZone ?? "UTC");
}
