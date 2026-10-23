import { useAddSet } from "@keylow/api-client";
import {
  SET_ENTRY,
  SET_TYPE_OPTIONS,
  describePrefillLine,
  describeSameAgainName,
  describeSetEntrySubtitle,
  describeSetInputError,
  describeSetTypeSheet,
  isWordedSetInputRule,
} from "@keylow/core/copy";
import { SET_TYPES, displayLoad, sameAgain, validateSetDraft } from "@keylow/core/training";
import { useRef, useState } from "react";
import { View } from "react-native";

import { Button, PressableSurface, SegmentedControl, Text } from "../../ui";
import { LoadRepsFields } from "../LoadRepsFields";
import { RirField } from "../RirField";

import type { SetEntryFormProps } from "./types";
import type { SetDraft, SetPrefill, SetType, SetValues } from "@keylow/core/training";

type EditedFields = Readonly<{ load: boolean; reps: boolean }>;

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

function sameAgainDraft(values: SetValues, setType: SetType): SetDraft {
  return {
    setType,
    load: values.loadKg === null ? "" : exactKilograms(values.loadKg),
    reps: String(values.reps),
    rir: values.rir === null ? "" : String(values.rir),
    rpe: "",
  };
}

const setTypeOptions = SET_TYPES.map((type) => ({
  value: type,
  label: SET_TYPE_OPTIONS[type].name,
}));

/**
 * The inside of the set entry sheet: the exercise and set, the Set type control, the load and reps fields,
 * RIR, and Same again and Log set. The type is the screen's to hold (`setType`), so a change of it leaves what
 * was typed alone, and both Log set and Same again store it. A field shows its rule once it has been edited,
 * and Log set is off while any field breaks one.
 * The typed values are held here and a failed write leaves them as they are, with a line saying the set did
 * not save that the next try clears. Given `onLogSet` (a session that is not the one in progress) the form
 * hands it the set instead of writing, and the screen that owns it says what went wrong, so no line is drawn
 * here; the sheet closes only when it resolves to true, and one press does one thing.
 */
export function SetEntryForm({
  entry,
  sessionId,
  setType,
  unit,
  onChangeSetType,
  onLogged,
  onLogSet,
  onPressSetNumber,
}: SetEntryFormProps) {
  const { exerciseId, exerciseName, setNumber, plan, prefill, lastWeek } = entry;
  const [typed, setTyped] = useState(() => openingDraft(prefill, unit));
  const [edited, setEdited] = useState<EditedFields>({ load: false, reps: false });
  const addSet = useAddSet();
  const [isAnswering, setIsAnswering] = useState(false);
  // The state would still read idle for a second press that arrives before React has drawn the first.
  const isAnsweringRef = useRef(false);

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
  const isLogging = addSet.isPending || isAnswering;

  async function logThrough(
    store: NonNullable<SetEntryFormProps["onLogSet"]>,
    input: { draft: SetDraft; unit: SetEntryFormProps["unit"] },
  ) {
    if (isAnsweringRef.current) {
      return;
    }
    isAnsweringRef.current = true;
    setIsAnswering(true);
    try {
      if (await store(input)) {
        onLogged();
      }
    } finally {
      isAnsweringRef.current = false;
      setIsAnswering(false);
    }
  }

  function log(input: { draft: SetDraft; unit: SetEntryFormProps["unit"] }) {
    if (onLogSet !== undefined) {
      void logThrough(onLogSet, input);
      return;
    }
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
      <SegmentedControl
        label={SET_ENTRY.setTypeGroupName}
        options={setTypeOptions}
        value={setType}
        onChange={onChangeSetType}
      />
      <LoadRepsFields
        load={typed.load}
        loadError={loadError}
        reps={typed.reps}
        repsError={repsError}
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
      {loadError === undefined && repsError === undefined ? (
        <Text className="-mt-2" tone="muted" variant="caption">
          {describePrefillLine(prefill, lastWeek, unit)}
        </Text>
      ) : null}
      <RirField
        help={SET_ENTRY.rirHelp}
        rir={typed.rir}
        onChange={(rir) => {
          setTyped((current) => ({ ...current, rir }));
        }}
      />
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
              log({ draft: sameAgainDraft(repeat, setType), unit: "kg" });
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
