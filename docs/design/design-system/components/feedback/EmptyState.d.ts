/**
 * Empty state, and error state with retry
 * @startingPoint section="Feedback" subtitle="Empty state, and error state with retry" viewport="360x220"
 */
export interface EmptyStateProps {
  icon?: string;
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
  style?: React.CSSProperties;
}
export interface ErrorStateProps {
  title?: string;
  body?: string;
  retryLabel?: string;
  onRetry?: () => void;
  compact?: boolean;
  style?: React.CSSProperties;
}
export declare function ErrorState(props: ErrorStateProps): JSX.Element;
export declare function EmptyState(props: EmptyStateProps): JSX.Element;
