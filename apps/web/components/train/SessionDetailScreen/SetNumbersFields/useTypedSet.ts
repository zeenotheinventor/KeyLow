import { describeSetInputError, isWordedSetInputRule } from "@keylow/core/copy";
import { validateSetDraft } from "@keylow/core/training";
import { useState } from "react";

import type { SetNumbersFieldsProps, TypedSet } from "./types";
import type { LoadUnit, SetDraft, SetType } from "@keylow/core/training";

type EditedFields = Readonly<{ load: boolean; reps: boolean }>;

/**
 * What a set dialog holds while it is open: the numbers it opened with, the numbers as typed, whether the
 * set they make is valid (`checked`) and the props of the shared fields. A field shows its rule only once it
 * has been edited, and the sentence states the rule, never the value typed.
 */
export function useTypedSet(
  initial: TypedSet,
  { unit, setType }: { unit: LoadUnit; setType: SetType },
) {
  const [opening] = useState(initial);
  const [typed, setTyped] = useState<TypedSet>(opening);
  const [edited, setEdited] = useState<EditedFields>({ load: false, reps: false });

  const draft: SetDraft = { setType, ...typed, rpe: "" };
  const checked = validateSetDraft(draft, { unit, effortMode: "rir" });
  const issues = checked.ok ? [] : checked.issues;
  const errorOf = (field: "load" | "reps"): string | undefined => {
    const rule = issues.find((issue) => issue.field === field)?.rule;
    return edited[field] && rule !== undefined && isWordedSetInputRule(rule)
      ? describeSetInputError(rule, unit)
      : undefined;
  };

  const fields: Omit<SetNumbersFieldsProps, "rirHelp"> = {
    unit,
    typed,
    loadError: errorOf("load"),
    repsError: errorOf("reps"),
    onChangeLoad: (load) => {
      setTyped((current) => ({ ...current, load }));
      setEdited((current) => ({ ...current, load: true }));
    },
    onChangeReps: (reps) => {
      setTyped((current) => ({ ...current, reps }));
      setEdited((current) => ({ ...current, reps: true }));
    },
    onChangeRir: (rir) => {
      setTyped((current) => ({ ...current, rir }));
    },
  };

  return { opening, typed, draft, checked, edited, fields };
}
