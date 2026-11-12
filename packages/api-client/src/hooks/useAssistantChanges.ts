import { assistantChangesFromActions, isValidTimeZone } from "@keylow/core";
import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";

import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { useProfileTimeZone } from "./useProfileTimeZone";
import { readAssistantActions } from "../repos/assistantConversations";

import type { DiaryReadOptions } from "./DiaryReadOptions";
import type { AssistantActionsRead } from "../repos/assistantConversations";

/**
 * "What the assistant changed": the signed in user's `assistant_actions`, newest first, one row per card
 * and grouped by day (`Today`, `Yesterday`, then the date as the diary writes it), with the number of
 * rows as `count`. Days and times are read in the time zone of the profile, UTC when it has none, so the
 * read waits for the profile. A training row is worded from the card its turn stored, which the read holds
 * as the words of the card alone. Key `keys.assistant.changes`.
 */
export function useAssistantChanges({ enabled = true }: DiaryReadOptions = {}) {
  const client = useSupabase();
  const profileTimeZone = useProfileTimeZone({ enabled });
  const timeZone =
    profileTimeZone.data !== null &&
    profileTimeZone.data !== undefined &&
    isValidTimeZone(profileTimeZone.data)
      ? profileTimeZone.data
      : "UTC";
  const group = useCallback(
    ({ actions, targets, cards }: AssistantActionsRead) =>
      assistantChangesFromActions(actions, { now: new Date(), timeZone, targets, cards }),
    [timeZone],
  );

  return useQuery({
    queryKey: keys.assistant.changes,
    queryFn: () => readAssistantActions(client, { withCards: true }),
    select: group,
    enabled: enabled && profileTimeZone.isFetched,
  });
}
