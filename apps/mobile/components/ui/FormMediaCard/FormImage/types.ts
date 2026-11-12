import type { ReactNode } from "react";

export type FormImageProps = {
  url: string;
  /** The accessible name of the image. */
  label: string;
  /** The size of the image and of the tile that replaces it, as classes: `h-[72px] w-[128px]`, or an aspect ratio and `w-full`. */
  sizeClassName: string;
  /** Drawn over the image while it is there, such as the play glyph, and gone with it when it fails. */
  children?: ReactNode;
};
