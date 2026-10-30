import { useSessionView } from "@keylow/api-client";

import { describeFinishDetails } from "./finishDetails";
import { useReadsEnabled } from "../../lib/useReadsEnabled";

import type { PendingSet, SessionScreenView } from "./types";

/**
 * What the active session screen shows: the session the shared `useSessionView` reads (every read waits
 * until the account has accepted the current Terms, and each is saved on the phone, so the screen opens
 * offline), and for a ready session what the finish screen shows as it stands now.
 */
export function useSessionScreen(pendingSets?: readonly PendingSet[]): SessionScreenView {
  const view = useSessionView({ enabled: useReadsEnabled() }, pendingSets);
  if (view.status !== "ready") {
    return view;
  }

  return {
    ...view,
    finish: describeFinishDetails(
      { id: view.sessionId, started_at: view.header.startedAt, sets: view.sets },
      view.header.dayName,
      view.progress,
      view.plannedNames,
    ),
  };
}
