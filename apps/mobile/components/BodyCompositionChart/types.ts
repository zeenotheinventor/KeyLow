import type { BodyCompositionChartData, BodySplitPoint } from "@keylow/core/weight";

export type {
  BodyCompositionChartAxis,
  BodyCompositionChartData,
  BodyCompositionChartPlot,
  BodyCompositionChartPoint,
} from "@keylow/core/weight";

/** One day of the composition trend. This is core's `BodySplitPoint`, so the view passes core's output as it is. */
export type CompositionInputPoint = BodySplitPoint;

export type BodyCompositionChartProps = {
  data: BodyCompositionChartData;
  /** Draws both lines dashed while the trend has too few readings to trust. */
  isSettling: boolean;
  /** What a screen reader says for the whole figure, which is one image. The caller writes it, because the words are copy. */
  name: string;
};
