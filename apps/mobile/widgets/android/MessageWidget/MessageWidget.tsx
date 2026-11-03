import { FlexWidget } from "react-native-android-widget";

import { ActionButton, WidgetCard, WidgetText } from "../components";

import type { MessageWidgetProps } from "./types";

/**
 * Board D: a widget with nothing normal to show, worded the same at every size. The eyebrow (and the
 * eaten figure in the corner), the headline and its line, then the buttons. Only the buttons tap.
 */
export function MessageWidget({ viewModel, theme }: MessageWidgetProps) {
  const { trailing, body, actions } = viewModel;

  return (
    <WidgetCard theme={theme} justifyContent="space-between">
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
        {trailing !== null && (
          <WidgetText text={trailing} theme={theme} size={12} role="textMuted" />
        )}
      </FlexWidget>
      <FlexWidget style={{ width: "match_parent", flexDirection: "column" }}>
        <WidgetText
          text={viewModel.headline}
          theme={theme}
          size={17}
          weight="semiBold"
          role={viewModel.headlineRole}
        />
        {body !== null && (
          <FlexWidget style={{ marginTop: 4 }}>
            <WidgetText text={body} theme={theme} role="textMuted" />
          </FlexWidget>
        )}
      </FlexWidget>
      <FlexWidget style={{ width: "match_parent", flexDirection: "row" }}>
        {actions.map((button, position) => (
          <FlexWidget
            key={button.label}
            style={{
              ...(actions.length > 1 ? { flex: 1 } : {}),
              ...(position === 0 ? {} : { marginLeft: 8 }),
            }}
          >
            <ActionButton button={button} theme={theme} />
          </FlexWidget>
        ))}
      </FlexWidget>
    </WidgetCard>
  );
}
