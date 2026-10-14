import { Slot } from "@radix-ui/react-slot";
import * as React from "react";

import { buttonVariants } from "./buttonVariants";

import type { ButtonProps } from "./types";

import { cn } from "@/lib/utils";

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

export { Button };
