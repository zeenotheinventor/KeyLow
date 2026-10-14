import type * as React from "react";

export type FoodFormPageProps = {
  /** What the way back says: "Back" over a form, "Back to foods" over a notice about a food that did not load. */
  backLabel: string;
  /** The heading of a form. Leave it out when the content brings its own, as a notice does. */
  title?: string;
  /** A sentence under the heading. */
  intro?: string;
  children: React.ReactNode;
};
