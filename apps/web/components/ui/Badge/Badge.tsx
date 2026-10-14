import type { BadgeProps, BadgeSource, BadgeTone } from "./types";

import { cn } from "@/lib/utils";

const sourceNames = {
  off: "Open Food Facts",
  cofid: "UK CoFID",
  user: "Yours",
} as const satisfies Record<BadgeSource, string>;

// A status tone is the tone's muted fill with the tone's colour as the text. In light mode that
// colour is too weak for small text, so the text falls back to the primary text colour and the
// colour is kept as the fill and the dot. Each class is written out whole so Tailwind can see it.
const tones = {
  neutral: { surface: "bg-surface-sheet text-text-secondary", dot: "bg-text-secondary" },
  accent: {
    surface: "bg-accent-muted text-accent [[data-theme=light]_&]:text-text-primary",
    dot: "bg-accent",
  },
  success: {
    surface: "bg-success-muted text-success [[data-theme=light]_&]:text-text-primary",
    dot: "bg-success",
  },
  warning: {
    surface: "bg-warning-muted text-warning [[data-theme=light]_&]:text-text-primary",
    dot: "bg-warning",
  },
  danger: {
    surface: "bg-danger-muted text-danger [[data-theme=light]_&]:text-text-primary",
    dot: "bg-danger",
  },
  protein: {
    surface: "bg-protein-muted text-protein [[data-theme=light]_&]:text-text-primary",
    dot: "bg-protein",
  },
  carbs: {
    surface: "bg-carbs-muted text-carbs [[data-theme=light]_&]:text-text-primary",
    dot: "bg-carbs",
  },
  fat: {
    surface: "bg-fat-muted text-fat [[data-theme=light]_&]:text-text-primary",
    dot: "bg-fat",
  },
  calories: {
    surface: "bg-calories-muted text-calories [[data-theme=light]_&]:text-text-primary",
    dot: "bg-calories",
  },
} as const satisfies Record<BadgeTone, { surface: string; dot: string }>;

const frame =
  "inline-flex h-5 items-center gap-[5px] whitespace-nowrap rounded-pill border px-2 text-caption";

/** Names where a food came from, or a short status. The text always carries the meaning. */
export function Badge(props: BadgeProps) {
  if (props.kind === "source") {
    // `kind` picks the branch and is not a DOM attribute, so it is taken out of the rest.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { kind, source, className, ...rest } = props;
    return (
      <span className={cn(frame, "border-border", tones.neutral.surface, className)} {...rest}>
        {sourceNames[source]}
      </span>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { kind, tone = "neutral", dot, className, children, ...rest } = props;
  return (
    <span className={cn(frame, "border-transparent", tones[tone].surface, className)} {...rest}>
      {dot === true && (
        <span aria-hidden="true" className={cn("size-[6px] rounded-pill", tones[tone].dot)} />
      )}
      {children}
    </span>
  );
}
