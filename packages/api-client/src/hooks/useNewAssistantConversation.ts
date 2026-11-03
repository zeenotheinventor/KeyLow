import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { createAssistantConversation } from "../repos/assistantConversations";

/**
 * "New conversation": starts an empty conversation through the `assistant` function and resolves to its
 * id. It is the newest, so the thread read is refreshed and shows it empty.
 */
export function useNewAssistantConversation() {
  const client = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => createAssistantConversation(client),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.assistant.conversation }),
  });
}
