type ListRowContent = {
  title: string;
  subtitle?: string | undefined;
  /** The chevron marks a row that goes somewhere. Leave it off for an action such as signing out. */
  chevron?: boolean;
  disabled?: boolean;
  className?: string;
};

/** A row goes to a page, runs an action, submits the form around it, or is plain text. It cannot do two of these. */
export type ListRowProps = ListRowContent &
  (
    | { href: string; onClick?: never; submit?: never }
    | { onClick: () => void; href?: never; submit?: never }
    | { submit: true; href?: never; onClick?: never }
    | { href?: never; onClick?: never; submit?: never }
  );
