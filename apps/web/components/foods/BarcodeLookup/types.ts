import type { Food } from "@keylow/core/schemas";

/** A valid barcode the user asked to look up. `attempt` counts the requests, from 1. */
export type BarcodeLookupRequest = {
  code: string;
  attempt: number;
};

export type BarcodeLookupProps = {
  /**
   * Called with the food a code finds, in place of opening the Add food dialog on it. A panel given it
   * is inside a page that must not be left, such as the recipe's Add ingredient dialog, so a code nobody
   * has offers to create the food in a new tab.
   */
  onFound?: ((food: Food) => void) | undefined;
  /** Called when the user closes the panel. */
  onClose: () => void;
  /** The day a found food is added to, `YYYY-MM-DD`. Left out, it is today. */
  day?: string | undefined;
};
