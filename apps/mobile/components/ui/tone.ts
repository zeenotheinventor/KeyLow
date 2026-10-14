import type { ColorName } from "@keylow/tokens";

/**
 * The foreground colours a kit primitive can take. Each is a token: `primary`, `secondary` and `muted`
 * are the three text levels, and `accent-foreground` and `on-status` are what sits on an accent fill
 * and on a status fill. Lime and the status colours are never text in light mode, so they are fills
 * with one of these on top (Q14).
 */
export type Tone = "primary" | "secondary" | "muted" | "accent-foreground" | "on-status";

/** For a primitive that takes its colour from a class. The classes are written out so Tailwind sees them. */
export const toneClassName: Record<Tone, string> = {
  primary: "text-text-primary",
  secondary: "text-text-secondary",
  muted: "text-text-muted",
  "accent-foreground": "text-accent-foreground",
  "on-status": "text-text-on-status",
};

/** For a native prop that cannot take a class, such as an icon's colour: the token to read from `useTheme().colors`. */
export const toneColorName: Record<Tone, ColorName> = {
  primary: "text-primary",
  secondary: "text-secondary",
  muted: "text-muted",
  "accent-foreground": "accent-foreground",
  "on-status": "text-on-status",
};
