export type AuthLinkTone = "accent" | "primary";

// Each ink is written out whole so Tailwind can see it. Accent is the look of every auth link. Primary is
// the one the boards draw for the Forgot password link and the forgot page's footer.
const inkClasses = {
  accent: "text-accent-ink",
  primary: "text-text-primary",
} as const satisfies Record<AuthLinkTone, string>;

export function authLinkClassFor(tone: AuthLinkTone = "accent"): string {
  return `rounded-small ${inkClasses[tone]} underline outline-none focus-visible:ring-2 focus-visible:ring-focus-ring`;
}

export const authLinkClass = authLinkClassFor();
