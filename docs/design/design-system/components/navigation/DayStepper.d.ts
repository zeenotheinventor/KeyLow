/**
 * Day stepper: yesterday / today / date picker
 * @startingPoint section="Navigation" subtitle="Day stepper: yesterday / today / date picker" viewport="360x60"
 */
export interface DayStepperProps {
  date: Date;
  today?: Date;
  onChange?: (date: Date) => void;
  onPickDate?: () => void;
  style?: React.CSSProperties;
}

export declare function DayStepper(props: DayStepperProps): JSX.Element;
