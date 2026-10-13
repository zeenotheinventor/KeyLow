/**
 * Card on the surface stack with elevation and the confirmation slash flourish
 * @startingPoint section="Surfaces" subtitle="Card on the surface stack with elevation and the confirmation slash flourish" viewport="360x160"
 */
export interface CardProps {
  /** surface: sits on --background. raised: sits on a --surface. */
  level?: 'surface' | 'raised';
  padding?: string;
  title?: React.ReactNode;
  children?: React.ReactNode;
  /** Change this value (e.g. increment) to play the diagonal accent slash once. */
  flourish?: number | boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
}

export declare function Card(props: CardProps): JSX.Element;
