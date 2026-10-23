export type StatTileProps = {
  label: string;
  value: string;
  /** The line under the value, or null for none. */
  caption: string | null;
  /** The classes of a small swatch drawn before the caption, such as its background colour. Left out, none is drawn. */
  swatchClassName?: string | undefined;
};
