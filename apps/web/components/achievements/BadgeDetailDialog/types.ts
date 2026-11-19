import type { AchievementId } from "@keylow/core";
import type { WebBadgeDetail } from "@keylow/core/copy";

export type BadgeDetailDialogProps = {
  id: AchievementId;
  detail: WebBadgeDetail;
  onClose: () => void;
};
