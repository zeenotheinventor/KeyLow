import type { ProgressBarKey } from "@keylow/core/diary";

// Over target a bar takes a brighter outline of its own colour: a 1 px gap in the background colour,
// then a 1.5 px ring of the nutrient colour mixed 55 % with white. The design draws it as this shadow.
// The classes are written out whole so Tailwind sees them.
export const overTargetOutline: Record<ProgressBarKey, string> = {
  calories:
    "[box-shadow:0_0_0_1px_rgb(var(--kl-background)),0_0_0_2.5px_color-mix(in_srgb,rgb(var(--kl-calories))_55%,white)]",
  protein:
    "[box-shadow:0_0_0_1px_rgb(var(--kl-background)),0_0_0_2.5px_color-mix(in_srgb,rgb(var(--kl-protein))_55%,white)]",
  carbs:
    "[box-shadow:0_0_0_1px_rgb(var(--kl-background)),0_0_0_2.5px_color-mix(in_srgb,rgb(var(--kl-carbs))_55%,white)]",
  fat: "[box-shadow:0_0_0_1px_rgb(var(--kl-background)),0_0_0_2.5px_color-mix(in_srgb,rgb(var(--kl-fat))_55%,white)]",
};
