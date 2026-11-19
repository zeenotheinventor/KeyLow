import type { TierColourToken } from "@keylow/core";

// Written out in full so Tailwind sees each class. The stop colour has no utility of its own, so it reads the
// theme variable the token utilities read. A presentation attribute cannot hold `var()` reliably.

// The fill of a mark, from the tier token.
export const fillClassNames: Readonly<Record<TierColourToken, string>> = {
  "tier-enamel": "fill-tier-enamel",
  "tier-bronze-hi": "fill-tier-bronze-hi",
  "tier-bronze-mid": "fill-tier-bronze-mid",
  "tier-bronze-lo": "fill-tier-bronze-lo",
  "tier-silver-hi": "fill-tier-silver-hi",
  "tier-silver-mid": "fill-tier-silver-mid",
  "tier-silver-lo": "fill-tier-silver-lo",
  "tier-gold-hi": "fill-tier-gold-hi",
  "tier-gold-mid": "fill-tier-gold-mid",
  "tier-gold-lo": "fill-tier-gold-lo",
  "tier-plat-a": "fill-tier-plat-a",
  "tier-plat-b": "fill-tier-plat-b",
  "tier-plat-c": "fill-tier-plat-c",
  "tier-plat-d": "fill-tier-plat-d",
  "tier-locked": "fill-tier-locked",
  "tier-locked-glyph": "fill-tier-locked-glyph",
};

// The stroke of a mark, from the tier token.
export const strokeClassNames: Readonly<Record<TierColourToken, string>> = {
  "tier-enamel": "stroke-tier-enamel",
  "tier-bronze-hi": "stroke-tier-bronze-hi",
  "tier-bronze-mid": "stroke-tier-bronze-mid",
  "tier-bronze-lo": "stroke-tier-bronze-lo",
  "tier-silver-hi": "stroke-tier-silver-hi",
  "tier-silver-mid": "stroke-tier-silver-mid",
  "tier-silver-lo": "stroke-tier-silver-lo",
  "tier-gold-hi": "stroke-tier-gold-hi",
  "tier-gold-mid": "stroke-tier-gold-mid",
  "tier-gold-lo": "stroke-tier-gold-lo",
  "tier-plat-a": "stroke-tier-plat-a",
  "tier-plat-b": "stroke-tier-plat-b",
  "tier-plat-c": "stroke-tier-plat-c",
  "tier-plat-d": "stroke-tier-plat-d",
  "tier-locked": "stroke-tier-locked",
  "tier-locked-glyph": "stroke-tier-locked-glyph",
};

// The colour of a gradient stop, from the tier token.
export const stopColourClassNames: Readonly<Record<TierColourToken, string>> = {
  "tier-enamel": "[stop-color:rgb(var(--kl-tier-enamel))]",
  "tier-bronze-hi": "[stop-color:rgb(var(--kl-tier-bronze-hi))]",
  "tier-bronze-mid": "[stop-color:rgb(var(--kl-tier-bronze-mid))]",
  "tier-bronze-lo": "[stop-color:rgb(var(--kl-tier-bronze-lo))]",
  "tier-silver-hi": "[stop-color:rgb(var(--kl-tier-silver-hi))]",
  "tier-silver-mid": "[stop-color:rgb(var(--kl-tier-silver-mid))]",
  "tier-silver-lo": "[stop-color:rgb(var(--kl-tier-silver-lo))]",
  "tier-gold-hi": "[stop-color:rgb(var(--kl-tier-gold-hi))]",
  "tier-gold-mid": "[stop-color:rgb(var(--kl-tier-gold-mid))]",
  "tier-gold-lo": "[stop-color:rgb(var(--kl-tier-gold-lo))]",
  "tier-plat-a": "[stop-color:rgb(var(--kl-tier-plat-a))]",
  "tier-plat-b": "[stop-color:rgb(var(--kl-tier-plat-b))]",
  "tier-plat-c": "[stop-color:rgb(var(--kl-tier-plat-c))]",
  "tier-plat-d": "[stop-color:rgb(var(--kl-tier-plat-d))]",
  "tier-locked": "[stop-color:rgb(var(--kl-tier-locked))]",
  "tier-locked-glyph": "[stop-color:rgb(var(--kl-tier-locked-glyph))]",
};
