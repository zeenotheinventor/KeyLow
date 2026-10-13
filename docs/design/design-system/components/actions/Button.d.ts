/**
 * Primary, secondary, destructive and ghost buttons with sizes, disabled and loading states
 * @startingPoint section="Actions" subtitle="Primary, secondary, destructive and ghost buttons with sizes, disabled and loading states" viewport="360x120"
 */
export interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'destructive' | 'ghost';
  /** sm 36 (web-dense only), md 44 (default, touch minimum), lg 52. */
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  /** Keeps the label's width, hides it and shows a spinner. */
  loading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit';
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

export declare function Button(props: ButtonProps): JSX.Element;
