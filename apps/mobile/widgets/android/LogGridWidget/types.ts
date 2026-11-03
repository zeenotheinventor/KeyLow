import type { WidgetTheme } from "../theme";
import type { LogGridViewModel } from "@keylow/core/widgets";

export type LogGridWidgetProps = Readonly<{ viewModel: LogGridViewModel; theme: WidgetTheme }>;
