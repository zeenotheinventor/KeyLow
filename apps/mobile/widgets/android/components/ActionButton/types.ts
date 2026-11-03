import type { WidgetTheme } from "../../theme";
import type { WidgetButton } from "@keylow/core/widgets";

export type ActionButtonProps = Readonly<{
  button: WidgetButton;
  theme: WidgetTheme;
  /** Shares the row equally with the other buttons in it. */
  isFlexible?: boolean;
}>;
