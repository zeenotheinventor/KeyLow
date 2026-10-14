import type { AllowlistEntry } from "./applyAllowlist";

// What the guard lets through, and why. A pattern that is right everywhere lives in the rule it
// belongs to, with its reason beside it (a CSS custom property in `style`, an animated style, a
// navigation style read from the theme, danger text on a small alert caption, a colour scoped to
// dark). This list is for the few exceptions that belong to one place. A new entry needs a reason
// Zee has approved, and an entry that nothing uses fails the test, so the list cannot keep an
// exception whose cause has gone. Each entry covers one finding (or `count` of them), so a second
// hex in the same file, or a second `text-danger` in the same component, fails until it is excused.
export const allowlist: AllowlistEntry[] = [
  {
    rule: "raw-hex",
    path: "apps/mobile/components/GoogleMark/GoogleMark.tsx",
    detail: "#4285F4",
    reason:
      "Google's four brand colours for the sign-in \"G\". They are Google's to set and not Ki-Lo tokens. The documented exception Q17, approved by Zee on 2026-10-13.",
  },
  {
    rule: "raw-hex",
    path: "apps/mobile/components/GoogleMark/GoogleMark.tsx",
    detail: "#34A853",
    reason:
      "Google's four brand colours for the sign-in \"G\". They are Google's to set and not Ki-Lo tokens. The documented exception Q17, approved by Zee on 2026-10-13.",
  },
  {
    rule: "raw-hex",
    path: "apps/mobile/components/GoogleMark/GoogleMark.tsx",
    detail: "#FBBC05",
    reason:
      "Google's four brand colours for the sign-in \"G\". They are Google's to set and not Ki-Lo tokens. The documented exception Q17, approved by Zee on 2026-10-13.",
  },
  {
    rule: "raw-hex",
    path: "apps/mobile/components/GoogleMark/GoogleMark.tsx",
    detail: "#EA4335",
    reason:
      "Google's four brand colours for the sign-in \"G\". They are Google's to set and not Ki-Lo tokens. The documented exception Q17, approved by Zee on 2026-10-13.",
  },
  {
    rule: "light-mode-coloured-text",
    path: "apps/mobile/components/ui/Input/FieldError/FieldError.tsx",
    detail: "text-danger",
    reason:
      "The kit's field error: a danger caption with role alert, in dark and in light, as the boards draw it (docs/design/auth/sign-in-field-errors.html and docs/design/food-form/validation-errors.html, light frames). The class is held in a constant, so the alert caption pattern cannot see the element. Orchestrator ruling 2026-10-14: the boards win over the Q14 prose.",
  },
  {
    rule: "light-mode-coloured-text",
    path: "apps/web/components/ui/Banner/Banner.tsx",
    detail: "text-warning",
    reason:
      "The review banner's icon glyph, which is aria-hidden and not text. The board draws the glyph in the warning colour in the light frame (docs/design/web-food/detail-missing-values-off.html). The banner's words stay in text-text-primary. If the design is ever changed so the glyph is not coloured in light, change the component and delete this entry.",
  },
  {
    rule: "light-mode-coloured-text",
    path: "apps/web/components/ui/Banner/Banner.tsx",
    detail: "text-danger",
    reason:
      "The error banner's icon glyph, which is aria-hidden and not text. The board draws the glyph in the danger colour in the light frame (docs/design/web-foods/barcode-error.html). The banner's words stay in text-text-primary. If the design is ever changed so the glyph is not coloured in light, change the component and delete this entry.",
  },
  {
    rule: "light-mode-coloured-text",
    path: "apps/web/components/ui/EmptyState/EmptyState.tsx",
    detail: "text-danger",
    reason:
      "The danger tone's icon tile: a 56 px tile with a danger-muted fill and a 32 px glyph, which is aria-hidden and not text. The board draws the glyph in the danger colour in the light frame (docs/design/web-food/detail-error.html). If the design is ever changed so the glyph is not coloured in light, change the component and delete this entry.",
  },
];
