import { FlexWidget } from "react-native-android-widget";

import { clickPropsFor } from "../../clickProps";

import type { WidgetCardProps } from "./types";

/** The card every widget sits on: the board's 22 point radius, 1 point border and 16 point padding. */
export function WidgetCard({
  theme,
  tap,
  accessibleName,
  paddingVertical = 16,
  paddingHorizontal = 16,
  direction = "column",
  justifyContent,
  alignItems,
  children,
}: WidgetCardProps) {
  return (
    <FlexWidget
      {...(tap === undefined ? {} : clickPropsFor(tap))}
      {...(accessibleName === undefined ? {} : { accessibilityLabel: accessibleName })}
      style={{
        width: "match_parent",
        height: "match_parent",
        flexDirection: direction,
        ...(justifyContent === undefined ? {} : { justifyContent }),
        ...(alignItems === undefined ? {} : { alignItems }),
        paddingVertical,
        paddingHorizontal,
        backgroundColor: theme.surface,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: theme.border,
      }}
    >
      {children}
    </FlexWidget>
  );
}
