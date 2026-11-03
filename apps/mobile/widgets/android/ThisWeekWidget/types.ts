import type { WidgetTheme } from "../theme";
import type { ThisWeekViewModel } from "@keylow/core/widgets";

export type ThisWeekWidgetProps = Readonly<{ viewModel: ThisWeekViewModel; theme: WidgetTheme }>;
