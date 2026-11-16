import { isSentTurnStored } from "@keylow/core";

import type { AssistantLiveTurn } from "./assistantLiveTurn";
import type { AssistantOpenTurn } from "./repos/assistantConversations";
import type { AssistantThreadItem } from "@keylow/core";

/** How often the stored conversation is read while a turn the phone lost the stream of is still open. */
export const DETACHED_TURN_POLL_MS = 2000;

/** How long after the phone first saw it open a turn is taken as lost, which is when the server's own clock has run out. */
export const OPEN_TURN_DEADLINE_MS = 150_000;

/**
 * How long a read after a detach must wait before a message that is not stored means the request never
 * reached the server, so a sheet closed right after Send does not flash the failed notice.
 */
export const UNSENT_TURN_GRACE_MS = 3000;

/** When an open turn is taken as lost, in epoch milliseconds, counted on the phone's own clock. */
export const openTurnDeadlineMs = (openTurn: AssistantOpenTurn): number =>
  openTurn.firstSeenAtMs + OPEN_TURN_DEADLINE_MS;

/** The stored newest turn while the server may still be writing it: open, and not past its deadline. */
export const runningOpenTurn = (
  openTurn: AssistantOpenTurn | null,
  nowMs: number,
): AssistantOpenTurn | null =>
  openTurn !== null && nowMs < openTurnDeadlineMs(openTurn) ? openTurn : null;

export type DetachedTurnInput = {
  live: Pick<AssistantLiveTurn, "turnId" | "text">;
  /** When the turn detached, in epoch milliseconds. */
  detachedAtMs: number;
  /** The id of the last stored item when the message was sent, or null for a conversation with none. */
  afterItemId: string | null;
  items: readonly AssistantThreadItem[];
  openTurn: AssistantOpenTurn | null;
  /** When the conversation was last read successfully, or null. Only a read well after the detach tells a turn that was never stored. */
  lastReadAtMs: number | null;
  nowMs: number;
};

/**
 * Where a detached turn stands, from the stored conversation:
 * - `stored`: the conversation holds the turn's ending (a reply, a question, or the failed notice of a turn
 *   the server marked failed), so the stored turn draws and the live one is let go,
 * - `failed`: the request never reached the server (no `turn` event and no new stored message of yours on a
 *   read at least 3 s after the detach), or the turn is still `open` 150 s after the phone first saw it, and
 * - `waiting`: anything else, the conversation is read again.
 * A turn that left no row is dated from the moment it detached.
 */
export function detachedTurnState({
  live,
  detachedAtMs,
  afterItemId,
  items,
  openTurn,
  lastReadAtMs,
  nowMs,
}: DetachedTurnInput): "waiting" | "stored" | "failed" {
  if (isSentTurnStored(items, afterItemId, live)) {
    return "stored";
  }
  const position = afterItemId === null ? -1 : items.findIndex((item) => item.id === afterItemId);
  const isMessageStored = items.slice(position + 1).some((item) => item.kind === "user");
  const isReadWellAfterDetach =
    lastReadAtMs !== null && lastReadAtMs >= detachedAtMs + UNSENT_TURN_GRACE_MS;
  if (live.turnId === null && !isMessageStored && isReadWellAfterDetach) {
    return "failed";
  }
  const own = openTurn !== null && (live.turnId === null || openTurn.turnId === live.turnId);
  const startedAtMs = own ? Math.min(openTurn.firstSeenAtMs, detachedAtMs) : detachedAtMs;
  return nowMs >= startedAtMs + OPEN_TURN_DEADLINE_MS ? "failed" : "waiting";
}

/**
 * The words of the reply the stored conversation holds after `afterItemId`, for a screen reader to read once
 * when a resumed turn finishes. Nothing for a turn that ended in a notice or was stopped, which nobody waits
 * to hear.
 */
export function storedReplyText(
  items: readonly AssistantThreadItem[],
  afterItemId: string | null,
): string {
  const position = afterItemId === null ? -1 : items.findIndex((item) => item.id === afterItemId);
  const added = items.slice(position + 1);
  if (added.some((item) => item.kind === "notice" || (item.kind === "reply" && item.stopped))) {
    return "";
  }
  return added.flatMap((item) => (item.kind === "reply" ? [item.text] : [])).join("\n\n");
}
