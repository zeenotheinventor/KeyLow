import { themeVariables } from "@keylow/tokens";
import plugin from "tailwindcss/plugin";

/**
 * `data-theme="device"` starts on the dark colours of `:root` and takes the light ones when the
 * system prefers light. The browser decides, so there is no flash and no script to keep in step.
 *
 * The `light-theme` variant is for the few rules that differ in light, such as text that cannot
 * lean on a colour. It follows the same two cases: an explicit Light, and Match device on a light
 * system.
 */
export const matchDeviceTheme = plugin((api) => {
  api.addBase({
    "@media (prefers-color-scheme: light)": {
      '[data-theme="device"]': { ...themeVariables("light"), "color-scheme": "light" },
    },
  });
  api.addVariant("light-theme", [
    '[data-theme="light"] &',
    '@media (prefers-color-scheme: light) { [data-theme="device"] & }',
  ]);
});
