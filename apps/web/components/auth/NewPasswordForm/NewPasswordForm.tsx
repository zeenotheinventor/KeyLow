"use client";

import { validateNewPassword, type NewPasswordProblems } from "@keylow/core/accounts";
import { GENERIC_ERROR, RESET_LINK_INVALID } from "@keylow/core/copy";
import { useState, type SubmitEvent } from "react";

import type { NewPasswordFormProps } from "./types";

import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Input";
import { reportOtherDevicesNotSignedOut } from "@/lib/auth/reportOtherDevicesNotSignedOut";
import { cn } from "@/lib/utils";

// The sentence is core copy: the outcome carries the words for its reason, never the server's message.
type Failure = { sentence: string; offersNewLink: boolean };

// Each class is written out whole so Tailwind can see it.
const buttonPlacementClasses = {
  fill: "flex flex-col",
  end: "flex justify-end",
} as const satisfies Record<NonNullable<NewPasswordFormProps["buttonPlacement"]>, string>;

const endButtonClass = "min-w-40 max-md:w-full";

/**
 * The two password fields of Set a new password and Change password, with their errors, the error notice and
 * the save button. Both fields are checked on Save and both errors show at once. The page passes the call that
 * saves, so a reset and a change can save differently. Nothing typed is trimmed, logged or kept after a save.
 */
export function NewPasswordForm({
  copy,
  onSave,
  onSaved,
  onSendNewLink,
  completed,
  buttonPlacement = "fill",
}: NewPasswordFormProps) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [problems, setProblems] = useState<NewPasswordProblems>({});
  const [failure, setFailure] = useState<Failure | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function save() {
    setIsSaving(true);
    try {
      const outcome = await onSave(newPassword);

      if (outcome.kind === "failed") {
        setFailure({
          sentence: outcome.message,
          offersNewLink: outcome.reason === "sessionEnded" && onSendNewLink !== undefined,
        });
        return;
      }

      // The password is saved either way, so the person sees the saved state as drawn.
      if (!outcome.otherDevicesSignedOut) {
        reportOtherDevicesNotSignedOut();
      }
      onSaved?.();
    } catch {
      setFailure({ sentence: GENERIC_ERROR, offersNewLink: false });
    } finally {
      setIsSaving(false);
    }
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) {
      return;
    }

    const found = validateNewPassword({ password: newPassword, confirmation });
    setProblems(found);
    setFailure(null);
    if (found.password !== undefined || found.confirmation !== undefined) {
      return;
    }

    void save();
  }

  const isCompleted = completed !== undefined;
  const buttonClass = buttonPlacement === "end" ? endButtonClass : undefined;

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
      <TextField
        label={copy.newPasswordLabel}
        name="newPassword"
        type="password"
        autoComplete="new-password"
        value={newPassword}
        onChange={(event) => {
          setNewPassword(event.target.value);
        }}
        helper={copy.helper}
        error={problems.password}
        disabled={isCompleted}
      />
      <TextField
        label={copy.confirmPasswordLabel}
        name="confirmation"
        type="password"
        autoComplete="new-password"
        value={confirmation}
        onChange={(event) => {
          setConfirmation(event.target.value);
        }}
        error={problems.confirmation}
        disabled={isCompleted}
      />

      {failure !== null && !isCompleted && (
        <Banner
          tone="error"
          {...(failure.offersNewLink && onSendNewLink !== undefined
            ? { action: { label: RESET_LINK_INVALID.sendNewLinkLabel, onClick: onSendNewLink } }
            : {})}
        >
          {failure.sentence}
        </Banner>
      )}

      {isCompleted && (
        <Banner tone="success" title={completed.title}>
          {completed.body}
        </Banner>
      )}

      <div className={cn("mt-1", buttonPlacementClasses[buttonPlacement])}>
        {isCompleted ? (
          <Button type="button" className={buttonClass} onClick={completed.onDone}>
            {completed.doneLabel}
          </Button>
        ) : (
          <Button
            type="submit"
            className={buttonClass}
            loading={isSaving}
            loadingLabel={copy.submittingLabel}
          >
            {copy.submitLabel}
          </Button>
        )}
      </div>
    </form>
  );
}
