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
        // The quiet add button of a food row. The button is the 44 px hit area and draws nothing
        // itself. It has no border, so its pseudo elements measure from its 44 px edge: the 32 px
        // circle with its 1 px border is one, and the hover and press tint fills the same circle.
        // It is always the 44 px square, whatever the size or iconOnly, so it cannot be drawn as a wide pill.
        ring: "rounded-pill border-0 bg-transparent text-text-secondary before:inset-1.5 before:rounded-pill after:pointer-events-none after:absolute after:inset-1.5 after:rounded-pill after:border after:border-border",
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
      // Only the ghost variant takes a tone. Any other variant keeps its own colour.
      tone: {
        danger: "",
      },
    },
    compoundVariants: [
      // The destructive action that sits under the main one, such as Delete beside Save: the label and
      // the icon in the danger colour on the plain background, as the M3 boards draw it in both themes.
      { variant: "ghost", tone: "danger", className: "text-danger" },
      { iconOnly: true, size: "sm", className: "w-control-sm" },
      { iconOnly: true, size: ["md", "default"], className: "w-control-md" },
      { iconOnly: true, size: "lg", className: "w-control-lg" },
      // Last, so the ring's 44 px square beats the icon only widths above.
      { variant: "ring", className: "h-control-md w-control-md px-0" },
    ],
    defaultVariants: {
      variant: "primary",
      size: "md",
      iconOnly: false,
    },
  },
);
