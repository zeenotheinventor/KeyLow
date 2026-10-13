import React from 'react';
import { typeStyle } from '../core/kl.js';

/** Bottom sheet with handle. Slams up with --ease-spring over --duration-flourish and dims the background. Renders inside its positioned parent (position:absolute) so it can be shown in a frame; pass `fixed` for a real page. */
export function BottomSheet({ open, onClose, title, children, fixed = false, platform = 'ios', style }) {
  const [mounted, setMounted] = React.useState(open);
  React.useEffect(() => { if (open) setMounted(true); else { const t = setTimeout(() => setMounted(false), 220); return () => clearTimeout(t); } }, [open]);
  if (!mounted) return null;
  const pos = fixed ? 'fixed' : 'absolute';
  return (
    <div style={{ position: pos, inset: 0, zIndex: 20, fontFamily: 'var(--font-sans)', ...style }}>
      <div onClick={onClose} aria-hidden style={{ position: 'absolute', inset: 0, background: 'var(--overlay)', animation: `${open ? 'kl-dim-in' : 'kl-fade-in'} var(--duration-standard) ease both`, animationDirection: open ? 'normal' : 'reverse' }}></div>
      <div role="dialog" aria-modal="true" aria-label={title} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, background: 'var(--surface-sheet)', color: 'var(--text-primary)', borderRadius: platform === 'android' ? 'var(--radius-large) var(--radius-large) 0 0' : 'var(--radius-large) var(--radius-large) 0 0', boxShadow: 'var(--elevation-sheet)', padding: '0 var(--space-4) calc(var(--space-6) + var(--safe-area-bottom))', animation: `${open ? 'kl-sheet-up var(--duration-flourish) var(--ease-spring)' : 'kl-sheet-down var(--duration-standard) var(--ease-exit)'} both` }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-2) 0 var(--space-3)' }}><span aria-hidden style={{ width: 'var(--sheet-handle-width)', height: 'var(--sheet-handle-height)', borderRadius: 'var(--radius-pill)', background: 'var(--border-strong)' }}></span></div>
        {title && <div style={{ ...typeStyle('h2'), marginBottom: 'var(--space-3)' }}>{title}</div>}
        {children}
      </div>
    </div>
  );
}
