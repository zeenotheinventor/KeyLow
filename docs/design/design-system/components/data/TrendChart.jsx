import React from 'react';
import { typeStyle, numeric, Format } from '../core/kl.js';
import { SegmentedControl } from '../forms/SegmentedControl.jsx';

const RANGES = [{ value: 7, label: '1W' }, { value: 30, label: '1M' }, { value: 90, label: '3M' }, { value: 365, label: '1Y' }];

function ema(values, alpha) { const out = []; let t; values.forEach((v, i) => { t = i === 0 ? v : t + alpha * (v - t); out.push(t); }); return out; }
function smoothPath(pts) { if (pts.length < 2) return ''; let d = `M${pts[0][0]},${pts[0][1]}`; for (let i = 1; i < pts.length; i++) { const [x0, y0] = pts[i - 1]; const [x1, y1] = pts[i]; const cx = (x0 + x1) / 2; d += ` C${cx},${y0} ${cx},${y1} ${x1},${y1}`; } return d; }

/** Trend chart. Uses chart tokens only: light axes, small raw-data points, a bold smoothed trend line and a soft confidence band. The line draws in with a fast sweep; changing the range redraws. `data` is [{day, value}] with day 0 = oldest. */
export function TrendChart({ data, unit = 'kg', range = 30, onRangeChange, width = 320, height = 160, alpha = 0.1, bandSd = 0.6, showRange = true, title, style }) {
  const [localRange, setLocalRange] = React.useState(range);
  const r = onRangeChange ? range : localRange;
  const setRange = (v) => { setLocalRange(v); onRangeChange && onRangeChange(v); };
  const slice = data.slice(-r);
  const values = slice.map((d) => d.value);
  const trend = ema(values, alpha);
  const padL = 36, padR = 12, padT = 12, padB = 22;
  const lo = Math.min(...values, ...trend) - bandSd * 1.5, hi = Math.max(...values, ...trend) + bandSd * 1.5;
  const x = (i) => padL + (i / Math.max(1, slice.length - 1)) * (width - padL - padR);
  const y = (v) => padT + (1 - (v - lo) / (hi - lo || 1)) * (height - padT - padB);
  const trendPts = trend.map((v, i) => [x(i), y(v)]);
  const band = `${smoothPath(trend.map((v, i) => [x(i), y(v + bandSd)]))} L${x(trend.length - 1)},${y(trend[trend.length - 1] - bandSd)} ${smoothPath([...trend].map((v, i) => [x(i), y(v - bandSd)]).reverse()).replace(/^M/, 'L')} Z`;
  const ticks = [lo + bandSd * 1.5, (lo + hi) / 2, hi - bandSd * 1.5];
  const last = trend[trend.length - 1];
  const first = trend[0];
  const delta = last - first;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', fontFamily: 'var(--font-sans)', color: 'var(--text-primary)', width, ...style }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>{title && <span style={{ ...typeStyle('caption'), color: 'var(--text-secondary)' }}>{title}</span>}<span style={{ ...typeStyle('numeral-small'), ...numeric }}>{Format.weight(last, unit)}</span></div>
        <span style={{ ...typeStyle('caption'), ...numeric, color: 'var(--text-muted)' }}>{delta > 0 ? '+' : ''}{Format.weight(delta, unit)} trend, est.</span>
      </div>
      <svg key={r} width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Trend over ${r} days, ${Format.weight(last, unit)}`} style={{ display: 'block', overflow: 'visible' }}>
        {ticks.map((t, i) => <g key={i}><line x1={padL} x2={width - padR} y1={y(t)} y2={y(t)} stroke="var(--chart-grid)" strokeWidth="1" /><text x={padL - 8} y={y(t) + 4} textAnchor="end" fill="var(--chart-point)" style={{ ...typeStyle('caption'), ...numeric, fontSize: 11 }}>{t.toFixed(1)}</text></g>)}
        <line x1={padL} x2={width - padR} y1={height - padB} y2={height - padB} stroke="var(--chart-axis)" strokeWidth="1" />
        <path d={band} fill="var(--chart-band)" style={{ animation: 'kl-fade-in var(--duration-chart) ease both' }} />
        {values.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r="2.5" fill="var(--chart-point)" style={{ animation: 'kl-fade-in var(--duration-standard) ease both', animationDelay: `calc(${Math.min(i, 24)} * 12ms)` }} />)}
        <path d={smoothPath(trendPts)} fill="none" stroke="var(--chart-trend)" strokeWidth="2.5" strokeLinecap="round" pathLength="1" strokeDasharray="1" strokeDashoffset="1" style={{ animation: 'kl-draw var(--duration-chart) var(--ease-whip) forwards' }} />
        <circle cx={x(trend.length - 1)} cy={y(last)} r="4" fill="var(--chart-marker)" style={{ animation: 'kl-punch var(--duration-flourish) var(--ease-enter) both', animationDelay: 'var(--duration-chart)' }} />
        <text x={padL} y={height - 6} fill="var(--chart-point)" style={{ ...typeStyle('caption'), fontSize: 11 }}>{slice[0]?.label || `${r} days ago`}</text>
        <text x={width - padR} y={height - 6} textAnchor="end" fill="var(--chart-point)" style={{ ...typeStyle('caption'), fontSize: 11 }}>Today</text>
      </svg>
      {showRange && <SegmentedControl size="sm" label="Range" options={RANGES} value={r} onChange={setRange} />}
    </div>
  );
}
