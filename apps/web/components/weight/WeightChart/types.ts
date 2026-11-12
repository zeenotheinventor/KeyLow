import type { WeightChartData } from "@keylow/core/weight";

export type WeightChartProps = {
  data: WeightChartData;
  /** Draws the trend line dashed while the trend has too few readings to trust. */
  isSettling: boolean;
  /** What a screen reader says for the whole figure, which is one image. The caller writes it, because the words are copy. */
  name: string;
};

/** The drawing's box in CSS pixels, as the column and the breakpoint give it. */
export type ChartSize = {
  width: number;
  height: number;
};
