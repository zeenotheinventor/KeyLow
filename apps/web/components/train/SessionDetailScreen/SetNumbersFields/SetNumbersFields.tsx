"use client";

import { RIR_CHIP_LABELS, SET_ENTRY, describeLoadFieldLabel } from "@keylow/core/copy";

import type { SetNumbersFieldsProps } from "./types";

import { ChipGroup } from "@/components/ui/ChipGroup";
import { NumericInput } from "@/components/ui/NumericInput";

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
 * The numbers of a set in a dialog, as the `history · edit-set` board draws them: the load and reps as large
 * numbers, and the RIR as chips. Shared by the dialog that changes a set and the one that adds a set, so the
 * two never drift. Pressing the chosen chip takes it back, so a set can be left with no RIR.
 */
export function SetNumbersFields({
  unit,
  typed,
  loadError,
  repsError,
  onChangeLoad,
  onChangeReps,
  onChangeRir,
  rirHelp,
  note = null,
}: SetNumbersFieldsProps) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <NumericInput
          label={describeLoadFieldLabel(unit)}
          value={typed.load}
          placeholder="–"
          error={loadError}
          frameClassName={numberFrameClasses}
          className={numberClasses}
          onChange={(event) => {
            onChangeLoad(event.target.value);
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
          error={repsError}
          frameClassName={numberFrameClasses}
          className={numberClasses}
          onChange={(event) => {
            onChangeReps(event.target.value);
          }}
        />
      </div>
      {note === null ? null : <p className="-mt-2 text-caption text-text-muted">{note}</p>}
      <div className="flex flex-col gap-2">
        <span aria-hidden className="text-caption text-text-secondary">
          {SET_ENTRY.rirHeading}
        </span>
        <ChipGroup
          label={SET_ENTRY.rirHeading}
          options={RIR_OPTIONS}
          value={chipOf(typed.rir)}
          className="[&>button]:flex-1 [&>button]:justify-center [&>button]:px-0"
          onChange={onChangeRir}
          onChipPress={(chip) => {
            if (chipOf(typed.rir) === chip) {
              onChangeRir("");
            }
          }}
        />
        {rirHelp === null ? null : <p className="text-caption text-text-muted">{rirHelp}</p>}
      </div>
    </>
  );
}
