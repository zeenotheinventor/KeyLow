import type { WidgetTheme } from "../theme";
import type { TodayMacrosViewModel } from "@keylow/core/widgets";

export type TodayMacrosWidgetProps = Readonly<{
  viewModel: TodayMacrosViewModel;
  theme: WidgetTheme;
}>;
