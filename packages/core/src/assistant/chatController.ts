import { replyWords } from "./replyText";

/**
 * The conversation a message is sent into. A settled read is the truth, so after Delete all conversations
 * it is null and the dead id the live turn still holds is not reused. The id the first turn started stands
 * in only while the read is unknown or failed.
 */
export function chooseAssistantConversationId({
  readIsSettled,
  readConversationId,
  liveConversationId,
}: {
  /** The stored conversation was read successfully and is not being read again. */
  readIsSettled: boolean;
  /** The id the read holds, or undefined when there is no data. */
  readConversationId: string | null | undefined;
  liveConversationId: string | null | undefined;
}): string | null {
  return readIsSettled
    ? (readConversationId ?? null)
    : (readConversationId ?? liveConversationId ?? null);
}

/** Whether New conversation is off: nothing to clear, still opening, busy, offline, or no consent yet. */
export function isNewConversationDisabled({
  isEmpty,
  isOpening,
  isStreaming,
  isOnline,
  isStartingNew,
  isConsentNeeded,
}: {
  isEmpty: boolean;
  isOpening: boolean;
  isStreaming: boolean;
  isOnline: boolean;
  isStartingNew: boolean;
  isConsentNeeded: boolean;
}): boolean {
  return isEmpty || isOpening || isStreaming || !isOnline || isStartingNew || isConsentNeeded;
}

/**
 * The words a screen reader hears once a turn has finished, or an empty string for none. An answer that was
 * stopped by closing the sheet is not read, because the person closed it. A stop has no outcome, and a turn
 * stopped after a card ends in the saved-change words and is not marked stopped, so a turn with no outcome is
 * not read either. It is read as the words without the markers the model wrote, as the message's own name is.
 */
export function finishedAnswerWords(
  live: { text: string; stopped: boolean; outcome: string | null } | null,
): string {
  return live === null || live.stopped || live.outcome === null
    ? ""
    : replyWords(live.text.trim(), { isPartial: false });
}
