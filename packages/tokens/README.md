# @keylow/tokens

The Ki-Lo design tokens, shared by the web and mobile apps. Dark is the default theme and light is the alternative. Both are exported as semantic names (`text-primary`, `surface-raised`, `border`) and as a Tailwind 3 preset that NativeWind v4 on mobile and Tailwind on web both read. It is consumed as source, so there is no build step.

The values are the Ki-Lo design system's, copied verbatim and never retyped. See "Where the values come from" below.

## Light-mode colour rule

Light-mode colour treatment, accepted by Zee (Q14): the light tokens are not darkened, and light-mode small text is not coloured. The lime `accent` is a fill with `accent-foreground` text on it, never text. Warning, success, danger and macro colours appear as a dot, bar, border or `*-muted` fill, and the words and values stay in `text-primary` or `text-secondary`. So a warning notice's text is `text-primary` in light, and a macro value sits beside a colour dot rather than being coloured text. Keep this in every light story and screen. In dark, coloured text is fine because every pair passes 4.5:1. If an approved frame shows otherwise, the frame wins.

`test/contrast.test.ts` records the WCAG ratio of every text, accent, status and macro colour on `background`, `surface` and `surface-raised` in both themes. It asserts no threshold. A design system edit that moves a ratio shows up as a snapshot diff. The body map colours (below) have their own section of that test: it asserts 3:1 on `surface` for the ten that carry a status (`heat-1` to `heat-5` and the volume and gap colours) in both themes and records the ratio of every one in the snapshot. Regenerate the snapshot with `pnpm --filter @keylow/tokens exec vitest run -u test/contrast.test.ts` and note the change in the PR.

## Use

```ts
import { preset } from "@keylow/tokens";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  presets: [preset],
};
```

The preset only sets `theme.extend`, so Tailwind's own theme (breakpoints, other utilities) is kept. It does not include the theme plugin. Add `themePlugin` to `plugins` where the CSS variables are wanted (web).

## Colours follow the theme through variables

Every colour class reads a `--kl-<name>` CSS variable, so one class follows the theme.

- A solid colour (`#RRGGBB`) resolves as `rgb(var(--kl-<name>) / <alpha-value>)`. The variable holds the space separated channels (`204 242 73`), so opacity modifiers work: `bg-accent/20`.
- A translucent colour carries its own alpha, so it resolves as `var(--kl-<name>)` and the variable holds the whole `rgba()` value. This covers the `*-muted` fills, `chart-band`, the overlays and `skeleton-shine`. **An opacity modifier on these is not supported.** `bg-accent-muted/50` generates nothing.
- Shadows follow the theme the same way, because the light shadows differ: `shadow-card` is `var(--kl-elevation-card)`.

The design's keys are kept exactly, so the classes read as `text-text-primary`, `border-border` and `bg-surface-raised`. The kit hides that. In the preset, a colour whose name starts with another colour's name (`accent-foreground`, `accent-muted`, `surface-raised`, `border-strong`, `focus-ring-offset`) is nested under that colour, the way Tailwind writes `DEFAULT`. The class names are unchanged. The nesting is what lets an app's own `accent: { DEFAULT, foreground }` block win key by key. A flat `accent-foreground` would instead replace the app's `accent.foreground`.

`themeVariables("dark")` and `themeVariables("light")` return the `--kl-*` values as plain data, for any consumer that cannot use the Tailwind plugin. `themePlugin` emits them on `:root` for dark and under `[data-theme="light"]` for light, together with `color-scheme`. Mobile does not use `themePlugin` or `[data-theme]`. Its `ThemeProvider` sets `themeVariables(scheme)` through nativewind `vars()` on its root view, for the scheme the app resolves from its own preference, and `apps/mobile/tailwind.config.js` emits only the dark set on `:root` as the fallback outside the provider.

## Ink colours, camera colours and label-small

