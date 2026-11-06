import type { BodyCompositionChartData } from "@keylow/core/weight";

export type BodyCompositionChartProps = {
  data: BodyCompositionChartData;
  /** Draws both lines dashed while the trend has too few readings to trust. */
  isSettling: boolean;
  /** What a screen reader says for the whole figure, which is one image. The caller writes it, because the words are copy. */
  name: string;
};
