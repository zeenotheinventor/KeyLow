import { ASSISTANT_OFFLINE, describeAssistantNotice } from "../copy/assistantNotices";
import { ASSISTANT_SHEET } from "../copy/assistantSheet";

import type { AssistantNotice } from "./notice";
import type { AssistantThreadItem } from "./thread";
import type { DescribableAssistantNotice } from "../copy/assistantNotices";

/*
 * What the assistant sheet draws in its thread (`assistant · empty`, `streaming`, `conversation`,
 * `unavailable`): the stored conversation, and under it the message sent from this sheet with the reply
 * as it arrives. The cards, questions, confirmations and answer lines of the stored thread are drawn by
 * later tickets, so they are left out here, never shown as raw data.
 */

/** What the sheet needs of the turn being written: the part of `AssistantLiveTurn` it draws. */
export type AssistantSheetLiveTurn = {
  text: string;
  stopped: boolean;
  notice: AssistantNotice | null;
};

/**
 * The message the person sent from this sheet, and the id of the last stored item when they sent it
 * (null for a conversation with none). While the answer arrives it is always drawn, with the stored items
 * after that one left out, because the function stores your message at the start of the turn and a read
 * during the stream returns it. Once the answer has ended and the stored conversation has an item after
 * that one, the stored conversation holds the turn and this message is no longer drawn.
 */
export type AssistantSheetSent = { text: string; afterItemId: string | null };

export type AssistantSheetEntry =
  | { kind: "you"; key: string; text: string }
  | {
      kind: "assistant";
      key: string;
      paragraphs: string[];
      isStreaming: boolean;
      isStopped: boolean;
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

function storedEntries(items: readonly AssistantThreadItem[]): DraftEntry[] {
  return items.flatMap((item): DraftEntry[] => {
    switch (item.kind) {
      case "user":
        return [{ kind: "you", key: item.id, text: item.text }];
      case "reply":
        return [
          {
            kind: "assistant",
            key: item.id,
            paragraphs: paragraphsOf(item.text),
            isStreaming: false,
            isStopped: item.stopped,
          },
        ];
      case "notice":
        return isDescribable(item.notice)
          ? [{ kind: "notice", key: item.id, notice: item.notice }]
          : [];
      default:
        return [];
    }
  });
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
  if (live.text.trim() !== "" || live.stopped || isStreaming) {
    const paragraphs = paragraphsOf(live.text);
    entries.push({
      kind: "assistant",
      key: "sent:reply",
      // One empty paragraph draws the caret alone, before the first words arrive.
      paragraphs: isStreaming && paragraphs.length === 0 ? [""] : paragraphs,
      isStreaming,
      isStopped: live.stopped && !isStreaming,
    });
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

/** The thread the sheet draws, oldest first. */
export function buildAssistantSheetThread({
  items,
  sent,
  live,
  isStreaming,
  accessNotice = null,
}: BuildInput): AssistantSheetThread {
  const isSentShown =
    sent !== null && (isStreaming || sent.afterItemId === (items.at(-1)?.id ?? null));
  const drafts = isSentShown
    ? [
        ...storedEntries(isStreaming ? itemsThrough(items, sent.afterItemId) : items),
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
  };
}

/**
 * Send is on for a message with words, while the app is online, no answer is arriving, and the stored
 * conversation has been read (a read that failed counts) and is not being read again. Before that the
 * conversation's id is not known, and a message would start a new conversation by accident.
 */
export function canSendAssistantMessage({
  text,
  isStreaming,
  isOnline,
  isThreadKnown,
  isThreadFetching,
  access,
}: {
  text: string;
  isStreaming: boolean;
  isOnline: boolean;
  isThreadKnown: boolean;
  isThreadFetching: boolean;
  access: AssistantSheetAccess;
}): boolean {
  return (
    text.trim() !== "" &&
    !isStreaming &&
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
  { isShown: false } | { isShown: true; isFieldDisabled: boolean; placeholder: string };

/**
 * The composer under the thread: gone for the consent card and while the status is read, off with the
 * notice's own words when the assistant is limited (in the person's time zone), off with the offline
 * words while offline, else on with the sheet's placeholder.
 */
export function describeAssistantComposer({
  access,
  isOnline,
  timeZone,
}: {
  access: AssistantSheetAccess;
  isOnline: boolean;
  timeZone: string;
}): AssistantComposerLook {
  switch (access.kind) {
    case "checking":
    case "consent":
      return { isShown: false };
    case "limited":
      return {
        isShown: true,
        isFieldDisabled: true,
        placeholder:
          describeAssistantNotice(access.notice, timeZone).fieldText ??
          ASSISTANT_SHEET.composerPlaceholder,
      };
    case "open":
      return isOnline
        ? {
            isShown: true,
            isFieldDisabled: false,
            placeholder: ASSISTANT_SHEET.composerPlaceholder,
          }
        : { isShown: true, isFieldDisabled: true, placeholder: ASSISTANT_OFFLINE.fieldText };
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
