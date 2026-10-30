import { usePendingSets } from "@keylow/api-client";
import {
  ADD_EXERCISE,
  FINISH_SCREEN,
  SESSION_ACTIVE,
  TRAIN_ERROR,
  TRAIN_LOADING_NAME,
} from "@keylow/core/copy";
import { vars } from "nativewind";
import { useState } from "react";
import { Keyboard, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AddExerciseSheet } from "../AddExerciseSheet";
import { ExerciseMusclesSheet } from "../ExerciseMusclesSheet";
import { FinishScreen } from "../FinishScreen";
import { SessionClock } from "../SessionClock";
import { SessionExerciseCard } from "../SessionExerciseCard";
import { SessionHeaderActions } from "../SessionHeaderActions";
import { SessionMenu } from "../SessionMenu";
import { SetEntrySheet } from "../SetEntrySheet";
import { SetTypeSheet } from "../SetTypeSheet";
import { Button, ErrorState, SheetHeader, Text } from "../ui";
import { useChangeSetType } from "./useChangeSetType";
import { useSessionScreen } from "./useSessionScreen";
import { useSetLogging } from "./useSetLogging";

import type { ExerciseMusclesSheetExercise } from "../ExerciseMusclesSheet";
import type { FinishDetails } from "../FinishScreen";
import type { SessionScreenProps, SetTypeOpening } from "./types";
import type { SetEntryOpening } from "../SetEntrySheet";
import type { SetType } from "@keylow/core/training";

// The board's padding under the Add exercise button, which a phone with a taller inset outgrows.
const MINIMUM_DOCK_BOTTOM_PADDING = 34;

/**
 * The active session, a full screen over the tabs, as the `session · active` and `session · from-routine`
 * boards draw it: the control that hides it while the session keeps running, the session's name with its
 * clock and sets logged, Finish and More at the right of the header, and a card for each exercise with its
 * set rows, with Add exercise docked under them. An exercise added with no set yet is a card too, held by
 * `useAddedExercises`. The cells of a set still to do open the set entry sheet, which logs the set. The check
 * logs a set from the numbers its row shows (or opens the same sheet when it has none) or removes a logged
 * one, and Add set adds a row. The entry sheet has a Set type control, and its set number opens the set types
 * sheet over it, so the type is chosen before the set is logged. The mark of a logged set opens the same
 * sheet, which changes the type of that set.
 * Editing a logged set's numbers has a ticket of its own. Finish opens the finish screen
 * in place of the session, and Keep logging brings the session back. Finish is off while no set is logged,
 * with a line that says what to do (no board draws it). While the session is read the screen shows a
 * loading status, a failed read shows Try again, and with no open session only the control that hides it is
 * left (no board draws these).
 * The header's More control, which no board draws, holds Discard session and is drawn only when
 * `onDiscarded` is given. The body icon button of a card, and the exercise's name, open the Muscles it works
 * sheet for that exercise.
 */
