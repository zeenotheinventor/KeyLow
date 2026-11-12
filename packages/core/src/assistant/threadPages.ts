import type { AssistantStoredMessage } from "./thread";

/** How many turns one page of the thread holds. */
export const ASSISTANT_THREAD_PAGE_TURNS = 20;

/** The oldest turn of a page, which the next older page is read from. */
export type AssistantThreadCursor = {
  conversationId: string;
  createdAt: string;
  turnId: string;
};

export type AssistantTurnPage<Turn> = {
  /** The page's turns, oldest first. */
  turns: Turn[];
  /** Null when no turn is older than the page's oldest. */
  olderCursor: AssistantThreadCursor | null;
};

/**
 * One page of turns from the rows a read returned, newest first, at most one more than a page holds. The
 * extra row is what says an older turn exists, so no read is needed to find the end. It is left out of
 * the page, and the cursor names the oldest turn that is kept.
 */
export function pageOfAssistantTurns<Turn extends { id: string; createdAt: string }>(
  conversationId: string,
  rowsNewestFirst: readonly Turn[],
): AssistantTurnPage<Turn> {
  const kept = rowsNewestFirst.slice(0, ASSISTANT_THREAD_PAGE_TURNS);
  const oldest = kept.at(-1);
  const hasOlder = rowsNewestFirst.length > ASSISTANT_THREAD_PAGE_TURNS;
  return {
    turns: kept.reverse(),
    olderCursor:
      hasOlder && oldest !== undefined
        ? { conversationId, createdAt: oldest.createdAt, turnId: oldest.id }
        : null,
  };
}

const keptOnceById = <Item extends { id: string }>(items: readonly Item[]): Item[] => [
  ...new Map(items.map((item) => [item.id, item])).values(),
];

/**
 * The messages and actions of the loaded pages, newest page first, as one list each: the messages in
 * `seq` order (an older page holds the lower `seq`s and each page is already in order) and every message
 * and action once, by id. The thread is built from this, never page by page, because a question is
 * answered when a later turn exists, and the last turn of an older page has its later turn on the next page.
 */
export function joinAssistantThreadPages<Action extends { id: string }>(
  pagesNewestFirst: readonly { messages: AssistantStoredMessage[]; actions: Action[] }[],
): { messages: AssistantStoredMessage[]; actions: Action[] } {
  const oldestFirst = [...pagesNewestFirst].reverse();
  return {
    messages: keptOnceById(oldestFirst.flatMap((page) => page.messages)),
    actions: keptOnceById(pagesNewestFirst.flatMap((page) => page.actions)),
  };
}
