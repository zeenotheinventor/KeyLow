import type { RecipeRefreshDiff } from "@keylow/api-client";
import type { Ref } from "react";

export type RecipeRefreshContentProps = {
  diff: RecipeRefreshDiff;
  /** The intro line, so the dialog can start focus there. */
  introRef: Ref<HTMLParagraphElement>;
  /** Done, the only button when there was nothing to apply. */
  onDone: () => void;
};