`text-accent-ink` and `text-warning-ink` (`--accent-ink`, `--warning-ink`) are the design's coloured text that turns to primary text in light: lime and orange in dark, `text-primary` in light, so they are safe where the light-mode rule bans coloured small text. `text-success-ink` (`--success-ink`) is the exception to the primary-text rule: it is the success green in dark (`#5CD67A`) and a darker green in light (`#126D31`), so success words can stay green in both themes. In light it is 5.65:1 on `--background` and 6.07:1 on `--surface`, and 4.98:1 and 5.32:1 on the `success-muted` tint over them, which is where the badge and the chip draw it. `bg-camera` and `bg-viewfinder-dim` (`--camera`, `--viewfinder-dim`) are the scan surface and the dim over it, the same in both themes. `text-label-small` is the 14 over 20 semibold type style (web nav, compact search field, Button sm, Switch label).

## Control sizes and the press scale

The preset adds the design's control heights and touch target to the width and height scales, and the press scale to its scale steps, so a kit component names the token and not its number:

| Class                                                         | Token                                 | Value |
| ------------------------------------------------------------- | ------------------------------------- | ----- |
| `h-control-sm`, `w-control-sm`, `min-h-control-sm`, ...       | `controlHeight.sm`                    | 36 px |
| `h-control-md`, `w-control-md`, `min-h-control-md`, ...       | `controlHeight.md`                    | 44 px |
| `h-control-lg`, `w-control-lg`, `min-h-control-lg`, ...       | `controlHeight.lg`                    | 52 px |
| `h-touch-target`, `w-touch-target`, `min-h-touch-target`, ... | `touchTarget`                         | 44 px |
| `scale-press` (`active:scale-press`)                          | `pressScale` (`--press-scale`)        | 0.96  |
| `scale-press-row` (`active:scale-press-row`)                  | `pressScaleRow` (`--press-scale-row`) | 0.985 |

`h`, `w`, `min-h` and `min-w` each take all four sizes. Web and mobile read the same preset, so the class names are the same. `scale-press` is a static 0.96 and `scale-press-row`, the list row's, a static 0.985: reduced motion is handled where it is used (`motion-reduce:active:scale-100` on web, `reducedMotion.pressScale` in `usePressScale` on mobile), not by the variable. An app that merges class names with tailwind-merge must tell it these names are sizes: `controlSizes` and `scaleSteps` are exported for that, and `apps/web/lib/utils.ts` does it.

## Plain CSS variables

`css/kilo-tokens.css` holds every token as a CSS custom property under the design system's own names (`--surface`, `--space-4`, `--type-h2-size`): dark on `:root`, light under `[data-theme="light"]`, and what reduced motion collapses under `@media (prefers-reduced-motion: reduce)`. It is generated by `pnpm --filter @keylow/tokens generate`, committed, and ignored by Prettier so it is written exactly as built. `test/css.test.ts` regenerates it in memory and fails when the committed file differs, and checks that every token in `src/source/` is in it. The `kl-*` keyframes are CSS, not tokens, and are not in the file.

The Tailwind classes do not read this file. They read the `--kl-*` variables from `themePlugin`. The file is for anything that writes `var(--surface)` directly, such as the `docs/design` exports.

## Exports

