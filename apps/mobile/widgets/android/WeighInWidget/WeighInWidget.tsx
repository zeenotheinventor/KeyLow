import { FlexWidget } from "react-native-android-widget";

import { ActionButton, WidgetCard, WidgetText } from "../components";

import type { WeighInWidgetProps } from "./types";

/** Board B, "Weigh in" (small): the last weight, when it was logged, and Log today, which opens the entry. */
export function WeighInWidget({ viewModel, theme }: WeighInWidgetProps) {
  const { unit, caption } = viewModel;

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
      <FlexWidget style={{ flexDirection: "column" }}>
        <FlexWidget style={{ flexDirection: "row", alignItems: "center" }}>
          <WidgetText text={viewModel.value} theme={theme} size={30} weight="semiBold" />
          {unit !== null && (
            <FlexWidget style={{ marginLeft: 4 }}>
              <WidgetText text={unit} theme={theme} size={15} weight="medium" role="textMuted" />
            </FlexWidget>
          )}
        </FlexWidget>
        {caption !== null && <WidgetText text={caption} theme={theme} size={12} role="textMuted" />}
      </FlexWidget>
      <ActionButton button={viewModel.button} theme={theme} fill="width" />
    </WidgetCard>
  );
}