export function SessionScreen({ onHide, onDiscarded, onFinished }: SessionScreenProps) {
  const pendingSets = usePendingSets();
  const view = useSessionScreen(pendingSets.sets);
  const logging = useSetLogging(view, pendingSets);
  // What the set entry opens with is kept while the sheet closes, so it does not change under its exit. The
  // type the set will be logged with starts as the slot's own and is held here, so the entry's control and the
  // types sheet its set number opens change the same value, and a change does not count up `openingId`.
  const [setEntry, setSetEntry] = useState<{
    entry: SetEntryOpening;
    setType: SetType;
    isOpen: boolean;
    openingId: number;
  } | null>(null);
  const [isEntryTypeSheetOpen, setIsEntryTypeSheetOpen] = useState(false);
  // Each change names the opening it was made for, so a call that arrives late never restores an older one.
  const updateOpening = (
    openingId: number,
    change: Partial<{ setType: SetType; isOpen: boolean }>,
  ) => {
    setSetEntry((current) =>
      current?.openingId === openingId ? { ...current, ...change } : current,
    );
  };
  // The set the types sheet is opened for is kept while the sheet closes, so it does not change under its exit.
  const [setTypeSheet, setSetTypeSheet] = useState<{
    opening: SetTypeOpening;
    isOpen: boolean;
  } | null>(null);
  const { changeSetType, isChangingType } = useChangeSetType();
  // The exercise whose muscles the sheet shows. The sheet keeps the last one on show while it closes.
  const [musclesFor, setMusclesFor] = useState<ExerciseMusclesSheetExercise | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [finishing, setFinishing] = useState<FinishDetails | null>(null);
  // Held here, beside `finishing`, so Keep logging does not drop a note of up to 1,000 characters.
  const [note, setNote] = useState("");
  const insets = useSafeAreaInsets();
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  // The finish screen keeps what it was opened with, so it stays up while the saved session stops being the one in progress.
  if (finishing !== null) {
    return (
      <FinishScreen
        details={finishing}
        note={note}
        onChangeNote={setNote}
        onKeepLogging={() => {
          setFinishing(null);
        }}
        onSaved={onFinished}
      />
    );
  }

  const hasNothingLogged =
    view.status === "ready" && view.finish.workingSets + view.finish.warmups === 0;
  // A set whose insert has not landed is counted on the finish screen, and Save would end the session before it is stored.
  const hasSetBeingSaved = pendingSets.sets.some(({ savedId }) => savedId === null);

  return (
    <View className="flex-1 bg-background">
      {/* The inset is a runtime value no class can name, so it goes through a variable, as the tab header's does. */}
      <View className="pt-[var(--inset-top)]" style={vars({ "--inset-top": insets.top })}>
        {view.status === "ready" ? (
          <SessionClock
            {...view.header}
            onHide={onHide}
            trailingSlot={
              <SessionHeaderActions
                isFinishDisabled={hasNothingLogged || hasSetBeingSaved}
                onFinish={() => {
                  setFinishing(view.finish);
                }}
                onMore={
                  onDiscarded === undefined
                    ? undefined
                    : () => {
                        setIsMenuOpen(true);
                      }
                }
              />
            }
          />
        ) : (
          <SheetHeader
            isTitleHeading={false}
            leading={{
              icon: "ChevronDown",
              label: SESSION_ACTIVE.hideSessionName,
              onPress: onHide,
            }}
            title=""
          />
        )}
      </View>
      {hasNothingLogged ? (
        <Text className="px-4 pb-1 text-center" tone="secondary" variant="caption">
          {FINISH_SCREEN.nothingLoggedHint}
        </Text>
      ) : null}
      {view.status === "loading" ? (
        <View accessible aria-label={TRAIN_LOADING_NAME} className="flex-1" role="status" />
      ) : null}
      {view.status === "error" ? (
        <ErrorState
          body={TRAIN_ERROR.body}
          retry={{ label: TRAIN_ERROR.action, onPress: view.retry }}
          title={TRAIN_ERROR.title}
        />
      ) : null}
      {view.status === "ready" ? (
        <ScrollView className="flex-1" contentContainerClassName="gap-3 px-4 pb-4 pt-1">
          {view.exercises.map(({ name, target, plan, muscles, exercise }) => (
            <SessionExerciseCard
              exercise={exercise}
              key={exercise.exerciseId}
              isChangingType={isChangingType}
              logging={logging}
              name={name}
              plan={plan}
              sessionId={view.sessionId}
              sessionSets={view.sets}
              target={target}
              unit={view.unit}
              onEditSet={(entry) => {
                setSetEntry((current) => ({
                  entry,
                  setType: entry.setType,
                  isOpen: true,
                  openingId: (current?.openingId ?? 0) + 1,
                }));
              }}
              onEditSetType={(opening) => {
                setSetTypeSheet({ opening, isOpen: true });
              }}
              onShowMuscles={() => {
                setMusclesFor({ id: exercise.exerciseId, name, muscles });
              }}
            />
          ))}
        </ScrollView>
      ) : null}
      {view.status === "ready" ? (
        // The dock holds Add exercise under the cards. The board leaves 34 under it, a home indicator's height.
        <View
          className="border-t border-border bg-surface px-4 pb-[var(--dock-bottom)] pt-3"
          style={vars({ "--dock-bottom": Math.max(insets.bottom, MINIMUM_DOCK_BOTTOM_PADDING) })}
        >
          <Button
            fullWidth
            icon="Plus"
            variant="secondary"
            onPress={() => {
              setIsPickerOpen(true);
            }}
          >
            {ADD_EXERCISE.title}
          </Button>
        </View>
      ) : null}
      {view.status === "ready" && setEntry !== null ? (
        <SetEntrySheet
          entry={setEntry.entry}
          open={setEntry.isOpen}
          openingId={setEntry.openingId}
          sessionId={view.sessionId}
          setType={setEntry.setType}
          unit={view.unit}
          onChangeSetType={(setType) => {
            updateOpening(setEntry.openingId, { setType });
          }}
          onClose={() => {
            setIsEntryTypeSheetOpen(false);
            updateOpening(setEntry.openingId, { isOpen: false });
          }}
          onPressSetNumber={() => {
            // The types sheet opens over the entry sheet, so the keyboard must not be left in front of it.
            Keyboard.dismiss();
            setIsEntryTypeSheetOpen(true);
          }}
        />
      ) : null}
      {view.status === "ready" && setEntry !== null ? (
        // Over the entry sheet, which stays under it with what was typed. Choosing a type changes the entry's own.
        <SetTypeSheet
          exerciseName={setEntry.entry.exerciseName}
          open={isEntryTypeSheetOpen}
          setNumber={setEntry.entry.setNumber}
          setType={setEntry.setType}
          onChoose={(setType) => {
            setIsEntryTypeSheetOpen(false);
            updateOpening(setEntry.openingId, { setType });
          }}
          onClose={() => {
            setIsEntryTypeSheetOpen(false);
          }}
        />
      ) : null}
      {view.status === "ready" && setTypeSheet !== null ? (
        <SetTypeSheet
          exerciseName={setTypeSheet.opening.exerciseName}
          open={setTypeSheet.isOpen}
          setNumber={setTypeSheet.opening.setNumber}
          setType={setTypeSheet.opening.setType}
          onChoose={(setType) => {
            setSetTypeSheet({ ...setTypeSheet, isOpen: false });
            if (setType !== setTypeSheet.opening.setType) {
              void changeSetType({ setId: setTypeSheet.opening.setId, setType });
            }
          }}
          onClose={() => {
            setSetTypeSheet({ ...setTypeSheet, isOpen: false });
          }}
        />
      ) : null}
      {view.status === "ready" && onDiscarded !== undefined ? (
        <SessionMenu
          dayName={view.header.dayName}
          open={isMenuOpen}
          sessionId={view.sessionId}
          sets={view.sets}
          onClose={() => {
            setIsMenuOpen(false);
          }}
          onDiscarded={onDiscarded}
        />
      ) : null}
      {view.status === "ready" ? (
        <ExerciseMusclesSheet
          exercise={musclesFor}
          onClose={() => {
            setMusclesFor(null);
          }}
        />
      ) : null}
      {view.status === "ready" ? (
        <AddExerciseSheet
          mode="session"
          open={isPickerOpen}
          onAddToSession={view.addExercise}
          onClose={() => {
            setIsPickerOpen(false);
          }}
        />
      ) : null}
    </View>
  );
}
