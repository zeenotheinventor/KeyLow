import { FlexWidget } from "react-native-android-widget";

import { CalorieRing, StatusLine, WidgetCard, WidgetText } from "../components";

import type { TodayRingWidgetProps } from "./types";

/** Board A, "Today ring" (small): the eyebrow, the ring, and what was eaten of the target under it. */
export function TodayRingWidget({ viewModel, theme }: TodayRingWidgetProps) {
  const { ring, status } = viewModel;

  return (
    <WidgetCard
      theme={theme}
      tap={viewModel.tap}
      accessibleName={viewModel.accessibleName}
      justifyContent="space-between"
    >
      <WidgetText
        text={viewModel.eyebrow}
        theme={theme}
        size={12}
        weight="semiBold"
        role="textSubtle"
      />
      <FlexWidget style={{ width: "match_parent", alignItems: "center" }}>
        <CalorieRing ring={ring} size="compact" theme={theme} />
      </FlexWidget>
      {/* The offline note takes the caption's place, because the small widget has no room for both. */}
      {status === null ? (
        ring.eatenOfTarget !== null && (
          <WidgetText
            text={ring.eatenOfTarget}
            theme={theme}
            size={12}
            role="textMuted"
            align="center"
            isFullWidth
          />
        )
      ) : (
        <StatusLine status={status} theme={theme} />
      )}
    </WidgetCard>
  );
}
