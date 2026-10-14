import type { TabBarPlatform, TabBarTab } from "../types";

export type TabItemProps = {
  tab: TabBarTab;
  isActive: boolean;
  platform: TabBarPlatform;
  onSelect: (key: string) => void;
};
