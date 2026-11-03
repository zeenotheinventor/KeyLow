import { FlexWidget } from "react-native-android-widget";

import { clickPropsFor } from "../../clickProps";
import { WidgetText } from "../WidgetText";

import type { ActionButtonProps } from "./types";

/** A button of board D: 36 points high, 12 point radius, the accent when primary. */
export function ActionButton({ button, theme, isFlexible = false }: ActionButtonProps) {
  const isPrimary = button.emphasis === "primary";

  return (
    <FlexWidget
      {...clickPropsFor(button.action)}
      accessibilityLabel={button.accessibleName}
      style={{
        height: 36,
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 14,
        borderRadius: 12,
        backgroundColor: isPrimary ? theme.palette.accent : theme.buttonBackground,
        ...(isFlexible ? { flex: 1 } : {}),
      }}
    >
      <WidgetText
        text={button.label}
        theme={theme}
        weight="semiBold"
        role={isPrimary ? "onAccent" : "text"}
      />
    </FlexWidget>
  );
}
