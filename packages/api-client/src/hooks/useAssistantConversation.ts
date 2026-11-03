import { threadFromMessages } from "@keylow/core";
import { useQuery } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { getLatestAssistantConversation } from "../repos/assistantConversations";

import type { DiaryReadOptions } from "./DiaryReadOptions";
import type { AssistantThreadItem } from "@keylow/core";

export type AssistantConversation = {
  /** Null while the person has no conversation. */
  conversationId: string | null;
  items: AssistantThreadItem[];
};

/**
 * The newest conversation of the signed in user by `updated_at`, as the items the sheet draws. They are
 * read back from the stored Messages API content, and each card carries its live undo state from the
 * user's `assistant_actions`. A person with no conversation gets no id and no items. The thread is health
 * data. Key `keys.assistant.conversation`.
 */
export function useAssistantConversation({ enabled = true }: DiaryReadOptions = {}) {
  const client = useSupabase();

  return useQuery({
    queryKey: keys.assistant.conversation,
    queryFn: async (): Promise<AssistantConversation> => {
      const conversation = await getLatestAssistantConversation(client);
      return conversation === null
        ? { conversationId: null, items: [] }
        : {
            conversationId: conversation.conversationId,
            items: threadFromMessages(conversation.messages, conversation.actions),
          };
    },
    enabled,
  });
}
