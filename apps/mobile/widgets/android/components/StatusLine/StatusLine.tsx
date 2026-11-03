import { FlexWidget } from "react-native-android-widget";

import { Icon } from "../Icon";
import { WidgetText } from "../WidgetText";

import type { StatusLineProps } from "./types";

/** "Offline · updated 10:05" in the warning colour, with the offline icon. */
export function StatusLine({ status, theme }: StatusLineProps) {
  return (
    <FlexWidget style={{ flexDirection: "row", alignItems: "center" }}>
      <Icon name="offline" colour={theme.palette[status.role]} size={14} />
      <FlexWidget style={{ marginLeft: 6 }}>
        <WidgetText text={status.text} theme={theme} size={12} role={status.role} />
      </FlexWidget>
    </FlexWidget>
  );
}
