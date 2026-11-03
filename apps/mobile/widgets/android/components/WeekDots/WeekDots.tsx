import { FlexWidget } from "react-native-android-widget";

import { WidgetText } from "../WidgetText";

import type { WeekDotsProps } from "./types";
import type { WidgetTheme } from "../../theme";
import type { WeekDotView } from "@keylow/core/widgets";

const dotOf = (dot: WeekDotView, size: number, theme: WidgetTheme) => (
  <FlexWidget
    style={{
      width: size,
      height: size,
      borderRadius: 999,
      ...(dot.fill === "filled"
        ? { backgroundColor: theme.palette[dot.role] }
        : { borderWidth: 2, borderColor: theme.palette[dot.role] }),
    }}
  />
);

/** The week's seven days, Monday first. A filled dot is a day complete and a ring is today, still open. */
export function WeekDots({ dots, theme, variant }: WeekDotsProps) {
  if (variant === "compact") {
    return (
      <FlexWidget style={{ flexDirection: "row", alignItems: "center" }}>
        {dots.map((dot, position) => (
          <FlexWidget key={position} style={position === 0 ? {} : { marginLeft: 4 }}>
            {dotOf(dot, 12, theme)}
          </FlexWidget>
        ))}
      </FlexWidget>
    );
  }

  return (
    <FlexWidget style={{ width: "match_parent", flexDirection: "row" }}>
      {dots.map((dot, position) => (
        <FlexWidget
          key={position}
          style={{ flex: 1, flexDirection: "column", alignItems: "center" }}
        >
          <WidgetText
            text={dot.letter}
            theme={theme}
            size={11}
            role={dot.isToday ? "text" : "textSubtle"}
            weight={dot.isToday ? "semiBold" : "regular"}
          />
          <FlexWidget style={{ marginTop: 4 }}>{dotOf(dot, 18, theme)}</FlexWidget>
        </FlexWidget>
      ))}
    </FlexWidget>
  );
}
