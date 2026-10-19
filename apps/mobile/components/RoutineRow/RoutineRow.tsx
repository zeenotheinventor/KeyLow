import { View } from "react-native";

import { rowPressScale } from "../../lib/motion";
import { Button, PressableSurface, Text, useGroupedRowPosition } from "../ui";

import type { RoutineRowProps } from "./types";

/**
 * A routine in a card of routines, as the `routines · list` and `routines · archived` boards draw it: the
 * name over its days and sets, and a small secondary button beside them, such as Make active or Restore. The
 * name is a button only when `onPress` opens the routine, and the button is drawn only when `action` is
 * given, so a row with neither is plain information. It sits in a `GroupedList`, which gives every row after
 * the first its hairline. The words wrap inside the 64 point minimum height, as the boards' do, so a long name
 * or meta is never cut, and the button keeps its width beside them.
 */
export function RoutineRow({ name, meta, onPress, action }: RoutineRowProps) {
  const { isFirst } = useGroupedRowPosition();

  const words = (
    <>
      <Text variant="body-strong">{name}</Text>
      <Text className="tabular-nums" tone="secondary" variant="caption">
        {meta}
      </Text>
    </>
  );
  const wordsClassName = "min-w-0 flex-1 gap-[2px]";

  return (
    <View
      className={`min-h-[64px] flex-row items-center gap-2 py-2 pl-3 pr-1 ${isFirst ? "" : "border-t border-border"}`}
    >
      {onPress === undefined ? (
        <View accessible aria-label={`${name}, ${meta}`} className={wordsClassName}>
          {words}
        </View>
      ) : (
        <PressableSurface
          className={wordsClassName}
          label={`${name}, ${meta}`}
          pressScale={rowPressScale}
          onPress={onPress}
        >
          {words}
        </PressableSurface>
      )}
      {action === undefined ? null : (
        <Button
          accessibilityLabel={action.accessibilityLabel}
          size="sm"
          variant="secondary"
          onPress={action.onPress}
        >
          {action.label}
        </Button>
      )}
    </View>
  );
}
