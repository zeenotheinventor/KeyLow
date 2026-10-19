import {
  DIARY_MORE_LABEL,
  SESSION_ACTIVE,
  TRAIN_ERROR,
  TRAIN_LOADING_NAME,
} from "@keylow/core/copy";
import { vars } from "nativewind";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SessionClock } from "../SessionClock";
import { SessionExerciseCard } from "../SessionExerciseCard";
import { SessionMenu } from "../SessionMenu";
import { SetEntrySheet } from "../SetEntrySheet";
import { ErrorState, IconButton, SheetHeader } from "../ui";
import { useSessionScreen } from "./useSessionScreen";

import type { SessionScreenProps } from "./types";
import type { SetEntryOpening } from "../SetEntrySheet";

/**
 * The active session, a full screen over the tabs, as the `session · active` and `session · from-routine`
 * boards draw it: the control that hides it while the session keeps running, the session's name with its
 * clock and sets logged, and a card for each exercise with its set rows. The cells of a set still to do open
 * the set entry sheet, which logs the set. The check, editing a logged set, Add set, Add exercise and Finish
 * have tickets of their own. While the session is read the screen shows a loading status, a failed read shows
 * Try again, and with no open session only the control that hides it is left (no board draws these).
 * The header's More control, which no board draws, holds Discard session and is drawn only when
 * `onDiscarded` is given.
 */
export function SessionScreen({ onHide, onDiscarded }: SessionScreenProps) {
  const view = useSessionScreen();
  // What the set entry opens with is kept while the sheet closes, so it does not change under its exit.
  const [setEntry, setSetEntry] = useState<{
    entry: SetEntryOpening;
    isOpen: boolean;
    openingId: number;
  } | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-background">
      {/* The inset is a runtime value no class can name, so it goes through a variable, as the tab header's does. */}
      <View className="pt-[var(--inset-top)]" style={vars({ "--inset-top": insets.top })}>
        {view.status === "ready" ? (
          <SessionClock
            {...view.header}
            onHide={onHide}
            trailingSlot={
              onDiscarded === undefined ? undefined : (
                <IconButton
                  icon="Ellipsis"
                  label={DIARY_MORE_LABEL}
                  onPress={() => {
                    setIsMenuOpen(true);
                  }}
                />
              )
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
          {view.exercises.map(({ name, target, plan, exercise }) => (
            <SessionExerciseCard
              exercise={exercise}
              key={exercise.exerciseId}
              name={name}
              plan={plan}
              sessionId={view.sessionId}
              sessionSets={view.sets}
              target={target}
              unit={view.unit}
              onEditSet={(entry) => {
                setSetEntry((current) => ({
                  entry,
                  isOpen: true,
                  openingId: (current?.openingId ?? 0) + 1,
                }));
              }}
            />
          ))}
          <View
            className="h-[var(--inset-bottom)]"
            style={vars({ "--inset-bottom": insets.bottom })}
          />
        </ScrollView>
      ) : null}
      {view.status === "ready" && setEntry !== null ? (
        <SetEntrySheet
          entry={setEntry.entry}
          open={setEntry.isOpen}
          openingId={setEntry.openingId}
          sessionId={view.sessionId}
          unit={view.unit}
          onClose={() => {
            setSetEntry({ ...setEntry, isOpen: false });
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
    </View>
  );
}
