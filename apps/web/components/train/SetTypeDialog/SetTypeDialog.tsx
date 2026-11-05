import { SET_ENTRY, SET_MARKS, SET_TYPE_OPTIONS, describeSetTypeSheet } from "@keylow/core/copy";
import { SET_TYPES } from "@keylow/core/training";

import type { SetTypeDialogProps } from "./types";

import { Dialog } from "@/components/ui/Dialog";

// The classes are written out so Tailwind sees them. The chosen option takes the accent border and fill, as
// the `session · set-types` board draws it, and there is no radio dot.
const optionClasses = {
  chosen: "border-accent bg-accent-muted",
  other: "border-border bg-transparent hover:bg-surface-raised",
} as const;

const optionBaseClasses =
  "flex min-h-[60px] w-full items-center gap-3 rounded-medium border px-3 py-2 text-left text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-focus-ring-offset";

const tileInkClasses = { warmup: "text-warning-ink", other: "text-text-primary" } as const;

const focusOnMount = (option: HTMLButtonElement | null) => {
  option?.focus();
};

/**
 * The dialog that changes the type of a set, as the `session · set-types` board draws its sheet (the web has
 * no bottom sheet, so it is the same choices in a `Dialog`): the exercise and set under a "Set type" heading,
 * and the four types as radios, each with a tile for its mark (W, the set's number, D, F), its name and what
 * it counts as. Pressing one hands it to `onChoose`, and the owner writes it and closes the dialog. Built for
 * the session page's rows to log and its logged rows, which both name the set the same way.
 */
export function SetTypeDialog({
  open,
  onClose,
  exerciseName,
  setType,
  setNumber,
  onChoose,
  returnFocusTo,
}: SetTypeDialogProps) {
  const { subtitle } = describeSetTypeSheet({ exerciseName, setType, setNumber });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={SET_ENTRY.setTypeSheetTitle}
      returnFocusTo={returnFocusTo}
    >
      <div className="flex flex-col gap-3">
        <p className="text-caption text-text-secondary">{subtitle}</p>
        <div
          role="radiogroup"
          aria-label={SET_ENTRY.setTypeGroupName}
          className="flex flex-col gap-2"
        >
          {SET_TYPES.map((type) => {
            const { name, help } = SET_TYPE_OPTIONS[type];
            const isChosen = type === setType;

            return (
              <button
                key={type}
                type="button"
                role="radio"
                aria-checked={isChosen}
                aria-label={`${name}. ${help}`}
                // The checked option takes focus when the dialog opens, so Enter or Space on it keeps the type.
                ref={isChosen ? focusOnMount : undefined}
                className={`${optionBaseClasses} ${optionClasses[isChosen ? "chosen" : "other"]}`}
                onClick={() => {
                  onChoose(type);
                }}
              >
                <span
                  aria-hidden
                  className={`flex size-8 shrink-0 items-center justify-center rounded-small bg-surface-raised text-body-strong tabular-nums ${tileInkClasses[type === "warmup" ? "warmup" : "other"]}`}
                >
                  {SET_MARKS[type](setNumber)}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span aria-hidden className="text-body-strong">
                    {name}
                  </span>
                  <span aria-hidden className="text-caption text-text-secondary">
                    {help}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </Dialog>
  );
}
