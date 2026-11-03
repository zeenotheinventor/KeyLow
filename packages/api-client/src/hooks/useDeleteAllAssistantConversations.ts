import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { deleteAllAssistantConversations } from "../repos/assistantConversations";

/**
 * "Delete all conversations" in the assistant settings. The turns and messages go with them, and what the
 * assistant changed stays in the changes list, which Undo still works from. The thread read is refreshed
 * and shows no conversation, and every other assistant read is refreshed as well.
 */
export function useDeleteAllAssistantConversations() {
  const client = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => deleteAllAssistantConversations(client),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.assistant.all }),
  });
}
