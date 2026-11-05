import { useSuggestionCard } from "@keylow/api-client";

import { useIsOnline } from "../../../lib/connectivity";
import { useSuggestionDismissed } from "../../../lib/suggestionDismissed";
import { useNow } from "../../../lib/useNow";
import { useReadsEnabled } from "../../../lib/useReadsEnabled";
import { SuggestionCard } from "../../SuggestionCard";

import type { TrainSuggestionCardProps } from "./types";

/**
 * The suggestion card of the Train home: the shared `useSuggestionCard` with this phone's clock, connection,
 * Terms gate and Not now store, drawn by `SuggestionCard`. It draws nothing while the suggestion is not
 * known, offline, and for a day that was put off on this device.
 */
export function TrainSuggestionCard({ home, notices, onSetGoal }: TrainSuggestionCardProps) {
  const { dismissedDays, dismiss } = useSuggestionDismissed();
  const state = useSuggestionCard({
    home,
    now: useNow(),
    enabled: useReadsEnabled(),
    isOnline: useIsOnline(),
    dismissedDays,
    notices,
  });

  return <SuggestionCard state={state} onDismiss={dismiss} onSetGoal={onSetGoal} />;
}
