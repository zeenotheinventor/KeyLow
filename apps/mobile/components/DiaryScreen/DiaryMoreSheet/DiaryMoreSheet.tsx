import { DIARY_ACTIONS, DIARY_MORE_LABEL, DIARY_PLAN_ITEM } from "@keylow/core/copy";

import { ActionMenu, BottomSheet } from "../../ui";

import type { DiaryMoreSheetProps } from "./types";

/**
 * The More button's sheet: the action menu in a bottom sheet, with Meal plan first (it opens the Plan screen) and
 * then Copy yesterday. Copy yesterday is disabled with the caption "Nothing logged yesterday" when there is nothing to copy.
 */
export function DiaryMoreSheet({
  open,
  onClose,
  isYesterdayEmpty,
  isCopyDisabled,
  onCopyYesterday,
  onOpenPlan,
}: DiaryMoreSheetProps) {
  return (
    <BottomSheet label={DIARY_MORE_LABEL} open={open} onClose={onClose}>
      <ActionMenu
        items={[
          {
            label: DIARY_PLAN_ITEM.label,
            icon: "CalendarDays",
            caption: DIARY_PLAN_ITEM.caption,
            onPress: onOpenPlan,
          },
          {
            label: DIARY_ACTIONS.copyYesterday,
            icon: "Copy",
            caption: isYesterdayEmpty ? DIARY_ACTIONS.nothingLoggedYesterday : undefined,
            disabled: isYesterdayEmpty || isCopyDisabled,
            onPress: onCopyYesterday,
          },
        ]}
      />
    </BottomSheet>
  );
}
