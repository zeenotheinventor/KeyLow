# Ki-Lo Design System

Ki-Lo (as in kilogram; the repository still carries the old KeyLow slug) is a mobile food diary with an adaptive calorie engine: log intake and weigh-ins, and the engine estimates energy expenditure and adjusts calorie and macro targets weekly. iOS and Android first (Expo, NativeWind, Reanimated); a web dashboard later (Next.js, Tailwind). A personal project built to showcase quality: it must look and behave like a product anyone could sign into.

This pass is the **design system only**: tokens and components, dark first. No screens.

## Sources

- GitHub: https://github.com/zeenotheinventor/KeyLow — monorepo. `packages/tokens/src/index.ts` holds the current (placeholder, Tailwind-default) preset this system replaces; `apps/mobile/components/**` and `apps/web/components/**` hold the first food-search, food-detail and food-form screens whose copy and behaviour this system was read against. Explore it further to build designs that match the product's data model (`docs/adr/0003-data-model.md`) and engine (`docs/adr/0002-engine-v1.md`).
- Brief from the product owner (in chat): feel, token names, component list, motion and haptic spec, rules.

The repo contained no brand mark — only Expo's template icons — so the mark, wordmark, app icon and splash here are **proposals**, made to the brief.

## Content fundamentals

Voice: direct and dry. Short labels, plain sentences, British English (yoghurt, fibre, colour).

- No exclamation marks. No emoji. No marketing adjectives.
- Sentence case everywhere: "Add entry", "Mark day complete", "Needs review".
- Estimates are always labelled as estimates: "2,480 kcal · estimate", "Trend weight (est.)", "Expenditure is an estimate".
- Second person for the user's things ("your foods", "your expenditure"), never "my". The app does not say "I".
- Errors say what happened and what to do, never the raw error: "Your food could not be saved. Check your connection and try again."
- States are statements, not apologies: "No foods found. Try other words, or create the food yourself." "Offline. Showing saved data. Changes will not save."
- Sources are named plainly: Open Food Facts, UK CoFID, Yours.
- Numbers: calories as whole numbers with a thousands separator (2,480); grams to one decimal only under 10 (7.5 g, 142 g); weight to one decimal in kg, lb or st (82.4 kg). "Over target" is written in words and shown in the warning colour, never danger.
- Toasts are one short clause with at most one action: "Entry deleted — Undo".

## Visual foundations

**Mode.** Dark is the default and the primary target; light is a supported alternative scoped under `[data-theme="light"]`. Status bar is light-content on dark.

**Surfaces.** Four layered dark levels, never pure black: `--background #0B0E13` (screen) → `--surface #141821` (cards) → `--surface-raised #1C212C` (controls, raised cards) → `--surface-sheet #232A37` (sheets, toasts). Depth is read from surface colour first and from shadow second; `--elevation-card` and `--elevation-sheet` are soft, dark, and include a 1 px top inner highlight. Borders are `--border #2A3142`, 1 px, on every card, input and row group. No decorative gradients, no illustrations, no imagery; no blur.

**Colour.** One accent, `--accent #CCF249` (lime), used sparingly: primary buttons, active states, focus rings, the pop colour of flourishes. Status: `--success #5CD67A`, `--warning #FF9F43`, `--danger #FF5C5C`. Macro colours `--protein #6E9BFF`, `--carbs #F2C14E`, `--fat #E87EC0`, `--calories #4FD1C5` are tuned for dark, kept apart in hue and lightness, and always paired with a text label. Every colour has a `*-muted` translucent fill for badges and chips, with the full colour as the text on top. Charts use chart tokens only.

**Type.** One family, Geist (variable, SIL OFL 1.1, free to embed natively and on the web), with `tnum` on every number. Scale: display-numeral 56/60 600 −0.03em; h1 28/34 600 −0.02em; h2 20/26 600 −0.01em; body 16/24 400; body-strong 16/24 600; caption 12/16 500 +0.01em; numeral-small 20/24 600 −0.01em. Large numerals are the only loud thing on a screen; everything else is quiet.

