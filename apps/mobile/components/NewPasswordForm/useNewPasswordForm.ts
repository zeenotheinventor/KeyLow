import { useUpdatePassword } from "@keylow/api-client";
import { describePasswordUpdateFailure, validateNewPassword } from "@keylow/core/accounts";
import { onlineManager } from "@tanstack/react-query";
import { useState } from "react";

import { reportOtherDevicesNotSignedOut } from "../../lib/sentry/reportOtherDevicesNotSignedOut";

import type { NewPasswordProblems, PasswordUpdateFailure } from "@keylow/core/accounts";

type Options = {
  context: "recovery" | "change";
  /** Called once the password is saved. */
  onSaved?: (() => void) | undefined;
};

/**
 * What the new password form knows: the two fields, the problem under each, the failure above the button,
 * and whether the password was saved. Both problems are found at once on Save, and nothing is sent while
 * there is one. The passwords never leave this hook except to the request itself.
 */
export function useNewPasswordForm({ context, onSaved }: Options) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [problems, setProblems] = useState<NewPasswordProblems>({});
  const [failure, setFailure] = useState<PasswordUpdateFailure | undefined>(undefined);
  const [isSaved, setIsSaved] = useState(false);
  const update = useUpdatePassword();

  async function save() {
    const found = validateNewPassword({ password, confirmation });
    setProblems(found);
    setFailure(undefined);
    if (found.password !== undefined || found.confirmation !== undefined) {
      return;
    }

    // Offline the mutation would pause, spin for ever and then save on reconnect with no one watching, so
    // it is not started.
    if (!onlineManager.isOnline()) {
      setFailure(describePasswordUpdateFailure("network", context));
      return;
    }

    const outcome = await update.mutateAsync({ newPassword: password, context });

    if (outcome.kind === "failed") {
      setFailure(outcome);
      return;
    }

    if (!outcome.otherDevicesSignedOut) {
      reportOtherDevicesNotSignedOut();
    }
    setIsSaved(true);
    onSaved?.();
  }

  return {
    password,
    setPassword,
    confirmation,
    setConfirmation,
    problems,
    // Core's sentence for the failure, never the server's message.
    failureSentence: failure?.message,
    isSessionEnded: failure?.reason === "sessionEnded",
    isSaving: update.isPending,
    isSaved,
    save: () => {
      void save();
    },
  };
}
