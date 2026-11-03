import type { WidgetTheme } from "../../theme";
import type { WidgetStatus } from "@keylow/core/widgets";

export type StatusLineProps = Readonly<{ status: WidgetStatus; theme: WidgetTheme }>;
