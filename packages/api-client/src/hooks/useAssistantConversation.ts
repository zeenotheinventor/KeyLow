import { joinAssistantThreadPages, threadFromMessages } from "@keylow/core";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";

import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { getAssistantConversationPage } from "../repos/assistantConversations";

import type { DiaryReadOptions } from "./DiaryReadOptions";
import type { AssistantConversationPage } from "../repos/assistantConversations";
import type { AssistantThreadCursor, AssistantThreadItem } from "@keylow/core";
import type { InfiniteData, UseInfiniteQueryResult } from "@tanstack/react-query";

export type AssistantConversation = {
  /** Null while the person has no conversation. */
  conversationId: string | null;
  items: AssistantThreadItem[];
};

/** What the cache holds under `keys.assistant.conversation`: the newest page first, each older one after it. */
export type AssistantConversationPages = InfiniteData<
  AssistantConversationPage,
  AssistantThreadCursor | null
>;

/** The cache's value for a person with no conversation, which Delete all conversations writes. */
export const emptyAssistantConversationPages: AssistantConversationPages = {
  pages: [{ conversationId: null, messages: [], actions: [], olderCursor: null }],
  pageParams: [null],
};

// The pages are joined first and the thread is built once over all of them, because a question is
// answered once a later turn exists, and the last turn of an older page has its later turn on the next.
function threadOfPages({ pages }: AssistantConversationPages): AssistantConversation {
  const { messages, actions } = joinAssistantThreadPages(pages);
  return {
    // The newest page's id: an older page of another conversation is never read.
    conversationId: pages[0]?.conversationId ?? null,
    items: threadFromMessages(messages, actions),
  };
}

type ConversationRead = Pick<
  UseInfiniteQueryResult<AssistantConversation>,
  "fetchStatus" | "refetch"
> & {
  /** The thread is being read again. Loading older turns is not that. */
  isFetching: boolean;
  /** Whether a turn older than the oldest one loaded exists. */
  hasOlder: boolean;
  isLoadingOlder: boolean;
  /** Reads the next 20 older turns. It does nothing while any read of the thread is in flight. */
  loadOlder: () => void;
} & (
    | { data: AssistantConversation; isSuccess: true; isError: false }
    | { data: AssistantConversation | undefined; isSuccess: false; isError: boolean }
  );

/**
 * The newest conversation of the signed in user by `updated_at`, as the items the sheet draws, a page of
 * 20 turns at a time, newest first. `loadOlder` reads the next older page. The items are read back from
 * the stored Messages API content, and each card carries its live undo state from the user's
 * `assistant_actions`. A person with no conversation gets no id and no items. The thread is health data.
 * Key `keys.assistant.conversation`.
 *
 * A page that fails to load never changes what the thread is: its items stay, `isError` stays false and
 * the next `loadOlder` reads it again. When `enabled` goes false the cache is cut back to its first page,
 * so the next open draws one page.
 */
export function useAssistantConversation({
  enabled = true,
}: DiaryReadOptions = {}): ConversationRead {
  const client = useSupabase();
  const queryClient = useQueryClient();

  const query = useInfiniteQuery({
    queryKey: keys.assistant.conversation,
    initialPageParam: null as AssistantThreadCursor | null,
    queryFn: ({ pageParam }) => getAssistantConversationPage(client, pageParam),
    getNextPageParam: (page) => page.olderCursor ?? undefined,
    select: threadOfPages,
    enabled,
  });

  useEffect(() => {
    const cached = queryClient.getQueryState<AssistantConversationPages>(
      keys.assistant.conversation,
    );
    if (!enabled && cached?.data) {
      // The cut keeps the time of the last read, so it does not make a stale thread look fresh.
      queryClient.setQueryData<AssistantConversationPages>(
        keys.assistant.conversation,
        {
          pages: cached.data.pages.slice(0, 1),
          pageParams: cached.data.pageParams.slice(0, 1),
        },
        { updatedAt: cached.dataUpdatedAt },
      );
    }
  }, [enabled, queryClient]);

  const { fetchNextPage, hasNextPage } = query;
  const loadOlder = useCallback(() => {
    // `fetchNextPage` cancels a read that is running, which would drop the refresh after a turn, and two
    // calls in one render must not both start a read, so the cache is asked now, not the last render.
    if (hasNextPage && queryClient.isFetching({ queryKey: keys.assistant.conversation }) === 0) {
      void fetchNextPage();
    }
  }, [hasNextPage, fetchNextPage, queryClient]);

  const { data } = query;
  const isError = query.isError && !query.isFetchNextPageError;
  const common = {
    fetchStatus: query.fetchStatus,
    refetch: query.refetch,
    isFetching: query.isFetching && !query.isFetchingNextPage,
    hasOlder: hasNextPage,
    isLoadingOlder: query.isFetchingNextPage,
    loadOlder,
  };
  return data !== undefined && !isError && (query.isSuccess || query.isFetchNextPageError)
    ? { ...common, data, isSuccess: true, isError: false }
    : { ...common, data, isSuccess: false, isError };
}
