import type * as React from "react";

export type InlineStatusProps = {
  /** What is happening, such as "Searching your foods". */
  children: React.ReactNode;
  /** The search lists use the caption size and the barcode panel the 14 px body size, as the boards draw them. */
  size?: "caption" | "small";
};
