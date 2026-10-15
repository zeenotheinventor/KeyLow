import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import * as React from "react";

import type { CardProps } from "./types";

import { cn } from "@/lib/utils";

// Level picks the surface by what the card sits on: the page background, or another surface.
const cardVariants = cva(
  "relative overflow-hidden rounded-large border border-border text-text-primary shadow-card",
  {
    variants: {
      level: {
        surface: "bg-surface",
        raised: "bg-surface-raised",
      },
      padding: {
        default: "p-4",
        none: "",
      },
    },
    defaultVariants: { level: "surface", padding: "default" },
  },
);

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, level, padding, title, asChild = false, children, ...props }, ref) => {
    const classes = cn(cardVariants({ level, padding, className }));

    if (asChild) {
      return (
        <Slot ref={ref} className={classes} {...props}>
          {children}
        </Slot>
      );
    }

    return (
      <div ref={ref} className={classes} {...props}>
        {title !== undefined && <h2 className="mb-3 text-h2">{title}</h2>}
        {children}
      </div>
    );
  },
);
Card.displayName = "Card";
