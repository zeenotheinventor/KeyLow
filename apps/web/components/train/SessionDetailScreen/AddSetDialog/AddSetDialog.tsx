"use client";

import {
  SET_ENTRY,
  describePrefillLine,
  describeSetEntryName,
  describeSetEntrySubtitle,
} from "@keylow/core/copy";
import { displayLoad, loggedLoad } from "@keylow/core/training";
import { useId, useRef, useState } from "react";

import { SetNumbersFields, useTypedSet } from "../SetNumbersFields";

import type { AddSetDialogProps } from "./types";

import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useIsOnline } from "@/lib/useIsOnline";

/**
 * The dialog that adds a set to a past session, in the shape of the one that changes a set (no board draws
 * it, the phone's set entry sheet is its twin): the exercise and the set's number, the load and reps as large
 * numbers, the RIR as chips, the line that says where the numbers came from, and Log set. The fields start
 * with the numbers of the last set (`entry.prefill`) in the person's unit and follow the rules of logging. A
 * load left as it was filled is stored as the exact kilograms it came from, so the pounds it was shown in do
 * not move it. `onLogSet` resolves to whether the set was stored: the dialog closes when it was, and otherwise
 * stays with the typed numbers as they are, and the owner has said what went wrong. One press, or one Enter,
 * does one thing however many arrive before the first is answered. Render it only while it is open, so each
 * opening starts from its own set.
 */
export function AddSetDialog({ entry, unit, returnFocusTo, onLogSet, onClose }: AddSetDialogProps) {
  const { exerciseName, setType, setNumber, prefill } = entry;
  const { draft, checked, edited, fields } = useTypedSet(
    {
      load: prefill.load_kg === null ? "" : displayLoad(prefill.load_kg, unit),
      reps: prefill.reps === null ? "" : String(prefill.reps),
      rir: prefill.rir === null ? "" : String(prefill.rir),
    },
    { unit, setType },
  );
  const [isLogging, setIsLogging] = useState(false);
  // The state would still read idle for a second submit that arrives before React has drawn the first.
  const isAnswering = useRef(false);
  const isOnline = useIsOnline();
  const formId = useId();
  const offlineId = useId();

  async function log() {
    // A write needs a connection, and Enter in a field submits the form even though the button is off.
    if (isAnswering.current || !isOnline || !checked.ok) {
      return;
    }
    isAnswering.current = true;
    setIsLogging(true);
    try {
      const request = loggedLoad(draft, { edited: edited.load, prefillKg: prefill.load_kg, unit });
      if (await onLogSet(request)) {
        onClose();
      }
    } finally {
      isAnswering.current = false;
      setIsLogging(false);
    }
  }

  return (
    <Dialog
      open
      title={exerciseName}
      onClose={onClose}
      returnFocusTo={returnFocusTo}
      footer={
        <Button
          type="submit"
          form={formId}
          disabled={!isOnline || !checked.ok || isLogging}
          aria-describedby={isOnline ? undefined : offlineId}
          loading={isLogging}
          loadingLabel={SET_ENTRY.logSetAction}
        >
          {SET_ENTRY.logSetAction}
        </Button>
      }
    >
      <form
        id={formId}
        aria-label={describeSetEntryName(exerciseName, setType, setNumber)}
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void log();
        }}
      >
        <p className="text-caption text-text-secondary">
          {describeSetEntrySubtitle({ setType, setNumber, plannedSets: null, target: null })}
        </p>
        <SetNumbersFields
          {...fields}
          rirHelp={SET_ENTRY.rirHelp}
          note={
            fields.loadError === undefined && fields.repsError === undefined
              ? describePrefillLine(prefill, null, unit)
              : null
          }
        />
        {isOnline ? null : (
          <div id={offlineId}>
            <Banner tone="info">{SET_ENTRY.offline}</Banner>
          </div>
        )}
      </form>
    </Dialog>
  );
}
