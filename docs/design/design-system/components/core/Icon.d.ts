/** Lucide icon rendered from the global `lucide` UMD bundle, sized by icon tokens and stroked with --icon-stroke. */
export interface IconProps {
  /** Lucide icon name, PascalCase ("BookOpen") or kebab ("book-open"). */
  name: string;
  /** Icon size token: sm 16, md 20, lg 24, xl 32 — or a CSS length. */
  size?: 'sm' | 'md' | 'lg' | 'xl' | string;
  color?: string;
  /** Accessible label; omit for decorative icons. */
  label?: string;
  style?: React.CSSProperties;
}
export declare function Icon(props: IconProps): JSX.Element;
