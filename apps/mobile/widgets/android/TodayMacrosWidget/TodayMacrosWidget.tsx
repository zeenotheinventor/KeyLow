import { FlexWidget } from "react-native-android-widget";

import { CalorieRing, MacroRows, StatusLine, WidgetCard, WidgetText } from "../components";

import type { TodayMacrosWidgetProps } from "./types";

/** Board A, "Today with macros" (medium): the ring on the left, the day's eyebrow and three macro bars. */
export function TodayMacrosWidget({ viewModel, theme }: TodayMacrosWidgetProps) {
  const { status } = viewModel;

  return (
    <WidgetCard
      theme={theme}
      tap={viewModel.tap}
      accessibleName={viewModel.accessibleName}
      direction="row"
      alignItems="center"
    >
      <CalorieRing ring={viewModel.ring} size="regular" theme={theme} />
      <FlexWidget style={{ flex: 1, flexDirection: "column", marginLeft: 16 }}>
        <WidgetText
          text={viewModel.eyebrow}
          theme={theme}
          size={12}
          weight="semiBold"
          role="textSubtle"
        />
        <FlexWidget style={{ width: "match_parent", marginTop: 10 }}>
          <MacroRows macros={viewModel.macros} theme={theme} gap={10} />
        </FlexWidget>
        {status !== null && (
          <FlexWidget style={{ marginTop: 8 }}>
            <StatusLine status={status} theme={theme} />
          </FlexWidget>
        )}
      </FlexWidget>
    </WidgetCard>
  );
}
