import type { BadgeDetail } from "@keylow/core";

export type BadgeDetailSheetProps = {
  open: boolean;
  onClose: () => void;
  detail: BadgeDetail;
};
