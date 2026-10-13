/**
 * Toast that cuts in from the edge at an angle, with an optional Undo action
 * @startingPoint section="Feedback" subtitle="Toast that cuts in from the edge at an angle, with an optional Undo action" viewport="360x120"
 */
export interface ToastProps {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  tone?: 'neutral' | 'success' | 'warning' | 'danger';
  icon?: string;
  open?: boolean;
  onClose?: () => void;
  /** Auto-dismiss in ms when there is no action. */
  duration?: number;
  position?: 'absolute' | 'fixed';
  style?: React.CSSProperties;
}

export declare function Toast(props: ToastProps): JSX.Element;
