import type { Targets } from "@keylow/api-client";
import type { ReactNode } from "react";

export type EngineTargetsProps = {
  /** The current targets of the programme. */
  targets: Targets;
  /** The date the current targets began, `YYYY-MM-DD`, once it is known. Nothing is said of it before. */
  since: string | undefined;
  /** The Estimate my targets card, drawn under the values. */
  estimateCard: ReactNode;
  onOpenProgramme: () => void;
  onSetOwnTargets: () => void;
};
