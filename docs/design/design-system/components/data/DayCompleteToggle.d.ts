/**
 * Day complete toggle and the "n incomplete days this week" chip
 * @startingPoint section="Data" subtitle="Day complete toggle and the "n incomplete days this week" chip" viewport="360x120"
 */
export interface DayCompleteToggleProps {
  complete?: boolean;
  onChange?: (complete: boolean) => void;
  disabled?: boolean;
  style?: React.CSSProperties;
}
export interface IncompleteDaysChipProps {
  count?: number;
  onPress?: () => void;
  style?: React.CSSProperties;
}
export declare function IncompleteDaysChip(props: IncompleteDaysChipProps): JSX.Element;
export declare function DayCompleteToggle(props: DayCompleteToggleProps): JSX.Element;
