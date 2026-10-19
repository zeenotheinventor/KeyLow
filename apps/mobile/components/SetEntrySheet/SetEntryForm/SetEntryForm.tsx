import { useAddSet } from "@keylow/api-client";
import {
  RIR_CHIP_LABELS,
  SET_ENTRY,
  describeLoadFieldLabel,
  describePrefillLine,
  describeSameAgainName,
  describeSetEntrySubtitle,
  describeSetInputError,
  describeSetTypeSheet,
  isWordedSetInputRule,
} from "@keylow/core/copy";
import { displayLoad, sameAgain, validateSetDraft } from "@keylow/core/training";
import { useState } from "react";
import { View } from "react-native";

import { Button, ChipGroup, NumericInput, PressableSurface, Text } from "../../ui";

import type { SetEntryFormProps } from "./types";
import type { SetDraft, SetPrefill, SetValues } from "@keylow/core/training";

type EditedFields = Readonly<{ load: boolean; reps: boolean }>;

// RIR is held as the text of its number, which is what a chip stands for: "6+" is 6.
const RIR_OPTIONS = RIR_CHIP_LABELS.map((label, index) => ({ value: String(index), label }));
const LAST_RIR_CHIP = RIR_OPTIONS.length - 1;

/** The chip that stands for the RIR held as text: the 6+ chip for six or more, none for a blank. */
function chipOf(rir: string): string | null {
  const number = rir.trim() === "" ? Number.NaN : Number(rir);
  return Number.isInteger(number) && number >= 0 ? String(Math.min(number, LAST_RIR_CHIP)) : null;
}

/** The text the fields open with: a blank for a number the prefill does not have. */
function openingDraft(prefill: SetPrefill, unit: SetEntryFormProps["unit"]) {
  return {
    load: prefill.load_kg === null ? "" : displayLoad(prefill.load_kg, unit),
    reps: prefill.reps === null ? "" : String(prefill.reps),
    rir: prefill.rir === null ? "" : String(prefill.rir),
  };
}

// Same again repeats a stored load in kilograms, to the gram. A load such as 102.058 would be refused as a
// thousands separator typed by hand, so it is written with a fourth decimal, which the rule leaves alone.
const exactKilograms = (kilograms: number): string => kilograms.toFixed(4);

function sameAgainDraft(values: SetValues): SetDraft {
  return {
    setType: values.setType,
    load: values.loadKg === null ? "" : exactKilograms(values.loadKg),
    reps: String(values.reps),
    rir: values.rir === null ? "" : String(values.rir),
    rpe: "",
  };
}

/**
 * The inside of the set entry sheet: the exercise and set, the load and reps fields, RIR, and Same again and
 * Log set. A field shows its rule once it has been edited, and Log set is off while any field breaks one.
 * The typed values are held here and a failed write leaves them as they are, with a line saying the set did
 * not save that the next try clears.
 */
