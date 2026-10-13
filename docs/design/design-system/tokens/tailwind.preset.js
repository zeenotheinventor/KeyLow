// Tailwind / NativeWind preset generated from tokens/*.css. Dark values are the default theme; light values are under `light`.
export const colors = {
  "background": "#0B0E13",
  "surface": "#141821",
  "surface-raised": "#1C212C",
  "surface-sheet": "#232A37",
  "border": "#2A3142",
  "border-strong": "#3A4355",
  "text-primary": "#F2F4F8",
  "text-secondary": "#A9B2C3",
  "text-muted": "#8691A5",
  "accent": "#CCF249",
  "accent-foreground": "#0B0E13",
  "success": "#5CD67A",
  "warning": "#FF9F43",
  "danger": "#FF5C5C",
  "protein": "#6E9BFF",
  "carbs": "#F2C14E",
  "fat": "#E87EC0",
  "calories": "#4FD1C5",
};
export const lightColors = {
  "background": "#EEF0F4",
  "surface": "#F7F8FA",
  "surface-raised": "#FFFFFF",
  "surface-sheet": "#FFFFFF",
  "border": "#D9DDE5",
  "border-strong": "#C3C9D4",
  "text-primary": "#0F131A",
  "text-secondary": "#4B5465",
  "text-muted": "#626B7B",
  "accent": "#7FAE00",
  "accent-foreground": "#0F131A",
  "success": "#1F9D4E",
  "warning": "#C76A00",
  "danger": "#D93030",
  "protein": "#2F6BEA",
  "carbs": "#B9800E",
  "fat": "#C2399A",
  "calories": "#0F9A8E",
};
export const spacing = { 1: "4px", 2: "8px", 3: "12px", 4: "16px", 5: "20px", 6: "24px", 8: "32px", 10: "40px", 12: "48px", 16: "64px" };
export const borderRadius = { small: "6px", medium: "12px", large: "20px", pill: "999px" };
export const fontFamily = { sans: ["Geist", "system-ui", "sans-serif"] };
export const fontSize = {
  "display-numeral": ["56px", { lineHeight: "60px", letterSpacing: "-0.03em", fontWeight: "600" }],
  h1: ["28px", { lineHeight: "34px", letterSpacing: "-0.02em", fontWeight: "600" }],
  h2: ["20px", { lineHeight: "26px", letterSpacing: "-0.01em", fontWeight: "600" }],
  body: ["16px", { lineHeight: "24px" }],
  "body-strong": ["16px", { lineHeight: "24px", fontWeight: "600" }],
  caption: ["12px", { lineHeight: "16px", letterSpacing: "0.01em", fontWeight: "500" }],
  "numeral-small": ["20px", { lineHeight: "24px", letterSpacing: "-0.01em", fontWeight: "600" }],
};
export const transitionDuration = { instant: "90ms", quick: "160ms", standard: "220ms", flourish: "400ms", chart: "600ms" };
export const transitionTimingFunction = { enter: "cubic-bezier(0.18,1.25,0.3,1)", exit: "cubic-bezier(0.6,0,0.9,0.2)", spring: "cubic-bezier(0.3,1.45,0.5,1)", whip: "cubic-bezier(0.05,0.9,0.15,1)" };
export const preset = { theme: { extend: { colors, spacing, borderRadius, fontFamily, fontSize, transitionDuration, transitionTimingFunction } } };
