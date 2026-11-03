import type { WidgetTheme } from "../theme";
import type { MessageViewModel } from "@keylow/core/widgets";

export type MessageWidgetProps = Readonly<{ viewModel: MessageViewModel; theme: WidgetTheme }>;
