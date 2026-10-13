// Shared helpers for Ki-Lo components: type styles, number formatting, focus ring.
import React from 'react';
const T = (name) => ({
  fontFamily: 'var(--font-sans)',
  fontSize: `var(--type-${name}-size)`,
  lineHeight: `var(--type-${name}-line)`,
  fontWeight: `var(--type-${name}-weight)`,
  letterSpacing: `var(--type-${name}-tracking)`,
});
export const typeStyle = T;
export const numeric = { fontVariantNumeric: 'tabular-nums', fontFeatureSettings: 'var(--font-numeric)' };

// Formatting rules the whole system encodes.
export const Format = {
  /** Calories: whole numbers, thousands separator. */
  calories(kcal) { return Math.round(kcal).toLocaleString('en-GB'); },
  /** Grams: one decimal only when under 10, otherwise whole. */
  grams(g) { const a = Math.abs(g); return a < 10 ? (Math.round(g * 10) / 10).toFixed(1).replace(/\.0$/, '') : String(Math.round(g)); },
  /** Weight: one decimal in kg, lb or st. */
  weight(value, unit = 'kg') { return `${(Math.round(value * 10) / 10).toFixed(1)} ${unit}`; },
  /** Signed over/under delta in grams. */
  deltaGrams(g) { return `${g > 0 ? '+' : g < 0 ? '−' : ''}${Format.grams(Math.abs(g))} g`; },
};

export const focusRing = (visible) => visible ? { boxShadow: `0 0 0 var(--focus-ring-offset-width) var(--focus-ring-offset), 0 0 0 calc(var(--focus-ring-offset-width) + var(--focus-ring-width)) var(--focus-ring)` } : {};

/** Hook: tracks keyboard focus (focus-visible) and pointer press for buttons and rows. */
export function useInteraction(disabled) {
  const [focus, setFocus] = React.useState(false);
  const [pressed, setPressed] = React.useState(false);
  const [hover, setHover] = React.useState(false);
  const handlers = disabled ? {} : {
    onFocus: (e) => setFocus(e.currentTarget.matches(':focus-visible')),
    onBlur: () => setFocus(false),
    onPointerDown: () => setPressed(true),
    onPointerUp: () => setPressed(false),
    onPointerLeave: () => { setPressed(false); setHover(false); },
    onPointerEnter: () => setHover(true),
  };
  return { focus, pressed, hover, handlers };
}
