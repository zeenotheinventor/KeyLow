"use client";

import { exerciseHitOf, useSaveExercise } from "@keylow/api-client";
import {
  CUSTOM_EXERCISE,
  describeCustomExerciseIssue,
  describeExerciseNameLength,
  describeSaveCustomExerciseAction,
} from "@keylow/core/copy";
import { validateCustomExerciseDraft } from "@keylow/core/training";
import { Plus } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { CustomExerciseMuscleRow } from "./CustomExerciseMuscleRow";
import { MuscleChooserDialog } from "./MuscleChooserDialog";

import type { CustomExerciseDialogProps, DraftMuscle } from "./types";
import type { ExerciseDetail } from "@keylow/api-client";
import type {
  CustomExerciseField,
  CustomExerciseRule,
  Equipment,
  MuscleId,
} from "@keylow/core/training";

import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ChipGroup } from "@/components/ui/ChipGroup";
import { Dialog } from "@/components/ui/Dialog";
import { TextField } from "@/components/ui/Input";
import { useIsOnline } from "@/lib/useIsOnline";

// The same size as the add exercise dialog under it, so the form covers it. Below 700 px a dialog is the
// whole screen already.
const PANEL_CLASSES = "min-[700px]:h-[min(720px,calc(100%-theme(spacing.12)))]";

/**
 * The New exercise dialog, as the `session · custom-exercise` board draws it in a web `Dialog`: the name with
 * its count, the equipment as chips (all ten values, where the board draws six), the muscles it works with a
 * role for each, Add a muscle, and Save docked under them. It opens over the add exercise dialog, and Add a
 * muscle opens the muscle list over it, so Escape and Close step back one level and never close the whole
 * stack: the dialog stack answers Escape for the topmost one only. The owner mounts it for one go and
 * unmounts it when it steps back, which drops the draft, as the phone's form does. The draft goes through
 * core's `validateCustomExerciseDraft`, and every rule it finds is worded next to its field and keeps Save
 * off. The mechanic is not asked: core derives it from the roles. Save is one `save_exercise` call. A failed
 * save keeps the form and shows a banner, and with no connection Save is off with the offline line. What the
 * person typed, and the muscles they chose, are health data: none of it is written to a log or an error
 * report here.
 */
export function CustomExerciseDialog({
  destination,
  initialName,
  onClose,
  onSaved,
}: CustomExerciseDialogProps) {
  const [name, setName] = useState(initialName);
  // Empty until a chip is pressed, which is not one of the ten values, so the equipment rule applies.
  const [equipment, setEquipment] = useState<Equipment | "">("");
  const [muscles, setMuscles] = useState<DraftMuscle[]>([]);
  const [isChoosingMuscle, setIsChoosingMuscle] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);
  // The two "nothing chosen yet" rules wait until the person has changed something, so a form that has just
  // opened does not announce them. Save is off throughout.
  const [hasChanged, setHasChanged] = useState(false);
  const isOnline = useIsOnline();
  const save = useSaveExercise();
  const nameCountId = useId();
  // Set at the first press and kept once the exercise is saved, so a second press in the same moment saves
  // nothing. A failed save lets go of it, to try again.
  const isLocked = useRef(false);
  // A dialog stepped back from while the save is on its way must not add the exercise afterwards.
  const isMounted = useRef(true);

  const failure = useRef<HTMLDivElement>(null);

  // Save is off while the save is on its way, which drops focus to the dialog panel. The banner takes it, so
  // a keyboard user is told, as the finish dialog does.
  useEffect(() => {
    if (hasFailed) {
      failure.current?.focus();
    }
  }, [hasFailed]);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const draft = { name, equipment, muscles };
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
      onSaved(exerciseHitOf(saved));
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

  return (
    <>
      <Dialog
        open
        title={CUSTOM_EXERCISE.title}
        onClose={onClose}
        className={PANEL_CLASSES}
        footer={
          <div className="flex w-full flex-col gap-2">
            {isOnline ? null : <Banner tone="info">{CUSTOM_EXERCISE.saveOffline}</Banner>}
            {hasFailed && isOnline ? (
              <div ref={failure} tabIndex={-1} className="rounded-medium outline-none">
                <Banner tone="error">{CUSTOM_EXERCISE.saveFailed}</Banner>
              </div>
            ) : null}
            <Button
              size="lg"
              className="w-full"
              aria-label={saveAction}
              disabled={!checked.ok || !isOnline}
              loading={save.isPending}
              onClick={() => {
                void submit();
              }}
            >
              {saveAction}
            </Button>
            <p className="text-center text-caption text-text-muted">
              {CUSTOM_EXERCISE.privacyNote}
            </p>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <TextField
              // The dialog leaves focus alone when a child inside it has taken focus, so the name is first, not Close.
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
              label={CUSTOM_EXERCISE.nameLabel}
              value={name}
              error={nameSentence}
              describedBy={nameCountId}
              onChange={(event) => {
                setHasChanged(true);
                setName(event.target.value);
              }}
            />
            <span id={nameCountId} className="self-end text-caption tabular-nums text-text-muted">
              {describeExerciseNameLength(name)}
            </span>
          </div>
          <div className="flex flex-col gap-2">
            <span aria-hidden className="text-caption text-text-secondary">
              {CUSTOM_EXERCISE.equipmentLabel}
            </span>
            <ChipGroup<Equipment | "">
              label={CUSTOM_EXERCISE.equipmentLabel}
              options={CUSTOM_EXERCISE.equipmentOptions}
              value={equipment}
              onChange={(next) => {
                setHasChanged(true);
                setEquipment(next);
              }}
            />
            {sentencesOf("equipment").map((sentence) => (
              <p key={sentence} role="alert" className="text-caption text-danger">
                {sentence}
              </p>
            ))}
          </div>
          <section className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-body-strong">{CUSTOM_EXERCISE.musclesHeading}</h3>
              <span className="text-caption text-text-muted">{CUSTOM_EXERCISE.musclesHint}</span>
            </div>
            {muscles.length === 0 ? null : (
              <Card asChild padding="none">
                <ul aria-label={CUSTOM_EXERCISE.musclesHeading} className="divide-y divide-border">
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
                </ul>
              </Card>
            )}
            {sentencesOf("muscles").map((sentence) => (
              <p key={sentence} role="alert" className="text-caption text-danger">
                {sentence}
              </p>
            ))}
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => {
                setIsChoosingMuscle(true);
              }}
            >
              <Plus aria-hidden />
              {CUSTOM_EXERCISE.addMuscleAction}
            </Button>
            <p className="text-caption text-text-muted">{CUSTOM_EXERCISE.roleExplanation}</p>
          </section>
        </div>
      </Dialog>
      {isChoosingMuscle ? (
        <MuscleChooserDialog
          chosenMuscles={muscles.map(({ muscle_id }) => muscle_id)}
          onChoose={addMuscle}
          onClose={() => {
            setIsChoosingMuscle(false);
          }}
        />
      ) : null}
    </>
  );
}
