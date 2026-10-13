import React from 'react';
import { typeStyle } from '../core/kl.js';
import { Icon } from '../core/Icon.jsx';
import { Button } from '../actions/Button.jsx';

/** Empty state: a muted icon, a short title, one line of body and an optional action. Cuts in once. */
export function EmptyState({ icon = 'Inbox', title, body, actionLabel, onAction, compact = false, style }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 'var(--space-2)', padding: compact ? 'var(--space-6) var(--space-4)' : 'var(--space-10) var(--space-6)', fontFamily: 'var(--font-sans)', color: 'var(--text-primary)', animation: 'kl-cut-in var(--duration-standard) var(--ease-enter) both', ...style }}>
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 56, height: 56, borderRadius: 'var(--radius-medium)', background: 'var(--surface-raised)', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}><Icon name={icon} size="xl" /></span>
      <span style={{ ...typeStyle('h2') }}>{title}</span>
      {body && <span style={{ ...typeStyle('body'), color: 'var(--text-secondary)', maxWidth: 320, textWrap: 'pretty' }}>{body}</span>}
      {actionLabel && <Button variant="secondary" onClick={onAction} style={{ marginTop: 'var(--space-3)' }}>{actionLabel}</Button>}
    </div>
  );
}

/** Error state with retry. Short, factual message; the retry is a secondary button. */
export function ErrorState({ title = 'Something went wrong', body, retryLabel = 'Try again', onRetry, compact = false, style }) {
  return (
    <div role="alert" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 'var(--space-2)', padding: compact ? 'var(--space-6) var(--space-4)' : 'var(--space-10) var(--space-6)', fontFamily: 'var(--font-sans)', color: 'var(--text-primary)', animation: 'kl-cut-in var(--duration-standard) var(--ease-enter) both', ...style }}>
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 56, height: 56, borderRadius: 'var(--radius-medium)', background: 'var(--danger-muted)', color: 'var(--danger)', marginBottom: 'var(--space-2)' }}><Icon name="TriangleAlert" size="xl" /></span>
      <span style={{ ...typeStyle('h2') }}>{title}</span>
      {body && <span style={{ ...typeStyle('body'), color: 'var(--text-secondary)', maxWidth: 320, textWrap: 'pretty' }}>{body}</span>}
      {onRetry && <Button variant="secondary" icon={<Icon name="RotateCw" size="sm" />} onClick={onRetry} style={{ marginTop: 'var(--space-3)' }}>{retryLabel}</Button>}
    </div>
  );
}
