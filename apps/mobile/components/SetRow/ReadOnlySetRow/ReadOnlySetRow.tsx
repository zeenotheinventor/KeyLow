import { View } from "react-native";

import { Icon, PressableSurface, Text } from "../../ui";
import { setColumnClassName } from "../columnClassName";

import type { ReadOnlySetRowProps } from "./types";

// The classes are written out so Tailwind sees them.
const rowClassName = `min-h-10 flex-row items-center ${setColumnClassName.row}`;

/**
 * A set of a logged session, as the `history · session-detail` board draws it: the set's mark (W for a
 * warm-up), what was done, the RIR and, when the row opens something, a chevron. Every row is drawn alike:
 * a past session is not compared with a plan. The row is a list item. With `onPress` the item holds one button, named as
 * the copy names it with its edit; without it the item is named without the edit and nothing in it responds.
 */
export function ReadOnlySetRow({ setType, copy, onPress }: ReadOnlySetRowProps) {
  const contents = (
    <>
      <Text
        className={setColumnClassName.mark}
        tone={setType === "warmup" ? "warning-ink" : "secondary"}
        variant="label-small"
      >
        {copy.label}
      </Text>
      <Text className="min-w-0 flex-1">{copy.what}</Text>
      <Text className="w-[56px] text-right" tone="secondary" variant="caption">
        {copy.rir}
      </Text>
      {onPress === undefined ? null : (
        <View className="w-6 items-center">
          <Icon name="ChevronRight" size="sm" tone="muted" />
        </View>
      )}
    </>
  );

  if (onPress === undefined) {
    return (
      <View accessible aria-label={copy.description} className={rowClassName} role="listitem">
        {contents}
      </View>
    );
  }

  return (
    <View role="listitem">
      <PressableSurface className={rowClassName} label={copy.accessibleName} onPress={onPress}>
        {contents}
      </PressableSurface>
    </View>
  );
}
