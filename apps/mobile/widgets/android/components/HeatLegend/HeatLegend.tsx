import { FlexWidget } from "react-native-android-widget";

import { WidgetText } from "../WidgetText";

import type { HeatLegendProps } from "./types";

/** The scale under the body map: one segment per step, and the words for its two ends. */
export function HeatLegend({ legend, theme }: HeatLegendProps) {
  return (
    <FlexWidget style={{ width: "match_parent", flexDirection: "column" }}>
      <FlexWidget
        style={{
          width: "match_parent",
          height: 6,
          flexDirection: "row",
          borderRadius: 999,
          overflow: "hidden",
        }}
      >
        {legend.swatches.map((role, position) => (
          <FlexWidget
            key={position}
            style={{ flex: 1, height: 6, backgroundColor: theme.palette[role] }}
          />
        ))}
      </FlexWidget>
      <FlexWidget
        style={{
          width: "match_parent",
          flexDirection: "row",
          justifyContent: "space-between",
          marginTop: 4,
        }}
      >
        <WidgetText text={legend.startLabel} theme={theme} size={10} role="textSubtle" />
        <WidgetText text={legend.endLabel} theme={theme} size={10} role="textSubtle" />
      </FlexWidget>
    </FlexWidget>
  );
}
