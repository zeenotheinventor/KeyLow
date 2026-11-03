import { FlexWidget } from "react-native-android-widget";

import { clickPropsFor } from "../../clickProps";
import { Icon } from "../Icon";
import { WidgetText } from "../WidgetText";

import type { QuickActionTileProps } from "./types";

/** A tile of the log grids: the icon over the label on a 16 point radius fill, the accent when primary. */
export function QuickActionTile({ button, theme, iconSize }: QuickActionTileProps) {
  const isPrimary = button.emphasis === "primary";
  const role = isPrimary ? "onAccent" : "text";

  return (
    <FlexWidget
      {...clickPropsFor(button.action)}
      accessibilityLabel={button.accessibleName}
      style={{
        width: "match_parent",
        height: "match_parent",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        borderRadius: 16,
        backgroundColor: isPrimary ? theme.palette.accent : theme.buttonBackground,
      }}
    >
      {button.icon !== null && (
        <FlexWidget style={{ marginBottom: 6 }}>
          <Icon name={button.icon} colour={theme.palette[role]} size={iconSize} />
        </FlexWidget>
      )}
      <WidgetText text={button.label} theme={theme} size={12} weight="semiBold" role={role} />
    </FlexWidget>
  );
}
