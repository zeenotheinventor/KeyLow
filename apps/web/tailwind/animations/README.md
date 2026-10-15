# Tailwind animations

One file per animation. `tailwind.config.ts` reads every `*.json` file here and merges its `keyframes` and `animation` into the theme, so adding an animation is adding a file and two branches that each add one do not conflict. A keyframe or animation name used by two files fails the load with both file names.

```json
{
  "keyframes": { "name": { "from": { "opacity": "0" }, "to": { "opacity": "1" } } },
  "animation": { "name": "name {transitionDuration.standard} ease both" }
}
```

`{transitionDuration.x}` and `{transitionTimingFunction.x}` are replaced with the `@keylow/tokens` values. A file may hold only `animation` when it reuses a keyframe from another file, as `dialog-in` reuses `punch`.

What each one is:

- `skeleton`: the design system's kl-shimmer, and kl-fade-in for the bone. A skeleton bone sweeps its shine across at 1400 ms and fades in over the quick duration.
- `wipe-in`, `slash`, `punch`: the design system's kl-wipe-in, kl-slash and kl-punch at full distance. Reduced motion is a `motion-reduce:animate-none` on each use, not a variable.
- `flash`: the design system's kl-flash. The calorie ring's numeral lands in the accent and settles.
- `toast-in`: the design system's kl-toast-in at full distance. A toast cuts in from the corner at an angle and straightens as it settles. Reduced motion is a `motion-reduce:animate-none` on the toast, not a variable.
- `dim-in`: the design system's kl-dim-in, which dims the page behind a dialog.
- `dialog-in`: a dialog enters with the design's kl-punch over the standard duration. Reduced motion is a `motion-reduce:animate-none` on each use.
