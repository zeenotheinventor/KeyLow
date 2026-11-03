import { FlexWidget } from "react-native-android-widget";

import { HeatRows, StatusLine, WidgetCard, WidgetText } from "../components";

import type { BodyHeatWidgetProps } from "./types";

/** Board A, "Body heat" (small): the three warmest muscles, and today's plan under a rule. */
export function BodyHeatWidget({ viewModel, theme }: BodyHeatWidgetProps) {
  const { rows, emptyLine, todayLine, status } = viewModel;

  return (
    <WidgetCard
      theme={theme}
      tap={viewModel.tap}
      accessibleName={viewModel.accessibleName}
      justifyContent="space-between"
    >
      <FlexWidget style={{ width: "match_parent", flexDirection: "column" }}>
        <WidgetText
          text={viewModel.eyebrow}
          theme={theme}
          size={12}
          weight="semiBold"
          role="textSubtle"
        />
        <FlexWidget style={{ width: "match_parent", marginTop: 12 }}>
          {emptyLine === null ? (
            <HeatRows rows={rows} theme={theme} />
          ) : (
            <WidgetText text={emptyLine} theme={theme} size={13} role="textMuted" />
          )}
        </FlexWidget>
      </FlexWidget>
      <FlexWidget style={{ width: "match_parent", flexDirection: "column" }}>
        {status !== null && <StatusLine status={status} theme={theme} />}
        {todayLine !== null && (
          <FlexWidget
            style={{
              width: "match_parent",
              marginTop: 8,
              paddingTop: 8,
              borderTopWidth: 1,
              borderTopColor: theme.border,
            }}
          >
            <WidgetText text={todayLine} theme={theme} size={12} role="textMuted" />
          </FlexWidget>
        )}
      </FlexWidget>
    </WidgetCard>
  );
}
