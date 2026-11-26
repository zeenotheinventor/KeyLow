import { useReauthenticateWithPassword } from "@keylow/api-client";
import { hasPasswordSignIn } from "@keylow/core/accounts";
import { AUTH_FIELD_PROBLEMS, DELETE_ACCOUNT_COPY, describeAuthError } from "@keylow/core/copy";
import { useRouter } from "expo-router";
import { useState } from "react";

import { useDeleteAccountOnDevice } from "../../lib/accountDeletion/useDeleteAccountOnDevice";
import { useIsOnline } from "../../lib/connectivity";
import { setForgotPasswordEmail } from "../../lib/forgotPasswordEmail";
import { useSessionUser } from "../../lib/useSessionUser";

import type { DeleteAccountFlow, DeleteAccountView } from "./types";
import type { DeleteAccountOnDeviceResult } from "../../lib/accountDeletion/types";
import type { ReauthenticationOutcome } from "@keylow/core/accounts";

// What the last attempt left on the screen. A confirmed deletion leaves nothing: `useDeleteAccountOnDevice` has
// already cleaned the phone and signed out, and AuthGate opens Sign in.
type Outcome = "none" | "notDeleted" | "unconfirmed";

const viewOf: Record<Outcome, DeleteAccountView> = {
  none: "explain",
  notDeleted: "failed",
  unconfirmed: "unconfirmed",
};

// The sentence under the field for each answer that is not a confirmed password. Wrong has its own on the
// board, and the rest are the sentences Sign in already says for the same answers. A session that has ended
// and a failure nobody expected get the generic one, because AuthGate moves a signed out person on its own.
const passwordErrorOf: Record<Exclude<ReauthenticationOutcome["kind"], "confirmed">, string> = {
  emptyPassword: AUTH_FIELD_PROBLEMS.passwordRequired,
  wrongPassword: DELETE_ACCOUNT_COPY.dialog.password.wrongPassword,
  tooManyAttempts: describeAuthError("over_request_rate_limit"),
  network: describeAuthError("network"),
  sessionEnded: describeAuthError(undefined),
  failed: describeAuthError(undefined),
};

/**
 * The state of the Delete account screen: whether the confirm is open, the password typed in it, the deletion
 * that is running, and what the last attempt left behind. A deletion is only ever started from Delete account in
 * the confirm (after the password was checked, when there is one) or from Try again on the unconfirmed board, and
 * the screen never navigates after one: a confirmed deletion signs out, and AuthGate moves. The one navigation is
 * Forgot password?, which deletes nothing.
 */
export function useDeleteAccountFlow(): DeleteAccountFlow {
  const isOnline = useIsOnline();
  const router = useRouter();
  const user = useSessionUser();
  const deletion = useDeleteAccountOnDevice();
  const reauthentication = useReauthenticateWithPassword();
  const [outcome, setOutcome] = useState<Outcome>("none");
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | undefined>(undefined);

  // This fails open on purpose: while the session user is not known (`useSessionUser` can be null for a while) the
  // plain confirm shows, as it did before the password step. The server enforces the rule, so a deletion that
  // needed the password is refused with `reauthentication_required`, and `settle` then reopens the confirm with
  // the field. Holding Delete account back until the user is known would only leave it disabled.
  const hasPasswordStep = hasPasswordSignIn(user?.app_metadata);

  // A confirmed deletion stays busy, so the moment before Sign in opens offers no second deletion.
  const isDeleting = deletion.isPending || isConfirmed;
  const isBusy = isDeleting || isChecking;

  function openConfirmWithEmptyField() {
    setPassword("");
    setPasswordError(undefined);
    setIsConfirmOpen(true);
  }

  function closeConfirm() {
    setIsConfirmOpen(false);
    // The mutation observer keeps its last variables, which hold the password, until it is reset.
    reauthentication.reset();
    setPassword("");
    setPasswordError(undefined);
  }

  function settle(result: DeleteAccountOnDeviceResult) {
    if (result.kind === "deleted") {
      setIsConfirmed(true);
      return;
    }
    // The server answered that nothing was deleted for want of a fresh password sign-in, as Try again on the
    // unconfirmed board can meet more than 15 minutes later. The account is known to be there, so the confirm
    // asks for the password again.
    if (result.kind === "notDeleted" && result.code === "reauthentication_required") {
      setOutcome("none");
      openConfirmWithEmptyField();
      return;
    }
    setOutcome(result.kind);
    closeConfirm();
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

  async function checkPasswordThenDelete() {
    setIsChecking(true);
    setPasswordError(undefined);
    try {
      const answer = await reauthentication.mutateAsync({ password });
      if (answer.kind === "confirmed") {
        start("none");
      } else {
        setPasswordError(passwordErrorOf[answer.kind]);
      }
    } catch {
      // The hook never rejects for an auth failure, so this is a call that could not run at all.
      setPasswordError(passwordErrorOf.failed);
    } finally {
      reauthentication.reset();
      setIsChecking(false);
    }
  }

  return {
    view: viewOf[outcome],
    isOnline,
    isConfirmOpen,
    hasPasswordStep,
    password,
    passwordError,
    changePassword: (nextPassword) => {
      setPassword(nextPassword);
      setPasswordError(undefined);
    },
    forgotPassword: () => {
      if (isBusy) {
        return;
      }
      closeConfirm();
      setForgotPasswordEmail(user?.email ?? "");
      router.push("/more/forgot-password");
    },
    isBusy,
    isDeleting,
    openConfirm: openConfirmWithEmptyField,
    closeConfirm,
    confirmDeletion: () => {
      if (isBusy) {
        return;
      }
      if (hasPasswordStep) {
        void checkPasswordThenDelete();
      } else {
        start("none");
      }
    },
    retryDeletion: () => {
      start(outcome);
    },
  };
}
