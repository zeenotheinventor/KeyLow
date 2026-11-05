import { useSuggestionCard } from "@keylow/api-client";

import { useSuggestionDismissed } from "../../lib/suggestionDismissed";

import type { SuggestionCardState, SuggestionNotices, TrainHome } from "@keylow/api-client";

const HIDDEN: SuggestionCardState = { status: "hidden" };

// The notices of a screen that was given none. Nothing reads or writes then, so they are never called.
const NO_NOTICES: SuggestionNotices = {
  onAccepted: () => undefined,
  onFailure: () => undefined,
  onStart: () => undefined,
};

type TrainSuggestion = {
  state: SuggestionCardState;
  /** Puts off the suggestion of the day given, on this device: "Not now". */
  dismiss: (day: string) => void;
};

/**
 * The suggestion of the Train home: the shared `useSuggestionCard` with the screen's clock, connection and
 * Terms gate and this phone's Not now store. The card and the detail sheet both draw this one state, so the sheet shows
 * the suggestion the card holds. It is hidden while the suggestion is not known, offline, for a day that was
 * put off on this device, and when the screen has no notices to show the toast with, since Add could then
 * not tell anyone.
 */
export function useTrainSuggestion({
  home,
  now,
  enabled,
  isOnline,
  notices,
}: {
  home: TrainHome;
  /** The clock, connection and Terms gate the screen already holds, so the hook starts no second timer. */
  now: Date;
  enabled: boolean;
  isOnline: boolean;
  notices: SuggestionNotices | undefined;
}): TrainSuggestion {
  const { dismissedDays, dismiss } = useSuggestionDismissed();
  const hasNotices = notices !== undefined;
  const state = useSuggestionCard({
    home,
    now,
    enabled: enabled && hasNotices,
    isOnline,
    dismissedDays,
    notices: notices ?? NO_NOTICES,
  });

  return { state: hasNotices ? state : HIDDEN, dismiss };
}
