import { FlexWidget } from "react-native-android-widget";

import { ProgressBar, StatusLine, WeekDots, WidgetCard, WidgetText } from "../components";

import type { ThisWeekWidgetProps } from "./types";

/** Board A, "This week" (medium): the average, its bar against the target, and the seven days. */
export function ThisWeekWidget({ viewModel, theme }: ThisWeekWidgetProps) {
  const { average, note, barFraction, status } = viewModel;

  return (
    <WidgetCard
      theme={theme}
      tap={viewModel.tap}
      accessibleName={viewModel.accessibleName}
      justifyContent="space-between"
    >
      <FlexWidget
        style={{
          width: "match_parent",
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <WidgetText
          text={viewModel.eyebrow}
          theme={theme}
          size={12}
          weight="semiBold"
          role="textSubtle"
        />
        <WidgetText text={viewModel.progress} theme={theme} size={12} role="textMuted" />
      </FlexWidget>
      {average === null ? (
        note !== null && <WidgetText text={note} theme={theme} size={13} role="textMuted" />
      ) : (
        <FlexWidget style={{ flexDirection: "row", alignItems: "center" }}>
          <WidgetText text={average.value} theme={theme} size={30} weight="semiBold" />
          <FlexWidget style={{ marginLeft: 8 }}>
            <WidgetText text={average.caption} theme={theme} role="textMuted" />
          </FlexWidget>
        </FlexWidget>
      )}
      {barFraction !== null && (
        <ProgressBar fraction={barFraction} fillRole="accent" trackRole="track" theme={theme} />
      )}
      <WeekDots dots={viewModel.dots} theme={theme} variant="labelled" />
      {status !== null && <StatusLine status={status} theme={theme} />}
    </WidgetCard>
  );
}
