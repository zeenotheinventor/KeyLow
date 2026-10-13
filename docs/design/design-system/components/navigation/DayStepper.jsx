import React from 'react';
import { typeStyle, focusRing, useInteraction } from '../core/kl.js';
import { Icon } from '../core/Icon.jsx';

function StepButton({ icon, label, onClick, disabled }) {
  const { focus, pressed, hover, handlers } = useInteraction(disabled);
  return <button type="button" aria-label={label} disabled={disabled} onClick={onClick} {...handlers} style={{ width: 'var(--touch-target)', height: 'var(--touch-target)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-medium)', border: '1px solid var(--border)', background: pressed ? 'var(--press-overlay)' : hover ? 'var(--hover-overlay)' : 'var(--surface-raised)', color: 'var(--text-primary)', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.4 : 1, outline: 'none', transform: pressed ? 'scale(var(--press-scale))' : 'none', transition: 'transform var(--duration-instant) var(--ease-spring), background var(--duration-quick) ease', ...focusRing(focus) }}><Icon name={icon} size="md" /></button>;
}

const DAY = 86400000;
function labelFor(date, today) {
  const d = Math.round((startOf(date) - startOf(today)) / DAY);
  if (d === 0) return 'Today';
  if (d === -1) return 'Yesterday';
  if (d === 1) return 'Tomorrow';
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}
const startOf = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** Day stepper: previous / label / next plus a date-picker button. The label cuts in with an angled wipe when the date changes. Stepping forward past today is disabled. */
export function DayStepper({ date, today = new Date(), onChange, onPickDate, style }) {
  const [dir, setDir] = React.useState(1);
  const step = (n) => { setDir(n); onChange && onChange(new Date(date.getTime() + n * DAY)); };
  const isToday = startOf(date) >= startOf(today);
  const label = labelFor(date, today);
  const sub = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontFamily: 'var(--font-sans)', color: 'var(--text-primary)', ...style }}>
      <StepButton icon="ChevronLeft" label="Previous day" onClick={() => step(-1)} />
      <button type="button" onClick={onPickDate} aria-label={`${label}, ${sub}. Choose a date`} style={{ flex: 1, minHeight: 'var(--touch-target)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 0, cursor: 'pointer', color: 'inherit', padding: 0, outline: 'none', overflow: 'hidden' }}>
        <span key={label} style={{ ...typeStyle('h2'), animation: 'kl-wipe-in var(--duration-standard) var(--ease-whip) both', transform: `scaleX(${dir})` }}><span style={{ display: 'inline-block', transform: `scaleX(${dir})` }}>{label}</span></span>
        <span style={{ ...typeStyle('caption'), color: 'var(--text-muted)' }}>{isToday && label === 'Today' ? sub : label === 'Yesterday' ? sub : 'Tap to change'}</span>
      </button>
      <StepButton icon="ChevronRight" label="Next day" onClick={() => step(1)} disabled={isToday} />
      <StepButton icon="Calendar" label="Choose a date" onClick={onPickDate} />
    </div>
  );
}
