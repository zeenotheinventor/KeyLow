import { FlexWidget } from "react-native-android-widget";

import type { ProgressBarProps } from "./types";

const BAR_HEIGHT = 6;

/** The 6 point bar of the macros and the week. The library has no percentage width, so flex weights split it. */
export function ProgressBar({ fraction, fillRole, trackRole, theme }: ProgressBarProps) {
  const filled = Math.min(1, Math.max(0, fraction));

  return (
    <FlexWidget
      style={{
        width: "match_parent",
        height: BAR_HEIGHT,
        flexDirection: "row",
        borderRadius: 999,
        backgroundColor: theme.palette[trackRole],
        overflow: "hidden",
      }}
    >
      {filled > 0 && (
        <FlexWidget
          style={{
            flex: filled,
            height: BAR_HEIGHT,
            borderRadius: 999,
            backgroundColor: theme.palette[fillRole],
          }}
        />
      )}
      {filled < 1 && <FlexWidget style={{ flex: 1 - filled, height: BAR_HEIGHT }} />}
    </FlexWidget>
  );
}
