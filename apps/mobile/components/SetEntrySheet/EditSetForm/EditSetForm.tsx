import {
  HISTORY_EDIT_SET,
  describeEditSetSheet,
  describeSetInputError,
  isWordedSetInputRule,
} from "@keylow/core/copy";
import { displayLoad, validateSetDraft } from "@keylow/core/training";
import { useRef, useState } from "react";
import { View } from "react-native";

import { Button, Text } from "../../ui";
import { LoadRepsFields } from "../LoadRepsFields";
import { RirField } from "../RirField";

import type { EditSetFormProps } from "./types";
import type { SetChanges } from "../types";
import type { SetDraft } from "@keylow/core/training";

type EditedFields = Readonly<{ load: boolean; reps: boolean }>;
type Pending = "save" | "delete";

/** The text the fields open with: the stored numbers in the person's unit, and a blank for a number the set does not have. */
function openingDraft(
  { loadKg, reps, rir }: EditSetFormProps["entry"],
  unit: EditSetFormProps["unit"],
) {
  return {
    load: loadKg === null ? "" : displayLoad(loadKg, unit),
    reps: String(reps),
    rir: rir === null ? "" : String(rir),
  };
}

/**
 * The inside of the set entry sheet when it changes a set of a past session, as the `history · edit-set`
 * board draws it: the exercise and when the set was done, the same fields and RIR as logging with the same
 * rules, a line saying the change reaches that day's heat and the week's sets, and Delete set and Save
 * changes. Only what was changed is handed to `onSave`, and a load left as it was is left out, so a set
 * stored in kilograms is not moved by the rounding of the pounds it was shown in. Saving with nothing
 * changed closes the sheet and writes nothing. The handlers resolve to whether the change was stored: the
 * sheet closes when it was, and otherwise stays with the typed numbers as they are. One press does one thing,
 * however many arrive before the first is answered.
 */
export function EditSetForm({ entry, unit, onSave, onDelete, onClose }: EditSetFormProps) {
  const [opening] = useState(() => openingDraft(entry, unit));
  const [typed, setTyped] = useState(opening);
  const [edited, setEdited] = useState<EditedFields>({ load: false, reps: false });
  const [pending, setPending] = useState<Pending | null>(null);
  // The state would still read idle for a second press that arrives before React has drawn the first.
  const isAnswering = useRef(false);

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
    if (isAnswering.current) {
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

  return (
    <View className="gap-4">
      <View className="gap-0.5">
        <Text role="heading" variant="h2">
          {copy.title}
        </Text>
        <Text tone="secondary" variant="caption">
          {copy.subtitle}
        </Text>
      </View>
      <LoadRepsFields
        load={typed.load}
        loadError={errorOf("load")}
        reps={typed.reps}
        repsError={errorOf("reps")}
        unit={unit}
        onChangeLoad={(load) => {
          setTyped((current) => ({ ...current, load }));
          setEdited((current) => ({ ...current, load: true }));
        }}
        onChangeReps={(reps) => {
          setTyped((current) => ({ ...current, reps }));
          setEdited((current) => ({ ...current, reps: true }));
        }}
      />
      <RirField
        help={rirHelp}
        rir={typed.rir}
        onChange={(rir) => {
          setTyped((current) => ({ ...current, rir }));
        }}
      />
      <Text tone="secondary" variant="caption">
        {HISTORY_EDIT_SET.effectHint}
      </Text>
      <View className="flex-row gap-2">
        <Button
          className="flex-1"
          disabled={pending !== null}
          icon="Trash2"
          loading={pending === "delete"}
          tone="danger"
          variant="secondary"
          onPress={() => {
            void answer("delete", onDelete);
          }}
        >
          {HISTORY_EDIT_SET.deleteSetAction}
        </Button>
        <Button
          className="flex-1"
          disabled={!checked.ok || pending !== null}
          haptic="confirm"
          loading={pending === "save"}
          onPress={() => {
            const changes = changesOf();
            void answer("save", () =>
              Object.keys(changes).length === 0 ? Promise.resolve(true) : onSave(changes),
            );
          }}
        >
          {HISTORY_EDIT_SET.saveAction}
        </Button>
      </View>
    </View>
  );
}
