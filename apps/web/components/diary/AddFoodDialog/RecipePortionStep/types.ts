import type { RecipePortionDraft } from "../useRecipePortionDraft";
import type { IconButtonProps } from "@/components/ui/IconButton";
import type { Ref } from "react";

export type RecipePortionStepProps = {
  draft: RecipePortionDraft;
  /** The favourite heart, at the other end of the Results link's row. */
  favouriteHeart?: IconButtonProps | undefined;
  /** The Results link: back to the search, with what was typed still in it. */
  onBack: () => void;
  /** What the link says. "Your plate" when the step edits a plate row. */
  backLabel?: string | undefined;
  /** Reaches the amount field, so the cursor can start in it. */
  amountRef?: Ref<HTMLInputElement> | undefined;
};
