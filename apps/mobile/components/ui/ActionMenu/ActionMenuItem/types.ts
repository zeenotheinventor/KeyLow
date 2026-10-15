import type { IconName } from "../../Icon";

export type ActionMenuItemProps = {
  /** What the action does, as a short sentence case name, such as "Copy yesterday". It is also the item's key, so no two items share one. */
  label: string;
  icon: IconName;
  /** A line under the label, such as the reason the item is disabled. It stays readable when the item is dimmed. */
  caption?: string | undefined;
  /** Dims the icon and the label to 40 percent and stops the item responding. The caption is not dimmed. */
  disabled?: boolean | undefined;
  /** Draws the icon and the label in the danger colour, for an action that removes something. */
  destructive?: boolean | undefined;
  onPress: () => void;
};
