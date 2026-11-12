import { useMutation, useQueryClient } from "@tanstack/react-query";

import { emptyAssistantConversationPages } from "./useAssistantConversation";
import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { deleteAllAssistantConversations } from "../repos/assistantConversations";

import type { AssistantConversationPages } from "./useAssistantConversation";

/**
 * "Delete all conversations" in the assistant settings. The turns and messages go with them, and what the
 * assistant changed stays in the changes list, which Undo still works from. The thread read is set to
 * no conversation at once, so a sheet that is closed opens empty, and every assistant read is refreshed
 * after that.
 */
export function useDeleteAllAssistantConversations() {
  const client = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => deleteAllAssistantConversations(client),
    onSuccess: () => {
      // A closed sheet's read is disabled, and invalidating does not refetch a disabled read, so it would open
      // on the deleted thread until its refetch landed. The thread is known to be empty, so it is set first.
      queryClient.setQueryData<AssistantConversationPages>(
        keys.assistant.conversation,
        emptyAssistantConversationPages,
      );
      return queryClient.invalidateQueries({ queryKey: keys.assistant.all });
    },
  });
}
