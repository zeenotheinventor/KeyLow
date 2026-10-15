import {
  DIARY_PROBLEMS,
  MACROS_OPTIONAL,
  QUICK_ADD_DIALOG,
  QUICK_ADD_FORM,
  describeMacroTotal,
} from "@keylow/core/copy";
import { iconStroke } from "@keylow/tokens";
import { TriangleAlert } from "lucide-react";
import { useId } from "react";

import type { QuickAddFieldsProps } from "./types";

import { TextField } from "@/components/ui/Input";
import { NumericInput } from "@/components/ui/NumericInput";

/**
 * The quick add fields, for the add dialog and the edit dialog: Calories with the line under it, then
 * Protein, Carbohydrate and Fat (always in that order), then a Label. Only calories are needed, and above 0.
 * The line says what the macros add up to, in the review colour with an icon when they are more than a
 * quarter of the calories away from them, which is information only. Put them in the dialog's form, which
 * lays out its children.
 */
export function QuickAddFields({ draft, caloriesRef }: QuickAddFieldsProps) {
  const helperId = useId();
  const { texts } = draft;

  const helper = draft.hasMacros ? (
    <span
      id={helperId}
      className={
        draft.macrosDisagree
          ? "inline-flex items-center gap-1 text-caption tabular-nums text-warning-ink"
          : "text-caption tabular-nums text-text-muted"
      }
    >
      {draft.macrosDisagree && (
        <TriangleAlert aria-hidden className="size-4" strokeWidth={iconStroke} />
      )}
      {describeMacroTotal(draft.macroTotal)}
    </span>
  ) : (
    <span id={helperId} className="text-caption text-text-muted">
      {MACROS_OPTIONAL}
    </span>
  );

  return (
    <>
      <div className="flex flex-col gap-1">
        <NumericInput
          ref={caloriesRef}
          label={QUICK_ADD_FORM.caloriesLabel}
          unit="kcal"
          value={texts.kcal}
          error={draft.hasKcalError ? DIARY_PROBLEMS.quickAddKcal : undefined}
          describedBy={draft.hasKcalError ? undefined : helperId}
          onChange={(event) => {
            draft.change("kcal", event.target.value);
          }}
          onBlur={draft.touchKcal}
        />
        {!draft.hasKcalError && helper}
      </div>
      <div className="grid gap-2 min-[700px]:grid-cols-3">
        <NumericInput
          label={QUICK_ADD_DIALOG.protein}
          unit="g"
          value={texts.protein}
          onChange={(event) => {
            draft.change("protein", event.target.value);
          }}
        />
        <NumericInput
          label={QUICK_ADD_DIALOG.carbs}
          unit="g"
          value={texts.carbs}
          onChange={(event) => {
            draft.change("carbs", event.target.value);
          }}
        />
        <NumericInput
          label={QUICK_ADD_DIALOG.fat}
          unit="g"
          value={texts.fat}
          onChange={(event) => {
            draft.change("fat", event.target.value);
          }}
        />
      </div>
      <TextField
        label={QUICK_ADD_FORM.labelLabel}
        autoComplete="off"
        value={texts.label}
        onChange={(event) => {
          draft.change("label", event.target.value);
        }}
      />
    </>
  );
}
