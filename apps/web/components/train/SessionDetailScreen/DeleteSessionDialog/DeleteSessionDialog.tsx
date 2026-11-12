"use client";

import { HISTORY_DELETE_SESSION } from "@keylow/core/copy";
import { Trash2 } from "lucide-react";
import { useId, useRef, useState } from "react";

import type { DeleteSessionDialogProps } from "./types";

import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useIsOnline } from "@/lib/useIsOnline";

/**
 * The confirmation before a past session is deleted, with the words KEY-414 gave it: the sets, the day and the
 * date, and that it cannot be undone. Delete session is the danger action on the left of the footer and Keep
 * it changes nothing. A delete needs a connection: with none, Delete session is off with the line that says
 * why. The answer is already given once the delete is on its way, so nothing closes the dialog until it is
 * answered, and a second press does nothing. A delete that fails leaves the dialog open, and the owner says so.
 * Render it only while it is open.
 */
export function DeleteSessionDialog({
  body,
  returnFocusTo,
  onConfirm,
  onClose,
}: DeleteSessionDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const isAnswering = useRef(false);
  const isOnline = useIsOnline();
  const offlineId = useId();

  async function confirm() {
    if (isAnswering.current || !isOnline) {
      return;
    }
    isAnswering.current = true;
    setIsDeleting(true);
    // A delete that worked stays answered: the page is on its way out, and a second press would delete a
    // session that is already gone. Only a failure lets go, to try again.
    if (!(await onConfirm())) {
      isAnswering.current = false;
      setIsDeleting(false);
    }
  }

  return (
    <Dialog
      open
      title={HISTORY_DELETE_SESSION.title}
      returnFocusTo={returnFocusTo}
      onClose={() => {
        if (!isAnswering.current) {
          onClose();
        }
      }}
      leadingAction={
        <Button
          type="button"
          variant="ghost"
          tone="danger"
          disabled={!isOnline}
          aria-describedby={isOnline ? undefined : offlineId}
          loading={isDeleting}
          loadingLabel={HISTORY_DELETE_SESSION.confirmAction}
          onClick={() => {
            void confirm();
          }}
        >
          <Trash2 aria-hidden />
          {HISTORY_DELETE_SESSION.confirmAction}
        </Button>
      }
      footer={
        <Button disabled={isDeleting} onClick={onClose}>
          {HISTORY_DELETE_SESSION.cancelAction}
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-body text-text-secondary">{body}</p>
        {isOnline ? null : (
          <div id={offlineId}>
            <Banner tone="info">{HISTORY_DELETE_SESSION.offline}</Banner>
          </div>
        )}
      </div>
    </Dialog>
  );
}
