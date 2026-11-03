import { FlexWidget } from "react-native-android-widget";

import {
  CalorieRing,
  Icon,
  MacroRows,
  StatusLine,
  WeekDots,
  WidgetCard,
  WidgetText,
} from "../components";

import type { TodayGlanceWidgetProps } from "./types";
import type { WidgetTheme } from "../theme";

const divider = (theme: WidgetTheme) => (
  <FlexWidget
    style={{ width: "match_parent", height: 1, marginVertical: 8, backgroundColor: theme.border }}
  />
);

/** Board A, "Today at a glance" (large): the ring and macros, the week, and today's training. */
export function TodayGlanceWidget({ viewModel, theme }: TodayGlanceWidgetProps) {
  const { week, training, status } = viewModel;

  return (
    <WidgetCard
      theme={theme}
      tap={viewModel.tap}
      accessibleName={viewModel.accessibleName}
      justifyContent="flex-start"
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
        <Icon name="chevron" colour={theme.palette.textSubtle} size={16} />
      </FlexWidget>
      <FlexWidget
        style={{ width: "match_parent", flexDirection: "row", alignItems: "center", marginTop: 16 }}
      >
        <CalorieRing ring={viewModel.ring} size="regular" theme={theme} dimension={104} />
        <FlexWidget style={{ flex: 1, marginLeft: 16 }}>
          <MacroRows macros={viewModel.macros} theme={theme} gap={8} />
        </FlexWidget>
      </FlexWidget>
      {status !== null && (
        <FlexWidget style={{ marginTop: 8 }}>
          <StatusLine status={status} theme={theme} />
        </FlexWidget>
      )}
      {divider(theme)}
      <FlexWidget
        style={{
          width: "match_parent",
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <FlexWidget style={{ flexDirection: "column" }}>
          <WidgetText
            text={week.eyebrow}
            theme={theme}
            size={12}
            weight="semiBold"
            role="textSubtle"
          />
          <WidgetText text={week.line} theme={theme} size={15} weight="semiBold" />
        </FlexWidget>
        <WeekDots dots={week.dots} theme={theme} variant="compact" />
      </FlexWidget>
      {training !== null && (
        <FlexWidget style={{ width: "match_parent", flexDirection: "column" }}>
          {divider(theme)}
          <FlexWidget
            style={{
              width: "match_parent",
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <FlexWidget style={{ flexDirection: "column" }}>
              <WidgetText
                text={training.eyebrow}
                theme={theme}
                size={12}
                weight="semiBold"
                role="textSubtle"
              />
              <WidgetText text={training.line} theme={theme} size={15} weight="semiBold" />
            </FlexWidget>
            {training.heatChip !== null && (
              <FlexWidget style={{ flexDirection: "row", alignItems: "center" }}>
                <FlexWidget
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 999,
                    backgroundColor: theme.palette[training.heatChip.dotRole],
                  }}
                />
                <FlexWidget style={{ marginLeft: 6 }}>
                  <WidgetText
                    text={training.heatChip.text}
                    theme={theme}
                    size={12}
                    role="textMuted"
                  />
                </FlexWidget>
              </FlexWidget>
            )}
          </FlexWidget>
        </FlexWidget>
      )}
    </WidgetCard>
  );
}
