import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

// Heights are the design's control heights (36 dense web only, 44, 52). A leading icon is 20 px as
// the boards draw it, and 16 px in the dense size. The overlay is a pseudo
// element so hover and press tint the variant's own fill. The press scale and the spinner both
// have a prefers-reduced-motion fallback.
const buttonVariants = cva(
  "relative inline-flex min-w-[44px] shrink-0 items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-medium border text-body-strong outline-none transition-transform duration-instant ease-spring before:pointer-events-none before:absolute before:inset-0 before:transition-colors before:duration-quick hover:before:bg-hover-overlay active:scale-[0.96] active:before:bg-press-overlay motion-reduce:active:scale-100 focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-focus-ring-offset disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "border-transparent bg-accent text-accent-foreground",
        secondary: "border-border bg-surface-raised text-text-primary",
        destructive: "border-transparent bg-danger text-text-on-status",
        ghost: "border-transparent bg-transparent text-text-primary",
        // Names the screens use today. They resolve to the design's variants until the screen
        // tickets move over.
        default: "border-transparent bg-accent text-accent-foreground",
        outline: "border-border bg-surface-raised text-text-primary",
      },
      size: {
        sm: "h-[36px] px-3 [&_svg]:size-4",
        md: "h-[44px] px-4 [&_svg]:size-5",
        lg: "h-[52px] px-5 [&_svg]:size-5",
        default: "h-[44px] px-4 [&_svg]:size-5",
      },
      iconOnly: {
        true: "px-0",
        false: "",
      },
    },
    compoundVariants: [
      { iconOnly: true, size: "sm", className: "w-[36px]" },
      { iconOnly: true, size: ["md", "default"], className: "w-[44px]" },
      { iconOnly: true, size: "lg", className: "w-[52px]" },
    ],
    defaultVariants: {
      variant: "primary",
      size: "md",
      iconOnly: false,
    },
  },
);

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    /** Renders the button's styles on a single child such as a link. It has no label to hide, so `loading` does nothing. */
    asChild?: boolean;
    /** Keeps the label's width, hides it and shows a spinner. The button is inert until it ends. */
    loading?: boolean;
    /** What a screen reader hears while loading, such as "Signing in". */
    loadingLabel?: string;
  };

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      iconOnly,
      asChild = false,
      loading = false,
      loadingLabel = "Loading",
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    // Only a button that was disabled on purpose is dimmed. A loading one is inert too, but it
    // stays at full strength, as the login-pending board draws it.
    const classes = cn(
      buttonVariants({ variant, size, iconOnly, className }),
      disabled === true && "opacity-40",
    );

    if (asChild) {
      return (
        <Slot className={classes} ref={ref} {...props}>
          {children}
        </Slot>
      );
    }

    return (
      <button
        className={classes}
        ref={ref}
        disabled={disabled === true || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        <span aria-hidden={loading || undefined} className={cn("contents", loading && "invisible")}>
          {children}
        </span>
        {loading && (
          <span
            role="img"
            aria-label={loadingLabel}
            className="absolute size-[18px] animate-spin rounded-pill border-2 border-current border-r-transparent motion-reduce:animate-pulse"
          />
        )}
      </button>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
export type { ButtonProps };
