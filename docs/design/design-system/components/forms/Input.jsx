import React from 'react';
import { typeStyle, numeric, focusRing } from '../core/kl.js';

function Field({ label, helper, error, disabled, children, id }) {
  return (
    <label htmlFor={id} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', fontFamily: 'var(--font-sans)', opacity: disabled ? 0.5 : 1 }}>
      <span style={{ ...typeStyle('caption'), color: 'var(--text-secondary)' }}>{label}</span>
      {children}
      {(error || helper) && <span role={error ? 'alert' : undefined} style={{ ...typeStyle('caption'), color: error ? 'var(--danger)' : 'var(--text-muted)', animation: 'kl-cut-in var(--duration-quick) var(--ease-enter) both' }}>{error || helper}</span>}
    </label>
  );
}

const boxStyle = (focus, error, disabled) => ({
  display: 'flex', alignItems: 'center', height: 'var(--control-height-md)', padding: '0 var(--space-4)', gap: 'var(--space-2)', background: disabled ? 'var(--surface)' : 'var(--surface-raised)', borderRadius: 'var(--radius-medium)',
  border: `1px solid ${error ? 'var(--danger)' : focus ? 'var(--accent)' : 'var(--border)'}`,
  transition: 'border-color var(--duration-quick) ease, box-shadow var(--duration-quick) ease', ...focusRing(focus),
});
const inputStyle = { ...typeStyle('body'), flex: 1, minWidth: 0, background: 'transparent', border: 0, outline: 'none', color: 'var(--text-primary)', padding: 0 };

export function Input({ label, helper, error, disabled = false, value, defaultValue, onChange, placeholder, type = 'text', id: idProp, ...rest }) {
  const auto = React.useId();
  const id = idProp || auto;
  const [focus, setFocus] = React.useState(false);
  return (
    <Field label={label} helper={helper} error={error} disabled={disabled} id={id}>
      <div style={boxStyle(focus, error, disabled)}>
        <input id={id} type={type} disabled={disabled} value={value} defaultValue={defaultValue} onChange={onChange} placeholder={placeholder} aria-invalid={!!error || undefined} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} style={inputStyle} {...rest} />
      </div>
    </Field>
  );
}

/** Numeric input with a unit suffix (g, kcal, kg, ml). Uses the decimal keyboard on mobile. */
export function NumericInput({ label, helper, error, disabled = false, unit, value, defaultValue, onChange, placeholder = '0', id: idProp, ...rest }) {
  const auto = React.useId();
  const id = idProp || auto;
  const [focus, setFocus] = React.useState(false);
  return (
    <Field label={label} helper={helper} error={error} disabled={disabled} id={id}>
      <div style={boxStyle(focus, error, disabled)}>
        <input id={id} type="text" inputMode="decimal" disabled={disabled} value={value} defaultValue={defaultValue} onChange={onChange} placeholder={placeholder} aria-invalid={!!error || undefined} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} style={{ ...inputStyle, ...numeric, textAlign: 'right' }} {...rest} />
        {unit && <span aria-hidden style={{ ...typeStyle('body'), color: 'var(--text-muted)' }}>{unit}</span>}
      </div>
    </Field>
  );
}
