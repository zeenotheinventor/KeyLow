import {
  ROUTINE_EDITOR,
  ROUTINE_WEEKDAY_CHOICES,
  describeDayNameFieldName,
  describeEditorDay,
  describeExerciseFieldNames,
  describeRemoveDay,
  describeRemoveExercise,
  describeWeekdayPickerTitle,
} from "@keylow/core/copy";
import { Plus, Trash2, X } from "lucide-react";

import type { RoutineDayCardProps } from "./types";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ChipGroup } from "@/components/ui/ChipGroup";
import { IconButton } from "@/components/ui/IconButton";
import { TextField } from "@/components/ui/Input";
import { NumericInput } from "@/components/ui/NumericInput";

// The weekday chips are named by their short label, which is unique among the eight choices.
const weekdayOptions = ROUTINE_WEEKDAY_CHOICES.map(({ label }) => ({ value: label, label }));

// A field of an exercise's row is a narrow box with its number centred.
const fieldFrameClasses = "px-2";
const fieldClasses = "text-center";

/**
 * A day of the routine editor, as the `web-routines · editor` board draws it: a card with the day's name
 * and weekday, and a row for each exercise with its sets, reps and RIR as fields. The problems core found
 * are marked under the field they belong to, and an exercise with more than one problem has one line. The
 * rows are the board's exercise rows made editable: the board shows each target as text.
 */
export function RoutineDayCard({
  day,
  marks,
  exerciseCount,
  setCount,
  isFull,
  onRename,
  onChangeWeekday,
  onRemove,
  onAddExercise,
  onChangeField,
  onRemoveExercise,
}: RoutineDayCardProps) {
  const copy = describeEditorDay({
    name: day.name,
    weekday: day.weekday,
    exerciseCount,
    setCount,
    isOpen: true,
  });
  const chosenWeekday = ROUTINE_WEEKDAY_CHOICES.find(({ weekday }) => weekday === day.weekday);

  return (
    <Card asChild padding="none">
      <section
        aria-label={`${day.name}, ${copy.weekdayLabel}`}
        className="flex flex-col gap-3 pb-2 pt-3"
      >
        <div className="flex flex-col gap-3 px-3">
          <div className="flex items-end gap-1">
            <div className="min-w-0 flex-1">
              <TextField
                label={describeDayNameFieldName(day.name)}
                value={day.name}
                error={marks?.name}
                onChange={(event) => {
                  onRename(event.target.value);
                }}
              />
            </div>
            <IconButton icon={Trash2} label={describeRemoveDay(day.name)} onClick={onRemove} />
          </div>
          <div className="flex flex-col gap-1">
            <ChipGroup
              label={describeWeekdayPickerTitle(day.name)}
              options={weekdayOptions}
              value={chosenWeekday?.label ?? ""}
              onChange={(label) => {
                const choice = ROUTINE_WEEKDAY_CHOICES.find(
                  (candidate) => candidate.label === label,
                );
                if (choice !== undefined) {
                  onChangeWeekday(choice.weekday);
                }
              }}
            />
            {marks?.header === undefined ? null : (
              <p
                role="alert"
                tabIndex={-1}
                data-problem
                className="text-caption text-danger outline-none"
              >
                {marks.header}
              </p>
            )}
          </div>
          <p className="text-caption tabular-nums text-text-secondary">{copy.meta}</p>
        </div>
        <ul className="flex flex-col">
          {day.exercises.map((exercise, position) => {
            const names = describeExerciseFieldNames(exercise.name);
            const exerciseMarks = marks?.exercises[position];

            return (
              <li
                key={exercise.key}
                className="flex flex-col gap-2 border-t border-border px-3 py-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-body">{exercise.name}</span>
                  <IconButton
                    icon={X}
                    label={describeRemoveExercise(exercise.name)}
                    onClick={() => {
                      onRemoveExercise(exercise.key);
                    }}
                  />
                </div>
                <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_minmax(0,1fr)] gap-2">
                  <div className="flex flex-col gap-1">
                    <span aria-hidden className="text-center text-caption text-text-muted">
                      {ROUTINE_EDITOR.setsHeading}
                    </span>
                    <NumericInput
                      label={names.sets}
                      hideLabel
                      inputMode="numeric"
                      value={exercise.setsText}
                      invalid={exerciseMarks?.sets !== undefined}
                      frameClassName={fieldFrameClasses}
                      className={fieldClasses}
                      onChange={(event) => {
                        onChangeField(exercise.key, "sets", event.target.value);
                      }}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span aria-hidden className="text-center text-caption text-text-muted">
                      {ROUTINE_EDITOR.repsHeading}
                    </span>
                    <NumericInput
                      label={names.reps}
                      hideLabel
                      inputMode="numeric"
                      value={exercise.repsText}
                      invalid={exerciseMarks?.reps !== undefined}
                      frameClassName={fieldFrameClasses}
                      className={fieldClasses}
                      onChange={(event) => {
                        onChangeField(exercise.key, "reps", event.target.value);
                      }}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span aria-hidden className="text-center text-caption text-text-muted">
                      {ROUTINE_EDITOR.rirHeading}
                    </span>
                    <NumericInput
                      label={names.rir}
                      hideLabel
                      inputMode="numeric"
                      value={exercise.rirText}
                      invalid={exerciseMarks?.rir !== undefined}
                      frameClassName={fieldFrameClasses}
                      className={fieldClasses}
                      onChange={(event) => {
                        onChangeField(exercise.key, "rir", event.target.value);
                      }}
                    />
                  </div>
                </div>
                {exerciseMarks === undefined ? null : (
                  <p role="alert" className="text-caption text-danger">
                    {exerciseMarks.line}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mx-2 self-start"
          disabled={isFull}
          aria-label={`${ROUTINE_EDITOR.addExerciseAction} to ${day.name}`}
          onClick={onAddExercise}
        >
          <Plus aria-hidden />
          {ROUTINE_EDITOR.addExerciseAction}
        </Button>
      </section>
    </Card>
  );
}
