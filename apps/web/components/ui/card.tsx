import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

// Level picks the surface by what the card sits on: the page background, or another surface. The
// header, content and footer parts from the earlier card carry their own padding, so a card made of
// them gives its own padding up. They mark themselves with data-slot for that.
const cardVariants = cva(
  "relative overflow-hidden rounded-large border border-border text-text-primary shadow-card",
  {
    variants: {
      level: {
        surface: "bg-surface",
        raised: "bg-surface-raised",
      },
      padding: {
        default: "p-4 has-[>[data-slot=card-part]]:p-0",
        none: "",
      },
    },
    defaultVariants: { level: "surface", padding: "default" },
  },
);

type CardProps = Omit<React.HTMLAttributes<HTMLDivElement>, "title"> &
  VariantProps<typeof cardVariants> & {
    /** A level two heading at the top of the card. */
    title?: React.ReactNode;
    /** Renders the card's styles on a single child such as a `section` or a `form`, which brings its own content and so its own title. */
    asChild?: boolean;
  };

const Card = React.forwardRef<HTMLDivElement, CardProps>(
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

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="card-part"
      className={cn("flex flex-col space-y-1.5 p-6", className)}
      {...props}
    />
  ),
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("font-semibold leading-none tracking-tight", className)}
      {...props}
    />
  ),
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("text-sm text-text-muted", className)} {...props} />
  ),
);
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} data-slot="card-part" className={cn("p-6 pt-0", className)} {...props} />
  ),
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="card-part"
      className={cn("flex items-center p-6 pt-0", className)}
      {...props}
    />
  ),
);
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
export type { CardProps };
