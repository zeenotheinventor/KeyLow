import type { Food, OffCandidate } from "@keylow/core/schemas";

export type OffCandidateListProps = {
  candidates: OffCandidate[];
  /** The text searched for, whose words are written in bold in each name. */
  query: string;
  /** Draws a row with the serving its product opens on, where it has one, as the add dialog's rows do. */
  showsServings?: boolean;
  /** Where a saved product goes. Leave it out to open the food's page. */
  onOpenFood?: (food: Food) => void;
};
