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
}: BuildInput): AssistantSheetThread {
  const isSentShown =
    sent !== null && (isStreaming || sent.afterItemId === (items.at(-1)?.id ?? null));
  const drafts = isSentShown
    ? [
        ...storedEntries(isStreaming ? itemsThrough(items, sent.afterItemId) : items),
        ...sentEntries(sent, live, isStreaming),
      ]
    : storedEntries(items);
  const entries = drafts.map((entry, position): AssistantSheetEntry =>
    entry.kind === "notice" ? { ...entry, isLatest: position === drafts.length - 1 } : entry,
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
}: {
  text: string;
  isStreaming: boolean;
  isOnline: boolean;
  isThreadKnown: boolean;
  isThreadFetching: boolean;
}): boolean {
  return text.trim() !== "" && !isStreaming && isOnline && isThreadKnown && !isThreadFetching;
}
