import type { WidgetTheme } from "../theme";
import type { TodayLoggingViewModel } from "@keylow/core/widgets";

export type TodayLoggingWidgetProps = Readonly<{
  viewModel: TodayLoggingViewModel;
  theme: WidgetTheme;
}>;
