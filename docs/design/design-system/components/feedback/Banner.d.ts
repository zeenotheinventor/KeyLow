/**
 * "Needs review" banner for incomplete nutrition data; quiet offline banner
 * @startingPoint section="Feedback" subtitle=""Needs review" banner for incomplete nutrition data; quiet offline banner" viewport="360x80"
 */
export interface BannerProps {
  variant?: 'review' | 'offline' | 'info';
  title?: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
  style?: React.CSSProperties;
}

export declare function Banner(props: BannerProps): JSX.Element;
