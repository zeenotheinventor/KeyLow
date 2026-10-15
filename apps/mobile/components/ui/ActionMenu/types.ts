import type { ActionMenuItemProps } from "./ActionMenuItem";

export type ActionMenuProps = {
  /** A heading over the items. Leave it out when the sheet that holds the menu has its own. */
  title?: string | undefined;
  /** The actions, top to bottom. Each is its own button. */
  items: readonly ActionMenuItemProps[];
};
