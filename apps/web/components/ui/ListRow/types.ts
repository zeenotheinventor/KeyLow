type ListRowContent = {
  title: string;
  subtitle?: string;
  /** The chevron marks a row that goes somewhere. Leave it off for an action such as signing out. */
  chevron?: boolean;
  disabled?: boolean;
  className?: string;
};

/** A row goes to a page, runs an action, or is plain text. It cannot do two of these. */
export type ListRowProps = ListRowContent &
  (
    | { href: string; onClick?: never }
    | { onClick: () => void; href?: never }
    | { href?: never; onClick?: never }
  );
