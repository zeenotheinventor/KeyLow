/**
 * Loading skeleton shown only after 200 ms
 * @startingPoint section="Feedback" subtitle="Loading skeleton shown only after 200 ms" viewport="360x80"
 */
export interface SkeletonProps {
  variant?: 'text' | 'row' | 'ring' | 'block';
  width?: number | string;
  height?: number | string;
  lines?: number;
  /** Delay before showing; default --skeleton-delay (200 ms). */
  delay?: number;
  /** Skip the delay (specimens only). */
  immediate?: boolean;
  style?: React.CSSProperties;
}

export declare function Skeleton(props: SkeletonProps): JSX.Element;
