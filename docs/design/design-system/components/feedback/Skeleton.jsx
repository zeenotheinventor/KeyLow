import React from 'react';

/** Loading skeleton. Appears only after --skeleton-delay (200 ms) so quick loads never flicker. `variant`: "text" | "row" | "ring" | "block". */
export function Skeleton({ variant = 'text', width, height, lines = 2, delay = 200, immediate = false, style }) {
  const [show, setShow] = React.useState(immediate);
  React.useEffect(() => { if (immediate) return; const t = setTimeout(() => setShow(true), delay); return () => clearTimeout(t); }, [delay, immediate]);
  if (!show) return <div aria-busy="true" aria-label="Loading" style={{ minHeight: height || 16, ...style }}></div>;
  const bone = (w, h, radius = 'var(--radius-small)', extra) => <span key={`${w}-${h}`} aria-hidden style={{ display: 'block', width: w, height: h, borderRadius: radius, background: 'var(--skeleton-base)', backgroundImage: 'linear-gradient(100deg, transparent 30%, var(--skeleton-shine) 50%, transparent 70%)', backgroundSize: '200% 100%', animation: 'kl-shimmer 1400ms linear infinite, kl-fade-in var(--duration-quick) ease both', ...extra }}></span>;
  const wrap = { display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', width: width || '100%', ...style };
  if (variant === 'ring') { const s = width || 200; return <div aria-busy="true" aria-label="Loading" style={{ width: s, height: s, ...style }}>{bone(s, s, '50%', { boxSizing: 'border-box', border: '14px solid var(--skeleton-base)', background: 'transparent', backgroundImage: 'none', animation: 'kl-fade-in var(--duration-quick) ease both' })}</div>; }
  if (variant === 'block') return <div aria-busy="true" aria-label="Loading" style={{ width: width || '100%', ...style }}>{bone('100%', height || 96, 'var(--radius-large)')}</div>;
  if (variant === 'row') return (
    <div aria-busy="true" aria-label="Loading" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', minHeight: 56, padding: 'var(--space-2) var(--space-3)', width: width || '100%', boxSizing: 'border-box', ...style }}>
      {bone(36, 36)}
      <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>{bone('55%', 12)}{bone('35%', 10)}</span>
      {bone(44, 16)}
    </div>
  );
  return <div aria-busy="true" aria-label="Loading" style={wrap}>{Array.from({ length: lines }, (_, i) => bone(i === lines - 1 && lines > 1 ? '60%' : '100%', height || 12))}</div>;
}
