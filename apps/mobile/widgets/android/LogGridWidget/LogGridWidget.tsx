import { FlexWidget } from "react-native-android-widget";

import { QuickActionTile, WidgetCard } from "../components";

import type { LogGridWidgetProps } from "./types";

/**
 * Board B, "Log grid" (small): four shortcuts in a two by two grid on a card with 10 points of padding. The
 * tiles fill the card, so the card has no tap of its own.
 */
export function LogGridWidget({ viewModel, theme }: LogGridWidgetProps) {
  const { buttons } = viewModel;
  const rows = [buttons.slice(0, 2), buttons.slice(2, 4)];

  return (
    <WidgetCard theme={theme} paddingVertical={10} paddingHorizontal={10}>
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
              <QuickActionTile button={button} theme={theme} iconSize={22} />
            </FlexWidget>
          ))}
        </FlexWidget>
      ))}
    </WidgetCard>
  );
}
