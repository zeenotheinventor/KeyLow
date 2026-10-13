/**
 * Text input with label, helper and error; numeric input with unit suffix
 * @startingPoint section="Forms" subtitle="Text input with label, helper and error; numeric input with unit suffix" viewport="360x100"
 */
export interface InputProps {
  label: string;
  helper?: string;
  /** Replaces the helper, turns the border danger and announces via role="alert". */
  error?: string;
  disabled?: boolean;
  value?: string;
  defaultValue?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  type?: string;
  id?: string;
}
export interface NumericInputProps extends Omit<InputProps, 'type'> {
  /** Unit suffix shown muted at the trailing edge: g, kcal, kg, ml. */
  unit?: string;
}
export declare function NumericInput(props: NumericInputProps): JSX.Element;
export declare function Input(props: InputProps): JSX.Element;
