import { FlexWidget } from "react-native-android-widget";

import { CalorieRing, QuickActionTile, WidgetCard } from "../components";

import type { TodayLoggingWidgetProps } from "./types";

/** Board B, "Today plus logging" (medium): the compact ring on the left, a two by two grid of actions on the right. */
export function TodayLoggingWidget({ viewModel, theme }: TodayLoggingWidgetProps) {
  const { buttons } = viewModel;
  const rows = [buttons.slice(0, 2), buttons.slice(2, 4)];

  return (
    <WidgetCard
      theme={theme}
      tap={viewModel.tap}
      accessibleName={viewModel.accessibleName}
      direction="row"
      alignItems="center"
    >
      <FlexWidget style={{ width: 100, alignItems: "center" }}>
        <CalorieRing ring={viewModel.ring} size="compact" theme={theme} />
      </FlexWidget>
      <FlexWidget
        style={{ flex: 1, height: "match_parent", flexDirection: "column", marginLeft: 16 }}
      >
        {rows.map((row, position) => (
          <FlexWidget
            key={position}
            style={{
              flex: 1,
              width: "match_parent",
              flexDirection: "row",
              ...(position === 0 ? {} : { marginTop: 8 }),
            }}
          >
            {row.map((button, column) => (
              <FlexWidget
                key={button.label}
                style={{
                  flex: 1,
                  height: "match_parent",
                  ...(column === 0 ? {} : { marginLeft: 8 }),
                }}
              >
                <QuickActionTile button={button} theme={theme} iconSize={20} />
              </FlexWidget>
            ))}
          </FlexWidget>
        ))}
      </FlexWidget>
    </WidgetCard>
  );
}
