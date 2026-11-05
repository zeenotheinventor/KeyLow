import type { HeatSet } from "@keylow/core/training";
import type { ReactNode } from "react";

/**
 * Where the card is drawn. The side card of the session page has its own heading and bigger figures
 * stacked over the list. The summary, on the finish dialog and the session detail, is the Muscles trained
 * card of the phone: the figures beside a list whose rows carry the swatch of their heat step.
 */
export type SessionMusclesCardVariant = "side" | "summary";

export type SessionMusclesCardProps = {
  variant: SessionMusclesCardVariant;
  /** The sets of the session, and of the session alone: the card shows what it did, with no fatigue from earlier days. */
  sets: readonly HeatSet[];
  /** The moment the figures' heat is read at, as an ISO timestamp with a zone. */
  at: string;
  /**
   * What closes the side card, under the list: the page's Add exercise button. Without a card to draw
   * (no working set yet, or the stored figure not read) it is drawn alone, so the page always has it once.
   */
  action?: ReactNode;
};
