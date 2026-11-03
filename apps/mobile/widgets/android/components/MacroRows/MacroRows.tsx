import { FlexWidget } from "react-native-android-widget";

import { ProgressBar } from "../ProgressBar";
import { WidgetText } from "../WidgetText";

import type { MacroRowsProps } from "./types";

/** Protein, carbs and fat: the name and what was eaten of the target on one line, the bar under it. */
export function MacroRows({ macros, theme, gap }: MacroRowsProps) {
  return (
    <FlexWidget style={{ width: "match_parent", flexDirection: "column" }}>
      {macros.map((macro, position) => (
        <FlexWidget
          key={macro.label}
          style={{
            width: "match_parent",
            flexDirection: "column",
            ...(position === 0 ? {} : { marginTop: gap }),
          }}
        >
          <FlexWidget
            style={{
              width: "match_parent",
              flexDirection: "row",
              justifyContent: "space-between",
              marginBottom: 4,
            }}
          >
            <WidgetText text={macro.label} theme={theme} size={12} />
            <WidgetText text={macro.value} theme={theme} size={12} role="textMuted" />
          </FlexWidget>
          <ProgressBar
            fraction={macro.fraction}
            fillRole={macro.fillRole}
            trackRole={macro.trackRole}
            theme={theme}
          />
        </FlexWidget>
      ))}
    </FlexWidget>
  );
}