| Export                                                                                                           | What it is                                                                            |
| ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `colors`, `lightColors`, `themes`                                                                                | Every colour, dark and light, with identical key sets. `themes` is `{ dark, light }`. |
| `statusBarStyle`, `colorScheme`                                                                                  | Per theme: `light-content` or `dark-content`, and `dark` or `light`.                  |
| `elevation`, `boxShadow`                                                                                         | The raw shadows per theme, and the `var()` references the preset uses.                |
| `spacing`, `borderRadius`                                                                                        | The 4 pt scale and the radii, as px strings.                                          |
| `fontFamily`, `fontNumeric`, `fontWeight`, `fontSize`                                                            | The type tokens. `fontSize` is the seven type styles in Tailwind's tuple form.        |
| `iconSize`, `iconStroke`, `controlHeight`, `touchTarget`, `tabBarHeight`, `sheetHandle`, `focusRing`, `safeArea` | Sizes as numbers of px (`safeArea` is the CSS `env()` strings).                       |
| `transitionDuration`, `transitionTimingFunction`                                                                 | The durations and easings as the CSS strings Tailwind wants.                          |
| `motionDuration`, `stagger`, `skeletonDelay`, `pressScale`, `easingCurve`, `motionScale`, `reducedMotion`        | The same motion tokens as numbers, plus what reduce-motion collapses to.              |
| `springs`, `timings`                                                                                             | The Reanimated spring and timing constants from the design system readme.             |
| `haptic`                                                                                                         | The haptic token names: `select`, `confirm`, `complete`, `warning`, `error`.          |
| `bodyMapPalette`                                                                                                 | The body map colours for one theme as concrete strings, for SVG fills.                |
| `preset`, `themePlugin`, `themeVariables`                                                                        | The Tailwind preset, the plugin, and the variables as data.                           |
| `controlSizes`, `scaleSteps`                                                                                     | The class names the preset adds for the control sizes and the press scale, as data.   |

The `kl-*` keyframes in `motion.css` are CSS and are not exported.

## Where the values come from

`src/source/` holds the design system's `ki-lo.tokens.json`, `colors.css`, `spacing.css`, `typography.css` and `motion.css`, copied verbatim from the Ki-Lo Design System project. Do not edit them by hand. Prettier ignores the folder.

`scripts/buildTokens.ts` reads them with a small CSS parser and builds the data. `src/source.generated.ts` is that data written out as TypeScript, so the apps never parse CSS at run time. The build throws when the JSON and the CSS disagree, when the light theme lacks a colour or a shadow the dark one has, or when the design adds a token that has no export yet. `test/source.test.ts` fails when the generated file is out of date, and it rebuilds the design's flat JSON from the exports to prove every token is present with its value.

`src/source/training.css` is the exception (see "Body map colours" below). When the design system changes, replace the five design system files in `src/source/` and run:

```sh
pnpm --filter @keylow/tokens generate
```

then commit the regenerated files with the new snapshot values.

## Body map colours are Ki-Lo training additions, not the design system's

`src/source/training.css` holds the colours of the 2D body map: `body-silhouette` and `body-separator`, the four materials of the 3D body (`body-skin`, `body-core`, `body-clay` for the head and `body-other-muscle`, KEY-589, dark values from the approved renders in `tools/body-model/blender/zanatomy_render.py`), the heat scale `heat-0` to `heat-5` with `heat-glow` (step 5 glows), the volume scale `volume-under`, `volume-maintaining`, `volume-productive`, `volume-over` and `volume-not-targeted`, and the gap scale `gap-behind`, `gap-on-plan` and `gap-ahead`. They come from the Ki-Lo training canvas (the v3 `tokens · body-map-scales` board, approved on KEY-339 and changed by KEY-515), not from the Ki-Lo Design System project, and are kept in their own file so the five design system files stay verbatim. The far-behind and far-ahead gap steps are retired: core has three plan statuses. The build treats them as colours: they are in `colors` and `lightColors`, and so in the preset (`bg-heat-3`, `bg-gap-on-plan`), `themeVariables`, `themePlugin` and `css/kilo-tokens.css`. The build throws when a training token is in one theme only or reuses a design system name.

`bodyMapPalette(scheme)` returns them as concrete colour strings, because `react-native-svg` fills cannot read CSS variables:

```ts
const { heat, heatGlow, volume, gap, silhouette, separator, skin, core, clay, otherMuscle } =
  bodyMapPalette("dark");
```

`gap.notInPlan` is `volume.notTargeted`, as the canvas draws it. The heat scale runs neutral grey at rest (`heat-0`), then green when a muscle is ready (`heat-1`), through yellow (`heat-2`) and amber (`heat-3`) to orange (`heat-4`) and red (`heat-5`, which glows). Ready and Very hot sit at the same lightness in both themes, and Warm and Hot are close in lightness, so the glow and the step names in the legend, the sheet and the list carry the difference. Colour is never the only signal. Light `heat-2` and `heat-3` are a shade darker than the board's mockup so every coloured step holds 3:1 on `surface`.

