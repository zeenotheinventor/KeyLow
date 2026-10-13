import React from 'react';
import { typeStyle, numeric, Format } from '../core/kl.js';

/** Counts a number to its new value over --duration-flourish and flashes the accent on arrival. */
export function useCountUp(target, duration = 400) {
  const [val, setVal] = React.useState(target);
  const [flash, setFlash] = React.useState(0);
  const from = React.useRef(target);
  React.useEffect(() => {
    const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const start = from.current; const t0 = performance.now(); let raf;
    if (start === target) return;
    if (reduce) { setVal(target); from.current = target; setFlash((f) => f + 1); return; }
    const tick = (t) => { const p = Math.min(1, (t - t0) / duration); const e = 1 - Math.pow(1 - p, 3); setVal(start + (target - start) * e); if (p < 1) raf = requestAnimationFrame(tick); else { from.current = target; setFlash((f) => f + 1); } };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return [val, flash];
}

/** Calorie ring: eaten / target / remaining. Fills with --ease-whip over --duration-chart. Past 100 % it keeps filling in the warning colour on top (never resets, never danger). The centre numeral counts up and flashes the accent on arrival. */
export function CalorieRing({ eaten, target, size = 200, stroke = 14, label = 'remaining', estimate = true, style }) {
  const r = (size - stroke) / 2; const c = 2 * Math.PI * r;
  const ratio = target > 0 ? eaten / target : 0;
  const base = Math.min(1, ratio); const over = Math.max(0, Math.min(1, ratio - 1));
  const remaining = target - eaten; const isOver = remaining < 0;
  const [val, flash] = useCountUp(Math.abs(Math.round(remaining)));
  const compact = size < 180;
  return (
    <div role="img" aria-label={`${Format.calories(eaten)} eaten of ${Format.calories(target)} target, ${Format.calories(Math.abs(remaining))} ${isOver ? 'over' : 'remaining'}`} style={{ position: 'relative', width: size, height: size, fontFamily: 'var(--font-sans)', color: 'var(--text-primary)', ...style }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)', display: 'block' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--calories)" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - base)} style={{ transition: 'stroke-dashoffset var(--duration-chart) var(--ease-whip)' }} />
        {over > 0 && <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--warning)" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${c * over} ${c}`} style={{ transition: 'stroke-dasharray var(--duration-chart) var(--ease-whip)' }} />}
        {over > 0 && <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--background)" strokeWidth={stroke + 4} strokeDasharray={`2 ${c}`} strokeDashoffset={-c * over + 1} />}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, textAlign: 'center' }}>
        <span key={flash} style={{ ...typeStyle('display-numeral'), ...numeric, fontSize: compact ? 'var(--type-h1-size)' : 'var(--type-display-numeral-size)', lineHeight: 1, color: isOver ? 'var(--warning)' : 'var(--text-primary)', animation: flash ? 'kl-flash var(--duration-flourish) var(--ease-exit) both' : undefined }}>{Format.calories(val)}</span>
        <span style={{ ...typeStyle('caption'), color: isOver ? 'var(--warning)' : 'var(--text-secondary)' }}>{isOver ? 'over target' : label}</span>
        {!compact && <span style={{ ...typeStyle('caption'), ...numeric, color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', lineHeight: '15px', marginTop: 2 }}><span>{Format.calories(eaten)} eaten</span><span>{Format.calories(target)} target{estimate ? ' (est.)' : ''}</span></span>}
      </div>
    </div>
  );
}
