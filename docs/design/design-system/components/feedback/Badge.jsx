import React from 'react';
import { typeStyle } from '../core/kl.js';

const SOURCES = { off: 'Open Food Facts', cofid: 'UK CoFID', user: 'Yours' };
const TONES = {
  neutral: { bg: 'var(--surface-sheet)', fg: 'var(--text-secondary)' },
  accent: { bg: 'var(--accent-muted)', fg: 'var(--accent)' },
  success: { bg: 'var(--success-muted)', fg: 'var(--success)' },
  warning: { bg: 'var(--warning-muted)', fg: 'var(--warning)' },
  danger: { bg: 'var(--danger-muted)', fg: 'var(--danger)' },
  protein: { bg: 'var(--protein-muted)', fg: 'var(--protein)' },
  carbs: { bg: 'var(--carbs-muted)', fg: 'var(--carbs)' },
  fat: { bg: 'var(--fat-muted)', fg: 'var(--fat)' },
  calories: { bg: 'var(--calories-muted)', fg: 'var(--calories)' },
};

/** Badge. `kind="source"` names where a food came from (off, cofid, user). `kind="status"` is a short status with a tone. Never colour alone: the text is the signal. */
export function Badge({ kind = 'status', source, tone = 'neutral', children, dot = false, style }) {
  const t = kind === 'source' ? TONES.neutral : (TONES[tone] || TONES.neutral);
  const text = kind === 'source' ? (SOURCES[source] || source) : children;
  return (
    <span style={{ ...typeStyle('caption'), display: 'inline-flex', alignItems: 'center', gap: 5, height: 20, padding: '0 var(--space-2)', borderRadius: 'var(--radius-pill)', background: t.bg, color: t.fg, whiteSpace: 'nowrap', fontFamily: 'var(--font-sans)', border: kind === 'source' ? '1px solid var(--border)' : '1px solid transparent', ...style }}>
      {dot && <span aria-hidden style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }}></span>}
      {text}
    </span>
  );
}
