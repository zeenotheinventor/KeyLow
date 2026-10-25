import type { BodyCompositionAccess } from "../../lib/health";
import type { WeightRange } from "@keylow/core/weight";

export type BodyCompositionSectionProps = {
  /** Which of body fat and lean mass Ki-Lo may read. The section reads only the kinds that are allowed. */
  access: BodyCompositionAccess;
  /** The range chosen on the weight chart's range control, which words each card's change and sets its line. */
  range: WeightRange;
  /** Today in the profile's time zone, `YYYY-MM-DD`. */
  today: string;
  /**
   * True while the trend card draws the composition view above the section. The section then draws only its
   * heading, its cards and the compact prompt for a kind that cannot be read, since the view draws the full
   * prompts, the loading status, the error prompt and the lean mass caption. Defaults to false.
   */
  isUnderComposition?: boolean;
};
