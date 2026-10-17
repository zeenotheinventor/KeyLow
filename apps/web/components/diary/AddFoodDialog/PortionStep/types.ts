import type { AmountDraft } from "../useAmountDraft";
import type { PortionTimeProps } from "@/components/diary/PortionFields";
import type { Ref } from "react";

export type PortionStepProps = PortionTimeProps & {
  draft: AmountDraft;
  /** A save of the amount failed. The banner says what to do and not what the amount was. */
  hasSaveError?: boolean | undefined;
  /**
   * The Copy to your foods link of a food that needs review opens in a new tab, so the screen behind the
   * dialog, a recipe with unsaved changes, is not left. The diary leaves it in the same tab.
   */
  opensReviewInNewTab?: boolean | undefined;
  /** The Results link: back to the search, with what was typed still in it. */
  onBack: () => void;
  /** Reaches the amount field, so the cursor can start in it. */
  amountRef?: Ref<HTMLInputElement> | undefined;
};
