import { useMutation } from "@tanstack/react-query";
import { useCallback } from "react";

import { useSupabase } from "../KeyLowProvider";
import { recordAchievementEvent } from "../repos/achievementEvents";

import type { AchievementEventKind } from "../repos/achievementEvents";

/**
 * Returns a function that records a countable action for the achievements, without waiting and without
 * ever failing into the caller. The write is a mutation on purpose: the phone runs the achievements engine
 * after each successful mutation, so a recorded event is picked up by the next run and the badge it earns
 * comes while the person is still looking. The write itself never rejects, so it is always a success.
 */
export function useRecordAchievementEvent() {
  const client = useSupabase();
  const { mutate } = useMutation({
    mutationFn: ({ kind, ref }: { kind: AchievementEventKind; ref?: string }) =>
      recordAchievementEvent(client, kind, ref),
  });

  return useCallback(
    (kind: AchievementEventKind, ref?: string) => {
      mutate(ref === undefined ? { kind } : { kind, ref });
    },
    [mutate],
  );
}
