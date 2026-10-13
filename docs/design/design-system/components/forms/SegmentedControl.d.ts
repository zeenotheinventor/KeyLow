/**
 * Segmented control whose highlight slides with a brief skew
 * @startingPoint section="Forms" subtitle="Segmented control whose highlight slides with a brief skew" viewport="360x60"
 */
export interface SegmentedControlProps {
  options: Array<{ value: string | number; label: string } | string>;
  value: string | number;
  onChange?: (value: string | number) => void;
  /** neutral (default): text-primary highlight. accent: accent highlight for a true active state. */
  tone?: 'neutral' | 'accent';
  size?: 'sm' | 'md';
  fullWidth?: boolean;
  label?: string;
}

export declare function SegmentedControl(props: SegmentedControlProps): JSX.Element;
