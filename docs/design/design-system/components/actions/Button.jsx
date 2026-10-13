import React from 'react';
import { typeStyle, focusRing, useInteraction } from '../core/kl.js';

const VARIANTS = {
  primary: { background: 'var(--accent)', color: 'var(--accent-foreground)', border: '1px solid transparent' },
  secondary: { background: 'var(--surface-raised)', color: 'var(--text-primary)', border: '1px solid var(--border)' },
  destructive: { background: 'var(--danger)', color: 'var(--text-on-status)', border: '1px solid transparent' },
  ghost: { background: 'transparent', color: 'var(--text-primary)', border: '1px solid transparent' },
};
const SIZES = { sm: { height: 'var(--control-height-sm)', padding: '0 var(--space-3)' }, md: { height: 'var(--control-height-md)', padding: '0 var(--space-4)' }, lg: { height: 'var(--control-height-lg)', padding: '0 var(--space-5)' } };

export function Button({ variant = 'primary', size = 'md', disabled = false, loading = false, icon, children, fullWidth = false, onClick, type = 'button', style, ...rest }) {
  const inert = disabled || loading;
  const { focus, pressed, hover, handlers } = useInteraction(inert);
  const v = VARIANTS[variant] || VARIANTS.primary;
  const overlay = pressed ? 'var(--press-overlay)' : hover ? 'var(--hover-overlay)' : 'transparent';
  return (
    <button type={type} disabled={inert} aria-busy={loading || undefined} onClick={onClick} {...handlers} {...rest}
      style={{ ...typeStyle('body-strong'), ...v, ...SIZES[size], position: 'relative', overflow: 'hidden', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)', borderRadius: 'var(--radius-medium)', width: fullWidth ? '100%' : undefined, minWidth: 'var(--touch-target)', cursor: inert ? 'default' : 'pointer', opacity: disabled ? 0.4 : 1, outline: 'none', WebkitTapHighlightColor: 'transparent', transform: pressed ? 'scale(var(--press-scale))' : 'scale(1)', transition: `transform var(--duration-instant) var(--ease-spring), background var(--duration-quick) ease, opacity var(--duration-quick) ease, box-shadow var(--duration-instant) ease`, ...focusRing(focus), ...style }}>
      <span aria-hidden style={{ position: 'absolute', inset: 0, background: overlay, transition: 'background var(--duration-quick) ease', pointerEvents: 'none' }}></span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)', visibility: loading ? 'hidden' : 'visible' }}>{icon}{children}</span>
      {loading && <span aria-label="Loading" style={{ position: 'absolute', width: 18, height: 18, borderRadius: '50%', border: '2px solid currentColor', borderRightColor: 'transparent', animation: 'kl-spin 700ms linear infinite' }}></span>}
    </button>
  );
}
