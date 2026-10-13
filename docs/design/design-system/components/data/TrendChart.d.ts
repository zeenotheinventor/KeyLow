/**
 * Trend chart: light axes, raw points, bold smoothed trend, confidence band, range selector
 * @startingPoint section="Data" subtitle="Trend chart: light axes, raw points, bold smoothed trend, confidence band, range selector" viewport="360x240"
 */
export interface TrendChartProps {
  data: Array<{ day: number; value: number; label?: string }>;
  unit?: 'kg' | 'lb' | 'st';
  /** Days shown: 7, 30, 90, 365. */
  range?: number;
  onRangeChange?: (days: number) => void;
  width?: number;
  height?: number;
  /** EMA smoothing factor; matches the engine's trend alpha (0.10). */
  alpha?: number;
  /** Half-height of the confidence band in data units. */
  bandSd?: number;
  showRange?: boolean;
  title?: string;
  style?: React.CSSProperties;
}

export declare function TrendChart(props: TrendChartProps): JSX.Element;
