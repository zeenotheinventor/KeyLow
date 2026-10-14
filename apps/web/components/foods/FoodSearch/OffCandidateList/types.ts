import type { OffCandidate } from "@keylow/core/schemas";

export type OffCandidateListProps = {
  candidates: OffCandidate[];
  /** The text searched for, whose words are written in bold in each name. */
  query: string;
};
