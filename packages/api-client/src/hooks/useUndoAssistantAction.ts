import { useMutation, useQueryClient } from "@tanstack/react-query";

import { invalidateFoodQueries } from "../invalidateFoodQueries";
import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { undoAssistantActions } from "../repos/assistantConversations";

import type { AssistantUndoResult } from "../repos/assistantConversations";

const MOST_IDS_PER_REQUEST = 10;

export type UndoAssistantActionInput = {
  /** The `actionIds` of the card or the changes row, at most 10 to a request, more are sent in several. */
  actionIds: readonly string[];
};

/**
 * Undo from a card or from "What the assistant changed". Sends the ids to the `assistant` function and
 * resolves to one code per id: `undone`, `already_undone`, `undo_unavailable` or `not_found`, with the
 * `reason` of a refusal when the route gives one. Whatever the answer, the thread, the changes list and
 * everything an Undo can change (the diary, the recipes, the foods, the targets and all of training) are refreshed after the request, because some of the ids may have been undone.
 */
export function useUndoAssistantAction() {
  const client = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ actionIds }: UndoAssistantActionInput) => {
      const results: AssistantUndoResult[] = [];
      // The route takes at most 10 ids, one for each write slot of a turn. One after another, so a
      // failure stops before the later ids are sent.
      for (let start = 0; start < actionIds.length; start += MOST_IDS_PER_REQUEST) {
        results.push(
          ...(await undoAssistantActions(
            client,
            actionIds.slice(start, start + MOST_IDS_PER_REQUEST),
          )),
        );
      }
      return results;
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: keys.assistant.conversation }),
        queryClient.invalidateQueries({ queryKey: keys.assistant.changes }),
        queryClient.invalidateQueries({ queryKey: keys.diary.all }),
        queryClient.invalidateQueries({ queryKey: keys.recipes.all }),
        invalidateFoodQueries(queryClient),
        queryClient.invalidateQueries({ queryKey: keys.profiles.targets }),
        queryClient.invalidateQueries({ queryKey: keys.program.all }),
        queryClient.invalidateQueries({ queryKey: keys.training.all }),
      ]),
  });
}
