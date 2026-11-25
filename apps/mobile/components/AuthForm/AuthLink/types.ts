export type AuthLinkProps = {
  /** The link's words, from `@keylow/core/copy`. */
  label: string;
  /** What pressing it does. Wrapped in a router `Link` with `asChild`, the link hands its navigation here. */
  onPress?: (() => void) | undefined;
};
