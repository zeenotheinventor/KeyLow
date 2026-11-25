import type * as React from "react";

export type AuthCardProps = {
  /** The page's heading, under the Ki-Lo mark. A card that carries its own title leaves it out, and the mark with it. */
  heading?: string;
  /** One sentence under the heading. */
  caption?: string;
  children: React.ReactNode;
};
