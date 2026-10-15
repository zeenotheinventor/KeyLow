export type DiaryMoreSheetProps = {
  open: boolean;
  onClose: () => void;
  /** Yesterday has nothing to copy: the item says so under its label. */
  isYesterdayEmpty: boolean;
  /** Dims the item and stops it responding, such as while offline or while a copy is under way. */
  isCopyDisabled: boolean;
  /** Copies yesterday's whole day. The sheet does not close itself. */
  onCopyYesterday: () => void;
};
