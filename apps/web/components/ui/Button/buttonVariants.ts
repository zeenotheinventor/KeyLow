import { cva } from "class-variance-authority";

// Heights are the design's control heights (36 dense web only, 44, 52). A leading icon is 20 px as
// the boards draw it, and 16 px in the dense size. The overlay is a pseudo
// element so hover and press tint the variant's own fill. The press scale and the spinner both
// have a prefers-reduced-motion fallback.
export const buttonVariants = cva(
  "relative inline-flex min-w-touch-target shrink-0 items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-medium border text-body-strong outline-none transition-transform duration-instant ease-spring before:pointer-events-none before:absolute before:inset-0 before:transition-colors before:duration-quick hover:before:bg-hover-overlay active:scale-press active:before:bg-press-overlay motion-reduce:active:scale-100 focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-focus-ring-offset disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0",
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
        sm: "h-control-sm px-3 [&_svg]:size-4",
        md: "h-control-md px-4 [&_svg]:size-5",
        lg: "h-control-lg px-5 [&_svg]:size-5",
        default: "h-control-md px-4 [&_svg]:size-5",
      },
      iconOnly: {
        true: "px-0",
        false: "",
      },
    },
    compoundVariants: [
      { iconOnly: true, size: "sm", className: "w-control-sm" },
      { iconOnly: true, size: ["md", "default"], className: "w-control-md" },
      { iconOnly: true, size: "lg", className: "w-control-lg" },
    ],
    defaultVariants: {
      variant: "primary",
      size: "md",
      iconOnly: false,
    },
  },
);
