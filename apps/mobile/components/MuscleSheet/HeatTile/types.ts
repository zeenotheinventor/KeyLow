import type { HeatTileCopy } from "@keylow/core/copy";

export type HeatTileProps = {
  /** The tile's words, from core copy. */
  heat: HeatTileCopy;
  /** The heat step, 0 to 5, which picks the swatch before the step's name. */
  step: number;
};
