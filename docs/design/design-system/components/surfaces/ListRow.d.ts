/**
 * List row with leading icon, title, subtitle, trailing value and chevron; source-badge variant; swipe-to-delete
 * @startingPoint section="Surfaces" subtitle="List row with leading icon, title, subtitle, trailing value and chevron; source-badge variant; swipe-to-delete" viewport="360x60"
 */
export interface ListRowProps {
  /** Lucide icon name or a node. */
  icon?: string | React.ReactNode;
  title: string;
  subtitle?: string;
  /** Formatted trailing value (use Format.calories / Format.grams). */
  value?: string | number;
  unit?: string;
  chevron?: boolean;
  /** Adds a source badge: off | cofid | user. */
  source?: 'off' | 'cofid' | 'user';
  onPress?: () => void;
  /** Shows the swiped-left state with the Delete action revealed. */
  revealDelete?: boolean;
  onDelete?: () => void;
  disabled?: boolean;
  /** Stagger index when animate is true. */
  index?: number;
  /** Cut in from the side on mount, staggered by --stagger. */
  animate?: boolean;
  style?: React.CSSProperties;
}

export declare function ListRow(props: ListRowProps): JSX.Element;
