# @keylow/tokens

The design tokens (colours, spacing and type scale) shared by the web and mobile apps, exported as a Tailwind 3 preset. NativeWind v4 on mobile and Tailwind on web both read it, so the two UIs share one visual system. It is consumed as source: there is no build step.

The values are placeholders. They are a neutral, brand-agnostic starting point (the colour scales are Tailwind's own neutral, blue, green, amber and red) and are expected to change when real UI work starts (KEY-21 and KEY-22 consume them).

## Use

```ts
import { preset } from "@keylow/tokens";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  presets: [preset],
};
```

`colors`, `spacing` and `fontSize` are also exported for code that needs the raw values.

## Values

- Colours: `neutral`, `brand`, `success`, `warning` and `danger`, each with steps 50 to 950, as plain hex strings so NativeWind can read them.
- Spacing: a 4px base on Tailwind's default step keys (`0`, `0.5`, `1` to `96`), written in px so the value is the same on web and native.
- Font size: `xs` to `5xl`, each with a px size and a px line height.

The preset only sets `theme.extend`, so Tailwind's own theme (breakpoints, other utilities) is kept.

## Scripts

```sh
pnpm --filter @keylow/tokens lint
pnpm --filter @keylow/tokens typecheck
pnpm --filter @keylow/tokens test
```
