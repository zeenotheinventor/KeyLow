import type { WeighIn } from "@keylow/api-client";

export type WeighInDialogProps = {
  /**
   * The weigh-in to open. Leave it out to add one. A manual one is edited and can be deleted, an imported one
   * can only be deleted.
   */
  weighIn?: WeighIn | undefined;
  /** Cancel, Close, Escape, a press on the dimmed page, or a save or delete that went through. */
  onClose: () => void;
};
