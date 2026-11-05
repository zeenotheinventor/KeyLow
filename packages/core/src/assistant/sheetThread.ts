import {
  ASSISTANT_CARD_WORDS,
  ASSISTANT_OFFLINE,
  describeAssistantNotice,
  describeAssistantStatus,
} from "../copy/assistantNotices";
import { ASSISTANT_DESCRIBE, ASSISTANT_SHEET, describeLogsAt } from "../copy/assistantSheet";

import type { AssistantCard } from "./card";
import type { AssistantNotice } from "./notice";
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
 * a recipe link shows the working line while its page is read (`assistant · recipe-reading`).
 */

/** What the sheet needs of the turn being written: the part of `AssistantLiveTurn` it draws. */
export type AssistantSheetLiveTurn = {
  text: string;
  /** The writes the turn has made so far, each with its Undo. */
  cards: readonly AssistantCard[];
  /** The line under the answer and the Estimate badge, sent at the end of an answer from the person's data. */
  answerMeta: { citation: string | null; estimate: string | null } | null;
  /** The recipe page being read, until the next event of the turn. */
  status: { code: "reading_recipe"; host: string } | null;
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
  stopped: boolean;
  notice: AssistantNotice | null;
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
      /** The working line under your message while a recipe page is read. */
      kind: "status";
      key: string;
      text: string;
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
  /** Whether the thread ends in an answer that was cut short, which offers the Ask again quick reply. */
  canAskAgain: boolean;
  /** The words in the empty field while a clarifying question waits for its answer ("Or say it your way"), else null. */
  fieldHint: string | null;
  /** Whether the sheet is to be at full height, which a recipe import card needs so its ingredient list shows. */
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
  | Exclude<AssistantSheetEntry, { kind: "notice" }>
  | { kind: "notice"; key: string; notice: DescribableAssistantNotice };

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
    }
  }
  return entries;
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
  // While a recipe page is read no words arrive, so there is no caret to draw, and the working line stands in.
  const status = isStreaming ? live.status : null;
  const isWriting = isStreaming && status === null;
  if (live.text.trim() !== "" || live.stopped || isWriting) {
    const paragraphs = paragraphsOf(live.text);
    entries.push({
      kind: "assistant",
      key: "sent:reply",
      // One empty paragraph draws the caret alone, before the first words arrive.
      paragraphs: isWriting && paragraphs.length === 0 ? [""] : paragraphs,
      isStreaming: isWriting,
      isStopped: live.stopped && !isStreaming,
      ...answerLinesOf(live.answerMeta),
    });
  }
  if (status !== null) {
    entries.push({ kind: "status", key: "sent:status", text: describeAssistantStatus(status) });
  }
  if (live.clarify !== null) {
    entries.push(...clarifyEntries("sent:clarify", live.clarify, false, entries.at(-1)));
  }
  if (live.confirm !== null) {
    entries.push(...confirmEntries("sent:confirm", live.confirm, false, entries.at(-1)));
  }
  if (live.notice !== null && isDescribable(live.notice)) {
    entries.push({ kind: "notice", key: "sent:notice", notice: live.notice });
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
        (item.kind === "card" && !hasWords),
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
    entry.kind === "notice" ? { ...entry, isLatest: position === allDrafts.length - 1 } : entry,
  );
  const last = entries.at(-1);

  return {
    entries,
    lastMessage: lastMessageOf(entries),
    canAskAgain: last?.kind === "assistant" && last.isStopped && !last.isStreaming,
    fieldHint: fieldHintOf(items, isSentShown, live),
    needsFullHeight: entries.some(
      (entry) => entry.kind === "card" && isRecipeImportCard(entry.card),
    ),
  };
}

/**
 * Send is on for a message with words, while the app is online, no answer is arriving, no recipe page is
 * being read, and the stored conversation has been read (a read that failed counts) and is not being read
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
  /** The turn's status is `reading_recipe`: a recipe page is being read, until the next event of the turn. */
  isReadingRecipe: boolean;
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
  isReadingRecipe,
  access,
}: AssistantSendState): boolean {
  return (
    !isStreaming &&
    !isReadingRecipe &&
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
 * The composer under the thread: gone for the consent card and while the status is read, off with the
 * notice's own words when the assistant is limited (in the person's time zone), off with the offline
 * words while offline, else on with the sheet's placeholder. Opened from Describe (`describeAt` is the
 * time it logs at) it asks for a meal instead, and says when the meal is logged while the field is on.
 */
export function describeAssistantComposer({
  access,
  isOnline,
  timeZone,
  describeAt,
  fieldHint = null,
}: {
  access: AssistantSheetAccess;
  isOnline: boolean;
  timeZone: string;
  describeAt?: string | undefined;
  /** The words of a clarifying question waiting for its answer, which the field shows in place of its own. */
  fieldHint?: string | null | undefined;
}): AssistantComposerLook {
  const placeholder =
    fieldHint ??
    (describeAt === undefined
      ? ASSISTANT_SHEET.composerPlaceholder
      : ASSISTANT_DESCRIBE.composerPlaceholder);
  switch (access.kind) {
    case "checking":
    case "consent":
      return { isShown: false };
    case "limited":
      return {
        isShown: true,
        isFieldDisabled: true,
        placeholder: describeAssistantNotice(access.notice, timeZone).fieldText ?? placeholder,
      };
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
