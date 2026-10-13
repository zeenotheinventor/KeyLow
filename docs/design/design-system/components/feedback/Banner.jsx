import React from 'react';
import { typeStyle } from '../core/kl.js';
import { Icon } from '../core/Icon.jsx';

const VARIANTS = {
  review: { icon: 'CircleAlert', bg: 'var(--warning-muted)', fg: 'var(--warning)', border: 'var(--warning)', title: 'Needs review', body: 'Some nutrition values are missing. Estimates use what is given.' },
  offline: { icon: 'WifiOff', bg: 'var(--surface-raised)', fg: 'var(--text-secondary)', border: 'var(--border)', title: 'Offline', body: 'Showing saved data. Changes will not save.' },
  info: { icon: 'Info', bg: 'var(--surface-raised)', fg: 'var(--text-secondary)', border: 'var(--border)', title: '', body: '' },
};

/** Banner. `review`: warning-toned "needs review" for foods with missing nutrition data, with an action. `offline`: quiet, neutral; reads come from cache and writes are disabled. Cuts in from the side. */
export function Banner({ variant = 'info', title, body, actionLabel, onAction, onDismiss, style }) {
  const v = VARIANTS[variant] || VARIANTS.info;
  return (
    <div role={variant === 'offline' ? 'status' : 'note'} style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)', padding: 'var(--space-3) var(--space-4)', background: v.bg, border: `1px solid ${v.border}`, borderRadius: 'var(--radius-medium)', color: 'var(--text-primary)', fontFamily: 'var(--font-sans)', animation: 'kl-cut-in var(--duration-standard) var(--ease-enter) both', ...style }}>
      <span style={{ color: v.fg, display: 'flex', paddingTop: 2 }}><Icon name={v.icon} size="md" /></span>
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ ...typeStyle('body-strong'), color: variant === 'review' ? 'var(--warning)' : 'var(--text-primary)' }}>{title ?? v.title}</span>
        {(body ?? v.body) && <span style={{ ...typeStyle('caption'), color: 'var(--text-secondary)', textWrap: 'pretty' }}>{body ?? v.body}</span>}
      </span>
      {actionLabel && <button type="button" onClick={onAction} style={{ ...typeStyle('body-strong'), fontSize: 14, minHeight: 'var(--touch-target)', padding: '0 var(--space-2)', margin: '-10px -8px', background: 'transparent', border: 0, color: v.fg, cursor: 'pointer', fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap' }}>{actionLabel}</button>}
      {onDismiss && <button type="button" aria-label="Dismiss" onClick={onDismiss} style={{ display: 'flex', minWidth: 'var(--touch-target)', minHeight: 'var(--touch-target)', alignItems: 'center', justifyContent: 'center', margin: '-12px -14px -12px -4px', background: 'transparent', border: 0, color: 'var(--text-muted)', cursor: 'pointer' }}><Icon name="X" size="sm" /></button>}
    </div>
  );
}
