import { SET_ENTRY, SET_MARKS, SET_TYPE_OPTIONS, describeSetTypeSheet } from "@keylow/core/copy";
import { SET_TYPES } from "@keylow/core/training";
import { View } from "react-native";

import { BottomSheet, PressableSurface, Text } from "../ui";

import type { SetTypeSheetProps } from "./types";

// The classes are written out so Tailwind sees them. The chosen row takes the accent border and fill, as the
// `session · set-types` board draws it, and there is no radio dot.
const rowClassName = {
  chosen: "border-accent bg-accent-muted",
  other: "border-border bg-transparent",
} as const;

/**
 * The sheet that changes the type of a set, as the `session · set-types` board draws it: the exercise and
 * set under a "Set type" heading, and the four types as radios, each a bordered button with a tile for its
 * mark (W, the set's number, D, F), its name and what it counts as. Pressing one hands it to `onChoose`;
 * the screen writes it and closes the sheet. Built for the session screen's logged rows and for the set
 * entry's Set type control, which both name the set the same way.
 */
export function SetTypeSheet({
  open,
  onClose,
  exerciseName,
  setType,
  setNumber,
  onChoose,
}: SetTypeSheetProps) {
  const { accessibleName, subtitle } = describeSetTypeSheet({ exerciseName, setType, setNumber });

  return (
    <BottomSheet label={accessibleName} open={open} onClose={onClose}>
      <View className="gap-3">
        <View className="gap-0.5">
          <Text role="heading" variant="h2">
            {SET_ENTRY.setTypeSheetTitle}
          </Text>
          <Text tone="secondary" variant="caption">
            {subtitle}
          </Text>
        </View>
        <View aria-label={SET_ENTRY.setTypeGroupName} className="gap-2" role="radiogroup">
          {SET_TYPES.map((type) => {
            const { name, help } = SET_TYPE_OPTIONS[type];
            const isChosen = type === setType;

            return (
              <PressableSurface
                checked={isChosen}
                className={`min-h-[60px] flex-row items-center gap-3 rounded-medium border px-3 py-2 ${rowClassName[isChosen ? "chosen" : "other"]}`}
                key={type}
                label={`${name}. ${help}`}
                role="radio"
                onPress={() => {
                  onChoose(type);
                }}
              >
                <View className="h-8 w-8 items-center justify-center rounded-small bg-surface-raised">
                  <Text tone={type === "warmup" ? "warning-ink" : "primary"} variant="body-strong">
                    {SET_MARKS[type](setNumber)}
                  </Text>
                </View>
                <View className="flex-1 gap-0.5">
                  <Text variant="body-strong">{name}</Text>
                  <Text tone="secondary" variant="caption">
                    {help}
                  </Text>
                </View>
              </PressableSurface>
            );
          })}
        </View>
      </View>
    </BottomSheet>
  );
}
