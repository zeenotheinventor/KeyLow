"use client";

import { useArchiveRoutineWithUndo, useSaveRoutine } from "@keylow/api-client";
import {
  ROUTINE_DAY_CONTROLS,
  ARCHIVE_ACTIVE_REFUSAL,
  ROUTINE_ARCHIVE_UNSAVED,
  ROUTINE_DISCARD,
  ROUTINE_EDITOR,
  ROUTINE_SAVE_FAILED,
  ROUTINES_OFFLINE,
  describeDaysSummary,
  describeMovedPosition,
  describeProblemsBanner,
} from "@keylow/core/copy";
import {
  MAX_DAYS_PER_ROUTINE,
  MAX_EXERCISES_PER_ROUTINE_DAY,
  draftOfState,
  routineDraftReducer,
  routineMarksOf,
  startingStateOf,
  summaryOf,
} from "@keylow/core/training";
import { onlineManager } from "@tanstack/react-query";
import { CircleAlert, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useReducer, useRef, useState } from "react";

import { AddExerciseDialog } from "../AddExerciseDialog";
import { CustomExerciseDialog } from "../CustomExerciseDialog";
import { RoutineDayCard } from "../RoutineDayCard";
import { useRoutineNotices } from "../useRoutineNotices";

import type { RoutineEditorProps } from "./types";
import type { KeyboardUndoOptions } from "@/lib/keyboardUndo";
import type { MoveDirection, RoutineDraft } from "@keylow/core/training";

import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { TextField } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { firstControlIn, useKeyboardUndo } from "@/lib/keyboardUndo";
import { trainRoutinesArchivedPath, trainRoutinesPath } from "@/lib/trainRoutes";
import { useIsOnline } from "@/lib/useIsOnline";

const emptyDraft: RoutineDraft = { name: "", days: [] };

/** What the last move asks of the page: the words to announce, and the move button to put focus on. */
type LastMove = { request: number; announcement: string; focusButton: string };

/**
 * The routine editor, as the `web-routines · editor` board draws it: the title with Cancel and Save, the
 * routine's name, and a card for each day. The draft is a reducer whose rules, checks and sentences are
 * core's. Save checks the draft: with problems it marks each one beside its field, counts them in the
 * banner and moves focus to the first (the marks then follow the draft as it is fixed), and with none it
 * saves, which needs a connection. A save that works returns to the routines list, and one that fails keeps
 * the draft and says so in a toast. Cancel and the browser's own prompt ask first when there are changes,
 * but never after a save.
 */
