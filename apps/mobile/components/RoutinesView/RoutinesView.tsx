import {
  EXERCISE_PROGRESS,
  GENERIC_ERROR,
  RETRY_LABEL,
  ROUTINES_EMPTY,
  ROUTINE_PROGRESS,
  ROUTINES_SCREEN,
  describeArchivedRoutinesLink,
  describeMakeActiveName,
  describeOtherRoutineMeta,
  TRAIN_LOADING_NAME,
} from "@keylow/core/copy";
import { vars } from "nativewind";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { RoutineCard } from "../RoutineCard";
import { RoutineProgressDay } from "../RoutineProgressDay";
import { RoutineRow } from "../RoutineRow";
import { Button, EmptyState, ErrorState, GroupedList, SheetHeader, Skeleton, Text } from "../ui";

import type { RoutineProgressState } from "../RoutineProgressDay";
import type { RoutinesViewProps } from "./types";

// The boards lift a state 80 points above the bottom of the space, so it sits a little above the middle.
const stateClassName = "flex-1 pb-20";

/** What stands in for the progress groups while they load or when they could not be read. */
function renderProgressStatus(progress: RoutineProgressState) {
  switch (progress.status) {
    case "loading":
      return (
        <View accessible aria-label={EXERCISE_PROGRESS.loadingName} role="status">
          <Skeleton rows={3} variant="group" />
        </View>
      );
    case "error":
      return (
        <ErrorState
          retry={{ label: RETRY_LABEL, onPress: progress.onRetry }}
          title={GENERIC_ERROR}
          variant="card"
        />
      );
    case "ready":
      return null;
  }
}

/**
 * The routines list, pushed inside the Train tab so the tab bar stays, as the `routines · list` and
 * `routines · empty` boards draw it: Back and the title, the active routine as a card, the other routines
 * in a card of rows, and the link to the archived routines. With no routine it shows the empty state. Every
 * control but Back and the archived link is drawn only when its handler is given, so none is a dead control.
 * The words are core's, and the routines' flags and sets are worked out before they get here. Given the
 * active routine's `progress`, a Progress section follows the list, which no board draws: a group for each
 * routine day, in the same scroll view. Every row is drawn, sparkline included, so a routine of many
 * exercises is many small canvases; scroll on a phone is to be checked.
 */
export function RoutinesView(props: RoutinesViewProps) {
  const insets = useSafeAreaInsets();
  const { onEditRoutine, onMakeActive, onCreateRoutine, onOpenExercise, progress } = props;
  const hasRoutines =
    props.status === "ready" && (props.active !== null || props.others.length > 0);
  const showsProgress =
    props.status === "ready" &&
    props.active !== null &&
    progress !== undefined &&
    (progress.status !== "ready" || progress.days.length > 0);

  function renderBody() {
    switch (props.status) {
      case "loading":
        return <View accessible aria-label={TRAIN_LOADING_NAME} role="status" />;
      case "error":
        return (
          <View className={stateClassName}>
            <ErrorState
              retry={{ label: RETRY_LABEL, onPress: props.onRetry }}
              title={GENERIC_ERROR}
            />
          </View>
        );
      case "ready": {
        const { active, others, archivedCount } = props;

        return (
          <>
            {active === null && others.length === 0 ? (
              <EmptyState
                action={
                  onCreateRoutine === undefined
                    ? undefined
                    : {
                        label: ROUTINES_EMPTY.action,
                        icon: "Plus",
                        variant: "primary",
                        onPress: onCreateRoutine,
                      }
                }
                body={ROUTINES_EMPTY.body}
                icon="Calendar"
                title={ROUTINES_EMPTY.title}
                variant="card"
              />
            ) : null}
            {active === null ? null : (
              <View className="gap-2">
                <Text className="px-1" role="heading" tone="muted" variant="caption">
                  {ROUTINES_SCREEN.activeLabel}
                </Text>
                <RoutineCard
                  {...active}
                  onPress={
                    onEditRoutine === undefined
                      ? undefined
                      : () => {
                          onEditRoutine({ id: active.id, name: active.name });
                        }
                  }
                />
              </View>
            )}
            {others.length === 0 ? null : (
              <View className="gap-2">
                <Text className="px-1" role="heading" tone="muted" variant="caption">
                  {ROUTINES_SCREEN.otherSectionName}
                </Text>
                <GroupedList hidesTitle title={ROUTINES_SCREEN.otherSectionName}>
                  {others.map((routine) => (
                    <RoutineRow
                      action={
                        onMakeActive === undefined
                          ? undefined
                          : {
                              label: ROUTINES_SCREEN.makeActiveAction,
                              accessibilityLabel: describeMakeActiveName(routine.name),
                              onPress: () => {
                                onMakeActive({ id: routine.id, name: routine.name });
                              },
                            }
                      }
                      key={routine.id}
                      meta={describeOtherRoutineMeta(routine)}
                      name={routine.name}
                      onPress={
                        onEditRoutine === undefined
                          ? undefined
                          : () => {
                              onEditRoutine({ id: routine.id, name: routine.name });
                            }
                      }
                    />
                  ))}
                </GroupedList>
              </View>
            )}
            {archivedCount === 0 ? null : (
              <Button
                className="self-start"
                icon="Archive"
                variant="ghost"
                onPress={props.onOpenArchived}
              >
                {describeArchivedRoutinesLink(archivedCount)}
              </Button>
            )}
          </>
        );
      }
    }
  }

  return (
    // The top inset is a runtime value no class can name, so it goes through a variable, as the Targets screen's does.
    <View
      className="flex-1 bg-background pt-[var(--inset-top)]"
      style={vars({ "--inset-top": insets.top })}
    >
      <SheetHeader
        leading={{ icon: "ChevronLeft", label: ROUTINES_SCREEN.backLabel, onPress: props.onBack }}
        title={ROUTINES_SCREEN.title}
        trailing={
          hasRoutines && onCreateRoutine !== undefined
            ? { icon: "Plus", label: ROUTINES_SCREEN.newRoutineLabel, onPress: onCreateRoutine }
            : undefined
        }
      />
      <ScrollView className="flex-1" contentContainerClassName="grow gap-4 px-4 pb-4 pt-1">
        {renderBody()}
        {showsProgress ? (
          <>
            <Text className="px-1" role="heading" tone="muted" variant="caption">
              {ROUTINE_PROGRESS.heading}
            </Text>
            {progress.status === "ready"
              ? progress.days.map((day) => (
                  <RoutineProgressDay day={day} key={day.id} onOpenExercise={onOpenExercise} />
                ))
              : renderProgressStatus(progress)}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}
