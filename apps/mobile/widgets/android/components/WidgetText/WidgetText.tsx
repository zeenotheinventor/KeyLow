import { TextWidget } from "react-native-android-widget";

import type { WidgetTextProps, WidgetTextWeight } from "./types";

// The three Geist files the config plugin copies into the app's assets, by file name.
const FONT_FAMILIES: Readonly<Record<WidgetTextWeight, string>> = {
  regular: "Geist-Regular",
  medium: "Geist-Medium",
  semiBold: "Geist-SemiBold",
};

/** One line of text in the widget's type: Geist, a size from the board and a colour role. */
export function WidgetText({
  text,
  theme,
  role = "text",
  size = 13,
  weight = "regular",
  align,
  isFullWidth = false,
}: WidgetTextProps) {
  return (
    <TextWidget
      text={text}
      maxLines={1}
      truncate="END"
      style={{
        color: theme.palette[role],
        fontSize: size,
        fontFamily: FONT_FAMILIES[weight],
        ...(align === undefined ? {} : { textAlign: align }),
        ...(isFullWidth ? { width: "match_parent" as const } : {}),
      }}
    />
  );
}
