import { describeIncompleteDays } from "@keylow/core";
import { touchTarget } from "@keylow/tokens";
import { Text as NativeText, View } from "react-native";

import { useTheme } from "../../../lib/theme";
import { Icon } from "../Icon";
import { PressableSurface } from "../PressableSurface";

import type { IncompleteDaysChipProps } from "./types";

const chipHeight = 28;

// A pressable chip reaches out to the touch target above and below. The reach is invisible.
const hitSlopVertical = (touchTarget - chipHeight) / 2;

const frameClassName = "min-h-[28px] flex-row items-center gap-[6px] rounded-pill px-3";

// The classes are written out so Tailwind sees them. A status tone is the tone's muted fill with the
// tone's colour as the text. The warning words use `text-warning-ink`, which is the warning colour in
// dark and the primary text colour in light, because the theme sets it per scheme. Success has no ink
// token yet, so its words take the same fall back in the component, as the badge does, and the colour
// stays on the fill and the glyph (Q14). KEY-192 (the ink tokens) is where they can take a token.
const fillClassName = { warning: "bg-warning-muted", success: "bg-success-muted" } as const;

/** Reports the week: warning-toned while days are incomplete, success-toned when none are. The words carry the meaning. */
export function IncompleteDaysChip({
  count = 0,
  onPress,
  className = "",
}: IncompleteDaysChipProps) {
  const { scheme } = useTheme();
  const isComplete = count <= 0;
  const tone = isComplete ? "success" : "warning";
  const successTextClassName = scheme === "light" ? "text-text-primary" : "text-success";
  const textClassName = isComplete ? successTextClassName : "text-warning-ink";
  const frame = `${frameClassName} ${fillClassName[tone]}`;

  const content = (
    <>
      <Icon name={isComplete ? "CircleCheck" : "CircleDashed"} size="sm" tone={tone} />
      <NativeText className={`text-caption font-medium tabular-nums ${textClassName}`}>
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
