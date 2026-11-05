import { useSaveExercise } from "@keylow/api-client";
import {
  CUSTOM_EXERCISE,
  describeCustomExerciseIssue,
  describeExerciseNameLength,
  describeSaveCustomExerciseAction,
} from "@keylow/core/copy";
import { validateCustomExerciseDraft } from "@keylow/core/training";
import { useEffect, useRef, useState } from "react";
import { BackHandler, View } from "react-native";

import { useIsOnline } from "../../../lib/connectivity";
import {
  Banner,
  Button,
  ChipGroup,
  FieldError,
  GroupedList,
  Input,
  SheetHeader,
  SheetScrollView,
  Text,
} from "../../ui";
import { CustomExerciseMuscleRow } from "../CustomExerciseMuscleRow";
import { MuscleChooser } from "../MuscleChooser";
import { chosenExerciseOf } from "./chosenExerciseOf";

import type { CustomExerciseFormProps, DraftMuscle } from "./types";
import type { ExerciseDetail } from "@keylow/api-client";
import type {
  CustomExerciseField,
  CustomExerciseRule,
  Equipment,
  MuscleId,
} from "@keylow/core/training";

/**
 * The New exercise form, as the `session · custom-exercise` board draws it: the name with its count, the
 * equipment as chips (all ten values, where the board draws six), the muscles it works with a role for
 * each, Add a muscle, and Save docked under them. The draft goes through core's `validateCustomExerciseDraft`,
 * and every rule it finds is worded next to its field and keeps Save off. The mechanic is not asked: core
 * derives it from the roles. Save is one `save_exercise` call, and a second press while it is on its way,
 * or after it has finished, does nothing. A failed save keeps the form and shows a banner, and with no
 * connection Save is off with the offline line. Add a muscle takes the form's place with the list of
 * muscles, so the sheet holds one scrollable at a time. What the person typed, and the muscles they chose,
 * are health data: none of it is written to a log or an error report here.
 */
