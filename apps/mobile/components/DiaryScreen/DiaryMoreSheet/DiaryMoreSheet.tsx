import { DIARY_ACTIONS, DIARY_MORE_LABEL } from "@keylow/core/copy";

import { ActionMenu, BottomSheet } from "../../ui";

import type { DiaryMoreSheetProps } from "./types";

/**
 * The More button's sheet: the action menu in a bottom sheet, with the one item, Copy yesterday. The
 * item is disabled with the caption "Nothing logged yesterday" when there is nothing to copy.
 */
export function DiaryMoreSheet({
  open,
  onClose,
  isYesterdayEmpty,
  isCopyDisabled,
  onCopyYesterday,
}: DiaryMoreSheetProps) {
  return (
    <BottomSheet label={DIARY_MORE_LABEL} open={open} onClose={onClose}>
      <ActionMenu
        items={[
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
