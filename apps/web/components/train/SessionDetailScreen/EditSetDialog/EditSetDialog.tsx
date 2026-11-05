"use client";

import {
  HISTORY_EDIT_SET,
  RIR_CHIP_LABELS,
  SET_ENTRY,
  describeEditSetSheet,
  describeLoadFieldLabel,
  describeSetInputError,
  isWordedSetInputRule,
} from "@keylow/core/copy";
import { displayLoad, validateSetDraft } from "@keylow/core/training";
import { Trash2 } from "lucide-react";
import { useId, useRef, useState } from "react";

import type { EditSetDialogProps } from "./types";
import type { SetChanges } from "@keylow/api-client";
import type { SetDraft } from "@keylow/core/training";

import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { ChipGroup } from "@/components/ui/ChipGroup";
import { Dialog } from "@/components/ui/Dialog";
import { NumericInput } from "@/components/ui/NumericInput";
import { useIsOnline } from "@/lib/useIsOnline";

type EditedFields = Readonly<{ load: boolean; reps: boolean }>;
type Pending = "save" | "delete";

// RIR is held as the text of its number, which is what a chip stands for: "6+" is 6.
const RIR_OPTIONS = RIR_CHIP_LABELS.map((label, index) => ({ value: String(index), label }));
const LAST_RIR_CHIP = RIR_OPTIONS.length - 1;

/** The chip that stands for the RIR held as text: the 6+ chip for six or more, none for a blank. */
function chipOf(rir: string): string {
  const number = rir.trim() === "" ? Number.NaN : Number(rir);
  return Number.isInteger(number) && number >= 0 ? String(Math.min(number, LAST_RIR_CHIP)) : "";
}

// The load and reps are the board's 32 px numbers in a 64 px box.
const numberFrameClasses = "h-16 justify-center px-3";
const numberClasses = "text-center text-[32px] leading-10 font-semibold";

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
  const [opening] = useState(() => ({
    load: entry.loadKg === null ? "" : displayLoad(entry.loadKg, unit),
    reps: String(entry.reps),
    rir: entry.rir === null ? "" : String(entry.rir),
  }));
  const [typed, setTyped] = useState(opening);
  const [edited, setEdited] = useState<EditedFields>({ load: false, reps: false });
  const [pending, setPending] = useState<Pending | null>(null);
  // The state would still read idle for a second submit that arrives before React has drawn the first.
  const isAnswering = useRef(false);
  const isOnline = useIsOnline();
  const formId = useId();
  const offlineId = useId();

  const draft: SetDraft = { setType: entry.setType, ...typed, rpe: "" };
  const checked = validateSetDraft(draft, { unit, effortMode: "rir" });
  const issues = checked.ok ? [] : checked.issues;
  const errorOf = (field: "load" | "reps"): string | undefined => {
    const rule = issues.find((issue) => issue.field === field)?.rule;
    return edited[field] && rule !== undefined && isWordedSetInputRule(rule)
      ? describeSetInputError(rule, unit)
      : undefined;
  };
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
        <div className="grid grid-cols-2 gap-3">
          <NumericInput
            label={describeLoadFieldLabel(unit)}
            value={typed.load}
            placeholder="–"
            error={errorOf("load")}
            frameClassName={numberFrameClasses}
            className={numberClasses}
            onChange={(event) => {
              setTyped((current) => ({ ...current, load: event.target.value }));
              setEdited((current) => ({ ...current, load: true }));
            }}
          />
          <NumericInput
            // The dialog leaves focus alone when a child inside it has taken focus, so the reps are first, as the board draws, not Close.
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            inputMode="numeric"
            label={SET_ENTRY.repsLabel}
            value={typed.reps}
            placeholder="–"
            error={errorOf("reps")}
            frameClassName={numberFrameClasses}
            className={numberClasses}
            onChange={(event) => {
              setTyped((current) => ({ ...current, reps: event.target.value }));
              setEdited((current) => ({ ...current, reps: true }));
            }}
          />
        </div>
        <div className="flex flex-col gap-2">
          <span aria-hidden className="text-caption text-text-secondary">
            {SET_ENTRY.rirHeading}
          </span>
          <ChipGroup
            label={SET_ENTRY.rirHeading}
            options={RIR_OPTIONS}
            value={chipOf(typed.rir)}
            className="[&>button]:flex-1 [&>button]:justify-center [&>button]:px-0"
            onChange={(chip) => {
              setTyped((current) => ({ ...current, rir: chip }));
            }}
            onChipPress={(chip) => {
              // Pressing the chosen chip takes it back, so a set can be left with no RIR.
              if (chipOf(typed.rir) === chip) {
                setTyped((current) => ({ ...current, rir: "" }));
              }
            }}
          />
          {rirHelp === null ? null : <p className="text-caption text-text-muted">{rirHelp}</p>}
        </div>
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
