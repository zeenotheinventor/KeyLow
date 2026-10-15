import { describeIncompleteDays } from "@keylow/core";
import { touchTarget } from "@keylow/tokens";
import { Text as NativeText, View } from "react-native";

import { Icon } from "../Icon";
import { PressableSurface } from "../PressableSurface";

import type { IncompleteDaysChipProps } from "./types";

const chipHeight = 28;

// A pressable chip reaches out to the touch target above and below. The reach is invisible.
const hitSlopVertical = (touchTarget - chipHeight) / 2;

const frameClassName = "min-h-[28px] flex-row items-center gap-[6px] rounded-pill px-3";

// The classes are written out so Tailwind sees them. A status tone is the tone's muted fill with the
// tone's colour as the text. The warning words use `text-warning-ink`, which is the warning colour in
// dark and the primary text colour in light, and the success words use `text-success-ink`, which is the
// success colour in dark and a darker green in light, because the theme sets each per scheme.
const toneClassName = {
  warning: { fill: "bg-warning-muted", text: "text-warning-ink" },
  success: { fill: "bg-success-muted", text: "text-success-ink" },
} as const;

/** Reports the week: warning-toned while days are incomplete, success-toned when none are. The words carry the meaning. */
export function IncompleteDaysChip({
  count = 0,
  onPress,
  className = "",
}: IncompleteDaysChipProps) {
  const isComplete = count <= 0;
  const tone = isComplete ? "success" : "warning";
  const frame = `${frameClassName} ${toneClassName[tone].fill}`;

  const content = (
    <>
      <Icon name={isComplete ? "CircleCheck" : "CircleDashed"} size="sm" tone={tone} />
      <NativeText className={`text-caption font-medium tabular-nums ${toneClassName[tone].text}`}>
        {describeIncompleteDays(count)}
      </NativeText>
    </>
  );

  return (
    <View className={`self-start ${className}`}>
      {onPress === undefined ? (
        <View className={frame}>{content}</View>
      ) : (
        <PressableSurface
          className={`overflow-hidden ${frame}`}
          hitSlop={{ top: hitSlopVertical, bottom: hitSlopVertical }}
          onPress={onPress}
        >
          {content}
        </PressableSurface>
      )}
    </View>
  );
}
