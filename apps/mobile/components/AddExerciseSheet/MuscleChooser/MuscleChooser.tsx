import { CUSTOM_EXERCISE, MUSCLE_GROUP_NAMES, MUSCLE_NAMES } from "@keylow/core/copy";
import { MUSCLE_GROUPS, MUSCLE_IDS, MUSCLES } from "@keylow/core/training";
import { View } from "react-native";

import { GroupedList, ListRow, SheetHeader, SheetScrollView } from "../../ui";

import type { MuscleChooserProps } from "./types";

/**
 * The Add a muscle list of the New exercise form: the 22 muscles in their 7 groups, each a row to press,
 * without the muscles the exercise already has. No board draws it. It takes the form's place in the sheet,
 * with a Back to the form, and its list scrolls in the sheet's own scroll view, the one scrollable a sheet
 * takes. Every muscle is a button, so none needs a gesture.
 */
export function MuscleChooser({ chosenMuscles, onChoose, onBack }: MuscleChooserProps) {
  return (
    <View className="flex-1">
      <SheetHeader
        leading={{
          icon: "ChevronLeft",
          label: CUSTOM_EXERCISE.muscleChooserBackName,
          onPress: onBack,
        }}
        title={CUSTOM_EXERCISE.addMuscleAction}
        variant="stack"
      />
      <SheetScrollView className="flex-1" contentContainerClassName="gap-4 pb-2">
        {MUSCLE_GROUPS.map((group) => {
          const offered = MUSCLE_IDS.filter(
            (muscle) => MUSCLES[muscle].group === group && !chosenMuscles.includes(muscle),
          );
          if (offered.length === 0) {
            return null;
          }
          return (
            <GroupedList key={group} title={MUSCLE_GROUP_NAMES[group]}>
              {offered.map((muscle) => (
                <ListRow
                  key={muscle}
                  title={MUSCLE_NAMES[muscle]}
                  onPress={() => {
                    onChoose(muscle);
                  }}
                />
              ))}
            </GroupedList>
          );
        })}
      </SheetScrollView>
    </View>
  );
}
