import {
  GENERIC_ERROR,
  RETRY_LABEL,
  ROUTINES_ARCHIVED,
  describeArchivedRoutineMeta,
  describeRestoreName,
  TRAIN_LOADING_NAME,
} from "@keylow/core/copy";
import { vars } from "nativewind";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { RoutineRow } from "../RoutineRow";
import { ErrorState, GroupedList, SheetHeader, Text } from "../ui";

import type { ArchivedRoutinesViewProps } from "./types";

// The boards lift a state 80 points above the bottom of the space, so it sits a little above the middle.
const stateClassName = "flex-1 pb-20";

/**
 * The archived routines, pushed inside the Train tab over the list, as the `routines · archived` board
 * draws it: Back and the title, a card of the routines and a note on what archived means. A routine's row
 * is not pressable, because an archived routine is restored before it is opened, and Restore is drawn only
 * when `onRestore` is given. The database does not keep the day a routine was archived, so a row gives its
 * days alone.
 */
export function ArchivedRoutinesView(props: ArchivedRoutinesViewProps) {
  const insets = useSafeAreaInsets();

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
        const { routines, onRestore } = props;

        return (
          <>
            {routines.length === 0 ? null : (
              <GroupedList hidesTitle title={ROUTINES_ARCHIVED.title}>
                {routines.map((routine) => (
                  <RoutineRow
                    action={
                      onRestore === undefined
                        ? undefined
                        : {
                            label: ROUTINES_ARCHIVED.restoreAction,
                            accessibilityLabel: describeRestoreName(routine.name),
                            onPress: () => {
                              onRestore({ id: routine.id, name: routine.name });
                            },
                          }
                    }
                    key={routine.id}
                    meta={describeArchivedRoutineMeta({
                      dayCount: routine.dayCount,
                      archivedOn: null,
                    })}
                    name={routine.name}
                  />
                ))}
              </GroupedList>
            )}
            <Text className="px-1" tone="muted" variant="caption">
              {ROUTINES_ARCHIVED.note}
            </Text>
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
        leading={{ icon: "ChevronLeft", label: ROUTINES_ARCHIVED.backLabel, onPress: props.onBack }}
        title={ROUTINES_ARCHIVED.title}
      />
      <ScrollView className="flex-1" contentContainerClassName="grow gap-3 px-4 pb-4 pt-1">
        {renderBody()}
      </ScrollView>
    </View>
  );
}
