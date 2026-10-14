import type { IconName } from "../ui";

export type PlaceholderScreenProps = {
  /** The screen's name, written as its heading. */
  title: string;
  /** The icon in the tile above "Coming soon". */
  icon: IconName;
  /** The sentence under "Coming soon", which says what the screen will show. */
  body?: string | undefined;
};
