import { FlexWidget } from "react-native-android-widget";

import { WidgetText } from "../WidgetText";

import type { HeatRowsProps } from "./types";

/** The warmest muscles: a dot in the heat colour, the name and the step in words. */
export function HeatRows({ rows, theme }: HeatRowsProps) {
  return (
    <FlexWidget style={{ width: "match_parent", flexDirection: "column" }}>
      {rows.map((row, position) => (
        <FlexWidget
          key={row.muscle}
          style={{
            width: "match_parent",
            flexDirection: "row",
            alignItems: "center",
            ...(position === 0 ? {} : { marginTop: 8 }),
          }}
        >
          <FlexWidget
            style={{
              width: 10,
              height: 10,
              borderRadius: 999,
              backgroundColor: theme.palette[row.dotRole],
            }}
          />
          <FlexWidget style={{ flex: 1, marginLeft: 8 }}>
            <WidgetText text={row.name} theme={theme} />
          </FlexWidget>
          <WidgetText text={row.stepName} theme={theme} size={11} role="textMuted" />
        </FlexWidget>
      ))}
    </FlexWidget>
  );
}
