import React from 'react';
import { typeStyle, numeric, focusRing } from '../core/kl.js';
import { Icon } from '../core/Icon.jsx';

/** "Day complete" toggle. Marking a day complete is a moment: the row gets the diagonal accent slash and the label punches in (haptic: --haptic-complete). Unmarking is quiet. */
export function DayCompleteToggle({ complete = false, onChange, disabled = false, style }) {
  const [slash, setSlash] = React.useState(0);
  const [focus, setFocus] = React.useState(false);
  const first = React.useRef(true);
  React.useEffect(() => { if (first.current) { first.current = false; return; } if (complete) setSlash((s) => s + 1); }, [complete]);
  return (
    <button type="button" role="switch" aria-checked={complete} disabled={disabled} onClick={() => onChange && onChange(!complete)} onFocus={(e) => setFocus(e.currentTarget.matches(':focus-visible'))} onBlur={() => setFocus(false)}
      style={{ position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', gap: 'var(--space-3)', width: '100%', minHeight: 56, padding: 'var(--space-2) var(--space-4)', boxSizing: 'border-box', background: complete ? 'var(--accent-muted)' : 'var(--surface)', border: `1px solid ${complete ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 'var(--radius-medium)', color: 'var(--text-primary)', fontFamily: 'var(--font-sans)', textAlign: 'left', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1, outline: 'none', transition: 'background var(--duration-quick) ease, border-color var(--duration-quick) ease', ...focusRing(focus), ...style }}>
      <span style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <span key={slash} style={{ ...typeStyle('body-strong'), animation: slash ? 'kl-punch var(--duration-flourish) var(--ease-enter) both' : undefined }}>{complete ? 'Day complete' : 'Mark day complete'}</span>
        <span style={{ ...typeStyle('caption'), color: 'var(--text-muted)' }}>{complete ? 'Counted in your expenditure estimate' : 'Complete days feed the expenditure estimate'}</span>
      </span>
      <span aria-hidden style={{ position: 'relative', width: 44, height: 26, borderRadius: 'var(--radius-pill)', background: complete ? 'var(--accent)' : 'var(--border-strong)', flex: 'none', transition: 'background var(--duration-quick) ease' }}>
        <span style={{ position: 'absolute', top: 3, left: 3, width: 20, height: 20, borderRadius: '50%', background: complete ? 'var(--accent-foreground)' : 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', transform: `translateX(${complete ? 18 : 0}px)`, transition: 'transform var(--duration-standard) var(--ease-spring), background var(--duration-quick) ease' }}>{complete && <Icon name="Check" size="sm" color="var(--accent)" style={{ width: 12, height: 12 }} />}</span>
      </span>
      {slash > 0 && <span key={`s${slash}`} aria-hidden style={{ position: 'absolute', top: '-20%', bottom: '-20%', left: 0, width: '16%', background: 'var(--accent)', opacity: 0, pointerEvents: 'none', animation: 'kl-slash var(--duration-flourish) var(--ease-exit) both' }}></span>}
    </button>
  );
}

/** "n incomplete days this week" chip. Warning tone when n > 0, success tone when the week is complete. Text carries the meaning; colour supports it. */
export function IncompleteDaysChip({ count = 0, onPress, style }) {
  const done = count === 0;
  const Tag = onPress ? 'button' : 'span';
  return (
    <Tag type={onPress ? 'button' : undefined} onClick={onPress} style={{ ...typeStyle('caption'), ...numeric, display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 28, padding: '0 var(--space-3)', borderRadius: 'var(--radius-pill)', background: done ? 'var(--success-muted)' : 'var(--warning-muted)', color: done ? 'var(--success)' : 'var(--warning)', border: 0, cursor: onPress ? 'pointer' : 'default', fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap', ...style }}>
      <Icon name={done ? 'CheckCircle2' : 'CircleDashed'} size="sm" />
      {done ? 'All days complete this week' : `${count} incomplete ${count === 1 ? 'day' : 'days'} this week`}
    </Tag>
  );
}
