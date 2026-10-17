import type { RecipeRefreshDiff } from "@keylow/api-client";
import type { Ref } from "react";
import type { View } from "react-native";

export type RecipeRefreshContentProps = {
  diff: RecipeRefreshDiff;
  /** The intro line's view, so the screen can start a screen reader's focus there. */
  introRef: Ref<View>;
  /** Whether Apply is saving. The button then shows its spinner and does not respond. */
  isApplying: boolean;
  /** Offline, Apply is dimmed and does nothing. */
  isOnline: boolean;
  onApply: () => void;
  /** Cancel, and the way out when there was nothing to apply. */
  onCancel: () => void;
};
