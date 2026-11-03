import { FlexWidget } from "react-native-android-widget";

import { clickPropsFor } from "../clickProps";
import { Icon, LoggedRow, WidgetCard, WidgetText } from "../components";

import type { LogAgainWidgetProps } from "./types";

const ROW_HEIGHT = 30;

/** Board B, "Log again" (medium): the recent foods as rows, each logs again with one tap, Logged and Undo after. */
export function LogAgainWidget({ viewModel, theme }: LogAgainWidgetProps) {
  return (
    <WidgetCard theme={theme} tap={viewModel.tap} accessibleName={viewModel.accessibleName}>
      <WidgetText
        text={viewModel.eyebrow}
        theme={theme}
        size={12}
        weight="semiBold"
        role="textSubtle"
      />
      <FlexWidget style={{ width: "match_parent", flexDirection: "column", marginTop: 10 }}>
        {viewModel.rows.map((row, position) => (
          <FlexWidget
            key={position}
            style={{ width: "match_parent", ...(position === 0 ? {} : { marginTop: 6 }) }}
          >
            {row.type === "logged" ? (
              <LoggedRow
                text={row.text}
                undoLabel={row.undoLabel}
                action={row.action}
                theme={theme}
                height={ROW_HEIGHT}
              />
            ) : (
              <FlexWidget
                {...clickPropsFor(row.action)}
                accessibilityLabel={row.accessibleName}
                style={{
                  width: "match_parent",
                  height: ROW_HEIGHT,
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingHorizontal: 12,
                  borderRadius: 12,
                  backgroundColor: theme.buttonBackground,
                }}
              >
                <WidgetText text={row.name} theme={theme} size={12} weight="medium" />
                <FlexWidget style={{ flexDirection: "row", alignItems: "center" }}>
                  <WidgetText text={row.energy} theme={theme} size={12} role="textMuted" />
                  <FlexWidget style={{ marginLeft: 8 }}>
                    <Icon name="add" colour={theme.palette.accent} size={16} strokeWidth={2.5} />
                  </FlexWidget>
                </FlexWidget>
              </FlexWidget>
            )}
          </FlexWidget>
        ))}
      </FlexWidget>
    </WidgetCard>
  );
}
