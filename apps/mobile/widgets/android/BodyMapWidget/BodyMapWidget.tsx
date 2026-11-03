import { FlexWidget } from "react-native-android-widget";

import {
  BodyFigures,
  HeatLegend,
  HeatRows,
  StatusLine,
  WidgetCard,
  WidgetText,
} from "../components";

import type { BodyMapWidgetProps } from "./types";

/** Board A, "Body map" (medium): both sides of the figure, then the warmest muscles and the legend. */
export function BodyMapWidget({ viewModel, theme }: BodyMapWidgetProps) {
  const { rows, summaryLine, status } = viewModel;

  return (
    <WidgetCard
      theme={theme}
      tap={viewModel.tap}
      accessibleName={viewModel.accessibleName}
      direction="row"
      alignItems="center"
      paddingVertical={14}
    >
      <BodyFigures figure={viewModel.figure} theme={theme} />
      <FlexWidget
        style={{
          flex: 1,
          height: "match_parent",
          flexDirection: "column",
          justifyContent: "space-between",
          marginLeft: 12,
        }}
      >
        <FlexWidget style={{ width: "match_parent", flexDirection: "column" }}>
          <WidgetText
            text={viewModel.eyebrow}
            theme={theme}
            size={12}
            weight="semiBold"
            role="textSubtle"
          />
          <FlexWidget style={{ width: "match_parent", marginTop: 8 }}>
            {summaryLine === null ? (
              <HeatRows rows={rows} theme={theme} />
            ) : (
              <WidgetText text={summaryLine} theme={theme} size={13} role="textMuted" />
            )}
          </FlexWidget>
          {status !== null && (
            <FlexWidget style={{ marginTop: 8 }}>
              <StatusLine status={status} theme={theme} />
            </FlexWidget>
          )}
        </FlexWidget>
        <HeatLegend legend={viewModel.legend} theme={theme} />
      </FlexWidget>
    </WidgetCard>
  );
}
