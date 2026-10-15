import type { IconName } from "../Icon";

/**
 * The two idioms the design system keeps. `ios` is a 49 point bar, counting its hairline, with an accent underline that slides
 * under the selected destination. `android` is a 64 point bar on the raised surface with the selected
 * icon in a pill.
 */
export type TabBarPlatform = "ios" | "android";

export type TabBarTab = {
  key: string;
  /** The destination's name, written under its icon and read as the tab's accessible name. */
  label: string;
  icon: IconName;
};

export type TabBarProps = {
  /** The destinations from left to right. The add button sits in the middle of them. */
  tabs: readonly TabBarTab[];
  /** The key of the selected destination. When it is not one of the `tabs`, none is drawn selected. */
  activeKey: string | undefined;
  onSelect: (key: string) => void;
  /** The add button's accessible name, such as "Find food". */
  addLabel: string;
  /** The add button is an action and not a destination, so it never shows as selected and selects nothing. */
  onAddPress: () => void;
  /** Dims the add button and stops it responding, such as while offline. Defaults to false. */
  addDisabled?: boolean | undefined;
  /** Names the bar for a screen reader, such as "Main". */
  label: string;
  /** The safe area under the bar, which the bar adds below its own height. Defaults to 0. */
  bottomInset?: number;
  /** Defaults to the idiom of the platform the app runs on. */
  platform?: TabBarPlatform | undefined;
};