export function CustomExerciseForm({
  destination,
  initialName,
  onBack,
  onSaved,
}: CustomExerciseFormProps) {
  const [name, setName] = useState(initialName);
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [muscles, setMuscles] = useState<DraftMuscle[]>([]);
  const [isChoosingMuscle, setIsChoosingMuscle] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);
  // The two "nothing chosen yet" rules wait until the person has changed something, so a form that has just
  // opened does not announce them. Save is off throughout.
  const [hasChanged, setHasChanged] = useState(false);
  const isOnline = useIsOnline();
  const save = useSaveExercise();
  // Set at the first press and kept once the exercise is saved, so a second press in the same moment, or
  // after the sheet has started to close, saves nothing. A failed save lets go of it, to try again.
  const isLocked = useRef(false);
  // A sheet dragged shut while the save is on its way must not add the exercise afterwards.
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Android's Back button steps back one view, as the header's Back does, and never closes the sheet with
  // the draft in it. This registers after the sheet's own listener, which the system asks last.
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (isChoosingMuscle) {
        setIsChoosingMuscle(false);
      } else {
        onBack();
      }
      return true;
    });
    return () => {
      subscription.remove();
    };
  }, [isChoosingMuscle, onBack]);

  const draft = { name, equipment: equipment ?? "", muscles };
  const checked = validateCustomExerciseDraft(draft);
  const problems = checked.ok ? [] : checked.problems;
  const isWaiting = (rule: CustomExerciseRule) =>
    !hasChanged && (rule === "equipment_invalid" || rule === "muscles_none");
  const sentencesOf = (field: CustomExerciseField) =>
    problems
      .filter((problem) => problem.field === field && !isWaiting(problem.rule))
      .map(describeCustomExerciseIssue);
  const [nameSentence] = sentencesOf("name");
  const saveAction = describeSaveCustomExerciseAction(destination);

  async function submit() {
    if (!checked.ok || !isOnline || isLocked.current) {
      return;
    }
    isLocked.current = true;
    setHasFailed(false);
    let saved: ExerciseDetail;
    try {
      saved = await save.mutateAsync({ draft });
    } catch {
      isLocked.current = false;
      if (isMounted.current) {
        setHasFailed(true);
      }
      return;
    }
    if (isMounted.current) {
      onSaved(chosenExerciseOf(saved));
    }
  }

  function addMuscle(muscle: MuscleId) {
    setHasChanged(true);
    // The first muscle is the one the exercise is for, and each after it assists.
    setMuscles((current) => [
      ...current,
      { muscle_id: muscle, role: current.length === 0 ? "primary" : "secondary" },
    ]);
    setIsChoosingMuscle(false);
  }

  if (isChoosingMuscle) {
    return (
      <MuscleChooser
        chosenMuscles={muscles.map(({ muscle_id }) => muscle_id)}
        onBack={() => {
          setIsChoosingMuscle(false);
        }}
        onChoose={addMuscle}
      />
    );
  }

  return (
    <View className="flex-1">
      <SheetHeader
        leading={{ icon: "ChevronLeft", label: CUSTOM_EXERCISE.backName, onPress: onBack }}
        title={CUSTOM_EXERCISE.title}
        variant="stack"
      />
      <SheetScrollView
        className="flex-1"
        contentContainerClassName="gap-4 pb-4"
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
        <View className="gap-1">
          <Input
            error={nameSentence}
            label={CUSTOM_EXERCISE.nameLabel}
            value={name}
            onChangeText={(next) => {
              setHasChanged(true);
              setName(next);
            }}
          />
          <Text className="self-end tabular-nums" tone="muted" variant="caption">
            {describeExerciseNameLength(name)}
          </Text>
        </View>
        <View className="gap-2">
          <Text aria-hidden tone="secondary" variant="caption">
            {CUSTOM_EXERCISE.equipmentLabel}
          </Text>
          <ChipGroup
            label={CUSTOM_EXERCISE.equipmentLabel}
            layout="wrap"
            options={CUSTOM_EXERCISE.equipmentOptions}
            value={equipment}
            onChange={(next: Equipment) => {
              setHasChanged(true);
              setEquipment(next);
            }}
          />
          {sentencesOf("equipment").map((sentence) => (
            <FieldError key={sentence}>{sentence}</FieldError>
          ))}
        </View>
        <View className="gap-2">
          <View className="flex-row items-baseline justify-between gap-2">
            <Text role="heading" variant="body-strong">
              {CUSTOM_EXERCISE.musclesHeading}
            </Text>
            <Text tone="muted" variant="caption">
              {CUSTOM_EXERCISE.musclesHint}
            </Text>
          </View>
          {muscles.length === 0 ? null : (
            <GroupedList
              hidesTitle
              label={CUSTOM_EXERCISE.musclesHeading}
              title={CUSTOM_EXERCISE.musclesHeading}
            >
              {muscles.map(({ muscle_id, role }) => (
                <CustomExerciseMuscleRow
                  key={muscle_id}
                  muscle={muscle_id}
                  role={role}
                  onChangeRole={(next) => {
                    setMuscles((current) =>
                      current.map((muscle) =>
                        muscle.muscle_id === muscle_id ? { ...muscle, role: next } : muscle,
                      ),
                    );
                  }}
                  onRemove={() => {
                    setHasChanged(true);
                    setMuscles((current) =>
                      current.filter((muscle) => muscle.muscle_id !== muscle_id),
                    );
                  }}
                />
              ))}
            </GroupedList>
          )}
          {sentencesOf("muscles").map((sentence) => (
            <FieldError key={sentence}>{sentence}</FieldError>
          ))}
          <Button
            fullWidth
            icon="Plus"
            variant="secondary"
            onPress={() => {
              setIsChoosingMuscle(true);
            }}
          >
            {CUSTOM_EXERCISE.addMuscleAction}
          </Button>
          <Text tone="muted" variant="caption">
            {CUSTOM_EXERCISE.roleExplanation}
          </Text>
        </View>
      </SheetScrollView>
      <View className="gap-2 pt-3">
        {isOnline ? null : (
          <Banner sentence title={CUSTOM_EXERCISE.saveOffline} variant="offline" />
        )}
        {hasFailed && isOnline ? (
          <Banner sentence title={CUSTOM_EXERCISE.saveFailed} variant="error" />
        ) : null}
        <Button
          accessibilityLabel={saveAction}
          disabled={!checked.ok || !isOnline || save.isPending}
          fullWidth
          loading={save.isPending}
          size="lg"
          onPress={() => {
            void submit();
          }}
        >
          {saveAction}
        </Button>
        <Text className="text-center" tone="muted" variant="caption">
          {CUSTOM_EXERCISE.privacyNote}
        </Text>
      </View>
    </View>
  );
}
