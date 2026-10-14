import type { buttonVariants } from "./buttonVariants";
import type { VariantProps } from "class-variance-authority";
import type * as React from "react";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    /** Renders the button's styles on a single child such as a link. It has no label to hide, so `loading` does nothing. */
    asChild?: boolean;
    /** Keeps the label's width, hides it and shows a spinner. The button is inert until it ends. */
    loading?: boolean;
    /** What a screen reader hears while loading, such as "Signing in". */
    loadingLabel?: string;
  };
