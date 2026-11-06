import type { AmountDraft } from "../useAmountDraft";
import type { PortionTimeProps } from "@/components/diary/PortionFields";
import type { IconButtonProps } from "@/components/ui/IconButton";
import type { Ref } from "react";

export type PortionStepProps = PortionTimeProps & {
  draft: AmountDraft;
  /**
   * The Copy to your foods link of a food that needs review opens in a new tab, so the screen behind the
   * dialog, a recipe with unsaved changes, is not left. The diary leaves it in the same tab.
   */
  opensReviewInNewTab?: boolean | undefined;
  /**
   * The line under the Results link, above what the amount comes to, such as "Last logged 50 g, yesterday"
   * for a food opened from Recent. Leave it out for a food opened from a search.
   */
  note?: string | undefined;
  /** The favourite heart, at the other end of the Results link's row. Left out while the food is not loaded. */
  favouriteHeart?: IconButtonProps | undefined;
  /** The Results link: back to the search, with what was typed still in it. */
  onBack: () => void;
  /** Reaches the amount field, so the cursor can start in it. */
  amountRef?: Ref<HTMLInputElement> | undefined;
};
