import { SESSION_ACTIVE, TRAIN_ERROR, TRAIN_LOADING_NAME } from "@keylow/core/copy";
import { vars } from "nativewind";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SessionClock } from "../SessionClock";
import { SessionExerciseCard } from "../SessionExerciseCard";
import { ErrorState, SheetHeader } from "../ui";
import { useSessionScreen } from "./useSessionScreen";

import type { SessionScreenProps } from "./types";

/**
 * The active session, a full screen over the tabs, as the `session · active` and `session · from-routine`
 * boards draw it: the control that hides it while the session keeps running, the session's name with its
 * clock and sets logged, and a card for each exercise with its set rows. The rows only display for now: the
 * check, editing a value, Add set, Add exercise and Finish have tickets of their own. While the session is
 * read the screen shows a loading status, a failed read shows Try again, and with no open session only the
 * control that hides it is left (no board draws these).
 */
export function SessionScreen({ onHide }: SessionScreenProps) {
  const view = useSessionScreen();
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-background">
      {/* The inset is a runtime value no class can name, so it goes through a variable, as the tab header's does. */}
      <View className="pt-[var(--inset-top)]" style={vars({ "--inset-top": insets.top })}>
        {view.status === "ready" ? (
          <SessionClock {...view.header} onHide={onHide} />
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
          {view.exercises.map(({ name, target, exercise }) => (
            <SessionExerciseCard
              exercise={exercise}
              key={exercise.exerciseId}
              name={name}
              sessionId={view.sessionId}
              sessionSets={view.sets}
              target={target}
              unit={view.unit}
            />
          ))}
          <View
            className="h-[var(--inset-bottom)]"
            style={vars({ "--inset-bottom": insets.bottom })}
          />
        </ScrollView>
      ) : null}
    </View>
  );
}
