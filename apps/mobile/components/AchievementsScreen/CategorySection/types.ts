import type { AchievementId, OverviewCategory } from "@keylow/core";

export type CategorySectionProps = {
  category: OverviewCategory;
  onOpenBadge: (id: AchievementId) => void;
};
