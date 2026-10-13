import React from 'react';
import { typeStyle, numeric, Format } from '../core/kl.js';

const MACROS = [
  { key: 'protein', label: 'Protein' },
  { key: 'carbs', label: 'Carbs' },
  { key: 'fat', label: 'Fat' },
];

/** Stacked macro bars. Each row is labelled (never colour alone) and shows grams eaten / target. Over target: the fill completes in the macro colour, the overflow is a warning-coloured cap and the delta is printed in warning. Fills whip in with --ease-whip, staggered. */
export function MacroBars({ protein, carbs, fat, compact = false, style }) {
  const data = { protein, carbs, fat };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 'var(--space-2)' : 'var(--space-3)', fontFamily: 'var(--font-sans)', color: 'var(--text-primary)', ...style }}>
      {MACROS.map((m, i) => {
        const d = data[m.key] || { eaten: 0, target: 0 };
        const ratio = d.target > 0 ? d.eaten / d.target : 0;
        const over = d.eaten - d.target;
        const isOver = over > 0;
        const fill = Math.min(1, ratio) * 100;
        const overPct = isOver ? Math.min(0.35, (ratio - 1)) * 100 : 0;
        return (
          <div key={m.key} role="group" aria-label={`${m.label}: ${Format.grams(d.eaten)} of ${Format.grams(d.target)} grams${isOver ? `, ${Format.grams(over)} over` : ''}`} style={{ display: 'grid', gridTemplateColumns: compact ? '56px 1fr auto' : '72px 1fr auto', alignItems: 'center', columnGap: 'var(--space-3)' }}>
            <span style={{ ...typeStyle('caption'), color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}><span aria-hidden style={{ width: 8, height: 8, borderRadius: 2, background: `var(--${m.key})`, flex: 'none' }}></span>{m.label}</span>
            <span style={{ position: 'relative', height: compact ? 6 : 8, borderRadius: 'var(--radius-pill)', background: 'var(--border)', overflow: 'hidden' }}>
              <span style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: `${fill}%`, background: `var(--${m.key})`, borderRadius: 'inherit', transition: `width var(--duration-chart) var(--ease-whip)`, transitionDelay: `calc(${i} * var(--stagger))` }}></span>
              {isOver && <span style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: `${overPct}%`, background: 'var(--warning)', backgroundImage: 'repeating-linear-gradient(-45deg, transparent 0 3px, var(--surface) 3px 4px)', transition: `width var(--duration-chart) var(--ease-whip)` }}></span>}
            </span>
            <span style={{ ...typeStyle(compact ? 'caption' : 'body-strong'), ...numeric, display: 'flex', alignItems: 'baseline', gap: 4, justifyContent: 'flex-end', minWidth: compact ? 72 : 96 }}>
              <span>{Format.grams(d.eaten)}</span><span style={{ ...typeStyle('caption'), color: 'var(--text-muted)' }}>/ {Format.grams(d.target)} g</span>
              {isOver && <span style={{ ...typeStyle('caption'), color: 'var(--warning)' }}>{Format.deltaGrams(over)}</span>}
            </span>
          </div>
        );
      })}
    </div>
  );
}
