import { FlexWidget } from "react-native-android-widget";

import { clickPropsFor } from "../../clickProps";
import { Icon } from "../Icon";
import { WidgetText } from "../WidgetText";

import type { LoggedRowProps } from "./types";

/** Board D's "Logged" row: a tick and the words in the success colour on its muted fill, and Undo on the right. */
export function LoggedRow({ text, undoLabel, action, theme, height }: LoggedRowProps) {
  return (
    <FlexWidget
      style={{
        width: "match_parent",
        height,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 12,
        borderRadius: 12,
        backgroundColor: theme.successMuted,
      }}
    >
      <FlexWidget style={{ flexDirection: "row", alignItems: "center" }}>
        <Icon name="check" colour={theme.palette.success} size={14} strokeWidth={2.5} />
        <FlexWidget style={{ marginLeft: 6 }}>
          <WidgetText text={text} theme={theme} size={12} weight="semiBold" role="success" />
        </FlexWidget>
      </FlexWidget>
      <FlexWidget
        {...clickPropsFor(action)}
        accessibilityLabel={undoLabel}
        style={{ height, justifyContent: "center", paddingHorizontal: 4 }}
      >
        <WidgetText text={undoLabel} theme={theme} size={12} weight="semiBold" role="accent" />
      </FlexWidget>
    </FlexWidget>
  );
}
