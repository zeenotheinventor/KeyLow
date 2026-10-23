import type { WeighIn } from "@keylow/api-client";

export type WeighInSheetProps = {
  open: boolean;
  /**
   * The weigh-in to open. Leave it out to add one. A manual one is edited and can be deleted, an imported one
   * can only be deleted.
   */
  weighIn?: WeighIn | undefined;
  /** Cancel, the dim, a drag down, the screen reader's escape, the back button, or a save or delete that went through. */
  onClose: () => void;
};
