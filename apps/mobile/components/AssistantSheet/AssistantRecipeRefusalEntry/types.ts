import type { AssistantRecipeRefusal } from "@keylow/core";

export type AssistantRecipeRefusalEntryProps = {
  /** The adjustment the assistant refused, as the turn sent it and stored it. */
  refusal: AssistantRecipeRefusal;
};
