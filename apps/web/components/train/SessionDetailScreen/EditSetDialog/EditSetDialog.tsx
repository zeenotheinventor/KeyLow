"use client";

import { HISTORY_EDIT_SET, describeEditSetSheet } from "@keylow/core/copy";
import { displayLoad } from "@keylow/core/training";
import { Trash2 } from "lucide-react";
import { useId, useRef, useState } from "react";

import { SetNumbersFields, useTypedSet } from "../SetNumbersFields";

import type { EditSetDialogProps } from "./types";
import type { SetChanges } from "@keylow/api-client";

import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useIsOnline } from "@/lib/useIsOnline";

type Pending = "save" | "delete";

/**
 * The dialog that changes a set of a past session, as the `history · edit-set` board draws its sheet (the web
 * has no bottom sheet, so it is the same content in a `Dialog`): the exercise and when the set was done, the
 * load and reps as large numbers, the RIR as chips with the line for a working set with none, the line that
 * the change reaches that day's heat and the week's sets, Delete set and Save changes. The fields start with
 * the stored numbers in the person's unit and follow the rules of logging. Only what was changed is handed to
 * `onSave`, and a load left as it was is left out, so a set stored in kilograms is not moved by the rounding of
 * the pounds it was shown in. Saving with nothing changed closes the dialog and writes nothing. Both writes
 * need a connection: with none the two buttons are off with the line that says why, and Enter in a field sends
 * nothing. The handlers resolve to whether the change was stored: the dialog closes when it was, and
 * otherwise stays with the typed numbers as they are. One press, or one Enter, does one thing however many
 * arrive before the first is answered. Render it only while it is open, so each opening starts from its own
 * set.
 */
export function EditSetDialog({
  entry,
  unit,
  returnFocusTo,
  onSave,
  onDelete,
  onClose,
}: EditSetDialogProps) {
  const { opening, typed, checked, fields } = useTypedSet(
    {
      load: entry.loadKg === null ? "" : displayLoad(entry.loadKg, unit),
      reps: String(entry.reps),
      rir: entry.rir === null ? "" : String(entry.rir),
    },
    { unit, setType: entry.setType },
  );
  const [pending, setPending] = useState<Pending | null>(null);
  // The state would still read idle for a second submit that arrives before React has drawn the first.
  const isAnswering = useRef(false);
  const isOnline = useIsOnline();
  const formId = useId();
  const offlineId = useId();

  const copy = describeEditSetSheet(entry);
  // The board's line is about a working set, which counts as hard with no RIR.
  const rirHelp =
    typed.rir.trim() === "" && entry.setType === "working" ? HISTORY_EDIT_SET.noRirHint : null;

  function changesOf(): SetChanges {
    if (!checked.ok) {
      return {};
    }
    const { values } = checked;
    return {
      ...(typed.load === opening.load ? {} : { loadKg: values.loadKg }),
      ...(typed.reps === opening.reps ? {} : { reps: values.reps }),
      ...(typed.rir === opening.rir ? {} : { rir: values.rir }),
    };
  }

  async function answer(kind: Pending, ask: () => Promise<boolean>) {
    // Writes need a connection, and Enter in a field submits the form even though the buttons are off.
    if (isAnswering.current || !isOnline) {
      return;
    }
    isAnswering.current = true;
    setPending(kind);
    try {
      if (await ask()) {
        onClose();
      }
    } finally {
      isAnswering.current = false;
      setPending(null);
    }
  }

  function save() {
    if (!checked.ok) {
      return;
    }
    const changes = changesOf();
    void answer("save", () =>
      Object.keys(changes).length === 0 ? Promise.resolve(true) : onSave(changes),
    );
  }

  return (
    <Dialog
      open
      title={copy.title}
      onClose={onClose}
      returnFocusTo={returnFocusTo}
      leadingAction={
        <Button
          type="button"
          variant="ghost"
          tone="danger"
          disabled={!isOnline || pending !== null}
          aria-describedby={isOnline ? undefined : offlineId}
          loading={pending === "delete"}
          loadingLabel={HISTORY_EDIT_SET.deleteSetAction}
          onClick={() => {
            void answer("delete", onDelete);
          }}
        >
          <Trash2 aria-hidden />
          {HISTORY_EDIT_SET.deleteSetAction}
        </Button>
      }
      footer={
        <Button
          type="submit"
          form={formId}
          disabled={!isOnline || !checked.ok || pending !== null}
          aria-describedby={isOnline ? undefined : offlineId}
          loading={pending === "save"}
          loadingLabel={HISTORY_EDIT_SET.saveAction}
        >
          {HISTORY_EDIT_SET.saveAction}
        </Button>
      }
    >
      <form
        id={formId}
        aria-label={copy.accessibleName}
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <p className="text-caption text-text-secondary">{copy.subtitle}</p>
        <SetNumbersFields {...fields} rirHelp={rirHelp} />
        <p className="text-caption text-text-secondary">{HISTORY_EDIT_SET.effectHint}</p>
        {isOnline ? null : (
          <div id={offlineId}>
            <Banner tone="info">{HISTORY_EDIT_SET.offline}</Banner>
          </div>
        )}
      </form>
    </Dialog>
  );
}
