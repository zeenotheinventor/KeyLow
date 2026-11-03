import { FlexWidget } from "react-native-android-widget";

import { clickPropsFor } from "../../clickProps";
import { Icon } from "../Icon";
import { WidgetText } from "../WidgetText";

import type { ActionButtonProps } from "./types";

/** A button of boards B and D: 12 point radius, the accent when primary, an icon before the label when it has one. */
export function ActionButton({ button, theme, fill, height = 36 }: ActionButtonProps) {
  const isPrimary = button.emphasis === "primary";
  const role = isPrimary ? "onAccent" : "text";

  return (
    <FlexWidget
      {...clickPropsFor(button.action)}
      accessibilityLabel={button.accessibleName}
      style={{
        height,
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 14,
        borderRadius: 12,
        backgroundColor: isPrimary ? theme.palette.accent : theme.buttonBackground,
        ...(fill === "flex" ? { flex: 1 } : {}),
        ...(fill === "width" ? { width: "match_parent" as const } : {}),
      }}
    >
      {button.icon !== null && (
        <FlexWidget style={{ marginRight: 6 }}>
          <Icon
            name={button.icon}
            colour={theme.palette[role]}
            size={16}
            strokeWidth={button.icon === "add" || button.icon === "check" ? 2.5 : 2}
          />
        </FlexWidget>
      )}
      <WidgetText text={button.label} theme={theme} weight="semiBold" role={role} />
    </FlexWidget>
  );
}
