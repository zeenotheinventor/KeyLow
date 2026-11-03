import type { WidgetTheme } from "../theme";
import type { TrainingViewModel } from "@keylow/core/widgets";

export type TrainingWidgetProps = Readonly<{ viewModel: TrainingViewModel; theme: WidgetTheme }>;