export function SetEntryForm({
  entry,
  sessionId,
  unit,
  onLogged,
  onPressSetNumber,
}: SetEntryFormProps) {
  const { exerciseId, exerciseName, setType, setNumber, plan, prefill, lastWeek } = entry;
  const [typed, setTyped] = useState(() => openingDraft(prefill, unit));
  const [edited, setEdited] = useState<EditedFields>({ load: false, reps: false });
  const addSet = useAddSet();

  const draft: SetDraft = { setType, ...typed, rpe: "" };
  const checked = validateSetDraft(draft, { unit, effortMode: "rir" });
  const issues = checked.ok ? [] : checked.issues;
  const errorOf = (field: "load" | "reps"): string | undefined => {
    const rule = issues.find((issue) => issue.field === field)?.rule;
    return edited[field] && rule !== undefined && isWordedSetInputRule(rule)
      ? describeSetInputError(rule, unit)
      : undefined;
  };
  const loadError = errorOf("load");
  const repsError = errorOf("reps");
  const repeat = prefill.source === "none" ? null : sameAgain(prefill);
  const isLogging = addSet.isPending;

  function log(input: { draft: SetDraft; unit: SetEntryFormProps["unit"] }) {
    addSet.mutate(
      { sessionId, exerciseId, effortMode: "rir", now: new Date(), ...input },
      { onSuccess: onLogged },
    );
  }

  const subtitle = describeSetEntrySubtitle({
    setType,
    setNumber,
    plannedSets: plan === null ? null : plan.sets,
    target: plan,
  });
  const subtitleText = (
    <Text tone="secondary" variant="caption">
      {subtitle}
    </Text>
  );

  return (
    <View className="gap-4">
      <View className="gap-0.5">
        <Text role="heading" variant="h2">
          {exerciseName}
        </Text>
        {onPressSetNumber === undefined ? (
          subtitleText
        ) : (
          <PressableSurface
            label={describeSetTypeSheet({ exerciseName, setType, setNumber }).accessibleName}
            onPress={onPressSetNumber}
          >
            {subtitleText}
          </PressableSurface>
        )}
      </View>
      <View className="flex-row gap-3">
        <View className="flex-1">
          <NumericInput
            align="center"
            error={loadError}
            label={describeLoadFieldLabel(unit)}
            size="display"
            value={typed.load}
            onChangeText={(load) => {
              setTyped((current) => ({ ...current, load }));
              setEdited((current) => ({ ...current, load: true }));
            }}
          />
        </View>
        <View className="flex-1">
          <NumericInput
            align="center"
            error={repsError}
            keyboardType="number-pad"
            label={SET_ENTRY.repsLabel}
            size="display"
            value={typed.reps}
            onChangeText={(reps) => {
              setTyped((current) => ({ ...current, reps }));
              setEdited((current) => ({ ...current, reps: true }));
            }}
          />
        </View>
      </View>
      {loadError === undefined && repsError === undefined ? (
        <Text className="-mt-2" tone="muted" variant="caption">
          {describePrefillLine(prefill, lastWeek, unit)}
        </Text>
      ) : null}
      <View className="gap-2">
        <Text tone="secondary" variant="caption">
          {SET_ENTRY.rirHeading}
        </Text>
        <ChipGroup
          allowDeselect
          label={SET_ENTRY.rirHeading}
          layout="equal"
          options={RIR_OPTIONS}
          value={chipOf(typed.rir)}
          onChange={(chip: string | null) => {
            setTyped((current) => ({ ...current, rir: chip ?? "" }));
          }}
        />
        <Text tone="muted" variant="caption">
          {SET_ENTRY.rirHelp}
        </Text>
      </View>
      {addSet.isError ? (
        <Text role="alert" tone="danger" variant="caption">
          {SET_ENTRY.saveFailed}
        </Text>
      ) : null}
      <View className="flex-row gap-2">
        {repeat === null ? null : (
          <Button
            accessibilityLabel={describeSameAgainName({
              loadKg: repeat.loadKg,
              reps: repeat.reps,
              rir: repeat.rir,
              unit,
            })}
            className="flex-1"
            disabled={isLogging}
            icon="Repeat2"
            variant="secondary"
            onPress={() => {
              log({ draft: sameAgainDraft(repeat), unit: "kg" });
            }}
          >
            {SET_ENTRY.sameAgainAction}
          </Button>
        )}
        <Button
          className="flex-1"
          disabled={!checked.ok}
          haptic="confirm"
          loading={isLogging}
          onPress={() => {
            // A load left as it was filled is the prefill's own kilograms, which the unit's rounded text may not be.
            log(
              edited.load || prefill.load_kg === null
                ? { draft, unit }
                : { draft: { ...draft, load: exactKilograms(prefill.load_kg) }, unit: "kg" },
            );
          }}
        >
          {SET_ENTRY.logSetAction}
        </Button>
      </View>
    </View>
  );
}
