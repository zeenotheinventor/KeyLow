/**
 * Calorie ring: eaten, target and remaining, with overflow past 100 %
 * @startingPoint section="Data" subtitle="Calorie ring: eaten, target and remaining, with overflow past 100 %" viewport="260x260"
 */
export interface CalorieRingProps {
  eaten: number;
  target: number;
  size?: number;
  stroke?: number;
  label?: string;
  /** Appends "(est.)" to the target line; targets are always estimates. */
  estimate?: boolean;
  style?: React.CSSProperties;
}
/** Counts a number towards target; returns [value, flashKey]. */
export declare function useCountUp(target: number, duration?: number): [number, number];
export declare function CalorieRing(props: CalorieRingProps): JSX.Element;
