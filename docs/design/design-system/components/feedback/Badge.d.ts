/**
 * Source badges (Open Food Facts, UK CoFID, Yours) and toned status badges
 * @startingPoint section="Feedback" subtitle="Source badges (Open Food Facts, UK CoFID, Yours) and toned status badges" viewport="360x40"
 */
export interface BadgeProps {
  kind?: 'source' | 'status';
  /** For kind="source": off | cofid | user. */
  source?: 'off' | 'cofid' | 'user' | string;
  /** For kind="status". */
  tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'protein' | 'carbs' | 'fat' | 'calories';
  dot?: boolean;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

export declare function Badge(props: BadgeProps): JSX.Element;
