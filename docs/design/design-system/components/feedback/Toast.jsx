import React from 'react';
import { typeStyle } from '../core/kl.js';
import { Icon } from '../core/Icon.jsx';

const TONES = { neutral: 'var(--text-secondary)', success: 'var(--success)', warning: 'var(--warning)', danger: 'var(--danger)' };

/** Toast. Cuts in from the edge at an angle, sits above the tab bar, carries at most one action (e.g. Undo after swipe-to-delete). Auto-dismisses after `duration` ms unless an action is present. */
export function Toast({ message, actionLabel, onAction, tone = 'neutral', icon, open = true, onClose, duration = 4000, position = 'absolute', style }) {
  React.useEffect(() => { if (!open || actionLabel || !onClose) return; const t = setTimeout(onClose, duration); return () => clearTimeout(t); }, [open, actionLabel, onClose, duration]);
  if (!open) return null;
  return (
    <div role="status" style={{ position, left: 'var(--space-4)', right: 'var(--space-4)', bottom: 'calc(var(--tab-bar-height) + var(--safe-area-bottom) + var(--space-3))', display: 'flex', alignItems: 'center', gap: 'var(--space-3)', minHeight: 'var(--touch-target)', padding: 'var(--space-2) var(--space-2) var(--space-2) var(--space-4)', background: 'var(--surface-sheet)', border: '1px solid var(--border)', borderRadius: 'var(--radius-medium)', boxShadow: 'var(--elevation-toast)', color: 'var(--text-primary)', fontFamily: 'var(--font-sans)', animation: 'kl-toast-in var(--duration-standard) var(--ease-enter) both', zIndex: 30, ...style }}>
      {icon && <span style={{ color: TONES[tone] || TONES.neutral, display: 'flex' }}><Icon name={icon} size="md" /></span>}
      <span style={{ ...typeStyle('body'), fontSize: 14, lineHeight: '20px', flex: 1, minWidth: 0 }}>{message}</span>
      {actionLabel && <button type="button" onClick={onAction} style={{ ...typeStyle('body-strong'), fontSize: 14, height: 36, padding: '0 var(--space-3)', borderRadius: 'var(--radius-small)', border: 0, background: 'transparent', color: 'var(--accent)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>{actionLabel}</button>}
    </div>
  );
}