**Spacing and shape.** 4 pt base (`--space-1` 4 … `--space-16` 64). Radius small 6 (inputs, icon tiles), medium 12 (buttons, rows, sheets, toasts), large 20 (cards), pill. Touch targets ≥ 44 pt; control heights 36 (web-dense only) / 44 / 52; tab bar 49 + safe area. Portrait only.

**Layout.** Content sits inside `--space-4` screen padding; the tab bar is fixed; the calorie ring is the hero of the Diary with macro bars beneath it; lists are flat rows on `--surface` with 4 px gaps, grouped in cards where there is a heading.

**Interaction states.** Hover: `--hover-overlay` (6 % white on dark). Press: `--press-overlay` plus compress to `--press-scale` 0.96, released with `--ease-spring` in `--duration-instant`. Focus (web): 2 px `--focus-ring` with a 2 px `--focus-ring-offset` gap, keyboard only. Disabled: 40 % opacity, no motion.

**Motion.** Fluid and kinetic: attack, short overshoot, fast settle. Nothing snaps, nothing floats. Durations: instant 90, quick 160, standard 220, flourish 400, chart 600 ms. Easings: `--ease-enter` (hard ease-out with overshoot), `--ease-exit` (sharp ease-in), `--ease-spring` (tight spring for dragged or released things), `--ease-whip` (fills and draws). Signature moves (keyframes in `tokens/motion.css`): angled wipes between screens and tabs (`kl-wipe-in`); panels and rows cut in from the side, skewed, straightening on settle, staggered 36 ms (`kl-cut-in`); segmented highlights slide with a brief skew; the hero numeral counts up and flashes the accent (`kl-flash`); ring and bars fill with the whip ease; confirmations get a diagonal accent slash and the text punches in (`kl-slash`, `kl-punch`); the sheet slams up and settles (`kl-sheet-up`); toasts cut in at an angle (`kl-toast-in`). Big flourishes are reserved for moments (entry added, day complete, check-in applied, onboarding); everyday micro-interactions stay quick. Motion never delays feedback: state changes immediately, the animation decorates it. Reduce-motion sets `--motion-distance` and `--motion-skew` to 0, so every keyframe degrades to a fade.

**Haptics** (specified next to motion): `--haptic-select` light (selection, step, tab, segment), `--haptic-confirm` medium (entry added, saved), `--haptic-complete` heavy-double (day complete, check-in applied), `--haptic-warning`, `--haptic-error`.

**Reanimated mapping.** `--ease-enter` ≈ `withSpring({ damping: 18, stiffness: 260, mass: 0.9 })`; `--ease-spring` ≈ `withSpring({ damping: 14, stiffness: 320, mass: 0.8 })`; `--ease-whip` ≈ `withTiming(v, { duration: 600, easing: Easing.bezier(0.05, 0.9, 0.15, 1) })`; `--ease-exit` ≈ `withTiming(v, { duration: 220, easing: Easing.bezier(0.6, 0, 0.9, 0.2) })`.

**Larger text.** Sizes are px tokens that scale with the platform text size; numerals use `adjustsFontSizeToFit` / `minimumFontScale 0.7` inside the ring, and rows wrap subtitles rather than truncate at accessibility sizes.

**Platform.** iOS and Android share the tokens and follow their own idioms: iOS tab bar (tinted, 49 pt) vs Android (pill, 64 dp); iOS back-swipe vs Android predictive back; sheets are `--surface-sheet` on both, with Android using the same top radius. Safe areas are honoured via `--safe-area-top/bottom`.

**States.** Skeletons appear only after 200 ms (`--skeleton-delay`). Offline: reads from cache, writes disabled, a quiet neutral banner and a disabled Save. Destructive row actions are swipe-to-delete with an Undo toast; only account deletion uses a full confirm.

