import type { buttonVariants } from "./buttonVariants";
import type { VariantProps } from "class-variance-authority";
import type * as React from "react";

type ButtonVariants = VariantProps<typeof buttonVariants>;

/**
 * The tone is the ghost variant's alone: `danger` writes the label and icon in the danger colour on the plain
 * background, for a destructive action under the main one, such as Delete beside Save. Any other variant
 * keeps its own colour, so the types refuse a tone on it.
 */
type ButtonTone =
  | { variant: "ghost"; tone?: "danger" | undefined }
  | { variant?: Exclude<ButtonVariants["variant"], "ghost">; tone?: never };

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  Omit<ButtonVariants, "variant" | "tone"> &
  ButtonTone & {
    /** Renders the button's styles on a single child such as a link. It has no label to hide, so `loading` does nothing. */
    asChild?: boolean;
    /** Keeps the label's width, hides it and shows a spinner. The button is inert until it ends. */
    loading?: boolean;
    /** What a screen reader hears while loading, such as "Signing in". */
    loadingLabel?: string;
  };
