import { FlexWidget } from "react-native-android-widget";

import { ActionButton, Icon, WidgetCard, WidgetText } from "../components";

import type { MessageWidgetProps } from "./types";

/**
 * Board D: a widget with nothing normal to show, worded the same at every size. The eyebrow (and the
 * eaten figure in the corner), the headline and its line, then the buttons. A failure is drawn as the
 * board's banner with an alert icon, and a rest day has the larger headline. Only the buttons tap.
 */
export function MessageWidget({ viewModel, theme }: MessageWidgetProps) {
  const { trailing, body, actions } = viewModel;
  const isFailure = viewModel.headlineRole === "danger";
  const hasSeveralButtons = actions.length > 1;

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
        {isFailure ? (
          <FlexWidget
            style={{
              width: "match_parent",
              flexDirection: "row",
              alignItems: "center",
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderRadius: 12,
              backgroundColor: theme.dangerMuted,
            }}
          >
            <Icon name="alert" colour={theme.palette.danger} size={16} />
            <FlexWidget style={{ marginLeft: 8 }}>
              <WidgetText text={viewModel.headline} theme={theme} weight="semiBold" role="danger" />
            </FlexWidget>
          </FlexWidget>
        ) : (
          <WidgetText
            text={viewModel.headline}
            theme={theme}
            size={viewModel.state === "rest_day" ? 22 : 17}
            weight="semiBold"
          />
        )}
        {body !== null && (
          <FlexWidget style={{ marginTop: isFailure ? 10 : 4 }}>
            <WidgetText text={body} theme={theme} role="textMuted" />
          </FlexWidget>
        )}
      </FlexWidget>
      <FlexWidget style={{ width: "match_parent", flexDirection: "row" }}>
        {actions.map((button, position) => (
          <FlexWidget
            key={button.label}
            style={{
              ...(hasSeveralButtons ? { flex: 1 } : {}),
              ...(position === 0 ? {} : { marginLeft: 8 }),
            }}
          >
            <ActionButton
              button={button}
              theme={theme}
              fill={hasSeveralButtons ? "width" : undefined}
            />
          </FlexWidget>
        ))}
      </FlexWidget>
    </WidgetCard>
  );
}