## Iconography

Lucide, via the UMD bundle (`https://unpkg.com/lucide@0.460.0/dist/umd/lucide.min.js`) on the web and `lucide-react-native` natively. Stroke weight `--icon-stroke` 1.75 everywhere; sizes `--icon-sm` 16, `--icon-md` 20, `--icon-lg` 24, `--icon-xl` 32. No icon font, no PNG icons, no emoji, no unicode glyphs as icons. Tab icons: BookOpen (Diary), Apple (Foods), ChefHat (Recipes), Scale (Weight), Settings. The repo defines no icon set yet (its tab bar renders no icons), so Lucide is a proposal matched to the brief's "one set, consistent stroke".

Brand assets live in `assets/brand/`: `mark.svg` (a calorie ring broken by a diagonal dumbbell — nutrition, training, and the kinetic 45° of sport; lime ring, white bar), `mark-mono.svg`, `mark-on-light.svg`, `app-icon-ios.svg`, `app-icon-android-foreground.svg`, `app-icon-android-monochrome.svg`.

## Tokens

- `styles.css` — entry; `@import`s everything below.
- `tokens/colors.css` — dark `:root` and `[data-theme="light"]`: background, surface, surface-raised, surface-sheet, border, text-primary/secondary/muted, accent, accent-foreground, success, warning, danger, protein, carbs, fat, calories, `*-muted` fills, chart tokens, overlays, focus ring, skeleton.
- `tokens/typography.css` — Geist, weights, the seven type styles as size/line/weight/tracking tokens.
- `tokens/spacing.css` — 4 pt scale, radius, elevation, icon sizes, control heights, touch target, safe areas.
- `tokens/motion.css` — durations, easings, reduce-motion collapse, haptic tokens, all `kl-*` keyframes.
- `tokens/fonts.css` — Geist from Google Fonts.
- `tokens/ki-lo.tokens.json` — every token as JSON (dark and light).
- `tokens/tailwind.preset.js` — ready to replace `packages/tokens/src/index.ts`.

## Components

All components live under `components/<group>/`, use only the tokens above, and document their motion next to their states in `<Name>.prompt.md`.

- Actions: `Button`
- Forms: `Input`, `NumericInput`, `SegmentedControl`
- Surfaces: `Card`, `ListRow`, `BottomSheet`
- Navigation: `TabBar`, `DayStepper`
- Data: `CalorieRing` (+ `useCountUp`), `MacroBars`, `TrendChart`, `DayCompleteToggle`, `IncompleteDaysChip`
- Feedback: `Badge`, `Banner` (review, offline), `Toast`, `Skeleton`, `EmptyState`, `ErrorState`
- Core: `Icon`, `Format` (calories, grams, weight, deltaGrams) and shared helpers in `components/core/kl.js`

### Intentional additions

- `Icon` — wrapper for the Lucide set so components take an icon name.
- `Format` — the number-formatting rules as code, so every component formats identically.
- `IncompleteDaysChip` — the "n incomplete days this week" chip the brief pairs with the day-complete toggle.
- `--surface-sheet` — a fourth dark level so sheets and toasts sit above raised cards.

## Index

- `readme.md` — this guide. `SKILL.md` — agent skill entry. `github.md` — source association.
- `styles.css`, `tokens/` — tokens (see above).
- `components/` — React components, `.d.ts` contracts, `.prompt.md` usage, and a `*.dark.card.html` + `*.light.card.html` specimen pair per group (Design System tab groups "Components · Dark" and "Components · Light").
- `guidelines/colors|type|spacing|icons|motion|brand/` — foundation specimen cards; colour, type and spacing cards come in `.dark.html` / `.light.html` pairs.
- `assets/brand/` — mark, app icons.
- `thumbnail.html` — project tile.

No UI kit screens in this pass, by design.
