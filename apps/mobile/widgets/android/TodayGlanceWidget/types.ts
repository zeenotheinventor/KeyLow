import type { WidgetTheme } from "../theme";
import type { TodayGlanceViewModel } from "@keylow/core/widgets";

export type TodayGlanceWidgetProps = Readonly<{
  viewModel: TodayGlanceViewModel;
  theme: WidgetTheme;
}>;
