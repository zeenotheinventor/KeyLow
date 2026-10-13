import React from 'react';
import { typeStyle, focusRing } from '../core/kl.js';

/** Segmented control. The highlight slides to the selected segment with a brief skew, then straightens. Selection changes immediately; the motion decorates it. */
export function SegmentedControl({ options, value, onChange, tone = 'neutral', size = 'md', fullWidth = true, label }) {
  const idx = Math.max(0, options.findIndex((o) => (o.value ?? o) === value));
  const [moving, setMoving] = React.useState(false);
  const [focus, setFocus] = React.useState(-1);
  const prev = React.useRef(idx);
  React.useEffect(() => { if (prev.current !== idx) { prev.current = idx; setMoving(true); const t = setTimeout(() => setMoving(false), 220); return () => clearTimeout(t); } }, [idx]);
  const n = options.length;
  const hl = tone === 'accent' ? { background: 'var(--accent)', color: 'var(--accent-foreground)' } : { background: 'var(--text-primary)', color: 'var(--background)' };
  const h = size === 'sm' ? 'var(--control-height-sm)' : 'var(--control-height-md)';
  return (
    <div role="radiogroup" aria-label={label} style={{ position: 'relative', display: 'grid', gridTemplateColumns: `repeat(${n}, 1fr)`, height: h, padding: 3, background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: 'var(--radius-medium)', width: fullWidth ? '100%' : undefined, boxSizing: 'border-box', fontFamily: 'var(--font-sans)' }}>
      <span aria-hidden style={{ position: 'absolute', top: 3, bottom: 3, left: 3, width: `calc((100% - 6px) / ${n})`, borderRadius: 'calc(var(--radius-medium) - 3px)', background: hl.background, transform: `translateX(${idx * 100}%) skewX(${moving ? 'calc(-10deg * var(--motion-skew))' : '0deg'})`, transition: `transform var(--duration-standard) var(--ease-spring)` }}></span>
      {options.map((o, i) => { const v = o.value ?? o; const active = i === idx; return (
        <button key={String(v)} type="button" role="radio" aria-checked={active} onClick={() => onChange && onChange(v)} onFocus={(e) => setFocus(e.currentTarget.matches(':focus-visible') ? i : -1)} onBlur={() => setFocus(-1)}
          style={{ ...typeStyle('caption'), fontSize: size === 'sm' ? 'var(--type-caption-size)' : '14px', fontWeight: 'var(--weight-semibold)', position: 'relative', zIndex: 1, background: 'transparent', border: 0, borderRadius: 'calc(var(--radius-medium) - 3px)', color: active ? hl.color : 'var(--text-secondary)', cursor: 'pointer', outline: 'none', padding: '0 var(--space-2)', transition: 'color var(--duration-quick) ease', whiteSpace: 'nowrap', ...focusRing(focus === i) }}>{o.label ?? o}</button>
      ); })}
    </div>
  );
}