export function RoutineEditor({
  initialDraft,
  exerciseNames,
  routineId,
  isActive = false,
  isArchived = false,
}: RoutineEditorProps) {
  const router = useRouter();
  const toast = useToast();
  const saveRoutine = useSaveRoutine();
  const isOnline = useIsOnline();
  const keyboardUndo = useKeyboardUndo();
  // Set when Archive routine is pressed, and asked for when the archived toast is shown, by which time the page is another.
  const archivedToastFocus = useRef<() => KeyboardUndoOptions>(() => ({}));
  const archiveRoutine = useArchiveRoutineWithUndo(
    useRoutineNotices(() => archivedToastFocus.current()),
  );
  const [isArchiving, setIsArchiving] = useState(false);
  const archiveReasonId = useId();
  const [startingState] = useState(() =>
    startingStateOf(initialDraft ?? emptyDraft, exerciseNames),
  );
  const [state, dispatch] = useReducer(routineDraftReducer, startingState);
  const [addingToDayKey, setAddingToDayKey] = useState<number | null>(null);
  // The words the New exercise form starts with, while it is open over the search.
  const [creatingName, setCreatingName] = useState<string | null>(null);
  const [isDiscardOpen, setIsDiscardOpen] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  // Marks show from the first press of Save with problems, and follow the draft after.
  const [areMarksShown, setAreMarksShown] = useState(false);
  const [focusRequest, setFocusRequest] = useState(0);
  const [lastMove, setLastMove] = useState<LastMove | null>(null);
  const form = useRef<HTMLFormElement>(null);

  const draft = draftOfState(state);
  const isChanged = JSON.stringify(draft) !== JSON.stringify(draftOfState(startingState));
  const summary = summaryOf(state);
  const marks = areMarksShown ? routineMarksOf(draft) : undefined;
  // Why Archive routine is off, if it is. The active routine and unsaved changes cannot be put right here, so they come before the connection.
  const archiveReason = isActive
    ? ARCHIVE_ACTIVE_REFUSAL
    : isChanged
      ? ROUTINE_ARCHIVE_UNSAVED
      : isOnline
        ? null
        : ROUTINES_OFFLINE.archive;
  const isBusy = saveRoutine.isPending || isLeaving || isArchiving;

  // The browser's own prompt covers closing the tab. A move inside the app is asked by the dialog.
  const isAskingBeforeLeaving = isChanged && !isLeaving;
  useEffect(() => {
    if (!isAskingBeforeLeaving) {
      return;
    }
    const askBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", askBeforeLeaving);

    return () => {
      window.removeEventListener("beforeunload", askBeforeLeaving);
    };
  }, [isAskingBeforeLeaving]);

  // Focus waits for the render that marked the problems, because the field is only flagged then.
  useEffect(() => {
    if (focusRequest > 0) {
      form.current?.querySelector<HTMLElement>('[aria-invalid="true"], [data-problem]')?.focus();
    }
  }, [focusRequest]);

  // Moving an item can take the browser's focus off its button: a button that is dimmed cannot hold it, and a
  // node the browser moves can lose it. So focus goes back after the render, to the button that moved the
  // item, or to its partner when the item is now at the end that button points to.
  useEffect(() => {
    if (lastMove !== null) {
      form.current
        ?.querySelector<HTMLElement>(`[data-move-button="${lastMove.focusButton}"]`)
        ?.focus();
    }
  }, [lastMove]);

  useEffect(() => {
    // The editor is replaced, so Back from the list does not return to a form that would save again.
    if (isLeaving) {
      router.replace(trainRoutinesPath());
    }
  }, [isLeaving, router]);

  async function save() {
    // A save that worked leaves for the list, and until the route changes Save must not send a second one.
    if (saveRoutine.isPending || isLeaving) {
      return;
    }
    if (routineMarksOf(draft).count > 0) {
      setAreMarksShown(true);
      setFocusRequest((request) => request + 1);
      return;
    }
    // Nothing is queued, so with no connection the press goes straight to the failure.
    if (!onlineManager.isOnline()) {
      toast.show({ message: ROUTINE_SAVE_FAILED, tone: "danger", icon: CircleAlert });
      return;
    }
    try {
      await saveRoutine.mutateAsync({ id: routineId ?? null, draft });
    } catch {
      toast.show({ message: ROUTINE_SAVE_FAILED, tone: "danger", icon: CircleAlert });
      return;
    }
    setIsLeaving(true);
  }

  /** Announces where the item went and asks for focus on its move button once the render has drawn it there. */
  function announceMove(
    scope: string,
    itemName: string,
    position: number,
    count: number,
    by: MoveDirection,
  ) {
    const newPosition = by === "up" ? position - 1 : position + 1;
    const isAtTheEnd = by === "up" ? newPosition === 0 : newPosition === count - 1;
    const focusDirection = isAtTheEnd ? (by === "up" ? "down" : "up") : by;
    setLastMove((previous) => ({
      request: (previous?.request ?? 0) + 1,
      announcement: describeMovedPosition(itemName, newPosition + 1, count),
      focusButton: `${scope}:${focusDirection}`,
    }));
  }

  async function archive() {
    if (routineId === undefined || archiveReason !== null || isBusy) {
      return;
    }
    // The press is read now, while focus is still on the button. The editor is gone by the time the toast shows.
    archivedToastFocus.current = keyboardUndo.afterPressingButton({
      returnTo: () =>
        document.querySelector<HTMLElement>(`a[href="${trainRoutinesArchivedPath()}"]`) ??
        firstControlIn(document.querySelector("main")),
    });
    setIsArchiving(true);
    const isArchived = await archiveRoutine(routineId);
    setIsArchiving(false);
    if (isArchived) {
      // The editor is replaced, so Back from the list does not reopen the archived routine's editor.
      setIsLeaving(true);
    }
  }

  function cancel() {
    if (isChanged) {
      setIsDiscardOpen(true);
    } else {
      router.replace(trainRoutinesPath());
    }
  }

  const addingToDay = state.days.find((day) => day.key === addingToDayKey);

  return (
    <>
      <form
        ref={form}
        noValidate
        className="mx-auto flex w-full max-w-[1180px] flex-col gap-3 xl:gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <h1 className="shrink-0 text-h1">
            {initialDraft === undefined ? ROUTINE_EDITOR.newTitle : ROUTINE_EDITOR.title}
          </h1>
          <div className="ml-auto flex flex-wrap justify-end gap-2">
            {routineId === undefined || isArchived ? null : (
              <Button
                type="button"
                variant="secondary"
                loading={isArchiving}
                disabled={archiveReason !== null || isBusy}
                aria-describedby={archiveReason === null ? undefined : archiveReasonId}
                onClick={() => {
                  void archive();
                }}
              >
                {ROUTINE_EDITOR.archiveAction}
              </Button>
            )}
            <Button type="button" variant="secondary" onClick={cancel}>
              {ROUTINE_EDITOR.cancelAction}
            </Button>
            <Button
              type="submit"
              loading={saveRoutine.isPending || isLeaving}
              disabled={isArchiving}
            >
              {ROUTINE_EDITOR.saveAction}
            </Button>
          </div>
        </div>
        {archiveReason === null || routineId === undefined || isArchived ? null : (
          <p id={archiveReasonId} className="text-caption text-text-muted sm:text-right">
            {archiveReason}
          </p>
        )}
        {marks === undefined || marks.count === 0 ? null : (
          <Banner tone="error">{describeProblemsBanner(marks.count)}</Banner>
        )}
        <div className="max-w-[420px]">
          <TextField
            label={ROUTINE_EDITOR.nameLabel}
            value={state.name}
            error={marks?.name}
            onChange={(event) => {
              dispatch({ type: "renameRoutine", name: event.target.value });
            }}
          />
        </div>
        <section aria-labelledby="routine-editor-days" className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="routine-editor-days" className="text-body-strong">
              {ROUTINE_EDITOR.daysHeading}
            </h2>
            <span className="text-caption tabular-nums text-text-muted">
              {describeDaysSummary({
                dayCount: summary.dayCount,
                setsPerWeek: summary.setsPerWeek,
              })}
            </span>
          </div>
          {marks?.daysMessage === undefined ? null : (
            <p role="alert" className="text-caption text-danger">
              {marks.daysMessage}
            </p>
          )}
          <div className="grid grid-cols-1 gap-3 min-[700px]:grid-cols-2 xl:grid-cols-4">
            {state.days.map((day, position) => (
              <RoutineDayCard
                key={day.key}
                day={day}
                marks={marks?.days[position]}
                exerciseCount={summary.days[position]?.exerciseCount ?? 0}
                setCount={summary.days[position]?.setCount ?? 0}
                isFull={day.exercises.length >= MAX_EXERCISES_PER_ROUTINE_DAY}
                isFirst={position === 0}
                isLast={position === state.days.length - 1}
                onRename={(name) => {
                  dispatch({ type: "renameDay", key: day.key, name });
                }}
                onChangeWeekday={(weekday) => {
                  dispatch({ type: "setWeekday", key: day.key, weekday });
                }}
                onMove={(by) => {
                  dispatch({ type: "moveDay", key: day.key, by });
                  announceMove(`day:${day.key}`, day.name, position, state.days.length, by);
                }}
                onRemove={() => {
                  dispatch({ type: "removeDay", key: day.key });
                }}
                onAddExercise={() => {
                  setAddingToDayKey(day.key);
                }}
                onChangeField={(key, field, text) => {
                  dispatch({ type: "editExercise", dayKey: day.key, key, field, text });
                }}
                onMoveExercise={(exercise, position, by) => {
                  dispatch({ type: "moveExercise", dayKey: day.key, key: exercise.key, by });
                  announceMove(
                    `exercise:${day.key}:${exercise.key}`,
                    exercise.name,
                    position,
                    day.exercises.length,
                    by,
                  );
                }}
                onRemoveExercise={(key) => {
                  dispatch({ type: "removeExercise", dayKey: day.key, key });
                }}
              />
            ))}
          </div>
          <Button
            type="button"
            variant="secondary"
            className="self-start"
            disabled={state.days.length >= MAX_DAYS_PER_ROUTINE}
            onClick={() => {
              dispatch({ type: "addDay" });
            }}
          >
            <Plus aria-hidden />
            {ROUTINE_DAY_CONTROLS.addDayAction}
          </Button>
        </section>
        {/* Each announcement is a new node, so the same words twice are heard twice. */}
        <p role="status" aria-live="polite" className="sr-only">
          {lastMove === null ? null : <span key={lastMove.request}>{lastMove.announcement}</span>}
        </p>
      </form>
      {/* The dialogs sit beside the form: a dialog renders in place and its buttons are untyped, so inside the form they would submit it. */}
      <AddExerciseDialog
        mode="routine"
        open={addingToDay !== undefined}
        onCreate={setCreatingName}
        onChoose={({ id, name }) => {
          if (addingToDay !== undefined) {
            dispatch({ type: "addExercise", dayKey: addingToDay.key, exercise: { id, name } });
          }
        }}
        onClose={() => {
          setAddingToDayKey(null);
        }}
      />
      {creatingName === null ? null : (
        <CustomExerciseDialog
          destination={{ kind: "routine" }}
          initialName={creatingName}
          onClose={() => {
            setCreatingName(null);
          }}
          onSaved={({ id, name }) => {
            if (addingToDay !== undefined) {
              dispatch({ type: "addExercise", dayKey: addingToDay.key, exercise: { id, name } });
            }
            setCreatingName(null);
            setAddingToDayKey(null);
          }}
        />
      )}
      <Dialog
        open={isDiscardOpen}
        title={ROUTINE_DISCARD.title}
        className="min-[700px]:w-[440px]"
        onClose={() => {
          setIsDiscardOpen(false);
        }}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setIsDiscardOpen(false);
              }}
            >
              {ROUTINE_DISCARD.keepEditingAction}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setIsLeaving(true);
              }}
            >
              {ROUTINE_DISCARD.discardAction}
            </Button>
          </>
        }
      >
        <p className="text-body text-text-secondary">{ROUTINE_DISCARD.body}</p>
      </Dialog>
    </>
  );
}
