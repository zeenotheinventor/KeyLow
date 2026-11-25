import { useState } from "react";

import { useDeleteAccountOnDevice } from "../../lib/accountDeletion/useDeleteAccountOnDevice";
import { useIsOnline } from "../../lib/connectivity";

import type { DeleteAccountFlow, DeleteAccountView } from "./types";
import type { DeleteAccountOnDeviceResult } from "../../lib/accountDeletion/types";

// What the last attempt left on the screen. A confirmed deletion leaves nothing: `useDeleteAccountOnDevice` has
// already cleaned the phone and signed out, and AuthGate opens Sign in.
type Outcome = "none" | "notDeleted" | "unconfirmed";

const viewOf: Record<Outcome, DeleteAccountView> = {
  none: "explain",
  notDeleted: "failed",
  unconfirmed: "unconfirmed",
};

/**
 * The state of the Delete account screen: whether the confirm is open, the deletion that is running, and what
 * the last attempt left behind. A deletion is only ever started from Delete account in the confirm or from Try
 * again on the unconfirmed board, and the screen never navigates after one: a confirmed deletion signs out, and
 * AuthGate moves.
 */
export function useDeleteAccountFlow(): DeleteAccountFlow {
  const isOnline = useIsOnline();
  const deletion = useDeleteAccountOnDevice();
  const [outcome, setOutcome] = useState<Outcome>("none");
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);

  // A confirmed deletion stays busy, so the moment before Sign in opens offers no second deletion.
  const isDeleting = deletion.isPending || isConfirmed;

  function settle(result: DeleteAccountOnDeviceResult) {
    if (result.kind === "deleted") {
      setIsConfirmed(true);
      return;
    }
    setOutcome(result.kind);
    setIsConfirmOpen(false);
  }

  // `leftOnScreen` is what stays drawn while the attempt runs: nothing for a new attempt, as the deleting board
  // draws the screen behind the confirm, and the warning for a retry, as the unconfirmed board stays under it.
  function start(leftOnScreen: Outcome) {
    if (isDeleting) {
      return;
    }
    setOutcome(leftOnScreen);
    deletion.mutate(undefined, {
      onSuccess: settle,
      // Nothing is known about the account when the attempt could not even run, which is what unconfirmed says.
      onError: () => {
        settle({ kind: "unconfirmed" });
      },
    });
  }

  return {
    view: viewOf[outcome],
    isOnline,
    isConfirmOpen,
    isDeleting,
    openConfirm: () => {
      setIsConfirmOpen(true);
    },
    closeConfirm: () => {
      setIsConfirmOpen(false);
    },
    confirmDeletion: () => {
      start("none");
    },
    retryDeletion: () => {
      start(outcome);
    },
  };
}
