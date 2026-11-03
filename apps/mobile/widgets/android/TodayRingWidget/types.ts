import type { WidgetTheme } from "../theme";
import type { TodayRingViewModel } from "@keylow/core/widgets";

export type TodayRingWidgetProps = Readonly<{ viewModel: TodayRingViewModel; theme: WidgetTheme }>;