## Spacing and type are the design's steps

The preset's spacing is the design's 4 pt scale, as px: steps `1`, `2`, `3`, `4`, `5`, `6`, `8`, `10`, `12` and `16` (4 px to 64 px). Its type sizes are the seven type styles (`text-display-numeral`, `text-h1`, `text-h2`, `text-body`, `text-body-strong`, `text-caption`, `text-numeral-small`). The preset adds them to Tailwind's theme and does not replace it, so a step the design does not define (`size-14`, `gap-1.5`, `text-sm`) still exists, but it is Tailwind's own default and that default is in `rem`.

That matters on mobile. NativeWind turns `1rem` into 14 px on a device, so `pb-24` is 84 px there and not the 96 px a web page gets. A size the boards draw that is not a step of the scale is therefore written as the board draws it, in px, with an arbitrary value: `pb-[96px]`. The kit's own control sizes have names for this (`h-control-md`, `min-h-touch-target`, see above), so a button, a field or a row never uses a literal.

## Guards

`packages/config/test/source-guard` reads the source of `apps/` and `packages/` as part of `pnpm check` and fails when the repository stops having one visual language. It fails on:

- a raw hex colour outside this package (the one exception is the Google "G" in `apps/mobile/components/GoogleMark`, approved as Q17);
- an inline `style`, or any prop named `...Style` (`contentContainerStyle`), that is not a CSS custom property (`vars({...})`), a Reanimated animated style on an `Animated.*` view, the status bar's `style`, or a navigation style read from `useTheme().colors`;
- a class from a retired placeholder scale, a shadcn colour name (`bg-primary`, `text-muted-foreground`, `border-input`) or Tailwind's default palette (a numbered step of grey, red or blue, and `text-white`);
- `error.message` or `debugMessage` rendered in JSX;
- a function declared in an app or a package under the name of a core format, copy, search or food helper;
- coloured small text in light mode (the Q14 rule above): `text-danger`, `text-warning`, `text-success`, `text-accent` or a macro colour (`text-protein`, `text-carbs`, `text-fat`, `text-calories`) that nothing scopes to dark. On web only a `light-theme:text-text-primary` override in the same class string scopes it. The `dark:` variant is not accepted there, because Tailwind compiles it to `prefers-color-scheme`, so a person who picks Light on a dark system would still see coloured text. On mobile `dark:` is accepted (NativeWind follows the app's scheme), and so are a branch that only runs in dark (`scheme === "light" ? ... : "text-accent"`) and a `dark...` property name. On both, a field error caption (danger text, `text-caption`, `role="alert"`) is scoped.

Each exception is in `source-guard/allowlist.ts` with its reason. An entry covers one finding, or the `count` it names, so a second hex colour or a second `text-danger` in the same place fails until it is excused, and an entry that covers fewer than its count fails too.

### What the guard does not see

The guard reads strings and syntax, not what the code does at run time. These are known blind spots, written down and not closed:

- class strings assembled from parts (`` `text-${tone}` ``, `["text", "danger"].join("-")`);
- `rgb()` and `hsl()` strings, and palette classes on a border side (`border-t-red-500`);
- `.message` read through a variable (`const text = error.message`) before it reaches JSX, on a receiver whose name does not end in error, err, exception, failure or cause (`e.message`), by index (`error['message']`), destructured, or through `String(error)`;
- helper names declared through `useCallback` or as object methods;
- folders named `build` or `dist`, which are skipped as build output wherever they are;
- an SVG `url(#id)` reference, which reads as a hex colour when the id is three, four, six or eight hex characters;
- a style passed by spreading props (`{...{ style }}`).

## Scripts

```sh
pnpm --filter @keylow/tokens generate
pnpm --filter @keylow/tokens lint
pnpm --filter @keylow/tokens typecheck
pnpm --filter @keylow/tokens test
```
